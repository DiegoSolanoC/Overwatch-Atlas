/**
 * Theater voiceline filenames: `{Hero}_-_{dialogue_with_underscores}.ogg`
 */

export const VOICELINE_HERO_DIALOGUE_SEPARATOR = '_-_';

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeHeroKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function stripVoicelineExtension(filename) {
    return String(filename || '')
        .trim()
        .replace(/\.[^.\\/]+$/, '');
}

/**
 * @param {string} filename
 * @returns {{ hero: string, dialoguePart: string, basename: string }}
 */
export function parseVoicelineFilename(filename) {
    const basename = stripVoicelineExtension(filename);
    const sepIdx = basename.indexOf(VOICELINE_HERO_DIALOGUE_SEPARATOR);
    if (sepIdx < 0) {
        return { hero: '', dialoguePart: basename, basename };
    }
    return {
        hero: basename.slice(0, sepIdx),
        dialoguePart: basename.slice(sepIdx + VOICELINE_HERO_DIALOGUE_SEPARATOR.length),
        basename,
    };
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function voicelineFilenameToSubtitles(filename) {
    const { dialoguePart } = parseVoicelineFilename(filename);
    return dialoguePart.replace(/_/g, ' ').trim();
}

/**
 * Normalize user search text: spaces become underscores to match filenames.
 * @param {string} text
 * @returns {string}
 */
export function normalizeVoicelineSearch(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function voicelineMatchRank(haystack, needle) {
    const h = normalizeVoicelineSearch(haystack);
    const n = normalizeVoicelineSearch(needle);
    if (!n) return 0;
    if (!h.includes(n)) return Infinity;
    if (h.startsWith(n)) return 0;
    return 1 + h.indexOf(n);
}

/**
 * Strip cosmetic skin prefixes like `"Space Prince" Lúcio` → `Lúcio`.
 * @param {string} heroName
 * @returns {string}
 */
export function heroNameForVoicelineMatch(heroName) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed) return '';

    const withoutLeadingSkin = trimmed.replace(/^"[^"]+"\s+/, '').trim();
    const unquoted = withoutLeadingSkin.replace(/"([^"]+)"/g, '$1').trim();
    return unquoted || trimmed;
}

/**
 * @param {string} filename
 * @param {string} heroName
 * @returns {boolean}
 */
export function voicelineBelongsToHero(filename, heroName) {
    const hero = heroNameForVoicelineMatch(heroName);
    if (!hero) return false;
    const parsed = parseVoicelineFilename(filename);
    const target = normalizeHeroKey(hero);
    const fileHero = normalizeHeroKey(parsed.hero);
    if (target.length > 0 && fileHero === target) return true;

    // Filename hero can be a short form (e.g. Lucio vs Lúcio).
    return target.length > 0 && (target.includes(fileHero) || fileHero.includes(target));
}

/**
 * @param {string} heroName
 * @param {string[]} voicelines
 * @returns {string[]}
 */
export function listVoicelinesForHero(heroName, voicelines) {
    const hero = String(heroName || '').trim();
    if (!hero || !Array.isArray(voicelines)) return [];
    return voicelines.filter((file) => voicelineBelongsToHero(file, hero));
}

/**
 * @param {string} heroName
 * @param {string[]} voicelines
 * @param {string} query
 * @param {number} [limit=8]
 * @returns {string[]}
 */
export function matchVoicelinesForHero(heroName, voicelines, query, limit = 8) {
    const pool = listVoicelinesForHero(heroName, voicelines);
    const needle = normalizeVoicelineSearch(query);
    if (!needle) return pool.slice(0, limit);

    return pool
        .filter((file) => {
            const { dialoguePart } = parseVoicelineFilename(file);
            const dialogueNorm = normalizeVoicelineSearch(dialoguePart);
            const fileNorm = normalizeVoicelineSearch(stripVoicelineExtension(file));
            return dialogueNorm.includes(needle) || fileNorm.includes(needle);
        })
        .sort((a, b) => {
            const aDialogue = parseVoicelineFilename(a).dialoguePart;
            const bDialogue = parseVoicelineFilename(b).dialoguePart;
            const rankDiff =
                voicelineMatchRank(aDialogue, query) - voicelineMatchRank(bDialogue, query);
            if (rankDiff !== 0) return rankDiff;
            return aDialogue.length - bDialogue.length;
        })
        .slice(0, limit);
}

import { stripDialogueSubtitleMarkup } from './dialogueSubtitleFormatting.js';

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeSubtitlesForMatch(text) {
    return normalizeVoicelineSearch(
        stripDialogueSubtitleMarkup(text)
            .replace(/[\u2018\u2019\u201C\u201D`]/g, '')
            .replace(/[.,!?;:'"()]+/g, ' '),
    );
}

/** Minimum normalized length for a partial subtitle ↔ filename match. */
const MIN_PARTIAL_VOICELINE_MATCH_LEN = 10;

/**
 * @param {string} target normalized subtitle text
 * @param {string} candidate normalized voiceline dialogue
 * @returns {number}
 */
function scorePartialVoicelineMatch(target, candidate) {
    if (!target || !candidate) return 0;
    if (target === candidate) return Number.POSITIVE_INFINITY;

    const shorter = Math.min(target.length, candidate.length);
    const longer = Math.max(target.length, candidate.length);
    if (shorter < MIN_PARTIAL_VOICELINE_MATCH_LEN && longer > shorter * 3) return 0;

    if (target.includes(candidate)) return candidate.length;
    if (candidate.includes(target)) return target.length;
    return 0;
}

/**
 * @param {string} heroName
 * @param {string} subtitles
 * @param {string[]} voicelines
 * @returns {string}
 */
export function findVoicelineForHeroAndSubtitles(heroName, subtitles, voicelines) {
    const pool = listVoicelinesForHero(heroName, voicelines);
    const target = normalizeSubtitlesForMatch(subtitles);
    if (!target || pool.length === 0) return '';

    for (let i = 0; i < pool.length; i += 1) {
        const file = pool[i];
        const candidate = normalizeSubtitlesForMatch(voicelineFilenameToSubtitles(file));
        if (candidate === target) return file;
    }

    let bestFile = '';
    let bestScore = 0;
    for (let i = 0; i < pool.length; i += 1) {
        const file = pool[i];
        const candidate = normalizeSubtitlesForMatch(voicelineFilenameToSubtitles(file));
        const score = scorePartialVoicelineMatch(target, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestFile = file;
        }
    }

    return bestScore >= MIN_PARTIAL_VOICELINE_MATCH_LEN ? bestFile : '';
}

/**
 * @param {{ hero?: string, voice?: string, subtitles?: string }} line
 * @param {string[]} voicelines
 * @returns {string}
 */
export function resolveLineVoiceFile(line, voicelines) {
    const stored = String(line?.voice || '').trim();
    if (stored && /\.(ogg|mp3|wav|m4a|webm)$/i.test(stored)) {
        const hero = String(line?.hero || '').trim();
        if (!hero || voicelineBelongsToHero(stored, hero)) return stored;
        // Imported lines can carry skin-prefixed hero labels — keep an explicit voice file.
        if (!Array.isArray(voicelines) || voicelines.length === 0 || voicelines.includes(stored)) {
            return stored;
        }
    }

    return findVoicelineForHeroAndSubtitles(
        line?.hero || '',
        line?.subtitles || '',
        voicelines,
    );
}
