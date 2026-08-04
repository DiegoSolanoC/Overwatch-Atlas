/**
 * tokenInputMatching — pure matching functions for the comma-token autocomplete on the
 * edit modal and inline slide editor.
 *
 * The four supported `type` values share a substring-match strategy: the current trailing
 * segment (text after the last comma) is the needle; we return entries whose name
 * substring-contains it, then sort by `substringRank` (prefix matches rank first, then
 * shortest-first within ties).
 *
 * Matching is accent-/punctuation-/space-insensitive so typing `lucio`, `dva`, or
 * `junkerqueen` still finds `Lúcio`, `D.va`, and `Junker Queen`.
 *
 * Inputs to the per-type matcher:
 *   - heroes  / npcs / countries → `string[]`
 *   - factions                   → `{ displayName, filename }[]` (or strings coerced into that shape)
 *   - heroesAndNpcs              → `{ heroes: string[], npcs: string[] }`
 *
 * All matchers de-duplicate against tokens already in the input (case-insensitive) so we
 * don't suggest something the user has already picked.
 */

/**
 * Fold a label for predictive matching: lowercase, strip diacritics, drop spaces/symbols.
 * `Lúcio` / `lucio`, `D.va` / `dva`, `Soldier: 76` / `soldier76` all collapse the same way.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeForPredictiveMatch(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '');
}

/** Trailing segment after the final comma, trimmed. */
export function getCurrentSegment(value) {
    const lastComma = value.lastIndexOf(',');
    return lastComma >= 0 ? value.slice(lastComma + 1).trim() : value.trim();
}

/** Set of already-committed tokens (everything before the trailing segment), folded. */
export function existingTokensLower(value) {
    const set = new Set();
    const parts = String(value || '').split(',');
    // Skip the in-progress trailing segment so typing `lucio` can still suggest `Lúcio`.
    const committed = parts.slice(0, -1);
    committed.forEach((s) => {
        const t = normalizeForPredictiveMatch(s);
        if (t) set.add(t);
    });
    return set;
}

/**
 * Score for "how good a match is `haystack` for `needle`?".
 * Lower is better; `Infinity` means no match.
 *   - `0`      : starts with the needle (best).
 *   - `1 + i`  : substring match at character offset `i`.
 *   - `Inf`    : no substring match (filtered out by callers).
 */
export function substringRank(haystack, needle) {
    const h = normalizeForPredictiveMatch(haystack);
    const n = normalizeForPredictiveMatch(needle);
    if (!n || !h.includes(n)) return Infinity;
    if (h.startsWith(n)) return 0;
    return 1 + h.indexOf(n);
}

const MAX_MATCHES = 8;

/**
 * Pick up to 8 best matches for the active trailing segment of `value` against `options`.
 *
 * @param {string} value Current `<input>` value (full CSV).
 * @param {Array<any>} options Candidates; shape varies by `type`.
 * @param {'heroes'|'factions'|'npcs'|'countries'|'heroesAndNpcs'} type
 * @returns {Array<any>} Sorted candidates (raw entries for heroes/npcs/countries; faction
 *   objects for `type === 'factions'`).
 */
export function buildMatches(value, options, type) {
    const segment = getCurrentSegment(value);
    if (!segment) return [];
    const prefix = normalizeForPredictiveMatch(segment);
    if (!prefix) return [];
    const existing = existingTokensLower(value);

    if (type === 'heroes' || type === 'npcs' || type === 'countries') {
        const list = Array.isArray(options) ? options : [];
        return list
            .filter((entry) => {
                const name = String(entry || '');
                const folded = normalizeForPredictiveMatch(name);
                return folded.includes(prefix) && !existing.has(folded);
            })
            .sort(
                (a, b) =>
                    substringRank(a, prefix) - substringRank(b, prefix)
                    || String(a).length - String(b).length
            )
            .slice(0, MAX_MATCHES);
    }

    if (type === 'factions') {
        let facs = Array.isArray(options) ? options : [];
        // Allow plain string[] input by coercing it to the object shape.
        if (facs.length > 0 && typeof facs[0] === 'string') {
            facs = facs.map((dn) => ({ displayName: dn, filename: dn }));
        }
        return facs
            .filter((f) => {
                if (!f || f.displayName == null) return false;
                const dn = String(f.displayName).trim();
                const fn = String(f.filename || '').trim();
                const dnFold = normalizeForPredictiveMatch(dn);
                const fnFold = normalizeForPredictiveMatch(fn);
                const hit = dnFold.includes(prefix) || fnFold.includes(prefix);
                return hit && !existing.has(dnFold);
            })
            .sort((a, b) => {
                const ra = Math.min(substringRank(a.displayName, prefix), substringRank(a.filename, prefix));
                const rb = Math.min(substringRank(b.displayName, prefix), substringRank(b.filename, prefix));
                if (ra !== rb) return ra - rb;
                return String(a.displayName).length - String(b.displayName).length;
            })
            .slice(0, MAX_MATCHES);
    }

    if (type === 'heroesAndNpcs') {
        const heroes = Array.isArray(options?.heroes) ? options.heroes : [];
        const npcs = Array.isArray(options?.npcs) ? options.npcs : [];
        const tagged = [];

        heroes.forEach((entry) => {
            const name = String(entry || '');
            const folded = normalizeForPredictiveMatch(name);
            if (!folded.includes(prefix) || existing.has(folded)) return;
            tagged.push({ kind: 'hero', name, rank: substringRank(name, prefix) });
        });
        npcs.forEach((entry) => {
            const name = String(entry || '');
            const folded = normalizeForPredictiveMatch(name);
            if (!folded.includes(prefix) || existing.has(folded)) return;
            tagged.push({ kind: 'npc', name, rank: substringRank(name, prefix) });
        });

        return tagged
            .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length)
            .slice(0, MAX_MATCHES);
    }

    return [];
}
