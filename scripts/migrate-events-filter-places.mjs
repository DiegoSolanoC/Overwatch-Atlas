/**
 * One-shot (or repeatable): story events → grouped hero/faction/NPC filter places only; strip flat arrays.
 * Usage: node scripts/migrate-events-filter-places.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src', 'data', 'events.json');

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const syncUrl = pathToFileURL(path.join(root, 'src', 'utils', 'StoryFilterPlacesSync.js')).href;
const { migrateAllStoryEventsFilterPlacesToGroupedInPlace } = await import(syncUrl);

if (!Array.isArray(raw.events)) {
    console.error('events.json: missing events array');
    process.exit(1);
}
migrateAllStoryEventsFilterPlacesToGroupedInPlace(raw.events);
fs.writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log('Updated', jsonPath, '—', raw.events.length, 'root events');
