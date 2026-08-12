/**
 * Pair search — find conversations where two named characters both speak.
 * Independent of additive globe/chip hero filters.
 *
 * For multipath conversations, both characters must share at least one path —
 * separate branches of the same multi do not count as a shared interaction.
 */

import {
    getHeroDisplayName,
    resolveManifestHeroId,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { normalizeForPredictiveMatch } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { heroNamesMatch } from './dialogueTheaterHeroFilter.js';

/**
 * @typedef {{ epoch: number, anyKeys: Set<string>, pathKeys: Set<string>[] }} ConversationSpeakerIndex
 */

/** @type {Map<string, string>} */
const resolveExactMemo = new Map();

/** Bumped when conversation data changes so WeakMap speaker indexes rebuild. */
let speakerIndexEpoch = 0;

/** @type {WeakMap<object, ConversationSpeakerIndex>} */
const speakerIndexByConversation = new WeakMap();

/**
 * Drop resolve memos + force speaker indexes to rebuild on next filter.
 * Call from Dialogue Theater list cache invalidation.
 */
export function clearPairSearchCaches() {
    resolveExactMemo.clear();
    speakerIndexEpoch += 1;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string[]}
 */
export function getConversationSpeakerNames(conversation) {
    const seen = new Set();
    /** @type {string[]} */
    const names = [];

    for (const line of conversation?.lines || []) {
        const hero = String(line?.hero || '').trim();
        if (!hero) continue;
        const key = hero.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(hero);
    }

    return names;
}

/**
 * Resolve typed Character A/B text to a roster hero only when it is a full valid name
 * (or known alias like McCree → Cassidy). Incomplete typing returns ''.
 *
 * @param {string} query
 * @param {string[]} manifestHeroes
 * @returns {string}
 */
export function resolveExactRosterHero(query, manifestHeroes = []) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return '';

    const heroes = Array.isArray(manifestHeroes) ? manifestHeroes : [];
    const memoKey = `${heroes.length}\0${heroes[0] || ''}\0${heroes[heroes.length - 1] || ''}\0${trimmed}`;
    if (resolveExactMemo.has(memoKey)) return resolveExactMemo.get(memoKey) || '';

    const fold = normalizeForPredictiveMatch(trimmed);
    for (const hero of heroes) {
        const label = String(hero || '').trim();
        if (!label) continue;
        if (normalizeForPredictiveMatch(label) === fold) {
            resolveExactMemo.set(memoKey, label);
            return label;
        }
        const display = getHeroDisplayName(label);
        if (display && normalizeForPredictiveMatch(display) === fold) {
            resolveExactMemo.set(memoKey, label);
            return label;
        }
    }

    for (const hero of heroes) {
        const label = String(hero || '').trim();
        if (!label) continue;
        if (heroNamesMatch(label, trimmed, heroes)) {
            resolveExactMemo.set(memoKey, label);
            return label;
        }
    }

    resolveExactMemo.set(memoKey, '');
    return '';
}

/**
 * Exact / alias equality for two character labels.
 *
 * @param {string} a
 * @param {string} b
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function characterNamesMatch(a, b, manifestHeroes = []) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return false;
    return heroNamesMatch(left, right, manifestHeroes);
}

/**
 * @param {string} label
 * @returns {string}
 */
function parseHeroFromPathLabel(label) {
    const text = String(label || '').trim();
    const sep = text.indexOf(' — ');
    return sep >= 0 ? text.slice(0, sep).trim() : text;
}

/**
 * @param {string} name
 * @param {string[]} manifestHeroes
 * @param {Map<string, string>} keyCache
 * @returns {string}
 */
function canonicalHeroKey(name, manifestHeroes, keyCache) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '';
    const fold = normalizeForPredictiveMatch(trimmed);
    if (!fold) return '';
    if (keyCache.has(fold)) return keyCache.get(fold) || '';

    const id = resolveManifestHeroId(trimmed, manifestHeroes) || trimmed;
    const key = normalizeForPredictiveMatch(id) || fold;
    keyCache.set(fold, key);
    const idFold = normalizeForPredictiveMatch(id);
    if (idFold) keyCache.set(idFold, key);
    return key;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} manifestHeroes
 * @param {Map<string, string>} keyCache
 * @returns {ConversationSpeakerIndex}
 */
function getSpeakerIndex(conversation, manifestHeroes, keyCache) {
    const cached = speakerIndexByConversation.get(conversation);
    if (cached && cached.epoch === speakerIndexEpoch) return cached;

    /** @type {Set<string>} */
    const anyKeys = new Set();
    /** @type {Set<string>[]} */
    const pathKeys = [];

    const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
    const byId = new Map(lines.map((line) => [line.id, line]));

    for (const line of lines) {
        const key = canonicalHeroKey(line?.hero, manifestHeroes, keyCache);
        if (key) anyKeys.add(key);
    }

    const paths = conversation?.paths;
    if (Array.isArray(paths) && paths.length > 0) {
        for (const path of paths) {
            /** @type {Set<string>} */
            const set = new Set();
            const labelKey = canonicalHeroKey(parseHeroFromPathLabel(path?.label), manifestHeroes, keyCache);
            if (labelKey) set.add(labelKey);
            for (const lineId of path?.lineIds || []) {
                const line = byId.get(lineId);
                const key = canonicalHeroKey(line?.hero, manifestHeroes, keyCache);
                if (key) set.add(key);
            }
            pathKeys.push(set);
            for (const key of set) anyKeys.add(key);
        }
    }

    const index = { epoch: speakerIndexEpoch, anyKeys, pathKeys };
    speakerIndexByConversation.set(conversation, index);
    return index;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @returns {string[]}
 */
function speakersOnConversationPath(conversation, path) {
    const seen = new Set();
    /** @type {string[]} */
    const names = [];

    const add = (name) => {
        const hero = String(name || '').trim();
        if (!hero) return;
        const key = hero.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(hero);
    };

    add(parseHeroFromPathLabel(path?.label));

    const byId = new Map((conversation?.lines || []).map((line) => [line.id, line]));
    for (const lineId of path?.lineIds || []) {
        const line = byId.get(lineId);
        if (line) add(line.hero);
    }

    return names;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {import('../data/DialogueTheaterDataService.js').DialoguePath} path
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function pathIncludesCharacter(conversation, path, characterName, manifestHeroes = []) {
    const query = String(characterName || '').trim();
    if (!query) return true;

    const resolved = resolveExactRosterHero(query, manifestHeroes);
    // Still typing / not a roster name — do not blank the list.
    if (!resolved) return true;

    return speakersOnConversationPath(conversation, path).some((hero) =>
        characterNamesMatch(hero, resolved, manifestHeroes),
    );
}

/**
 * True when both characters share at least one variation path (or the linear line set).
 * Separate multipath branches do not count as a shared interaction.
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function conversationHasSharedPathForPair(conversation, charA, charB, manifestHeroes = []) {
    const a = String(charA || '').trim();
    const b = String(charB || '').trim();
    if (!a || !b) return false;

    const paths = conversation?.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
        return (
            conversationIncludesCharacter(conversation, a, manifestHeroes) &&
            conversationIncludesCharacter(conversation, b, manifestHeroes)
        );
    }

    return paths.some(
        (path) =>
            pathIncludesCharacter(conversation, path, a, manifestHeroes) &&
            pathIncludesCharacter(conversation, path, b, manifestHeroes),
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} characterName
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function conversationIncludesCharacter(conversation, characterName, manifestHeroes = []) {
    const query = String(characterName || '').trim();
    if (!query) return true;

    const resolved = resolveExactRosterHero(query, manifestHeroes);
    // Incomplete typing should keep the current list, not show "no conversations".
    if (!resolved) return true;

    const keyCache = new Map();
    const index = getSpeakerIndex(conversation, manifestHeroes, keyCache);
    const key = canonicalHeroKey(resolved, manifestHeroes, keyCache);
    return Boolean(key) && index.anyKeys.has(key);
}

/**
 * Fast path when Character A/B are already resolved roster ids (or '').
 *
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} resolvedA
 * @param {string} resolvedB
 * @param {string[]} manifestHeroes
 * @param {Map<string, string>} keyCache
 * @returns {boolean}
 */
export function conversationMatchesResolvedCharacterPair(
    conversation,
    resolvedA,
    resolvedB,
    manifestHeroes = [],
    keyCache = new Map(),
) {
    const a = String(resolvedA || '').trim();
    const b = String(resolvedB || '').trim();
    if (!a && !b) return true;

    const index = getSpeakerIndex(conversation, manifestHeroes, keyCache);
    const keyA = a ? canonicalHeroKey(a, manifestHeroes, keyCache) : '';
    const keyB = b ? canonicalHeroKey(b, manifestHeroes, keyCache) : '';

    if (keyA && !keyB) return index.anyKeys.has(keyA);
    if (!keyA && keyB) return index.anyKeys.has(keyB);
    if (!keyA || !keyB) return true;

    if (!index.pathKeys.length) {
        return index.anyKeys.has(keyA) && index.anyKeys.has(keyB);
    }

    return index.pathKeys.some((set) => set.has(keyA) && set.has(keyB));
}

/**
 * True only when at least one field is a completed roster hero name.
 * Incomplete typing does not count as an active pair filter.
 *
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} manifestHeroes
 * @returns {boolean}
 */
export function isDialogueTheaterPairSearchActive(charA, charB, manifestHeroes = []) {
    return Boolean(
        resolveExactRosterHero(charA, manifestHeroes) ||
            resolveExactRosterHero(charB, manifestHeroes),
    );
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} charA
 * @param {string} charB
 * @param {string[]} [manifestHeroes]
 * @returns {boolean}
 */
export function conversationMatchesCharacterPair(conversation, charA, charB, manifestHeroes = []) {
    const resolvedA = resolveExactRosterHero(charA, manifestHeroes);
    const resolvedB = resolveExactRosterHero(charB, manifestHeroes);
    return conversationMatchesResolvedCharacterPair(
        conversation,
        resolvedA,
        resolvedB,
        manifestHeroes,
    );
}

/**
 * Autocomplete options for Character A/B — atlas roster only (no NPC/one-off speakers).
 *
 * @param {string[]} manifestHeroes
 * @returns {string[]}
 */
export function buildDialogueTheaterSpeakerOptions(manifestHeroes) {
    const seen = new Set();
    /** @type {string[]} */
    const options = [];

    for (const hero of manifestHeroes || []) {
        const label = resolveManifestHeroId(hero, manifestHeroes) || String(hero || '').trim();
        if (!label) continue;
        // resolveManifestHeroId returns the input when unknown — only keep real roster ids.
        const isRoster = (manifestHeroes || []).some((entry) =>
            heroNamesMatch(entry, label, manifestHeroes),
        );
        if (!isRoster) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        options.push(label);
    }

    return options.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}
