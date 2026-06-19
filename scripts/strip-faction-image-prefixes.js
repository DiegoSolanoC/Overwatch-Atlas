/**
 * One-time migration: remove legacy numeric sort prefixes from Factions filter
 * assets (e.g. 25Shambali Order.png → Shambali Order.png) and update JSON refs.
 *
 * Run from repo root: node scripts/strip-faction-image-prefixes.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FACTIONS_DIR = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Factions');

/** @param {string} name */
function stripFactionNumericPrefix(name) {
    const m = String(name).match(/^(\d+)\s*(.*)$/s);
    if (m && m[2] != null) {
        const rest = m[2].trim();
        if (rest) return rest;
    }
    return String(name).trim();
}

/** @param {string} dir */
function collectRenameTargets(dir) {
    /** @type {Array<{ from: string, to: string, isDir: boolean }>} */
    const targets = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fromName = entry.name;
        const toName = stripFactionNumericPrefix(fromName);
        if (!toName || toName === fromName) continue;

        targets.push({
            from: path.join(dir, fromName),
            to: path.join(dir, toName),
            isDir: entry.isDirectory(),
        });
    }

    return targets;
}

/** @param {Array<{ from: string, to: string, isDir: boolean }>} targets */
function applyRenames(targets) {
    const dirs = targets.filter((t) => t.isDir);
    const files = targets.filter((t) => !t.isDir);

    for (const t of [...dirs, ...files]) {
        if (fs.existsSync(t.to)) {
            throw new Error(`Rename blocked — target already exists: ${t.to}`);
        }
    }

    for (const t of [...dirs, ...files]) {
        fs.renameSync(t.from, t.to);
        console.log(`  ${path.basename(t.from)} → ${path.basename(t.to)}`);
    }
}

/** @param {string} filePath @param {Record<string, string>} map */
function replaceFactionFilenamesInJsonFile(filePath, map) {
    if (!fs.existsSync(filePath)) return 0;
    let raw = fs.readFileSync(filePath, 'utf8');
    let count = 0;
    for (const [oldName, newName] of Object.entries(map)) {
        const needle = `"factionFilename": "${oldName}"`;
        const repl = `"factionFilename": "${newName}"`;
        const parts = raw.split(needle);
        if (parts.length > 1) {
            count += parts.length - 1;
            raw = parts.join(repl);
        }
    }
    if (count > 0) {
        fs.writeFileSync(filePath, raw);
        console.log(`  ${path.relative(ROOT, filePath)}: ${count} factionFilename update(s)`);
    }
    return count;
}

/** @param {string} filePath @param {Record<string, string>} map */
function updateLegacyFactionAliasValues(filePath, map) {
    let raw = fs.readFileSync(filePath, 'utf8');
    let count = 0;
    for (const [oldName, newName] of Object.entries(map)) {
        const re = new RegExp(`('${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}')`, 'g');
        const next = raw.replace(re, `'${newName.replace(/'/g, "\\'")}'`);
        if (next !== raw) {
            count += (raw.match(re) || []).length;
            raw = next;
        }
    }
    if (count > 0) {
        fs.writeFileSync(filePath, raw);
        console.log(`  ${path.relative(ROOT, filePath)}: ${count} legacy alias value(s)`);
    }
}

function main() {
    console.log('Scanning faction filter assets…');
    const topTargets = collectRenameTargets(FACTIONS_DIR);
    /** @type {Record<string, string>} */
    const filenameMap = {};
    for (const t of topTargets) {
        filenameMap[path.basename(t.from)] = path.basename(t.to);
        if (t.isDir) {
            const nested = collectRenameTargets(t.from);
            applyRenames(nested);
        }
    }

    if (topTargets.length === 0) {
        console.log('No prefixed faction assets found — already migrated?');
    } else {
        console.log(`Renaming ${topTargets.length} top-level item(s)…`);
        applyRenames(topTargets);
    }

    /** @type {Record<string, string>} */
    const manifestKeyMap = {};
    for (const [fromBase, toBase] of Object.entries(filenameMap)) {
        const fromKey = fromBase.replace(/\.png$/i, '');
        const toKey = toBase.replace(/\.png$/i, '');
        manifestKeyMap[fromKey] = toKey;
    }

    console.log('Updating JSON references…');
    replaceFactionFilenamesInJsonFile(path.join(ROOT, 'src', 'data', 'codex', 'codex-labels.json'), manifestKeyMap);
    replaceFactionFilenamesInJsonFile(path.join(ROOT, 'src', 'data', 'story-archive', 'heroes.json'), manifestKeyMap);

    const legacyPath = path.join(
        ROOT,
        'src',
        'features',
        'system-interface',
        'interface-globe-markers',
        'filtering',
        'entityMatchesActiveFilters.js',
    );
    updateLegacyFactionAliasValues(legacyPath, manifestKeyMap);

    console.log('Done. Run `node scripts/generate-manifest.js` to refresh manifest.json.');
}

main();
