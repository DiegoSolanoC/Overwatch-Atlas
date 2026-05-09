/**
 * Prepend primary-location row to every story event's secondaryCountryPlaces (same rules as LocationFlagHelpers migration).
 * Run from repo root: node scripts/ensure-story-primary-secondary-place.mjs
 */
import fs from 'fs';
import vm from 'vm';

const rootDir = new URL('../', import.meta.url);
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../src/features/worldview/data/flagFileByCommonName.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(
    fs.readFileSync(new URL('../src/features/system-interface/utils/LocationFlagHelpers.js', import.meta.url), 'utf8'),
    sandbox
);

const LFH = sandbox.window.LocationFlagHelpers;
if (!LFH?.migrateAllStoryEventsSecondaryPlaces) {
  throw new Error('LocationFlagHelpers migration not available');
}

const eventsPath = new URL('../src/data/events.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const events = Array.isArray(data) ? data : data.events;
if (!Array.isArray(events)) {
  throw new Error('events.json: expected top-level array or { events: [] }');
}

LFH.migrateAllStoryEventsSecondaryPlaces(events);
fs.writeFileSync(eventsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated secondaryCountryPlaces (primary row first) for', events.length, 'events');
