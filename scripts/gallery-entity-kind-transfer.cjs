/**
 * Promote NPC → Hero or demote Hero → NPC (filter chip + archive rows + Codex kinds).
 * Does NOT rewrite story timeline relevancies — those stay mismatched so the UI can
 * flag them with the orange wrong-category glow until manually fixed.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

/**
 * @param {string} a
 * @param {string} b
 */
function namesEqual(a, b) {
    const na = String(a || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    const nb = String(b || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    return Boolean(na && nb && na === nb);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    const body = `${JSON.stringify(data, null, 2)}\n`;
    const tmp = `${filePath}.tmp`;
    try {
        fs.writeFileSync(tmp, body, 'utf8');
        fs.renameSync(tmp, filePath);
    } catch (err) {
        try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch (_) { /* ignore */ }
        /* OneDrive / Windows locks often block atomic rename — fall back. */
        fs.writeFileSync(filePath, body, 'utf8');
        if (err && err.code !== 'EPERM' && err.code !== 'EACCES') {
            /* still wrote; surface unexpected rename errors only in steps later */
        }
    }
}

/**
 * @param {string} from
 * @param {string} to
 */
function moveFileIfExists(from, to) {
    if (!fs.existsSync(from)) return false;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(to)) fs.unlinkSync(to);
    fs.renameSync(from, to);
    return true;
}

/**
 * @param {object[]} list
 * @param {string} name
 */
function findIndexByName(list, name) {
    return list.findIndex((row) => namesEqual(row?.name, name));
}

/**
 * @param {object} row
 * @param {string} name
 */
function toHeroRow(row, name) {
    const next = { ...(row && typeof row === 'object' ? row : {}) };
    next.name = name;
    if (next.description == null) next.description = '';
    if (!Array.isArray(next.relevantLocations)) next.relevantLocations = [];
    if (!Array.isArray(next.connections)) next.connections = [];
    delete next.npcCategory;
    /* Fourth filter band: no Tank/Damage/Support role until assigned. */
    next.heroRole = 'Unassigned';
    next.heroSubRole = '';
    return next;
}

/**
 * @param {object} row
 * @param {string} name
 */
function toNpcRow(row, name) {
    const next = { ...(row && typeof row === 'object' ? row : {}) };
    next.name = name;
    if (next.description == null) next.description = '';
    if (!Array.isArray(next.relevantLocations)) next.relevantLocations = [];
    if (!Array.isArray(next.connections)) next.connections = [];
    delete next.heroRole;
    delete next.heroSubRole;
    delete next.birthday;
    next.npcCategory = 'Unassigned';
    return next;
}

/** Keep in sync with CodexNodePortraitMetrics defaults (heroes larger than NPCs). */
const CODEX_DEFAULT_SCALE_HERO = 2.5;
const CODEX_DEFAULT_SCALE_NPC = 1.5;

/**
 * @param {object} codex
 * @param {string} name
 * @param {'promote'|'demote'} direction
 */
function remapCodexKinds(codex, name, direction) {
    const nodes = Array.isArray(codex?.nodes) ? codex.nodes : [];
    let nodeHits = 0;
    for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        if (direction === 'promote') {
            const isNpc = node.kind === 'npc' && namesEqual(node.npcName, name);
            const isHero = node.kind === 'hero' && namesEqual(node.heroName, name);
            if (!isNpc && !isHero) continue;
            node.kind = 'hero';
            node.heroName = name;
            delete node.npcName;
            node.scale = CODEX_DEFAULT_SCALE_HERO;
            nodeHits += 1;
        } else {
            const isHero = node.kind === 'hero' && namesEqual(node.heroName, name);
            const isNpc = node.kind === 'npc' && namesEqual(node.npcName, name);
            if (!isHero && !isNpc) continue;
            node.kind = 'npc';
            node.npcName = name;
            delete node.heroName;
            node.scale = CODEX_DEFAULT_SCALE_NPC;
            nodeHits += 1;
        }
    }

    const connections = Array.isArray(codex?.connections) ? codex.connections : [];
    let connHits = 0;
    for (const conn of connections) {
        if (!conn || typeof conn !== 'object') continue;
        const touch =
            namesEqual(conn.name, name)
            || namesEqual(conn.linkedName, name)
            || namesEqual(conn.subjectName, name);
        if (!touch) continue;
        if (direction === 'promote' && conn.kind === 'npc') {
            conn.kind = 'hero';
            connHits += 1;
        } else if (direction === 'demote' && conn.kind === 'hero') {
            conn.kind = 'npc';
            connHits += 1;
        }
    }

    return { nodeHits, connHits };
}

/**
 * @param {{ repoRoot: string, name: string, direction: 'promote'|'demote' }} opts
 */
function transferGalleryEntityKind(opts) {
    const repoRoot = opts.repoRoot;
    const name = String(opts.name || '').trim();
    const direction = opts.direction === 'demote' ? 'demote' : 'promote';
    if (!name) {
        return { ok: false, error: 'Missing entity name.' };
    }

    const filterNpc = path.join(repoRoot, 'src/assets/images/Filters/NPCs', `${name}.png`);
    const filterHero = path.join(repoRoot, 'src/assets/images/Filters/Heroes', `${name}.png`);
    const heroesPath = absFromPublic(FILES.storyArchive.heroes);
    const npcsPath = absFromPublic(FILES.storyArchive.npcs);
    const codexPath = path.join(repoRoot, 'src/data/codex/codex-labels.json');

    const heroesDoc = readJson(heroesPath);
    const npcsDoc = readJson(npcsPath);
    const heroList = Array.isArray(heroesDoc.events) ? heroesDoc.events : [];
    const npcList = Array.isArray(npcsDoc.events) ? npcsDoc.events : [];

    const heroIdx = findIndexByName(heroList, name);
    const npcIdx = findIndexByName(npcList, name);

    /** @type {string[]} */
    const steps = [];

    if (direction === 'promote') {
        if (npcIdx < 0 && heroIdx < 0) {
            return { ok: false, error: `No archive row found for ${name}.` };
        }
        const alreadyHero = heroIdx >= 0 && npcIdx < 0;
        if (!alreadyHero) {
            const src = npcIdx >= 0 ? npcList[npcIdx] : heroList[heroIdx];
            if (npcIdx >= 0) {
                npcList.splice(npcIdx, 1);
                steps.push('removed npc archive row');
            }
            const stillHero = findIndexByName(heroList, name);
            if (stillHero >= 0) heroList.splice(stillHero, 1);
            heroList.push(toHeroRow(src, name));
            steps.push('wrote hero archive row');
        } else {
            steps.push('archive already hero — healing codex/chip');
        }
        if (moveFileIfExists(filterNpc, filterHero)) {
            steps.push('moved filter chip NPCs → Heroes');
        } else if (fs.existsSync(filterHero)) {
            steps.push('filter chip already in Heroes');
        } else {
            return { ok: false, error: `Missing filter image for ${name} in NPCs or Heroes.` };
        }
    } else {
        if (heroIdx < 0 && npcIdx < 0) {
            return { ok: false, error: `No archive row found for ${name}.` };
        }
        const alreadyNpc = npcIdx >= 0 && heroIdx < 0;
        if (!alreadyNpc) {
            const src = heroIdx >= 0 ? heroList[heroIdx] : npcList[npcIdx];
            if (heroIdx >= 0) {
                heroList.splice(heroIdx, 1);
                steps.push('removed hero archive row');
            }
            const stillNpc = findIndexByName(npcList, name);
            if (stillNpc >= 0) npcList.splice(stillNpc, 1);
            npcList.push(toNpcRow(src, name));
            steps.push('wrote npc archive row');
        } else {
            steps.push('archive already npc — healing codex/chip');
        }
        if (moveFileIfExists(filterHero, filterNpc)) {
            steps.push('moved filter chip Heroes → NPCs');
        } else if (fs.existsSync(filterNpc)) {
            steps.push('filter chip already in NPCs');
        } else {
            return { ok: false, error: `Missing filter image for ${name} in Heroes or NPCs.` };
        }
    }

    writeJson(heroesPath, { events: heroList });
    writeJson(npcsPath, { events: npcList });
    steps.push('wrote story-archive heroes/npcs');

    if (fs.existsSync(codexPath)) {
        const codex = readJson(codexPath);
        const { nodeHits, connHits } = remapCodexKinds(codex, name, direction);
        writeJson(codexPath, codex);
        steps.push(`codex nodes ${nodeHits}, connection kinds ${connHits}`);
    }

    const gen = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/generate-manifest.js')], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    if (gen.status !== 0) {
        steps.push(`manifest regenerate warning: ${gen.stderr || gen.stdout || gen.status}`);
    } else {
        steps.push('regenerated platform manifest');
    }

    return {
        ok: true,
        name,
        direction,
        kind: direction === 'promote' ? 'heroes' : 'npcs',
        steps,
        heroes: heroList,
        npcs: npcList,
    };
}

module.exports = {
    transferGalleryEntityKind,
    namesEqual,
};
