/**
 * Scan timeline-events.json for locations that would render without a flag.
 * Ports FlagFileResolver + secondaryCountryFlags + slideRelevantLocations
 * resolution logic as closely as possible for Node (no DOM/window).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const timelinePath = path.join(ROOT, 'src/data/event-system/timeline-events.json');
const flagMapPath = path.join(
  ROOT,
  'src/features/world/worldview-shared-assets/data/flagFileByCommonName.js',
);

function loadFlagMap() {
  const src = fs.readFileSync(flagMapPath, 'utf8');
  const m = src.match(/window\.FLAG_FILE_BY_COMMON\s*=\s*(\{[\s\S]*?\n\s*\})\s*;/);
  if (!m) throw new Error('Could not parse FLAG_FILE_BY_COMMON');
  return JSON.parse(m[1]);
}

const FLAG_FILE_BY_COMMON = loadFlagMap();

const FICTIONAL = {
  numbani: 'Numbani.png',
  moon: 'Horizon Lunar Colony.png',
  horizonLunarColony: 'Horizon Lunar Colony.png',
  redPromiseColony: 'Red Promise Colony.png',
  mars: 'Mars.png',
  station: 'Interstellar Journey Space Station.png',
  stationFallback: 'Space Station.png',
  marsShip: 'Mars.png',
};

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
  return String(s || '')
    .trim()
    .replace(/[.?]+$/g, '')
    .trim();
}

function stripTrailingCommaSep(s) {
  return String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .replace(/,+\s*$/g, '')
    .trim();
}

function resolveCountryToFilename(countryRaw) {
  const map = FLAG_FILE_BY_COMMON;
  if (!map || !countryRaw) return null;
  const t = scrubCountrySuffix(String(countryRaw).trim());
  if (!t) return null;
  if (map[t]) return map[t];
  const nk = normalizeKey(t);
  if (ALIASES[nk]) {
    const canon = ALIASES[nk];
    if (map[canon]) return map[canon];
  }
  for (const common of Object.keys(map)) {
    if (normalizeKey(common) === nk) return map[common];
  }
  return null;
}

function trySpecialDisplayFile(locationName) {
  const n = (locationName || '').toLowerCase();
  if (n.indexOf('numbani') >= 0) return FICTIONAL.numbani;
  if (n.indexOf('horizon lunar') >= 0) return FICTIONAL.horizonLunarColony;
  if (n.indexOf('red promise colony') >= 0 || n.indexOf('red promise escape ship') >= 0) {
    return FICTIONAL.redPromiseColony;
  }
  if (n.indexOf('atlantic arcology') >= 0) return 'Atlantic Arcology.png';
  if (n.indexOf('baltic sea') >= 0) return 'Sweden.png';
  if (n.indexOf('coral sea') >= 0) return 'New Zealand.png';
  if (
    n.indexOf('ecopoint antarctica') >= 0 ||
    n.indexOf('ecoopint antartica') >= 0 ||
    n.indexOf('ecopoint antartica') >= 0
  ) {
    return 'Antarctica.png';
  }
  if (n.indexOf('secret omnium') >= 0) return 'Antarctica.png';
  if (n.indexOf('watchpoint gibraltar') >= 0) return 'Gibraltar.png';
  if (n.indexOf('gwishin omnium') >= 0) return 'China.png';
  return null;
}

function extractCountryFromDisplay(locationName) {
  if (!locationName || typeof locationName !== 'string') return null;
  const s = stripTrailingCommaSep(locationName);
  if (!s) return null;
  const idx = s.lastIndexOf(',');
  if (idx < 0) return null;
  const c = s.slice(idx + 1).trim();
  return c || null;
}

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
  if (n.indexOf('horizon lunar') >= 0) return FICTIONAL.horizonLunarColony;
  if (n.indexOf('lunar') >= 0 && n.indexOf('colony') >= 0) return FICTIONAL.moon;
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

function getResolvedFlagFilename(locationName, locationType) {
  const loc = stripTrailingCommaSep(locationName);
  if (!loc) return null;
  const special = trySpecialDisplayFile(loc);
  if (special) return special;
  const country = extractCountryFromDisplay(loc);
  if (country) {
    const fn = resolveCountryToFilename(country);
    if (fn) return fn;
  }
  const fic = tryFictionalFile(loc, locationType);
  if (fic) return fic;
  return null;
}

function resolveManualCountryTokenToFlagFile(token, locationType) {
  const trimmed = stripTrailingCommaSep(token);
  if (!trimmed) return null;
  const directCountry = resolveCountryToFilename(trimmed);
  if (directCountry) return directCountry;
  const t = locationType || 'earth';
  const viaDisplay = getResolvedFlagFilename(trimmed, t);
  if (viaDisplay) return viaDisplay;
  return null;
}

/** Classify why primary/display resolution failed (best-effort). */
function classifyPrimaryFail(cityDisplayName, locationType) {
  const loc = stripTrailingCommaSep(cityDisplayName);
  if (!loc) return 'empty_location';
  if (trySpecialDisplayFile(loc) || tryFictionalFile(loc, locationType)) {
    return 'unexpected_special_resolved'; // shouldn't happen if flagless
  }
  const country = extractCountryFromDisplay(loc);
  if (!country) {
    return 'no_comma_country_and_no_special';
  }
  const scrubbed = scrubCountrySuffix(country);
  if (!scrubbed) return 'empty_country_after_scrub';
  if (resolveCountryToFilename(country)) return 'unexpected_country_resolved';
  return 'unknown_country';
}

/**
 * Mirror slideRelevantLocations.createRelevantLocationsSlideHtml flag lead logic.
 * Returns { flagless: boolean, tokens: [{token, flagFile|null}], reason }.
 */
function resolveSecondaryRow(row, locationType) {
  const t = locationType || 'earth';
  let locName = stripTrailingCommaSep(row.locationName != null ? String(row.locationName) : '');
  if (!locName && row.name != null) locName = stripTrailingCommaSep(String(row.name));
  let country = stripTrailingCommaSep(row.country != null ? String(row.country) : '');
  const reasoning = row.reasoning != null ? String(row.reasoning).trim() : '';

  if (!locName && !country && !reasoning) {
    return { skipped: true };
  }

  if (!country && locName) {
    const inferred = extractCountryFromDisplay(locName);
    if (inferred) {
      country = inferred;
      const ixCut = locName.lastIndexOf(',');
      if (ixCut >= 0) locName = stripTrailingCommaSep(locName.slice(0, ixCut));
    }
  }

  const countryTokens = (country || '')
    .split(',')
    .map((s) => stripTrailingCommaSep(s))
    .filter(Boolean);

  if (country && countryTokens.length > 1) {
    const tokens = countryTokens.map((tok) => {
      let f = resolveManualCountryTokenToFlagFile(tok, t);
      if (!f && locName) f = getResolvedFlagFilename(locName + ', ' + tok, t);
      if (!f) f = getResolvedFlagFilename(tok, t);
      return { token: tok, flagFile: f };
    });
    const flaglessTokens = tokens.filter((x) => !x.flagFile);
    return {
      skipped: false,
      multi: true,
      locName,
      country,
      tokens,
      fullyFlagless: flaglessTokens.length === tokens.length,
      partiallyFlagless: flaglessTokens.length > 0 && flaglessTokens.length < tokens.length,
      flaglessTokens,
      hasAnyFlag: tokens.some((x) => x.flagFile),
    };
  }

  let flagFn = null;
  let path = null;
  if (country) {
    flagFn = resolveManualCountryTokenToFlagFile(country, t);
    if (flagFn) path = 'country_token';
  }
  if (!flagFn && locName && country) {
    flagFn = getResolvedFlagFilename(locName + ', ' + country, t);
    if (flagFn) path = 'loc_plus_country';
  }
  if (!flagFn && locName) {
    flagFn = getResolvedFlagFilename(locName, t);
    if (flagFn) path = 'loc_only';
  }

  let reason = null;
  if (!flagFn) {
    if (!country && !locName) reason = 'empty_loc_and_country';
    else if (!country) reason = 'no_country_and_loc_unresolved';
    else if (countryTokens.length === 1 && !resolveCountryToFilename(countryTokens[0]) && !getResolvedFlagFilename(countryTokens[0], t)) {
      reason = 'unknown_country_token';
    } else {
      reason = 'unresolved';
    }
  }

  return {
    skipped: false,
    multi: false,
    locName,
    country,
    flagFile: flagFn,
    path,
    fullyFlagless: !flagFn,
    partiallyFlagless: false,
    reason,
  };
}

const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const events = data.events || [];

const primaryFlagless = [];
const secondaryFullyFlagless = [];
const secondaryPartialFlagless = [];

events.forEach((ev, i) => {
  const idx = i + 1;
  const name = ev.name || '(unnamed)';
  const year = ev.yearStart ?? ev.year ?? null;
  const lt = ev.locationType || 'earth';
  const city = ev.cityDisplayName != null ? String(ev.cityDisplayName) : '';

  const primaryFn = getResolvedFlagFilename(city, lt);
  if (!primaryFn) {
    primaryFlagless.push({
      index: idx,
      name,
      year,
      locationType: lt,
      field: 'cityDisplayName',
      cityDisplayName: city,
      extractedCountry: extractCountryFromDisplay(city),
      reason: classifyPrimaryFail(city, lt),
    });
  }

  const places = Array.isArray(ev.secondaryCountryPlaces) ? ev.secondaryCountryPlaces : [];
  places.forEach((row, ri) => {
    const res = resolveSecondaryRow(row, lt);
    if (res.skipped) return;

    const base = {
      index: idx,
      name,
      year,
      locationType: lt,
      field: `secondaryCountryPlaces[${ri}]`,
      locationName: row.locationName ?? '',
      country: row.country ?? '',
      resolvedLocName: res.locName,
      resolvedCountry: res.country,
    };

    if (res.multi) {
      if (res.fullyFlagless) {
        secondaryFullyFlagless.push({
          ...base,
          reason: 'multi_all_tokens_unresolved',
          tokens: res.tokens,
        });
      } else if (res.partiallyFlagless) {
        secondaryPartialFlagless.push({
          ...base,
          reason: 'multi_some_tokens_unresolved',
          flaglessTokens: res.flaglessTokens,
          tokens: res.tokens,
        });
      }
    } else if (res.fullyFlagless) {
      secondaryFullyFlagless.push({
        ...base,
        reason: res.reason || 'unresolved',
      });
    }
  });
});

// Also note events with no secondary rows at all
const noSecondary = events
  .map((ev, i) => ({ index: i + 1, name: ev.name, year: ev.yearStart, places: ev.secondaryCountryPlaces }))
  .filter((x) => !Array.isArray(x.places) || x.places.length === 0);

function groupBy(arr, keyFn) {
  const g = {};
  for (const item of arr) {
    const k = keyFn(item);
    (g[k] ||= []).push(item);
  }
  return g;
}

const report = {
  totals: {
    events: events.length,
    primaryFlagless: primaryFlagless.length,
    secondaryFullyFlaglessRows: secondaryFullyFlagless.length,
    secondaryPartialFlaglessRows: secondaryPartialFlagless.length,
    eventsMissingSecondaryPlaces: noSecondary.length,
    uniqueEventsWithAnyFlagless:
      new Set([
        ...primaryFlagless.map((x) => x.index),
        ...secondaryFullyFlagless.map((x) => x.index),
        ...secondaryPartialFlagless.map((x) => x.index),
      ]).size,
  },
  primaryFlaglessByReason: groupBy(primaryFlagless, (x) => x.reason),
  secondaryFullyFlaglessByReason: groupBy(secondaryFullyFlagless, (x) => x.reason),
  primaryFlagless,
  secondaryFullyFlagless,
  secondaryPartialFlagless,
  noSecondary,
};

const outPath = path.join(__dirname, 'scan-flagless-locations-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('=== FLAGLESS LOCATION SCAN ===');
console.log('Events scanned:', report.totals.events);
console.log('Primary (cityDisplayName) flagless:', report.totals.primaryFlagless);
console.log('Secondary rows fully flagless:', report.totals.secondaryFullyFlaglessRows);
console.log('Secondary rows partially flagless (multi-token):', report.totals.secondaryPartialFlaglessRows);
console.log('Unique events with any flagless:', report.totals.uniqueEventsWithAnyFlagless);
console.log('Events with no secondaryCountryPlaces:', report.totals.eventsMissingSecondaryPlaces);
console.log('');

console.log('--- PRIMARY FLAGLESS ---');
for (const [reason, items] of Object.entries(report.primaryFlaglessByReason)) {
  console.log(`\n[${reason}] (${items.length})`);
  for (const it of items) {
    console.log(
      `  #${it.index} | ${it.year} | ${it.name}\n    cityDisplayName=${JSON.stringify(it.cityDisplayName)} | extractedCountry=${JSON.stringify(it.extractedCountry)} | locationType=${it.locationType}`,
    );
  }
}

console.log('\n--- SECONDARY FULLY FLAGLESS ---');
for (const [reason, items] of Object.entries(report.secondaryFullyFlaglessByReason)) {
  console.log(`\n[${reason}] (${items.length})`);
  for (const it of items) {
    console.log(
      `  #${it.index} | ${it.year} | ${it.name}\n    field=${it.field}\n    locationName=${JSON.stringify(it.locationName)} | country=${JSON.stringify(it.country)}`,
    );
    if (it.tokens) {
      console.log('    tokens:', it.tokens.map((t) => `${t.token}->${t.flagFile || 'PIN'}`).join(' | '));
    }
  }
}

console.log('\n--- SECONDARY PARTIAL (multi-country some pins) ---');
for (const it of secondaryPartialFlagless) {
  console.log(
    `  #${it.index} | ${it.year} | ${it.name}\n    field=${it.field}\n    locationName=${JSON.stringify(it.locationName)} | country=${JSON.stringify(it.country)}`,
  );
  console.log(
    '    flagless tokens:',
    it.flaglessTokens.map((t) => t.token).join(', '),
  );
  console.log('    all tokens:', it.tokens.map((t) => `${t.token}->${t.flagFile || 'PIN'}`).join(' | '));
}

console.log('\nWrote', outPath);
