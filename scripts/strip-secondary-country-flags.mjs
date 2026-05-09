/**
 * Remove persisted `secondaryCountryFlags` from story events (derived from `secondaryCountryPlaces`).
 * node scripts/strip-secondary-country-flags.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src', 'data', 'events.json');

function stripNode(n) {
    if (!n || typeof n !== 'object') return;
    delete n.secondaryCountryFlags;
}

function walkEvent(ev) {
    stripNode(ev);
    if (Array.isArray(ev.variants)) {
        for (let i = 0; i < ev.variants.length; i += 1) {
            stripNode(ev.variants[i]);
        }
    }
}

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(raw.events)) {
    console.error('missing events array');
    process.exit(1);
}
for (let i = 0; i < raw.events.length; i += 1) {
    walkEvent(raw.events[i]);
}
fs.writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log('Stripped secondaryCountryFlags from', raw.events.length, 'events in', jsonPath);
