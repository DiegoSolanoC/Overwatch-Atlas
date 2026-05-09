/**
 * One-off migration: rename faction PNGs (numeric prefix unchanged), regenerate manifest,
 * rewrite event/variant factions[] to canonical display names.
 *
 * Run from repo root: node scripts/migrate-faction-names-2026.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FACTIONS_DIR = path.join(__dirname, '..', 'src', 'assets', 'images', 'Filters', 'factions');
const EVENTS_PATH = path.join(__dirname, '..', 'src', 'data', 'events.json');
const ROOT = path.join(__dirname, '..');

const RENAMES = [
    ['04Omnica.png', '04Omnica Corporation.png'],
    ['05Vishkar.png', '05Vishkar Corporation.png'],
    ['07Lucheng.png', '07Lucheng Interstellar.png'],
    ['08Ironclad.png', '08Ironclad Guild.png'],
    ['09Crusaders.png', '09Crusader Initiative.png'],
    ['11Volskaya.png', '11Volskaya Industries.png'],
    ['12Crisis.png', '12The Anubis Omnic Crisis.png'],
    ['13Lumerico.png', '13Lumérico Incorporated.png'],
    ['14Deadlock.png', '14Deadlock Rebels.png'],
    ['16Junkers.png', '16Junker Monarchy.png'],
    ['19Wayfinders.png', '19Wayfinder Society.png'],
    ['21Shimada.png', '21Shimada Clan.png'],
    ['22Hashimoto.png', '22Hashimoto Clan.png'],
    ['23Conspiracy.png', '23The Chernobog Conspiracy.png'],
    ['24Oasis.png', '24Oasis Ministries.png'],
    ['27Collective.png', '27The Martins Collective.png'],
    ['29Phreaks.png', '29The Phreaks.png'],
    ['30MEKA.png', '30M.E.K.A Squad.png'],
    ['32Yokai.png', '32Yokai Gang.png'],
];

/** Every historical token → canonical manifest displayName (single form in events.json). */
const TO_DISPLAY = {
    Omnica: 'Omnica Corporation',
    '04Omnica': 'Omnica Corporation',
    '05Omnica': 'Omnica Corporation',
    Vishkar: 'Vishkar Corporation',
    '05Vishkar': 'Vishkar Corporation',
    Lucheng: 'Lucheng Interstellar',
    '07Lucheng': 'Lucheng Interstellar',
    '09Lucheng': 'Lucheng Interstellar',
    Ironclad: 'Ironclad Guild',
    '08Ironclad': 'Ironclad Guild',
    '10Ironclad': 'Ironclad Guild',
    Crusaders: 'Crusader Initiative',
    '09Crusaders': 'Crusader Initiative',
    Volskaya: 'Volskaya Industries',
    '11Volskaya': 'Volskaya Industries',
    Crisis: 'The Anubis Omnic Crisis',
    '12Crisis': 'The Anubis Omnic Crisis',
    '06Crisis': 'The Anubis Omnic Crisis',
    Lumerico: 'Lumérico Incorporated',
    '13Lumerico': 'Lumérico Incorporated',
    Deadlock: 'Deadlock Rebels',
    '14Deadlock': 'Deadlock Rebels',
    Junkers: 'Junker Monarchy',
    '16Junkers': 'Junker Monarchy',
    '08Junkers': 'Junker Monarchy',
    Wayfinders: 'Wayfinder Society',
    '19Wayfinders': 'Wayfinder Society',
    '20Wayfinders': 'Wayfinder Society',
    Shimada: 'Shimada Clan',
    '21Shimada': 'Shimada Clan',
    '22Shimada': 'Shimada Clan',
    Hashimoto: 'Hashimoto Clan',
    '22Hashimoto': 'Hashimoto Clan',
    '23Hashimoto': 'Hashimoto Clan',
    Conspiracy: 'The Chernobog Conspiracy',
    '23Conspiracy': 'The Chernobog Conspiracy',
    '24Conspiracy': 'The Chernobog Conspiracy',
    Oasis: 'Oasis Ministries',
    '24Oasis': 'Oasis Ministries',
    '25Oasis': 'Oasis Ministries',
    'Shambali Order': 'Shambali Order',
    '25Shambali Order': 'Shambali Order',
    '26Shambali': 'Shambali Order',
    '25Shambali': 'Shambali Order',
    Shambali: 'Shambali Order',
    Collective: 'The Martins Collective',
    '27Collective': 'The Martins Collective',
    '28Collective': 'The Martins Collective',
    Phreaks: 'The Phreaks',
    '29Phreaks': 'The Phreaks',
    '30Phreaks': 'The Phreaks',
    MEKA: 'M.E.K.A Squad',
    '30MEKA': 'M.E.K.A Squad',
    '31MEKA': 'M.E.K.A Squad',
    Yokai: 'Yokai Gang',
    '32Yokai': 'Yokai Gang',
    '33Yokai': 'Yokai Gang',
    'Helix Securities': 'Helix Securities',
    '31Helix Securities': 'Helix Securities',
};

function mergeManifestIntoToDisplay() {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'manifest.json'), 'utf8'));
    for (const f of m.factions || []) {
        if (f?.filename && f?.displayName) {
            TO_DISPLAY[f.filename] = f.displayName;
        }
    }
}

function renamePngs() {
    for (const [from, to] of RENAMES) {
        const a = path.join(FACTIONS_DIR, from);
        const dest = path.join(FACTIONS_DIR, to);
        if (!fs.existsSync(a)) {
            if (fs.existsSync(dest)) {
                continue; /* already migrated */
            }
            console.warn('skip rename src missing:', from);
            continue;
        }
        fs.renameSync(a, path.join(FACTIONS_DIR, '__tmp__' + to));
    }
    for (const [, to] of RENAMES) {
        const t = path.join(FACTIONS_DIR, '__tmp__' + to);
        if (fs.existsSync(t)) {
            fs.renameSync(t, path.join(FACTIONS_DIR, to));
        }
    }
    console.log('Faction PNG renames done.');
}

function migrateFactions(obj) {
    if (obj == null) return;
    if (Array.isArray(obj.factions) && obj.factions.length) {
        const seen = new Set();
        const out = [];
        for (const f of obj.factions) {
            const s = f != null ? String(f).trim() : '';
            if (!s) continue;
            if (s === 'Numbani' || s === '19Numbani') continue;
            let next = TO_DISPLAY[s] || TO_DISPLAY[s.replace(/\s+/g, ' ')] || s;
            if (s === '18Numbani' || next === '18Numbani') next = "Max's Vault";
            if (!seen.has(next)) {
                seen.add(next);
                out.push(next);
            }
        }
        obj.factions = out;
    }
    if (Array.isArray(obj.variants)) {
        obj.variants.forEach(migrateFactions);
    }
}

function main() {
    renamePngs();
    execFileSync(process.execPath, [path.join('scripts', 'generate-manifest.js')], { cwd: ROOT, stdio: 'inherit' });
    mergeManifestIntoToDisplay();

    const raw = fs.readFileSync(EVENTS_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.events)) {
        throw new Error('events.json: missing events array');
    }
    data.events.forEach(migrateFactions);
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('events.json factions migrated. events:', data.events.length);
}

main();
