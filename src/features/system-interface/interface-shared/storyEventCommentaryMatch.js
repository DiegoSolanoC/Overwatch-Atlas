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
                if (candWords[j].startsWith(qw) || qw.startsWith(candWords[j])) {
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
 * @param {string[]} options
 * @param {number} [limit]
 * @returns {string[]}
 */
export function buildCommentaryNameMatches(value, options, limit = 8) {
    const segment = String(value || '').trim();
    if (!segment) return [];
    const list = Array.isArray(options) ? options : [];
    const ranked = [];
    for (let i = 0; i < list.length; i += 1) {
        const name = String(list[i] || '').trim();
        if (!name) continue;
        const rank = commentaryNameMatchRank(name, segment);
        if (!Number.isFinite(rank)) continue;
        ranked.push({ name, rank, len: name.length });
    }
    // Prefer better rank; on ties prefer alphabetical so "Deals with Talon" does not
    // lose to shorter "Done with Talon" for shared-suffix queries like "with Talon".
    ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.len - b.len);
    return ranked.slice(0, Math.max(1, limit)).map((r) => r.name);
}
