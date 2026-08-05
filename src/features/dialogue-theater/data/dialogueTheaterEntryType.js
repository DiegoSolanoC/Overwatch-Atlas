/**
 * Dialogue Theater entry kinds — conversations (dialogues) vs Hero Chatters.
 */

/** @typedef {'dialogue'|'chatter'} DialogueTheaterEntryType */

export const DIALOGUE_THEATER_ENTRY_DIALOGUE = 'dialogue';
export const DIALOGUE_THEATER_ENTRY_CHATTER = 'chatter';

/**
 * @param {unknown} raw
 * @returns {DialogueTheaterEntryType}
 */
export function normalizeDialogueTheaterEntryType(raw) {
    const value = String(raw != null ? raw : '').trim().toLowerCase();
    if (value === DIALOGUE_THEATER_ENTRY_CHATTER || value === 'chatters') {
        return DIALOGUE_THEATER_ENTRY_CHATTER;
    }
    return DIALOGUE_THEATER_ENTRY_DIALOGUE;
}

/**
 * @param {{ entryType?: string }|null|undefined} row
 * @returns {boolean}
 */
export function isChatterEntry(row) {
    return normalizeDialogueTheaterEntryType(row?.entryType) === DIALOGUE_THEATER_ENTRY_CHATTER;
}

/**
 * @param {{ entryType?: string }|null|undefined} row
 * @returns {boolean}
 */
export function isDialogueEntry(row) {
    return !isChatterEntry(row);
}

/**
 * Stable id for a seeded Hero Chatter row.
 * @param {string} heroName
 * @returns {string}
 */
export function chatterIdForHero(heroName) {
    const slug = String(heroName || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug ? `chatter-${slug}` : `chatter-${Date.now()}`;
}
