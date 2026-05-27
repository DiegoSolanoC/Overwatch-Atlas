// Regenerate src/data/platform/manifest.json from assets (heroes / factions PNGs, music audio).
// Run from repo root: node scripts/generate-manifest.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const heroesFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Heroes');
const factionsFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Factions');
const npcsFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'NPCs');
const musicFolder = path.join(ROOT, 'src', 'assets', 'audio', 'music');
const dataDir = path.join(ROOT, 'src', 'data');

/**
 * Story-archive order for filters (keep aligned with src/features/system-interface/filters/manifest/storyArchiveFilterOrder.js).
 */
function readStoryArchiveNames(jsonPath) {
    try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const j = JSON.parse(raw);
        if (!j.events || !Array.isArray(j.events)) return [];
        return j.events
            .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
            .filter(Boolean);
    } catch {
        return [];
    }
}

function orderHeroOrNpcIdsByArchive(manifestItems, archiveNames) {
    if (!Array.isArray(manifestItems) || manifestItems.length === 0) return manifestItems || [];
    const set = new Set(manifestItems.map((x) => String(x)));
    if (!Array.isArray(archiveNames) || archiveNames.length === 0) {
        return [...manifestItems].sort((a, b) =>
            String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
        );
    }
    const seen = new Set();
    const out = [];
    for (const n of archiveNames) {
        if (!set.has(n) || seen.has(n)) continue;
        out.push(n);
        seen.add(n);
    }
    const tail = manifestItems.filter((x) => !seen.has(x));
    tail.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
    return out.concat(tail);
}

function orderFactionsByArchive(manifestFactions, archiveNames) {
    if (!Array.isArray(manifestFactions) || manifestFactions.length === 0) return manifestFactions || [];
    if (!Array.isArray(archiveNames) || archiveNames.length === 0) {
        return [...manifestFactions].sort((a, b) =>
            String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                sensitivity: 'base',
                numeric: true
            })
        );
    }
    const resolveFaction = (archiveName) => {
        const key = String(archiveName).trim();
        if (!key) return null;
        let f = manifestFactions.find(
            (x) => String(x.displayName || '').trim() === key || String(x.filename || '').trim() === key
        );
        if (!f) {
            const kl = key.toLowerCase();
            f = manifestFactions.find(
                (x) =>
                    String(x.displayName || '')
                        .trim()
                        .toLowerCase() === kl ||
                    String(x.filename || '')
                        .trim()
                        .toLowerCase() === kl
            );
        }
        return f || null;
    };
    const seen = new Set();
    const out = [];
    for (const name of archiveNames) {
        const f = resolveFaction(name);
        const fn = f && f.filename != null ? String(f.filename) : '';
        if (f && fn && !seen.has(fn)) {
            out.push(f);
            seen.add(fn);
        }
    }
    const tail = manifestFactions.filter((f) => {
        const fn = f && f.filename != null ? String(f.filename) : '';
        return fn && !seen.has(fn);
    });
    tail.sort((a, b) =>
        String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
            sensitivity: 'base',
            numeric: true
        })
    );
    return out.concat(tail);
}

function getHeroesFromFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        return files
            .filter((file) => file.toLowerCase().endsWith('.png'))
            .map((file) => file.replace(/\.png$/i, ''));
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

/** PNG basename keeps optional numeric prefix for file naming; labels use the rest (e.g. 01Blackwatch → Blackwatch). */
function factionDisplayNameFromBasename(base) {
    const m = String(base).match(/^(\d+)(.*)$/);
    if (m && m[2] != null) {
        const rest = m[2].trim();
        if (rest) return rest;
    }
    return base;
}

function getFactionsFromFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        return files
            .filter((file) => file.toLowerCase().endsWith('.png'))
            .map((file) => {
                const filename = file.replace(/\.png$/i, '');
                return {
                    filename,
                    displayName: factionDisplayNameFromBasename(filename)
                };
            });
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

function getMusicFiles(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        const musicFiles = files
            .filter((file) => {
                const lower = file.toLowerCase();
                return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg');
            })
            .map((file) => ({
                filename: file,
                name: file.replace(/\.(mp3|wav|ogg)$/i, '')
            }));

        return musicFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

let heroes = getHeroesFromFolder(heroesFolder);
let factions = getFactionsFromFolder(factionsFolder);
let npcs = getHeroesFromFolder(npcsFolder);

heroes = orderHeroOrNpcIdsByArchive(heroes, readStoryArchiveNames(path.join(dataDir, 'story-archive', 'heroes.json')));
npcs = orderHeroOrNpcIdsByArchive(npcs, readStoryArchiveNames(path.join(dataDir, 'story-archive', 'npcs.json')));
factions = orderFactionsByArchive(factions, readStoryArchiveNames(path.join(dataDir, 'story-archive', 'factions.json')));

const music = getMusicFiles(musicFolder);

const manifest = {
    heroes,
    factions: factions.map((f) => ({
        filename: f.filename,
        displayName: f.displayName
    })),
    npcs,
    music
};

const manifestPath = path.join(dataDir, 'platform', 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`${manifestPath} written from disk assets (heroes/factions/npcs ordered like story-archive JSON).`);
console.log(`  heroes: ${heroes.length}, factions: ${factions.length}, npcs: ${npcs.length}, music: ${music.length}`);
