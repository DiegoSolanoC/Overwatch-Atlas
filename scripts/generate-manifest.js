// Regenerate src/data/platform/manifest.json from assets (heroes / factions PNGs, music audio).
// Run from repo root: node scripts/generate-manifest.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const heroesFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Heroes');
const factionsFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Factions');
const npcsFolder = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'NPCs');
const musicFolder = path.join(ROOT, 'src', 'assets', 'audio', 'music');
const biosFolder = path.join(ROOT, 'src', 'assets', 'images', 'Bios');
const phrasesFolder = path.join(ROOT, 'src', 'assets', 'audio', 'Phrases');
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

/** Faction folder name = manifest `filename`; display label matches folder name. */
function factionEntryFromFolderName(folderName) {
    const name = String(folderName).trim();
    return { filename: name, displayName: name };
}

/** Default first, then A–Z (basename without .png). */
function sortFactionLookNames(fileNames) {
    const seen = new Set();
    const unique = [];
    for (const file of fileNames) {
        const base = String(file).replace(/\.png$/i, '').trim();
        if (!base || seen.has(base)) continue;
        seen.add(base);
        unique.push(base);
    }
    const norm = (s) => s.toLowerCase();
    const defaults = unique.filter((x) => norm(x) === 'default');
    const rest = unique.filter((x) => norm(x) !== 'default');
    rest.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    return [...defaults, ...rest];
}

function getFactionsFromFolder(folderPath) {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        const factions = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const factionDir = path.join(folderPath, entry.name);
            let files;
            try {
                files = fs.readdirSync(factionDir);
            } catch {
                continue;
            }
            const hasPng = files.some((f) => f.toLowerCase().endsWith('.png'));
            if (!hasPng) continue;
            factions.push(factionEntryFromFolderName(entry.name));
        }
        return factions;
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

function getFactionBiosFromFolder(folderPath) {
    const out = {};
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const factionId = entry.name;
            const factionDir = path.join(folderPath, entry.name);
            let files;
            try {
                files = fs.readdirSync(factionDir);
            } catch {
                continue;
            }
            const pngs = files.filter((f) => f.toLowerCase().endsWith('.png'));
            if (pngs.length === 0) continue;
            out[factionId] = sortFactionLookNames(pngs);
        }
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
    }
    return out;
}

/** Heroic first, Classic second, remaining looks A–Z (basename without .png). */
function sortHeroBioLookNames(fileNames) {
    const seen = new Set();
    const unique = [];
    for (const file of fileNames) {
        const base = String(file).replace(/\.png$/i, '').trim();
        if (!base || seen.has(base)) continue;
        seen.add(base);
        unique.push(base);
    }
    const norm = (s) => s.toLowerCase();
    const heroic = unique.filter((x) => norm(x) === 'heroic');
    const classic = unique.filter((x) => norm(x) === 'classic');
    const rest = unique.filter((x) => norm(x) !== 'heroic' && norm(x) !== 'classic');
    rest.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    return [...heroic, ...classic, ...rest];
}

function getHeroPhrasesFromFolder(folderPath) {
    const out = {};
    const audioExt = /\.(mp3|wav|ogg|m4a|webm)$/i;
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const heroId = entry.name;
            const heroDir = path.join(folderPath, heroId);
            /** @type {string[]} */
            const clips = [];
            try {
                for (const name of fs.readdirSync(heroDir)) {
                    const full = path.join(heroDir, name);
                    let st;
                    try {
                        st = fs.statSync(full);
                    } catch {
                        continue;
                    }
                    if (st.isFile() && audioExt.test(name)) {
                        clips.push(name);
                        continue;
                    }
                    // Ultimate voicelines live in Phrases/<hero>/Ultimate/ (weighted 2× in gallery).
                    // Hamster/ holds Wrecking Ball prefix takes — not part of the random pool.
                    if (st.isDirectory() && name === 'Ultimate') {
                        let ultFiles = [];
                        try {
                            ultFiles = fs.readdirSync(full);
                        } catch {
                            ultFiles = [];
                        }
                        for (const ult of ultFiles) {
                            if (audioExt.test(ult)) clips.push(`Ultimate/${ult}`);
                        }
                    }
                }
            } catch {
                continue;
            }
            clips.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
            if (clips.length === 0) continue;
            out[heroId] = clips;
        }
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
    }
    return out;
}

function getHeroBiosFromFolder(folderPath) {
    const out = {};
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const heroId = entry.name;
            const heroDir = path.join(folderPath, heroId);
            let files;
            try {
                files = fs.readdirSync(heroDir);
            } catch {
                continue;
            }
            const pngs = files.filter((f) => f.toLowerCase().endsWith('.png'));
            if (pngs.length === 0) continue;
            out[heroId] = sortHeroBioLookNames(pngs);
        }
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
    }
    return out;
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
const heroBios = getHeroBiosFromFolder(biosFolder);
const factionBios = getFactionBiosFromFolder(factionsFolder);
const heroPhrases = getHeroPhrasesFromFolder(phrasesFolder);

const manifest = {
    heroes,
    factions: factions.map((f) => ({
        filename: f.filename,
        displayName: f.displayName
    })),
    npcs,
    music,
    heroBios,
    factionBios,
    heroPhrases
};

const manifestPath = path.join(dataDir, 'platform', 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`${manifestPath} written from disk assets (heroes/factions/npcs ordered like story-archive JSON).`);
console.log(
    `  heroes: ${heroes.length}, factions: ${factions.length}, npcs: ${npcs.length}, music: ${music.length}, heroBios: ${Object.keys(heroBios).length}, factionBios: ${Object.keys(factionBios).length}, heroPhrases: ${Object.keys(heroPhrases).length}`
);
