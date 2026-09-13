/**
 * Story Commentary ↔ Dialogue Theater resolution.
 * Supports dialogue entry names and Hero Chatter line labels.
 *
 * Chatter labels: `{Hero} · {cleaned subtitle}`
 * Map-specific: `{Hero} · {map} — {cleaned subtitle}`
 */

import { isChatterEntry } from '../../dialogue-theater/data/dialogueTheaterEntryType.js';
import { stripDialogueSubtitleMarkup } from '../../dialogue-theater/data/dialogueSubtitleFormatting.js';
import { hasConversationVariationPaths } from '../../dialogue-theater/data/dialogueTheaterPathHelpers.js';
import { normalizeForPredictiveMatch } from '../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';

/** Max speaker chips on a story commentary row. */
export const COMMENTARY_SPEAKER_CHIP_LIMIT = 3;

/**
 * Deterministic shuffle so multipath chip picks stay stable across re-renders.
 * @template T
 * @param {T[]} items
 * @param {number} seed
 * @returns {T[]}
 */
function seededShuffle(items, seed) {
    const out = items.slice();
    let state = seed >>> 0;
    if (state === 0) state = 1;
    for (let i = out.length - 1; i > 0; i -= 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}

/**
 * @param {string} text
 * @returns {number}
 */
function seedFromText(text) {
    let hash = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Cap speakers at {@link COMMENTARY_SPEAKER_CHIP_LIMIT}, keeping highest scores.
 * Equal-score leftovers are filled with a seeded shuffle (stable per conversation).
 * @param {{ hero: string, score: number }[]} ranked
 * @param {string} seedKey
 * @param {number} [limit]
 * @returns {string[]}
 */
function pickTopSpeakersByScore(ranked, seedKey, limit = COMMENTARY_SPEAKER_CHIP_LIMIT) {
    if (!ranked.length || limit <= 0) return [];
    const sorted = ranked
        .slice()
        .sort(
            (a, b) =>
                b.score - a.score
                || a.hero.localeCompare(b.hero, undefined, { sensitivity: 'base' }),
        );

    /** @type {string[]} */
    const picked = [];
    let i = 0;
    while (picked.length < limit && i < sorted.length) {
        const score = sorted[i].score;
        /** @type {string[]} */
        const tier = [];
        while (i < sorted.length && sorted[i].score === score) {
            tier.push(sorted[i].hero);
            i += 1;
        }
        const slots = limit - picked.length;
        if (tier.length <= slots) {
            picked.push(...tier);
            continue;
        }
        picked.push(...seededShuffle(tier, seedFromText(`${seedKey}|${score}`)).slice(0, slots));
    }
    return picked;
}

export const CHATTER_COMMENTARY_SEP = ' · ';
export const CHATTER_COMMENTARY_MAP_SEP = ' — ';

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    /** @type {number[]} */
    let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s.length; i += 1) {
        /** @type {number[]} */
        const cur = [i];
        for (let j = 1; j <= t.length; j += 1) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = cur;
    }
    return prev[t.length];
}

/**
 * True when a commentary theater name is a Hero Chatter line label (`Hero · …`).
 * @param {string} name
 * @returns {boolean}
 */
export function isChatterCommentaryTheaterName(name) {
    return String(name || '').includes(CHATTER_COMMENTARY_SEP);
}

/**
 * @param {string} name
 * @returns {{ hero: string, map: string, subtitle: string } | null}
 */
export function parseChatterCommentaryLabel(name) {
    const raw = String(name || '').trim();
    const sep = raw.indexOf(CHATTER_COMMENTARY_SEP);
    if (sep < 0) return null;
    const hero = raw.slice(0, sep).trim();
    let rest = raw.slice(sep + CHATTER_COMMENTARY_SEP.length).trim();
    rest = rest.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!hero || !rest) return null;
    const mapSep = rest.indexOf(CHATTER_COMMENTARY_MAP_SEP);
    if (mapSep >= 0) {
        return {
            hero,
            map: rest.slice(0, mapSep).trim(),
            subtitle: rest.slice(mapSep + CHATTER_COMMENTARY_MAP_SEP.length).trim(),
        };
    }
    return { hero, map: '', subtitle: rest };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1 similarity
 */
function chatterSubtitleSimilarity(a, b) {
    const cleanA = cleanChatterSubtitleForCommentaryLabel(a);
    const cleanB = cleanChatterSubtitleForCommentaryLabel(b);
    const na = normalizeForPredictiveMatch(cleanA);
    const nb = normalizeForPredictiveMatch(cleanB);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.95;

    const ta = cleanA
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const tb = cleanB
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!ta.length || !tb.length) return 0;
    const setB = new Set(tb);
    let inter = 0;
    for (const t of ta) if (setB.has(t)) inter += 1;
    const union = new Set([...ta, ...tb]).size;
    const jaccard = union ? inter / union : 0;

    // Shared leading phrase (e.g. "I wouldn't change a thing we …").
    let prefix = 0;
    while (prefix < ta.length && prefix < tb.length && ta[prefix] === tb[prefix]) {
        prefix += 1;
    }
    const prefixScore = prefix >= 5
        ? Math.min(0.93, 0.55 + prefix * 0.06)
        : 0;

    // Voice-filename style: strip fillers and compare condensed stems.
    // Require a long shared stem so short lines like "Dead on." cannot
    // hitch onto "Deadlock…" via a tiny substring.
    const stem = (tokList) => tokList
        .filter((t) => t.length > 2 && !['the', 'and', 'for', 'that', 'this', 'with', 'from'].includes(t))
        .join('');
    const sa = stem(ta);
    const sb = stem(tb);
    let stemScore = 0;
    if (sa && sb) {
        if (sa === sb) stemScore = 0.97;
        else if (sa.includes(sb) || sb.includes(sa)) {
            const shorter = Math.min(sa.length, sb.length);
            const longer = Math.max(sa.length, sb.length);
            if (shorter >= 16 && shorter / longer >= 0.72) stemScore = 0.9;
        }
    }

    return Math.max(jaccard, prefixScore, stemScore);
}

/**
 * @param {string} wantedMap
 * @param {string} disclaimer
 * @returns {boolean}
 */
function chatterMapSoftMatches(wantedMap, disclaimer) {
    const want = String(wantedMap || '').trim();
    if (!want) return true;
    const live = mapLabelFromChatterDisclaimer(disclaimer);
    if (!live) return false;
    const nw = normalizeForPredictiveMatch(want);
    const nl = normalizeForPredictiveMatch(live);
    if (!nw || !nl) return false;
    if (nw === nl || nw.includes(nl) || nl.includes(nw)) return true;
    // "Nepal or Shambali Monastery" vs "Nepal" — share a leading place token.
    const wantTokens = want
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length > 2);
    const liveTokens = new Set(
        live
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .filter((t) => t.length > 2),
    );
    return wantTokens.some((t) => liveTokens.has(t));
}

/**
 * Soft resolve a chatter line when the stored commentary label drifted
 * (wiki/voice subtitle rewrites, punctuation, map note edits).
 * @param {string} name
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {string} [restrictTheaterId]
 * @returns {StoryCommentaryTheaterTarget | null}
 */
function resolveChatterLineBySoftLabel(name, conversations, restrictTheaterId = '') {
    const parsed = parseChatterCommentaryLabel(name);
    if (!parsed?.hero || !parsed.subtitle) return null;
    const heroNeedle = normalizeForPredictiveMatch(parsed.hero);
    const restrictId = String(restrictTheaterId || '').trim();

    /** @type {{ score: number, conversation: any, line: any }[]} */
    const hits = [];
    for (const row of conversations) {
        if (!isChatterEntry(row) || String(row.status || 'active') === 'removed') continue;
        if (restrictId && String(row.id || '') !== restrictId) continue;
        for (const line of row.lines || []) {
            if (!isActiveChatterLineForCommentary(line)) continue;
            const hero = normalizeForPredictiveMatch(line.hero || row.name);
            if (!hero || hero !== heroNeedle) continue;
            if (!chatterMapSoftMatches(parsed.map, line.disclaimer)) continue;
            const score = chatterSubtitleSimilarity(parsed.subtitle, line.subtitles);
            // Map-scoped lines can drift further; accept a slightly lower floor.
            const minScore = parsed.map ? 0.62 : 0.72;
            if (score < minScore) continue;
            hits.push({ score, conversation: row, line });
        }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.score - a.score);
    const best = hits[0];
    const second = hits[1];
    const margin = parsed.map ? 0.05 : 0.08;
    if (second && best.score - second.score < margin && best.score < 0.98) {
        // Ambiguous soft match — refuse rather than open the wrong line.
        return null;
    }
    return { kind: 'chatter-line', conversation: best.conversation, line: best.line };
}

/**
 * @param {string} subtitles
 * @returns {string}
 */
export function cleanChatterSubtitleForCommentaryLabel(subtitles) {
    let text = stripDialogueSubtitleMarkup(String(subtitles || '')).trim();
    while (/^\([^)]*\)\s*/.test(text)) {
        text = text.replace(/^\([^)]*\)\s*/, '').trim();
    }
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Prefer the map portion of a chatter disclaimer for commentary labels.
 * @param {string} disclaimer
 * @returns {string}
 */
export function mapLabelFromChatterDisclaimer(disclaimer) {
    let text = String(disclaimer || '').trim();
    if (!text) return '';
    // Drop trailing condition notes: "Numbani — final blow" → keep full for context,
    // but strip leading "On ".
    text = text.replace(/^on\s+/i, '').trim();
    // Partner-style disclaimers are not maps.
    if (/^(with|vs\.?|against|eliminating)\b/i.test(text)) return '';
    if (text.length < 2 || text.length > 120) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} hero
 * @param {string} subtitles
 * @param {string} [disclaimer]
 * @returns {string}
 */
export function buildChatterCommentaryLabel(hero, subtitles, disclaimer = '') {
    const speaker = String(hero || '').trim();
    const text = cleanChatterSubtitleForCommentaryLabel(subtitles);
    if (!speaker || !text) return '';
    const map = mapLabelFromChatterDisclaimer(disclaimer);
    if (map) {
        return `${speaker}${CHATTER_COMMENTARY_SEP}${map}${CHATTER_COMMENTARY_MAP_SEP}${text}`;
    }
    return `${speaker}${CHATTER_COMMENTARY_SEP}${text}`;
}

/**
 * True when a conversation is tagged Classic (OW1 archived interactions).
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation | null | undefined} conversation
 * @returns {boolean}
 */
export function isClassicTaggedConversation(conversation) {
    if (!conversation || typeof conversation !== 'object') return false;
    if (String(conversation.eraName || '') === 'Classic') return true;
    const tags = Array.isArray(conversation.tags) ? conversation.tags : [];
    return tags.some((t) => String(t || '').trim().toLowerCase() === 'classic');
}

/**
 * True when a dialogue entry may appear in Story Commentary autocomplete / play.
 * Classic OW1 dialogues are archived as `status: removed` but remain valid lore targets
 * (e.g. "Adapting Well").
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation | null | undefined} conversation
 * @returns {boolean}
 */
export function isDialogueEligibleForCommentary(conversation) {
    if (!conversation || typeof conversation !== 'object') return false;
    if (isChatterEntry(conversation)) return false;
    const status = String(conversation.status || 'active');
    if (status !== 'removed') return true;
    return isClassicTaggedConversation(conversation);
}

/**
 * True when a chatter line may appear in Story Commentary autocomplete / play.
 * OW1 map-specific lines are Classic + often `removed`, but still matchable when they
 * carry a map disclaimer (unlike Classic set-up chatter).
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine | null | undefined} line
 * @returns {boolean}
 */
export function isActiveChatterLineForCommentary(line) {
    if (!line || typeof line !== 'object') return false;
    const hasText = Boolean(String(line.subtitles || '').trim() || String(line.voice || '').trim());
    if (!hasText) return false;

    const era = String(line.era || '');
    const status = String(line.status || 'active');
    const hasMap = Boolean(mapLabelFromChatterDisclaimer(line.disclaimer));

    // Classic map-specific (OW1 Map-Specific import): eligible for commentary matching.
    if (era === 'Classic' && hasMap) return true;

    if (status === 'removed') return false;
    if (era === 'Classic') return false;
    return true;
}

/**
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {string[]}
 */
export function listStoryCommentaryTheaterNames(conversations) {
    /** @type {string[]} */
    const out = [];
    const seen = new Set();

    const push = (raw) => {
        const name = String(raw || '').trim();
        if (!name) return;
        const key = normalizeForPredictiveMatch(name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(name);
    };

    const list = Array.isArray(conversations) ? conversations : [];
    for (const row of list) {
        if (!row) continue;

        if (isChatterEntry(row)) {
            // Chatter hubs stay active; Classic map lines are gated per-line below.
            if (String(row.status || 'active') === 'removed') continue;
            const labelCounts = new Map();
            for (const line of row.lines || []) {
                if (!isActiveChatterLineForCommentary(line)) continue;
                const base = buildChatterCommentaryLabel(
                    line.hero || row.name,
                    line.subtitles,
                    line.disclaimer,
                );
                if (!base) continue;
                const n = (labelCounts.get(base) || 0) + 1;
                labelCounts.set(base, n);
                push(n === 1 ? base : `${base} (${n})`);
            }
            continue;
        }

        if (!isDialogueEligibleForCommentary(row)) continue;
        push(row.name);
    }

    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * @typedef {{
 *   kind: 'dialogue' | 'chatter-hub' | 'chatter-line',
 *   conversation: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation,
 *   line: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine | null,
 * }} StoryCommentaryTheaterTarget
 */

/**
 * @param {string | { name?: string, theaterId?: string, lineId?: string } | null | undefined} nameOrEntry
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {StoryCommentaryTheaterTarget | null}
 */
export function resolveStoryCommentaryTheaterTarget(nameOrEntry, conversations) {
    const list = Array.isArray(conversations) ? conversations : [];
    const entry = typeof nameOrEntry === 'string'
        ? { name: nameOrEntry }
        : (nameOrEntry && typeof nameOrEntry === 'object' ? nameOrEntry : null);
    if (!entry) return null;

    const theaterId = String(entry.theaterId || '').trim();
    const lineId = String(entry.lineId || '').trim();
    const name = String(entry.name || '').trim();

    // 1) Stable conversation id (rename-proof).
    if (theaterId) {
        const byId = list.filter((row) => String(row?.id || '') === theaterId);
        if (byId.length) {
            const row =
                byId.find((r) => String(r.status || 'active') !== 'removed')
                || byId[0];
            if (isChatterEntry(row)) {
                if (lineId) {
                    const line = (row.lines || []).find((l) => String(l?.id || '') === lineId) || null;
                    if (line && isActiveChatterLineForCommentary(line)) {
                        return { kind: 'chatter-line', conversation: row, line };
                    }
                }
                if (name) {
                    const needle = normalizeForPredictiveMatch(name);
                    const labelCounts = new Map();
                    for (const line of row.lines || []) {
                        if (!isActiveChatterLineForCommentary(line)) continue;
                        const base = buildChatterCommentaryLabel(
                            line.hero || row.name,
                            line.subtitles,
                            line.disclaimer,
                        );
                        if (!base) continue;
                        const n = (labelCounts.get(base) || 0) + 1;
                        labelCounts.set(base, n);
                        const label = n === 1 ? base : `${base} (${n})`;
                        if (normalizeForPredictiveMatch(label) === needle) {
                            return { kind: 'chatter-line', conversation: row, line };
                        }
                    }
                    const soft = resolveChatterLineBySoftLabel(name, list, theaterId);
                    if (soft) return soft;
                }
                return { kind: 'chatter-hub', conversation: row, line: null };
            }
            return { kind: 'dialogue', conversation: row, line: null };
        }
    }

    // 2) Legacy / autocomplete: exact conversation / chatter-hub name.
    const needle = normalizeForPredictiveMatch(name);
    if (!needle) return null;

    const nameMatches = list.filter(
        (row) => normalizeForPredictiveMatch(row?.name) === needle,
    );
    if (nameMatches.length) {
        const row =
            nameMatches.find((r) => String(r.status || 'active') !== 'removed')
            || nameMatches[0];
        if (isChatterEntry(row)) {
            return { kind: 'chatter-hub', conversation: row, line: null };
        }
        return { kind: 'dialogue', conversation: row, line: null };
    }

    // 2b) Soft dialogue name (typos like "Ilegal Activities" → "Illegal Activities").
    if (!isChatterCommentaryTheaterName(name)) {
        /** @type {{ score: number, row: any }[]} */
        const dialogueHits = [];
        for (const row of list) {
            if (isChatterEntry(row) || !isDialogueEligibleForCommentary(row)) continue;
            const rowNeedle = normalizeForPredictiveMatch(row?.name);
            if (!rowNeedle) continue;
            if (rowNeedle === needle) {
                dialogueHits.push({ score: 1, row });
                continue;
            }
            const dist = levenshteinDistance(needle, rowNeedle);
            const maxLen = Math.max(needle.length, rowNeedle.length);
            if (maxLen < 8 || dist > 2) continue;
            const score = 1 - dist / maxLen;
            if (score >= 0.85) dialogueHits.push({ score, row });
        }
        dialogueHits.sort((a, b) => b.score - a.score);
        if (
            dialogueHits.length === 1
            || (dialogueHits[0] && dialogueHits[0].score - (dialogueHits[1]?.score || 0) >= 0.05)
        ) {
            return { kind: 'dialogue', conversation: dialogueHits[0].row, line: null };
        }
    }

    // 3) Chatter line label (with optional " (2)" duplicate suffix).
    for (const row of list) {
        if (!isChatterEntry(row) || String(row.status || 'active') === 'removed') continue;
        const labelCounts = new Map();
        for (const line of row.lines || []) {
            if (!isActiveChatterLineForCommentary(line)) continue;
            const base = buildChatterCommentaryLabel(
                line.hero || row.name,
                line.subtitles,
                line.disclaimer,
            );
            if (!base) continue;
            const n = (labelCounts.get(base) || 0) + 1;
            labelCounts.set(base, n);
            const label = n === 1 ? base : `${base} (${n})`;
            if (normalizeForPredictiveMatch(label) === needle) {
                return { kind: 'chatter-line', conversation: row, line };
            }
        }
    }

    // 4) Soft match after subtitle / map-note rewrites (e.g. Omnic Crisis → Crisis).
    if (isChatterCommentaryTheaterName(name)) {
        const soft = resolveChatterLineBySoftLabel(name, list);
        if (soft) return soft;
    }

    return null;
}

/**
 * Stamp theaterId / lineId onto commentary entries (and refresh dialogue names from live data).
 * @param {import('./storyEventCommentary.js').CommentaryEntry[]} entries
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {import('./storyEventCommentary.js').CommentaryEntry[]}
 */
export function stampCommentaryTheaterIds(entries, conversations) {
    if (!Array.isArray(entries)) return [];
    return entries.map((entry) => {
        const target = resolveStoryCommentaryTheaterTarget(entry, conversations);
        if (!target?.conversation?.id) return entry;
        /** @type {import('./storyEventCommentary.js').CommentaryEntry} */
        const next = { ...entry, theaterId: String(target.conversation.id) };
        if (target.kind === 'dialogue') {
            next.name = String(target.conversation.name || entry.name || '').trim() || entry.name;
            delete next.lineId;
        } else if (target.kind === 'chatter-line' && target.line?.id) {
            next.lineId = String(target.line.id);
            next.name = buildChatterCommentaryLabel(
                target.line.hero || target.conversation.name,
                target.line.subtitles,
                target.line.disclaimer,
            ) || entry.name;
        } else if (target.kind === 'chatter-hub') {
            next.name = String(target.conversation.name || entry.name || '').trim() || entry.name;
            delete next.lineId;
        }
        return next;
    });
}

/**
 * Live display title — dialogues use current conversation name when theaterId resolves.
 * @param {import('./storyEventCommentary.js').CommentaryEntry} entry
 * @param {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @returns {string}
 */
export function commentaryLiveDisplayTitle(entry, conversations) {
    if (!entry) return '';
    if (entry.label) return String(entry.label).trim();
    const target = resolveStoryCommentaryTheaterTarget(entry, conversations);
    if (target?.kind === 'dialogue' && target.conversation?.name) {
        return String(target.conversation.name).trim();
    }
    if (target?.kind === 'chatter-line' && target.line) {
        return buildChatterCommentaryLabel(
            target.line.hero || target.conversation.name,
            target.line.subtitles,
            target.line.disclaimer,
        ) || String(entry.name || '').trim();
    }
    return String(entry.name || '').trim();
}

/**
 * Speakers to chip on the story slide for a commentary target.
 * Multipath dialogues: prefer heroes present in the most paths (then most lines);
 * ties for remaining chip slots are filled at random (seeded per conversation).
 * Hard cap: {@link COMMENTARY_SPEAKER_CHIP_LIMIT}.
 * @param {StoryCommentaryTheaterTarget | null} target
 * @returns {string[]}
 */
export function speakersForCommentaryTheaterTarget(target) {
    if (!target?.conversation) return [];
    if (target.kind === 'chatter-line' && target.line?.hero) {
        return [String(target.line.hero).trim()].filter(Boolean);
    }
    if (target.kind === 'chatter-hub') {
        const hero = String(target.conversation.name || '').trim();
        return hero ? [hero] : [];
    }

    const conversation = target.conversation;
    const seedKey = String(conversation.id || conversation.name || 'commentary');
    const allLines = Array.isArray(conversation.lines) ? conversation.lines : [];
    const byId = new Map(allLines.map((line) => [line.id, line]));

    if (hasConversationVariationPaths(conversation)) {
        /** @type {Map<string, { hero: string, pathCount: number, lineCount: number }>} */
        const stats = new Map();
        const bump = (raw, { path = false, line = false } = {}) => {
            const hero = String(raw ?? '').trim();
            if (!hero) return;
            const key = hero.toLowerCase();
            let row = stats.get(key);
            if (!row) {
                row = { hero, pathCount: 0, lineCount: 0 };
                stats.set(key, row);
            }
            if (path) row.pathCount += 1;
            if (line) row.lineCount += 1;
        };

        for (const path of conversation.paths || []) {
            /** @type {Set<string>} */
            const inPath = new Set();
            const lineIds = Array.isArray(path?.lineIds) ? path.lineIds : [];
            if (lineIds.length) {
                for (const lineId of lineIds) {
                    const line = byId.get(lineId);
                    const hero = String(line?.hero ?? '').trim();
                    if (!hero) continue;
                    bump(hero, { line: true });
                    inPath.add(hero.toLowerCase());
                }
            } else if (Array.isArray(path?.lines)) {
                for (const line of path.lines) {
                    const hero = String(line?.hero ?? '').trim();
                    if (!hero) continue;
                    bump(hero, { line: true });
                    inPath.add(hero.toLowerCase());
                }
            }
            for (const key of inPath) {
                const row = stats.get(key);
                if (row) row.pathCount += 1;
            }
        }

        const ranked = [...stats.values()].map((row) => ({
            hero: row.hero,
            // Path coverage dominates; line density breaks near-ties.
            score: row.pathCount * 1000 + row.lineCount,
        }));
        return pickTopSpeakersByScore(ranked, seedKey);
    }

    /** @type {Map<string, { hero: string, lineCount: number, firstIndex: number }>} */
    const linear = new Map();
    allLines.forEach((line, index) => {
        const hero = String(line?.hero ?? '').trim();
        if (!hero) return;
        const key = hero.toLowerCase();
        const existing = linear.get(key);
        if (!existing) {
            linear.set(key, { hero, lineCount: 1, firstIndex: index });
            return;
        }
        existing.lineCount += 1;
    });

    const ranked = [...linear.values()].map((row) => ({
        hero: row.hero,
        // More lines first; earlier first-speak breaks ties before random fill.
        score: row.lineCount * 1000 + Math.max(0, 500 - row.firstIndex),
    }));
    return pickTopSpeakersByScore(ranked, seedKey);
}
