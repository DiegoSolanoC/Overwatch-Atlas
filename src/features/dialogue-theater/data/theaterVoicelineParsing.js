/**
 * Theater voiceline filenames: `{Hero}_-_{dialogue_with_underscores}.ogg`
 */

import { stripDialogueSubtitleMarkup } from './dialogueSubtitleFormatting.js';

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
 * MatchTalk dumps include ability callouts and pure SFX — hide those from dialogue pickers.
 * @param {string} filename
 * @returns {boolean}
 */
export function isLikelyDialogueVoiceline(filename) {
    const { dialoguePart } = parseVoicelineFilename(filename);
    const text = String(dialoguePart || '').replace(/_/g, ' ').trim();
    if (!text) return false;

    // Pure SFX / ability callouts like (breathes) or (Chain Throw)
    if (/^\([^)]+\)$/i.test(text)) return false;

    return true;
}

/**
 * @param {string} heroName
 * @param {string[]} voicelines
 * @returns {string[]}
 */
export function listDialogueVoicelinesForHero(heroName, voicelines) {
    return listVoicelinesForHero(heroName, voicelines).filter((file) =>
        isLikelyDialogueVoiceline(file),
    );
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
export function matchVoicelinesForHero(heroName, voicelines, query, limit = 24) {
    const pool = listDialogueVoicelinesForHero(heroName, voicelines);
    if (pool.length === 0) return [];

    const needle = normalizeVoicelineSearch(stripDialogueSubtitleMarkup(query));

    if (!needle) {
        return pool
            .slice()
            .sort((a, b) =>
                voicelineFilenameToSubtitles(a).localeCompare(voicelineFilenameToSubtitles(b)),
            )
            .slice(0, limit);
    }

    return pool
        .filter((file) => {
            const { dialoguePart } = parseVoicelineFilename(file);
            const preview = voicelineFilenameToSubtitles(file);
            const dialogueNorm = normalizeVoicelineSearch(dialoguePart);
            const previewNorm = normalizeVoicelineSearch(stripDialogueSubtitleMarkup(preview));
            const fileNorm = normalizeVoicelineSearch(stripVoicelineExtension(file));
            return (
                dialogueNorm.includes(needle) ||
                previewNorm.includes(needle) ||
                fileNorm.includes(needle)
            );
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

/**
 * @param {{ hero?: string, voice?: string, subtitles?: string }} line
 * @returns {boolean}
 */
export function isWreckingBallHamsterOnlyLine(line) {
    if (!isWreckingBallHero(line?.hero || '')) return false;

    const voice = String(line?.voice || '').trim();
    const cleanSub = stripDialogueSubtitleMarkup(String(line?.subtitles || '')).trim();
    if (cleanSub) return false;

    if (!voice) return true;
    const { dialoguePart } = parseVoicelineFilename(voice);
    return /^\(?(hamster|angry|scared|bashful|unhappy|apologetic|excited)/i.test(dialoguePart);
}

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
    const fullPool = listVoicelinesForHero(heroName, voicelines);
    const dialoguePool = fullPool.filter((file) => isLikelyDialogueVoiceline(file));
    const target = normalizeSubtitlesForMatch(subtitles);
    if (!target || fullPool.length === 0) return '';

    for (let i = 0; i < fullPool.length; i += 1) {
        const file = fullPool[i];
        const candidate = normalizeSubtitlesForMatch(voicelineFilenameToSubtitles(file));
        if (candidate === target) return file;
    }

    let bestFile = '';
    let bestScore = 0;
    for (let i = 0; i < dialoguePool.length; i += 1) {
        const file = dialoguePool[i];
        const candidate = normalizeSubtitlesForMatch(voicelineFilenameToSubtitles(file));
        const score = scorePartialVoicelineMatch(target, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestFile = file;
        }
    }

    return bestScore >= MIN_PARTIAL_VOICELINE_MATCH_LEN ? bestFile : '';
}

export const WRECKING_BALL_HERO = 'Wrecking Ball';

const HAMSTER_VOICELINE_SFX_PREFIXES = [
    '(hamster_noises)_',
    '(angry_squeaks)_',
    '(scared_hamster_noises)_',
    '(unhappy_hamster_noises)_',
    '(apologetic_squeaks)_',
    '(excited_hamster_squeaks)_',
    '(hamster_squeaks)_',
    '(angry_squeaks)_(Chinese)__',
];

const GENERIC_HAMSTER_PREFIX_FILE = 'Wrecking_Ball_-_(hamster_noises).ogg';

/**
 * @param {string} dialoguePart
 * @returns {string}
 */
function stripVoicelineSfxPrefix(dialoguePart) {
    let result = String(dialoguePart || '');
    for (const marker of HAMSTER_VOICELINE_SFX_PREFIXES) {
        if (result.startsWith(marker)) {
            return result.slice(marker.length);
        }
    }
    const parenMatch = result.match(/^\([^)]+\)_+/);
    if (parenMatch) return result.slice(parenMatch[0].length);
    return result;
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
function isHamsterSfxVoiceline(filename) {
    const { dialoguePart } = parseVoicelineFilename(filename);
    return /^\([^)]+\)_/i.test(dialoguePart);
}

/**
 * Strip `_(2)` / `_(3)` variant suffixes from a voiceline dialogue part.
 * @param {string} dialoguePart
 * @returns {string}
 */
function voicelineVariantBase(dialoguePart) {
    return String(dialoguePart || '').replace(/_\(\d+\)$/i, '');
}

/**
 * All hamster-prefix variants sharing the same base filename (e.g. multiple MatchTalk takes).
 * @param {string} prefixFile
 * @param {string[]} voicelines
 * @returns {string[]}
 */
export function listHamsterPrefixVariants(prefixFile, voicelines) {
    const pool = listVoicelinesForHero(WRECKING_BALL_HERO, voicelines);
    if (!prefixFile || pool.length === 0) return [];

    const base = voicelineVariantBase(parseVoicelineFilename(prefixFile).dialoguePart);
    const matches = pool.filter((file) => {
        if (!isHamsterSfxVoiceline(file)) return false;
        return voicelineVariantBase(parseVoicelineFilename(file).dialoguePart) === base;
    });

    if (matches.length > 0) return matches;
    return pool.includes(prefixFile) ? [prefixFile] : [];
}

/**
 * @param {string[]} variants
 * @returns {string}
 */
function pickRandomHamsterVariant(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return '';
    if (variants.length === 1) return variants[0];
    return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * @param {string} translatorFile
 * @param {string[]} voicelines
 * @param {string} [subtitleHint]
 * @returns {string}
 */
export function findHamsterPrefixVoicelineForTranslator(translatorFile, voicelines, subtitleHint = '') {
    const pool = listVoicelinesForHero(WRECKING_BALL_HERO, voicelines);
    if (!translatorFile || pool.length === 0) return '';

    const translatorDialogue = parseVoicelineFilename(translatorFile).dialoguePart;
    const translatorNorm = normalizeSubtitlesForMatch(voicelineFilenameToSubtitles(translatorFile));
    const subtitleNorm = subtitleHint ? normalizeSubtitlesForMatch(subtitleHint) : '';

    for (const sfx of HAMSTER_VOICELINE_SFX_PREFIXES) {
        const candidate = `Wrecking_Ball_-_${sfx}${translatorDialogue}.ogg`;
        if (pool.includes(candidate)) return candidate;
    }

    let bestFile = '';
    let bestScore = 0;
    for (const file of pool) {
        if (!isHamsterSfxVoiceline(file)) continue;
        const stripped = stripVoicelineSfxPrefix(parseVoicelineFilename(file).dialoguePart);
        const candidateNorm = normalizeSubtitlesForMatch(stripped.replace(/_/g, ' '));
        if (candidateNorm === translatorNorm || (subtitleNorm && candidateNorm === subtitleNorm)) {
            return file;
        }
        const score = Math.max(
            scorePartialVoicelineMatch(translatorNorm, candidateNorm),
            subtitleNorm ? scorePartialVoicelineMatch(subtitleNorm, candidateNorm) : 0,
        );
        if (score > bestScore) {
            bestScore = score;
            bestFile = file;
        }
    }
    if (bestScore >= MIN_PARTIAL_VOICELINE_MATCH_LEN) return bestFile;

    return pool.includes(GENERIC_HAMSTER_PREFIX_FILE) ? GENERIC_HAMSTER_PREFIX_FILE : '';
}

/**
 * @param {string} heroName
 * @returns {boolean}
 */
export function isWreckingBallHero(heroName) {
    return normalizeHeroKey(heroName) === normalizeHeroKey(WRECKING_BALL_HERO);
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

/**
 * Hamster squeaks / noises that play before Wrecking Ball's translator voice.
 * @param {{ hero?: string, voicePrefix?: string }} line
 * @param {string[]} voicelines
 * @returns {string}
 */
export function resolveLineVoicePrefixFile(line, voicelines) {
    if (!isWreckingBallHero(line?.hero || '')) return '';
    if (isWreckingBallHamsterOnlyLine(line)) return '';

    const translator = resolveLineVoiceFile(line, voicelines);
    let prefix = '';

    const stored = String(line?.voicePrefix || '').trim();
    if (stored && /\.(ogg|mp3|wav|m4a|webm)$/i.test(stored) && stored !== translator) {
        if (!Array.isArray(voicelines) || voicelines.length === 0 || voicelines.includes(stored)) {
            prefix = stored;
        } else if (voicelineBelongsToHero(stored, WRECKING_BALL_HERO)) {
            prefix = stored;
        }
    }

    if (!prefix && translator) {
        prefix = findHamsterPrefixVoicelineForTranslator(
            translator,
            voicelines,
            String(line?.subtitles || ''),
        );
    }

    if (!prefix || prefix === translator) return '';
    return pickRandomHamsterVariant(listHamsterPrefixVariants(prefix, voicelines));
}

/**
 * Ordered voiceline files for playback (hamster noises first, then translator for Wrecking Ball).
 * @param {{ hero?: string, voice?: string, voicePrefix?: string, subtitles?: string }} line
 * @param {string[]} voicelines
 * @returns {string[]}
 */
export function resolveLineVoicePlaybackFiles(line, voicelines) {
    const main = resolveLineVoiceFile(line, voicelines);
    if (!main) return [];

    if (!isWreckingBallHero(line?.hero || '')) return [main];
    if (isWreckingBallHamsterOnlyLine(line)) return [main];

    const prefix = resolveLineVoicePrefixFile(line, voicelines);
    if (prefix && prefix !== main) return [prefix, main];
    return [main];
}
