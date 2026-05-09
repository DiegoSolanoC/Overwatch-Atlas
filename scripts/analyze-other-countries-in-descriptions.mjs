/**
 * Scans event descriptions (and titles) for country-related mentions from FLAG_FILE_BY_COMMON,
 * excluding the primary country parsed from "City, Country" on the location label.
 *
 * Pass 1 — direct names: exact keys from the flag map with word boundaries (e.g. "Mexico").
 *
 * Pass 2 — demonyms / forms Pass 1 misses: e.g. Venezuelan→Venezuela, Canadian→Canada, Chinese→China,
 * British→United Kingdom, Egyptian→Egypt. Rules use word boundaries; Korean handles North/South ordering.
 * Poland uses case-sensitive matching so the verb "polish" is not counted as Poland.
 *
 * Primary label quirks: COMMON_DISPLAY→DR Congo aliases for "Democratic Republic of the Congo", etc.
 *
 * Pass 3 — cities / major places: maps city (or place) names in `scripts/data/city-to-country.json` to a country
 * key from the flag map. Skips the city if it is already the event's primary location segment (before the comma),
 * or if the primary label contains that place (e.g. Watchpoint + Gibraltar). Extend the JSON as needed.
 *
 * Output: otherCountriesDirectNames, otherCountriesFromDemonyms, otherCountriesFromCities, otherCountriesMentioned (union).
 *
 * Not exhaustive: cities not in the JSON, ambiguous names shared by multiple countries, rare demonyms.
 *
 * Usage: node scripts/analyze-other-countries-in-descriptions.mjs [limit]
 * Default limit: 100
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadFlagMap() {
    const src = fs.readFileSync(path.join(root, 'src/features/worldview/data/flagFileByCommonName.js'), 'utf8');
    const map = {};
    for (const m of src.matchAll(/"([^"]+)"\s*:\s*"([^"]+\.png)"/g)) {
        map[m[1]] = m[2];
    }
    return map;
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Map display string after comma to canonical FLAG key when REST name differs. */
const PRIMARY_ALIASES = {
    'democratic republic of the congo': 'DR Congo',
    'the congo': 'DR Congo',
    'united states of america': 'United States',
    usa: 'United States',
    uk: 'United Kingdom',
    'u.k.': 'United Kingdom',
    'great britain': 'United Kingdom',
    britain: 'United Kingdom',
};

function canonKey(plain, map) {
    if (!plain) return null;
    const p = plain.trim();
    if (map[p]) return p;
    const alias = PRIMARY_ALIASES[p.toLowerCase()];
    if (alias && map[alias]) return alias;
    const lower = p.toLowerCase();
    for (const k of Object.keys(map)) {
        if (k.toLowerCase() === lower) return k;
    }
    return null;
}

function primaryCountryFromDisplay(loc) {
    if (!loc || typeof loc !== 'string') return null;
    const i = loc.lastIndexOf(',');
    if (i < 0) return null;
    return loc.slice(i + 1).trim();
}

/** City / place segment of the location label (before last comma, or whole string if no comma). */
function primaryLocationCitySegment(loc) {
    if (!loc || typeof loc !== 'string') return null;
    const i = loc.lastIndexOf(',');
    if (i >= 0) return loc.slice(0, i).trim();
    return loc.trim();
}

function normalizePlace(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * True if `cityName` is the event pin location (so we don't infer country again from the same place).
 */
function isCityOnPrimaryLabel(cityName, loc) {
    if (!cityName || !loc) return false;
    const seg = primaryLocationCitySegment(loc);
    if (!seg) return false;
    const ns = normalizePlace(seg);
    const nc = normalizePlace(cityName);
    if (ns === nc) return true;
    if (nc.length >= 5 && ns.includes(nc)) return true;
    if (ns.length >= 5 && nc.includes(ns)) return true;
    return false;
}

function loadCityToCountry() {
    const p = path.join(__dirname, 'src', 'data', 'city-to-country.json');
    if (!fs.existsSync(p)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findCountryMentionsCities(text, cityToCountry, flagMap, loc) {
    const entries = Object.entries(cityToCountry).filter(([, c]) => flagMap[c]);
    entries.sort((a, b) => b[0].length - a[0].length);
    let work = text;
    const found = [];
    for (const [city, country] of entries) {
        if (isCityOnPrimaryLabel(city, loc)) continue;
        const inner = city.includes(' ')
            ? city.split(/\s+/).map(escapeRe).join('\\s+')
            : escapeRe(city);
        const re = new RegExp(`\\b(?:${inner})\\b`, 'gi');
        if (re.test(work)) {
            found.push(country);
            work = work.replace(re, ' ');
        }
    }
    return found;
}

function collectText(event) {
    const parts = [];
    if (event.name) parts.push(event.name);
    if (event.description) parts.push(event.description);
    if (Array.isArray(event.variants)) {
        for (const v of event.variants) {
            if (v.name) parts.push(v.name);
            if (v.description) parts.push(v.description);
        }
    }
    return parts.join('\n');
}

function displayLocation(event) {
    if (event.cityDisplayName) return event.cityDisplayName;
    if (event.variants?.[0]?.cityDisplayName) return event.variants[0].cityDisplayName;
    return null;
}

function findCountryMentionsDirect(text, map) {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    let work = text;
    const found = [];
    for (const key of keys) {
        const inner = key.includes(' ')
            ? key.split(/\s+/).map(escapeRe).join('\\s+')
            : escapeRe(key);
        const re = new RegExp(`\\b(?:${inner})\\b`, 'gi');
        if (re.test(work)) {
            found.push(key);
            work = work.replace(re, ' ');
        }
    }
    return found;
}

/**
 * Pass 2: patterns that indicate a country without using the exact common name.
 * Longer / more specific patterns should appear first where order matters for documentation;
 * all matches are merged and deduped by country key.
 * Only countries that exist in `map` are kept.
 */
function buildDemonymRules() {
    return [
        { pattern: String.raw`\bSouth\s+Africans?\b`, country: 'South Africa' },
        { pattern: String.raw`\bNew\s+Zealanders?\b`, country: 'New Zealand' },
        { pattern: String.raw`\bCosta\s+Ricans?\b`, country: 'Costa Rica' },
        { pattern: String.raw`\bSaudi\s+Arabians?\b`, country: 'Saudi Arabia' },
        { pattern: String.raw`\bSri\s+Lankans?\b`, country: 'Sri Lanka' },
        { pattern: String.raw`\bPuerto\s+Ricans?\b`, country: 'Puerto Rico' },
        /* "Dominican" alone is ambiguous (Dominica island); rely on pass 1 for "Dominican Republic". */

        { pattern: String.raw`\bNorth\s+Koreans?\b`, country: 'North Korea' },
        { pattern: String.raw`\bSouth\s+Koreans?\b`, country: 'South Korea' },
        /* Bare "Korean(s)" → South Korea; exclude when already labeled North/South. */
        { pattern: String.raw`(?<!\b(?:North|South)\s)\bKoreans?\b`, country: 'South Korea' },

        { pattern: String.raw`\bIndonesians?\b`, country: 'Indonesia' },
        { pattern: String.raw`\bVenezuelans?\b`, country: 'Venezuela' },
        { pattern: String.raw`\bFilipinos?\b|\bFilipinas?\b`, country: 'Philippines' },
        { pattern: String.raw`\bMalaysians?\b`, country: 'Malaysia' },
        { pattern: String.raw`\bSingaporeans?\b`, country: 'Singapore' },
        { pattern: String.raw`\bBangladeshis?\b`, country: 'Bangladesh' },
        { pattern: String.raw`\bPakistanis?\b`, country: 'Pakistan' },
        { pattern: String.raw`\bAfghan(?:is|an)s?\b`, country: 'Afghanistan' },
        { pattern: String.raw`\bIraqis?\b`, country: 'Iraq' },
        { pattern: String.raw`\bIranians?\b`, country: 'Iran' },
        { pattern: String.raw`\bIsraelis?\b`, country: 'Israel' },
        { pattern: String.raw`\bPalestinians?\b`, country: 'Palestine' },
        { pattern: String.raw`\bLebanese\b`, country: 'Lebanon' },
        { pattern: String.raw`\bSyrians?\b`, country: 'Syria' },
        { pattern: String.raw`\bJordanians?\b`, country: 'Jordan' },
        { pattern: String.raw`\bKuwaitis?\b`, country: 'Kuwait' },
        { pattern: String.raw`\bEmiratis?\b|\bU\.?A\.?E\.?\s+nationals?\b`, country: 'United Arab Emirates' },
        { pattern: String.raw`\bOmanis?\b`, country: 'Oman' },
        { pattern: String.raw`\bYemenis?\b`, country: 'Yemen' },
        { pattern: String.raw`\bKazakhs?\b|\bKazakhstanis?\b`, country: 'Kazakhstan' },
        { pattern: String.raw`\bUzbek(?:s|istanis)?\b`, country: 'Uzbekistan' },
        { pattern: String.raw`\bUkrainians?\b`, country: 'Ukraine' },
        { pattern: String.raw`\bRussians?\b`, country: 'Russia' },
        /* Case-sensitive: avoid matching English verb "polish". */
        { pattern: String.raw`\b(?:Polish|Pole|Poles)\b`, country: 'Poland', flags: 'g' },
        { pattern: String.raw`\bCzechs?\b|\bCzechia(?:ns)?\b`, country: 'Czechia' },
        { pattern: String.raw`\bSlovaks?\b`, country: 'Slovakia' },
        { pattern: String.raw`\bHungarians?\b`, country: 'Hungary' },
        { pattern: String.raw`\bRomanians?\b`, country: 'Romania' },
        { pattern: String.raw`\bBulgarians?\b`, country: 'Bulgaria' },
        { pattern: String.raw`\bGreeks?\b|\bGreek\b`, country: 'Greece' },
        { pattern: String.raw`\bTurks?\b(?!\s+cat)|\bTurkish\b`, country: 'Turkey' },
        { pattern: String.raw`\bItalians?\b`, country: 'Italy' },
        { pattern: String.raw`\bSpaniards?\b|\bSpanish\b`, country: 'Spain' },
        { pattern: String.raw`\bPortuguese\b`, country: 'Portugal' },
        { pattern: String.raw`\bFrench(?:man|woman|men|people)?\b|\bFrench\b`, country: 'France' },
        { pattern: String.raw`\bGermans?\b|\bGerman\b`, country: 'Germany' },
        { pattern: String.raw`\bDutch(?:man|owers)?\b|\bNetherlanders?\b`, country: 'Netherlands' },
        { pattern: String.raw`\bBelgians?\b`, country: 'Belgium' },
        { pattern: String.raw`\bSwed(?:e|ish|es)\b`, country: 'Sweden' },
        { pattern: String.raw`\bNorwegians?\b`, country: 'Norway' },
        { pattern: String.raw`\bDanes?\b|\bDanish\b`, country: 'Denmark' },
        { pattern: String.raw`\bFinns?\b|\bFinnish\b`, country: 'Finland' },
        { pattern: String.raw`\bIcelanders?\b|\bIcelandic\b`, country: 'Iceland' },
        { pattern: String.raw`\bIrish(?:men|women|people)?\b`, country: 'Ireland' },
        { pattern: String.raw`\bScotsman\b|\bScotsmen\b|\bScottish\b`, country: 'Scotland' },
        { pattern: String.raw`\bBritons?\b|\bBritish\b`, country: 'United Kingdom' },
        { pattern: String.raw`\bAmericans?\b`, country: 'United States' },
        { pattern: String.raw`\bCanadians?\b`, country: 'Canada' },
        { pattern: String.raw`\bMexicans?\b`, country: 'Mexico' },
        { pattern: String.raw`\bCubans?\b`, country: 'Cuba' },
        { pattern: String.raw`\bJamaicans?\b`, country: 'Jamaica' },
        { pattern: String.raw`\bBrazilians?\b`, country: 'Brazil' },
        { pattern: String.raw`\bArgentines?\b|\bArgentine\b|\bArgentinian?s?\b`, country: 'Argentina' },
        { pattern: String.raw`\bChileans?\b`, country: 'Chile' },
        { pattern: String.raw`\bColombians?\b`, country: 'Colombia' },
        { pattern: String.raw`\bPeruvians?\b`, country: 'Peru' },
        { pattern: String.raw`\bEcuadorians?\b`, country: 'Ecuador' },
        { pattern: String.raw`\bVietnamese\b`, country: 'Vietnam' },
        { pattern: String.raw`\bThais?\b|\bThai\b`, country: 'Thailand' },
        { pattern: String.raw`\bCambodians?\b`, country: 'Cambodia' },
        { pattern: String.raw`\bLaotians?\b`, country: 'Laos' },
        { pattern: String.raw`\bBurmese\b|\bMyanmars?\b`, country: 'Myanmar' },
        { pattern: String.raw`\bJapanese\b`, country: 'Japan' },
        { pattern: String.raw`\bChinese\b`, country: 'China' },
        { pattern: String.raw`\bIndians?\b(?!\s+Ocean)`, country: 'India' },
        { pattern: String.raw`\bNigerians?\b`, country: 'Nigeria' },
        { pattern: String.raw`\bKenyans?\b`, country: 'Kenya' },
        { pattern: String.raw`\bEgyptians?\b`, country: 'Egypt' },
        { pattern: String.raw`\bMoroccans?\b`, country: 'Morocco' },
        { pattern: String.raw`\bAlgerians?\b`, country: 'Algeria' },
        { pattern: String.raw`\bTunisians?\b`, country: 'Tunisia' },
        { pattern: String.raw`\bEthiopians?\b`, country: 'Ethiopia' },
        { pattern: String.raw`\bSouth\s+Sudanese\b`, country: 'South Sudan' },
        { pattern: String.raw`\bAustralians?\b`, country: 'Australia' },
        { pattern: String.raw`\bSwiss\b`, country: 'Switzerland' },
        { pattern: String.raw`\bAustrians?\b`, country: 'Austria' },
        { pattern: String.raw`\bNigeriens?\b`, country: 'Niger' },

        { pattern: String.raw`\bSerb(?:s|ians?)?\b`, country: 'Serbia' },
        { pattern: String.raw`\bCroat(?:s|ians?)?\b`, country: 'Croatia' },
        { pattern: String.raw`\bBosnians?\b`, country: 'Bosnia and Herzegovina' },
    ];
}

let _demonymRules;

function findCountryMentionsDemonyms(text, map) {
    if (!_demonymRules) _demonymRules = buildDemonymRules();
    const found = [];
    for (const rule of _demonymRules) {
        const { pattern, country } = rule;
        if (!map[country]) continue;
        const re = new RegExp(pattern, rule.flags || 'gi');
        if (re.test(text)) {
            found.push(country);
        }
    }
    return found;
}

const limit = parseInt(process.argv[2], 10) > 0 ? parseInt(process.argv[2], 10) : 100;
const map = loadFlagMap();
const cityToCountry = loadCityToCountry();
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/events.json'), 'utf8'));
const events = data.events || [];
const slice = events.slice(0, limit);

const rows = [];
for (let i = 0; i < slice.length; i++) {
    const event = slice[i];
    const text = collectText(event);
    const loc = displayLocation(event);
    const primaryRaw = primaryCountryFromDisplay(loc);
    const primaryKey = canonKey(primaryRaw, map);

    const directAll = findCountryMentionsDirect(text, map);
    const demonymAll = findCountryMentionsDemonyms(text, map);
    const cityAll = findCountryMentionsCities(text, cityToCountry, map, loc);

    const keep = (keys) => [...new Set(keys.filter((k) => {
        const canon = canonKey(k, map);
        return canon && canon !== primaryKey;
    }))].sort((a, b) => a.localeCompare(b));

    const directOnly = keep(directAll);
    const demonymOnly = keep(demonymAll);
    const cityOnly = keep(cityAll);
    const union = [...new Set([...directOnly, ...demonymOnly, ...cityOnly])].sort((a, b) => a.localeCompare(b));
    const addedByDemonyms = demonymOnly.filter((k) => !directOnly.includes(k));
    const pass1and2 = new Set([...directOnly, ...demonymOnly]);
    const addedByCities = cityOnly.filter((k) => !pass1and2.has(k));

    if (union.length > 0) {
        rows.push({
            index: i + 1,
            name: event.name || event.variants?.[0]?.name || '(multi)',
            cityDisplayName: loc || '—',
            primaryCountry: primaryRaw || '—',
            primaryResolvedKey: primaryKey || null,
            otherCountriesDirectNames: directOnly,
            otherCountriesFromDemonyms: addedByDemonyms,
            otherCountriesFromCities: addedByCities,
            otherCountriesMentioned: union,
        });
    }
}

console.log(JSON.stringify({
    scanned: slice.length,
    withOtherCountries: rows.length,
    cityLookupSize: Object.keys(cityToCountry).length,
    events: rows,
}, null, 2));
