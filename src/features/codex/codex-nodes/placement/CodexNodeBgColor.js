/** Default hex portrait fill when no custom bgColor is saved. */
export const CODEX_NODE_BG_DEFAULT = '#a8adb4';

/** Legacy portrait fills treated as the default (was pure white). */
const CODEX_NODE_BG_LEGACY_DEFAULTS = new Set([
    '',
    '#ffffff',
    '#fff',
    'ffffff',
    'fff',
]);

/**
 * @param {string | null | undefined} bgColor
 * @returns {boolean}
 */
export function isCodexNodeBgDefault(bgColor) {
    return CODEX_NODE_BG_LEGACY_DEFAULTS.has(String(bgColor || '').trim().toLowerCase());
}

/**
 * @param {string | null | undefined} bgColor
 * @returns {string}
 */
export function resolveCodexNodeBgColor(bgColor) {
    if (isCodexNodeBgDefault(bgColor)) return CODEX_NODE_BG_DEFAULT;
    const raw = String(bgColor || '').trim();
    if (!raw) return CODEX_NODE_BG_DEFAULT;
    return raw.startsWith('#') ? raw : `#${raw}`;
}

/**
 * @param {string | null | undefined} bgColor
 * @returns {string | null}
 */
export function serializeCodexNodeBgColor(bgColor) {
    if (isCodexNodeBgDefault(bgColor)) return null;
    return resolveCodexNodeBgColor(bgColor);
}
