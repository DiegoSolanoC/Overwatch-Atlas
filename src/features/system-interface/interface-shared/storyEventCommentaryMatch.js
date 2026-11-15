/**
 * Commentary theater-name ranking — stricter than generic token substring matching
 * so multi-word queries like "Deals with Talon" don't lose to shared-suffix hits
 * like "Done with Talon".
 */

import { normalizeForPredictiveMatch } from '../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {number} lower is better; Infinity = no match
 */
export function commentaryNameMatchRank(haystack, needle) {
    const h = normalizeForPredictiveMatch(haystack);
    const n = normalizeForPredictiveMatch(needle);
    if (!n || !h) return Infinity;
    if (h === n) return 0;
    if (h.startsWith(n)) return 1;

    // Multi-word query: every query word must be a prefix of some candidate word
    // (order preserved). This keeps "deals with talon" from ranking "done with talon"
    // via the shared "with talon" tail alone.
    const rawWords = String(needle || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((w) => normalizeForPredictiveMatch(w))
        .filter(Boolean);
    if (rawWords.length >= 2) {
        const candWords = String(haystack || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map((w) => normalizeForPredictiveMatch(w))
            .filter(Boolean);
        let from = 0;
        let ok = true;
        for (let i = 0; i < rawWords.length; i += 1) {
            const qw = rawWords[i];
            let hit = -1;
            for (let j = from; j < candWords.length; j += 1) {
                // Candidate may extend the query token ("see" → "seen"), but never the
                // reverse ("seen" must not match standalone "see" in "Eager to see you").
                if (candWords[j] === qw || candWords[j].startsWith(qw)) {
                    hit = j;
                    break;
                }
            }
            if (hit < 0) {
                ok = false;
                break;
            }
            from = hit + 1;
        }
        if (ok) {
            // Prefer candidates whose first word matches the query's first word.
            const firstBonus = candWords[0]?.startsWith(rawWords[0]) ? 0 : 20;
            // Contiguous phrase ("with talon" inside the label) beats scattered word hits.
            const spacedNeedle = rawWords.join(' ');
            const spacedHay = String(haystack || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');
            const phraseBonus = spacedHay.includes(spacedNeedle) ? 0 : 8;
            return 10 + firstBonus + phraseBonus + Math.abs(candWords.length - rawWords.length);
        }
        // Fall through only for single-token style substring if multi-word token walk failed.
        if (!h.includes(n)) return Infinity;
        // Shared-suffix-only multi-word matches (needle longer than half, but not a prefix
        // of a word sequence) are weak — bury them.
        return 200 + h.indexOf(n);
    }

    if (!h.includes(n)) return Infinity;
    // Single token / short query: prefer earlier occurrence, then shorter labels.
    return 50 + h.indexOf(n);
}

/**
 * @param {string} value
 * @param {Array<string | { name?: string, listLabel?: string }>} options
 * @param {number} [limit]
 * @returns {string[]} list labels (or names) for the dropdown
 */
export function buildCommentaryNameMatches(value, options, limit = 8) {
    const segment = String(value || '').trim();
    if (!segment) return [];
    const list = Array.isArray(options) ? options : [];
    /** @type {{ label: string, rank: number, exactCase: number, len: number }[]} */
    const ranked = [];
    for (let i = 0; i < list.length; i += 1) {
        const raw = list[i];
        const name = typeof raw === 'string'
            ? String(raw || '').trim()
            : String(raw?.name || '').trim();
        const label = typeof raw === 'string'
            ? name
            : String(raw?.listLabel || raw?.name || '').trim();
        if (!name || !label) continue;
        // Rank on the real theater name so speaker hints don't dilute exact matches.
        const rank = commentaryNameMatchRank(name, segment);
        if (!Number.isFinite(rank)) continue;
        const exactCase = name === segment ? 0 : name.toLowerCase() === segment.toLowerCase() ? 1 : 2;
        ranked.push({ label, rank, exactCase, len: name.length });
    }
    // Prefer better rank; exact case; then alphabetical.
    ranked.sort(
        (a, b) =>
            a.rank - b.rank
            || a.exactCase - b.exactCase
            || a.label.localeCompare(b.label)
            || a.len - b.len,
    );
    return ranked.slice(0, Math.max(1, limit)).map((r) => r.label);
}
