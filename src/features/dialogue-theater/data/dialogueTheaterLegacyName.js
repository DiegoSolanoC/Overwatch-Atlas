/**
 * Legacy hero-name handling (Jesse / McCree / Jesse McCree → modern name-stripped playback).
 *
 * Line fields:
 * - voice / subtitles — original Classic recordings (legacy ON)
 * - modernVoice / modernSubtitles — name-cut variants (legacy OFF, default)
 */

/** Detects Jesse, McCree, or Jesse McCree in dialogue text. */
export const LEGACY_HERO_NAME_RE = /\bJesse\s+McCree\b|\bMcCree\b|\bJesse\b/i;

/** Session preference — OFF by default (play name-stripped modern clips when available). */
let legacyNameLinesEnabled = false;

/** @returns {boolean} */
export function isLegacyNameLinesEnabled() {
    return legacyNameLinesEnabled;
}

/**
 * @param {boolean} enabled
 * @returns {boolean}
 */
export function setLegacyNameLinesEnabled(enabled) {
    legacyNameLinesEnabled = Boolean(enabled);
    return legacyNameLinesEnabled;
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
export function subtitlesContainLegacyHeroName(text) {
    return LEGACY_HERO_NAME_RE.test(String(text ?? ''));
}

/**
 * @param {{ subtitles?: string, modernVoice?: string, modernSubtitles?: string }|null|undefined} line
 * @returns {boolean}
 */
export function lineHasLegacyNameFailsafe(line) {
    if (!line || typeof line !== 'object') return false;
    if (subtitlesContainLegacyHeroName(line.subtitles)) return true;
    if (String(line.modernVoice || '').trim()) return true;
    if (String(line.modernSubtitles || '').trim()) return true;
    return false;
}

/**
 * @param {{ lines?: Array<{ subtitles?: string, modernVoice?: string, modernSubtitles?: string }> }|null|undefined} conversation
 * @returns {boolean}
 */
export function conversationHasLegacyNameFailsafe(conversation) {
    const lines = conversation?.lines;
    if (!Array.isArray(lines)) return false;
    return lines.some((line) => lineHasLegacyNameFailsafe(line));
}

/**
 * Resolve the line used for playback / on-screen text.
 * Legacy ON → original voice + subtitles.
 * Legacy OFF (default) → modernVoice / modernSubtitles when present.
 *
 * @template {Record<string, unknown>} T
 * @param {T|null|undefined} line
 * @param {boolean} legacyNameEnabled
 * @returns {T|null|undefined}
 */
export function resolveEffectiveDialogueLine(line, legacyNameEnabled) {
    if (!line || typeof line !== 'object') return line;
    if (legacyNameEnabled) return line;

    const modernVoice = String(line.modernVoice ?? '').trim();
    const modernSubtitles = String(line.modernSubtitles ?? '').trim();
    if (!modernVoice && !modernSubtitles) return line;

    return {
        ...line,
        voice: modernVoice || line.voice,
        subtitles: modernSubtitles || line.subtitles,
    };
}

/**
 * @template {{ lines?: unknown[] }} C
 * @param {C|null|undefined} conversation
 * @param {boolean} legacyNameEnabled
 * @returns {C|null|undefined}
 */
export function withLegacyNamePreference(conversation, legacyNameEnabled) {
    if (!conversation || typeof conversation !== 'object') return conversation;
    const lines = Array.isArray(conversation.lines) ? conversation.lines : [];
    return {
        ...conversation,
        lines: lines.map((line) => resolveEffectiveDialogueLine(line, legacyNameEnabled)),
    };
}
