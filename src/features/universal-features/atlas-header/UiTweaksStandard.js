/**
 * UI Tweaks standard — same collab model as Codex / Story JSON:
 * - Committed `src/data/platform/atlas-ui-tweaks.json` is the site look for everyone
 * - On localhost, Save POSTs that file via `/api/ui-tweaks` (push ships it)
 * - localStorage holds an optional *draft* while editing (invalidated when standard version bumps)
 */

export const UI_TWEAKS_STANDARD_URL = 'src/data/platform/atlas-ui-tweaks.json';
export const UI_TWEAKS_REPO_API = 'api/ui-tweaks';

const DRAFT_KEY = 'atlas.uiTweaks.draft.v1';
const PROMOTE_FLAG_KEY = 'atlas.uiTweaks.promotedDraftOnce.v1';

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
 * @param {object | null} data
 */
export function setCachedUiTweaksStandard(data) {
    cachedStandard = data && typeof data === 'object' ? data : null;
}

/**
 * True when the local Node server can write `atlas-ui-tweaks.json` (not GitHub Pages).
 * @returns {boolean}
 */
export function isUiTweaksRepoSaveAvailable() {
    try {
        if (typeof window === 'undefined') return false;
        if (typeof window.EventDataService?.isGitHubPages === 'function' && window.EventDataService.isGitHubPages()) {
            return false;
        }
        const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        const isDevServerPort = String(window.location.port || '') === '8000';
        const isLoopbackHost =
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isHttp && (isDevServerPort || isLoopbackHost);
    } catch {
        return false;
    }
}

/**
 * @param {string} apiPathWithQuery
 * @returns {string}
 */
export function resolveUiTweaksRepoApiUrl(apiPathWithQuery) {
    if (typeof window === 'undefined') return `/${apiPathWithQuery}`;
    if (typeof window.resolveDevApiUrl === 'function') {
        return window.resolveDevApiUrl(apiPathWithQuery);
    }
    return `/${apiPathWithQuery}`;
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
 * Write the site standard on the local Node server (localhost only).
 * @param {object} payload
 * @returns {Promise<{ ok: true, version: number } | { ok: false, error: string }>}
 */
export async function saveUiTweaksStandardToRepo(payload) {
    if (!isUiTweaksRepoSaveAvailable()) {
        return { ok: false, error: 'Repo save only works on the local Atlas server (localhost:8000)' };
    }
    try {
        const res = await fetch(resolveUiTweaksRepoApiUrl(UI_TWEAKS_REPO_API), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: data?.error || data?.detail || `HTTP ${res.status}` };
        }
        cachedStandard = payload;
        return { ok: true, version: Number(data?.version) || Number(payload.version) || 1 };
    } catch (err) {
        return { ok: false, error: err?.message || 'Network error' };
    }
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

/**
 * One-shot: if this browser still has a draft that differs from the committed
 * JSON, write that draft as the new site standard (localhost only).
 * @param {object} standard
 * @returns {Promise<object | null>} promoted payload, or null
 */
export async function promoteUiTweaksDraftToRepoIfNeeded(standard) {
    if (!isUiTweaksRepoSaveAvailable()) return null;
    try {
        if (localStorage.getItem(PROMOTE_FLAG_KEY) === '1') return null;
    } catch {
        /* ignore */
    }

    const draft = readUiTweaksDraft(undefined);
    if (!draft?.badge || !draft?.sides || !draft?.panels) return null;

    const stdVer = Number(standard?.version) || 1;
    const nextVersion = stdVer + 1;
    const payload = {
        kind: 'atlas-ui-tweaks',
        version: nextVersion,
        exportedAt: new Date().toISOString(),
        note: 'Site chrome standard. Save in UI Tweaks (localhost) writes this file; push to ship for everyone.',
        badge: draft.badge,
        sides: draft.sides,
        panels: draft.panels,
    };

    const sameAsStandard =
        standard
        && JSON.stringify(standard.badge) === JSON.stringify(payload.badge)
        && JSON.stringify(standard.sides) === JSON.stringify(payload.sides)
        && JSON.stringify(standard.panels) === JSON.stringify(payload.panels);

    if (sameAsStandard) {
        try {
            localStorage.setItem(PROMOTE_FLAG_KEY, '1');
        } catch {
            /* ignore */
        }
        clearUiTweaksDraft();
        return null;
    }

    const result = await saveUiTweaksStandardToRepo(payload);
    if (!result.ok) {
        console.warn('[UI Tweaks] could not promote local draft to site standard:', result.error);
        return null;
    }

    try {
        localStorage.setItem(PROMOTE_FLAG_KEY, '1');
    } catch {
        /* ignore */
    }
    writeUiTweaksDraft(payload);
    console.info(`[UI Tweaks] promoted local draft → atlas-ui-tweaks.json (v${payload.version})`);
    return payload;
}
