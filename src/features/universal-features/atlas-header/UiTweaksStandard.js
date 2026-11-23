/**
 * UI Tweaks standard — same collab model as Codex / Story JSON:
 * - Committed `src/data/platform/atlas-ui-tweaks.json` is the site look for everyone
 * - Export / Import hand off proposals between collaborators
 * - localStorage holds an optional *draft* while editing (invalidated when standard version bumps)
 */

export const UI_TWEAKS_STANDARD_URL = 'src/data/platform/atlas-ui-tweaks.json';

const DRAFT_KEY = 'atlas.uiTweaks.draft.v1';

/** Legacy per-slice keys — cleared so old browser forks do not override the standard. */
const LEGACY_STORAGE_KEYS = Object.freeze([
    'atlas.headerTitleBadge.tweak.v7',
    'atlas.headerTitleBadge.tweak.v6',
    'atlas.headerTitleBadge.tweak.v5',
    'atlas.headerTitleBadge.tweak.v4',
    'atlas.headerTitleBadge.tweak.v3',
    'atlas.headerTitleBadge.tweak.v2',
    'atlas.headerTitleBadge.tweak.v1',
    'atlas.headerSides.tweak.v1',
    'atlas.sidePanelsTrap.tweak.v2',
    'atlas.sidePanelsTrap.tweak.v1',
]);

/** @type {object | null} */
let cachedStandard = null;

/**
 * @returns {object | null}
 */
export function getCachedUiTweaksStandard() {
    return cachedStandard;
}

/**
 * Fetch the committed site standard (Codex/Story-style data file).
 * @returns {Promise<object>}
 */
export async function loadUiTweaksStandard() {
    const url = `${UI_TWEAKS_STANDARD_URL}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
        throw new Error(`UI Tweaks standard HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data || typeof data !== 'object') {
        throw new Error('UI Tweaks standard is not an object');
    }
    cachedStandard = data;
    return data;
}

/**
 * @param {number} [standardVersion] — when omitted, skip version gate (boot before JSON fetch)
 * @returns {object | null}
 */
export function readUiTweaksDraft(standardVersion) {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const draftVer = Number(parsed.version);
        const stdVer = Number(standardVersion);
        if (Number.isFinite(stdVer) && Number.isFinite(draftVer) && draftVer !== stdVer) {
            clearUiTweaksDraft();
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Sync boot source: saved draft (preferred) → cached standard → null.
 * Used by badge/sides/panels loaders so reload applies the draft before/without
 * waiting on the async JSON fetch.
 * @returns {object | null}
 */
export function resolveUiTweaksSyncPayload() {
    const cachedVer = Number(cachedStandard?.version);
    const draft = readUiTweaksDraft(
        Number.isFinite(cachedVer) ? cachedVer : undefined,
    );
    if (draft) return draft;
    return cachedStandard;
}

/**
 * @param {object} payload — same shape as Export (`version`, `badge`, `sides`, `panels`)
 */
export function writeUiTweaksDraft(payload) {
    try {
        clearLegacyUiTweaksStorage();
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
        /* ignore */
    }
}

export function clearUiTweaksDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch {
        /* ignore */
    }
    clearLegacyUiTweaksStorage();
}

export function clearLegacyUiTweaksStorage() {
    try {
        for (const key of LEGACY_STORAGE_KEYS) {
            localStorage.removeItem(key);
        }
    } catch {
        /* ignore */
    }
}
