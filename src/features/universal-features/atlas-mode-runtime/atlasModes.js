/**
 * Canonical Atlas mode ids and display labels.
 *
 * Persisted in `localStorage.currentMode` and `loadedComponents` mode flags.
 * Legacy ids (globe, glossary, biography, …) are normalized on read.
 */

/** @typedef {typeof ATLAS_MODE[keyof typeof ATLAS_MODE]} AtlasModeId */

export const ATLAS_MODE = Object.freeze({
    MENU: 'menu',
    WORLD: 'world',
    CODEX: 'codex',
    DATA_WORKSHOP: 'dataWorkshop',
    STORY: 'story',
    GALLERY: 'gallery',
    OFFICIAL_ARCHIVE: 'officialArchive',
    DIALOGUE_THEATER: 'dialogueTheater',
});

/** User-facing mode names (menu, header, loading overlay). */
export const MODE_LABEL = Object.freeze({
    [ATLAS_MODE.MENU]: 'Menu',
    [ATLAS_MODE.WORLD]: 'World',
    [ATLAS_MODE.CODEX]: 'Codex',
    [ATLAS_MODE.DATA_WORKSHOP]: 'Data Workshop',
    [ATLAS_MODE.STORY]: 'Story',
    [ATLAS_MODE.GALLERY]: 'Gallery',
    [ATLAS_MODE.OFFICIAL_ARCHIVE]: 'Official Archive',
    [ATLAS_MODE.DIALOGUE_THEATER]: 'Dialogue Theater',
});

/** @type {Readonly<Record<string, AtlasModeId>>} */
const LEGACY_MODE_ALIASES = Object.freeze({
    globe: ATLAS_MODE.WORLD,
    timeline: ATLAS_MODE.WORLD,
    interactiveworldview: ATLAS_MODE.WORLD,
    glossary: ATLAS_MODE.CODEX,
    connectioncodex: ATLAS_MODE.CODEX,
    biography: ATLAS_MODE.DATA_WORKSHOP,
    dataarchive: ATLAS_MODE.DATA_WORKSHOP,
    storytimeline: ATLAS_MODE.STORY,
    herobiography: ATLAS_MODE.GALLERY,
    officialresources: ATLAS_MODE.OFFICIAL_ARCHIVE,
    dialoguetheater: ATLAS_MODE.DIALOGUE_THEATER,
});

const CANONICAL_MODE_IDS = new Set(Object.values(ATLAS_MODE));

/**
 * @param {string | null | undefined} mode
 * @returns {AtlasModeId | 'menu'}
 */
export function normalizeAtlasMode(mode) {
    if (mode == null || mode === '') {
        return ATLAS_MODE.MENU;
    }
    const raw = mode.toString().trim();
    const lower = raw.toLowerCase();
    const compact = lower.replace(/[\s_-]/g, '');

    if (LEGACY_MODE_ALIASES[compact]) {
        return LEGACY_MODE_ALIASES[compact];
    }
    if (LEGACY_MODE_ALIASES[lower]) {
        return LEGACY_MODE_ALIASES[lower];
    }
    if (CANONICAL_MODE_IDS.has(raw)) {
        return /** @type {AtlasModeId} */ (raw);
    }
    for (const id of CANONICAL_MODE_IDS) {
        if (id.toLowerCase() === lower || id.toLowerCase() === compact) {
            return id;
        }
    }
    return ATLAS_MODE.MENU;
}

/**
 * @param {string | null | undefined} mode
 * @returns {string}
 */
export function modeDisplayLabel(mode) {
    const id = normalizeAtlasMode(mode);
    return MODE_LABEL[id] || id;
}

/**
 * @param {string | null | undefined} a
 * @param {AtlasModeId | string} b
 * @returns {boolean}
 */
export function isAtlasMode(a, b) {
    return normalizeAtlasMode(a) === normalizeAtlasMode(b);
}
