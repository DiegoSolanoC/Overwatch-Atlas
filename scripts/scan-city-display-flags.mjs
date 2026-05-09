/**
 * One-off / audit: list cityDisplayName values that get no flag (pin only) with current LocationFlagHelpers rules.
 * Run: node scripts/scan-city-display-flags.mjs
 */
import fs from 'fs';
import vm from 'vm';

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../src/features/worldview/data/flagFileByCommonName.js', import.meta.url), 'utf8'), sandbox);
const FLAG_FILE_BY_COMMON = sandbox.window.FLAG_FILE_BY_COMMON;

const ALIASES = {
  usa: 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  uae: 'United Arab Emirates',
  'russian federation': 'Russia',
  'south korea': 'South Korea',
  'north korea': 'North Korea',
  'czech republic': 'Czechia',
  turkiye: 'Turkey',
  kurjikstan: 'Kyrgyzstan',
  'democratic republic of the congo': 'DR Congo',
  oceania: 'New Zealand',
  antartica: 'Antarctica',
};

function normalizeKey(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function scrubCountrySuffix(s) {
  return String(s || '').trim().replace(/[.?]+$/g, '').trim();
}

function trySpecialDisplayFile(locationName) {
  const n = (locationName || '').toLowerCase();
  if (n.indexOf('numbani') >= 0) return 'Numbani.png';
  if (n.indexOf('horizon lunar') >= 0) return 'Horizon Lunar Colony.png';
  if (n.indexOf('red promise colony') >= 0 || n.indexOf('red promise escape ship') >= 0) {
    return 'Red Promise Colony.png';
  }
  if (n.indexOf('atlantic arcology') >= 0) return 'Atlantic Arcology.png';
  if (n.indexOf('baltic sea') >= 0) return 'Sweden.png';
  if (n.indexOf('coral sea') >= 0) return 'New Zealand.png';
  if (n.indexOf('ecopoint antarctica') >= 0 || n.indexOf('ecoopint antartica') >= 0 || n.indexOf('ecopoint antartica') >= 0) {
    return 'Antarctica.png';
  }
  if (n.indexOf('secret omnium') >= 0) return 'Antarctica.png';
  if (n.indexOf('watchpoint gibraltar') >= 0) return 'Gibraltar.png';
  if (n.indexOf('gwishin omnium') >= 0) return 'China.png';
  return null;
}

function resolveCountryToFilename(countryRaw) {
  if (!countryRaw) return null;
  const t = scrubCountrySuffix(String(countryRaw).trim());
  if (!t) return null;
  if (FLAG_FILE_BY_COMMON[t]) return FLAG_FILE_BY_COMMON[t];
  const nk = normalizeKey(t);
  if (ALIASES[nk]) {
    const canon = ALIASES[nk];
    if (FLAG_FILE_BY_COMMON[canon]) return FLAG_FILE_BY_COMMON[canon];
  }
  for (const common of Object.keys(FLAG_FILE_BY_COMMON)) {
    if (normalizeKey(common) === nk) return FLAG_FILE_BY_COMMON[common];
  }
  return null;
}

function extractCountryFromDisplay(locationName) {
  if (!locationName || typeof locationName !== 'string') return null;
  const idx = locationName.lastIndexOf(',');
  if (idx < 0) return null;
  const c = locationName.slice(idx + 1).trim();
  return c || null;
}

const FICTIONAL = {
  numbani: 'Numbani.png',
  moon: 'Moon.png',
  mars: 'Mars.png',
  station: 'Interstellar Journey Space Station.png',
  marsShip: 'Mars.png',
};

function tryFictionalFile(locationName, locationType) {
  const n = (locationName || '').toLowerCase();
  const t = locationType || 'earth';

  if (n.indexOf('numbani') >= 0) return FICTIONAL.numbani;
  if (t === 'marsShip') return FICTIONAL.marsShip;
  if (
    n.indexOf('promice') >= 0 ||
    (n.indexOf('escape ship') >= 0 && (n.indexOf('mars') >= 0 || n.indexOf('promise') >= 0)) ||
    n.indexOf('martian ship') >= 0
  ) {
    return FICTIONAL.marsShip;
  }
  if (n.indexOf('horizon lunar') >= 0 || (n.indexOf('lunar') >= 0 && n.indexOf('colony') >= 0)) {
    return FICTIONAL.moon;
  }
  if (
    t === 'station' ||
    n.indexOf('space station') >= 0 ||
    n.indexOf('(iss)') >= 0 ||
    n.indexOf(' iss') >= 0 ||
    n.indexOf('interstellar journey') >= 0
  ) {
    return FICTIONAL.station;
  }
  if (t === 'moon' || (n.indexOf('moon') >= 0 && n.indexOf('mars') < 0)) return FICTIONAL.moon;
  if (t === 'mars' || n.indexOf('mars:') >= 0 || n.indexOf('mars (') >= 0) return FICTIONAL.mars;
  return null;
}

function wouldGetFlag(locationName, locationType) {
  if (!locationName || typeof locationName !== 'string') return false;
  if (trySpecialDisplayFile(locationName)) return true;
  if (tryFictionalFile(locationName, locationType)) return true;
  const country = extractCountryFromDisplay(locationName);
  if (country && resolveCountryToFilename(country)) return true;
  return false;
}

const eventsPath = new URL('../src/data/events.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const eventList = Array.isArray(data) ? data : data.events || [];

const rows = [];
function collect(e) {
  const base = e.locationType || 'earth';
  if (e.cityDisplayName) rows.push({ name: e.cityDisplayName, loc: base });
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      const lt = v.locationType || base;
      if (v.cityDisplayName) rows.push({ name: v.cityDisplayName, loc: lt });
    }
  }
}
for (const e of eventList) collect(e);

const byName = new Map();
for (const r of rows) {
  if (!byName.has(r.name)) byName.set(r.name, new Set());
  byName.get(r.name).add(r.loc);
}

const failures = [];
for (const [name, locTypes] of byName) {
  let ok = false;
  for (const loc of locTypes) {
    if (wouldGetFlag(name, loc)) {
      ok = true;
      break;
    }
  }
  if (!ok) failures.push({ name, locationTypes: [...locTypes].sort() });
}

failures.sort((a, b) => a.name.localeCompare(b.name));

console.log(JSON.stringify(failures, null, 2));
console.error(`\nUnique cityDisplayName values with no flag: ${failures.length} (of ${byName.size} unique names)`);