/**
 * One-off / batch migration: geographic label + coordinate consistency for timeline-events.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateGeoConsistencyInStoryEvents } from '../src/features/system-interface/interface-left-panel/event-system/data/geoConsistencyMigration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../src/data/event-system/timeline-events.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const changed = migrateGeoConsistencyInStoryEvents(data.events);
fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Migration complete (changed=${changed}, events=${data.events.length})`);
