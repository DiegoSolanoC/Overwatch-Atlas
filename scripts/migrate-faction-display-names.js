/**
 * Rewrite data/events.json faction entries to manifest displayName where possible.
 * Run from repo root: node scripts/migrate-faction-display-names.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/events.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'manifest.json'), 'utf8'));

function norm(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    if (/^\d+$/.test(t)) return t.toLowerCase();
    const r = t.replace(/^\d+/, '').trim();
    return ((r || t).replace(/\s+/g, ' ').trim()).toLowerCase();
}

const byNorm = new Map();
for (const f of manifest.factions || []) {
    byNorm.set(norm(f.filename), f.displayName);
    byNorm.set(norm(f.displayName), f.displayName);
}

function migrateFaction(val) {
    const n = norm(val);
    if (!n) return val;
    if (byNorm.has(n)) return byNorm.get(n);
    const bare = String(val).replace(/^\d+/, '').trim();
    return bare || val;
}

function walk(ev) {
    if (ev.factions && Array.isArray(ev.factions)) {
        ev.factions = ev.factions.map(migrateFaction);
    }
    if (ev.variants && Array.isArray(ev.variants)) {
        ev.variants.forEach(walk);
    }
}

(data.events || []).forEach(walk);
fs.writeFileSync(path.join(root, 'src/data/events.json'), JSON.stringify(data, null, 2));
console.log('events.json factions updated to display names where matched manifest.');
