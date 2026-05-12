/**
 * searchTokenUtils — pure helpers shared by the Event Manager search bar.
 *
 * All functions here are stateless: no DOM, no closures, no `window` access. They sit
 * underneath `wireEventManagerSearch.js` and handle the messy string-shaping tasks (default
 * faction display names from filenames, flag-key normalization for fuzzy matching, ranking
 * a needle against a haystack, partitioning selection keys, and parsing the current token
 * out of a partially-typed input string).
 *
 * Safe to unit-test in isolation.
 */

/** "0001_Faction_Name.png" → "Faction Name" (titlecased), with numeric prefix stripped. */
export function defaultFactionDisplayName(filename) {
    const base = String(filename ?? '').replace(/\.png$/i, '').trim();
    if (!base) return '';
    const bare = base.replace(/^\d+/, '').replace(/_/g, ' ').trim();
    const token = bare || base;
    return token
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/** Lowercase + strip diacritics + collapse whitespace for fuzzy flag-name comparison. */
export function normalizeFlagKey(s) {
    if (!s) return '';
    return String(s)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Substring-match rank for sorting suggestions:
 *   0 → starts with `needle`
 *   1..N → contains `needle` at index N-1
 *   Infinity → no match
 */
export function tokenSubstringRank(hayLower, needle) {
    if (!needle || !hayLower.includes(needle)) return Infinity;
    if (hayLower.startsWith(needle)) return 0;
    return 1 + hayLower.indexOf(needle);
}

/** Identical contract to {@link tokenSubstringRank}; kept as a named alias for clarity at call sites. */
export const countrySubstringRank = tokenSubstringRank;

/**
 * Split selected filter keys into country (`country:flag.png`) and non-country buckets.
 * @param {Array<string>|null|undefined} keys
 */
export function partitionSelectionKeys(keys) {
    const nonCountryKeys = [];
    const countryKeys = [];
    (keys || []).forEach((k) => {
        const s = (k ?? '').toString().trim();
        if (!s) return;
        if (s.toLowerCase().startsWith('country:')) {
            countryKeys.push(s);
        } else {
            nonCountryKeys.push(s);
        }
    });
    return { nonCountryKeys, countryKeys };
}

/**
 * Given a comma-separated text input and the cursor (end-of-text) position, return:
 *   - `before`     — completed tokens (everything up to the last comma).
 *   - `current`    — text typed for the in-progress token (after the last comma, left-trimmed).
 *   - `lastComma`  — index of the last comma in the input (`-1` when not present).
 */
export function getCurrentTokenInfo(text) {
    const value = text || '';
    const lastComma = value.lastIndexOf(',');
    const before = lastComma >= 0 ? value.slice(0, lastComma) : '';
    const currentRaw = lastComma >= 0 ? value.slice(lastComma + 1) : value;
    const current = currentRaw.trimStart();
    return { before, current, lastComma };
}
