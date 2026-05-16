/**
 * Single boundary for Codex ↔ timeline shell, status line, and browser globals.
 * Keeps `CodexCanvasService` from scattering `window.*` service-locator calls.
 */

export function getEventTimelineDataService() {
    if (typeof window === 'undefined') return null;
    return window.eventManager?.dataService || window.EventDataService || null;
}

/**
 * True when the repo Node server is expected to expose `GET/POST /api/codex` (same rules as EventDataService save).
 */
export function isCodexPersistToRepoAvailable() {
    try {
        const ds = getEventTimelineDataService();
        if (ds && typeof ds._canPersistTimelineJsonToRepo === 'function') {
            return ds._canPersistTimelineJsonToRepo();
        }
        if (ds && typeof ds.isGitHubPages === 'function' && ds.isGitHubPages()) return false;
        if (typeof window === 'undefined') return false;
        const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        const isDevServerPort = String(window.location.port || '') === '8000';
        const isLoopbackHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isHttp && (isDevServerPort || isLoopbackHost);
    } catch (_) {
        return false;
    }
}

export function resolveCodexRepoApiUrl(apiPathWithQuery) {
    if (typeof window === 'undefined') return `/${apiPathWithQuery}`;
    if (typeof window.resolveDevApiUrl === 'function') {
        return window.resolveDevApiUrl(apiPathWithQuery);
    }
    return `/${apiPathWithQuery}`;
}

export function updateAppStatus(message, kind = 'info') {
    if (typeof window === 'undefined') return;
    if (typeof window.updateStatus === 'function') {
        window.updateStatus(message, kind);
    }
}

export function dispatchBioArchivesRefreshed(detail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('atlas-bio-archives-refreshed', { detail }));
}

export function getFactionMatchHelpers() {
    if (typeof window === 'undefined') return null;
    return window.FactionMatchHelpers || null;
}

export function playSoundEffect(name) {
    if (typeof window === 'undefined') return;
    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play(name);
    }
}

export function flashUiButton(el) {
    if (typeof window === 'undefined' || !el) return;
    if (typeof window.flashButton === 'function') {
        window.flashButton(el);
    }
}

export function userConfirms(message) {
    if (typeof window === 'undefined') return false;
    return window.confirm(message);
}

export function getCodexLoadingOverlayLineSetter() {
    if (typeof window === 'undefined') return null;
    return typeof window.__codexSetLoadingOverlayLine === 'function'
        ? window.__codexSetLoadingOverlayLine
        : null;
}

export function getStandaloneActiveFiltersSet() {
    if (typeof window === 'undefined') return null;
    return window.standaloneActiveFilters || null;
}

export function exposeApplyCodexFilterState(fn) {
    if (typeof window === 'undefined') return;
    window.applyCodexFilterState = fn;
}

export function getGlobeController() {
    if (typeof window === 'undefined') return null;
    return window.globeController || null;
}

export function getEventsFromEventManager() {
    if (typeof window === 'undefined') return null;
    return window.eventManager?.events ?? null;
}

export function getStandaloneEventSlide() {
    if (typeof window === 'undefined') return null;
    return window.standaloneEventSlide || null;
}

export function getStoryFilterPlacesSync() {
    if (typeof window === 'undefined') return null;
    return window.StoryFilterPlacesSync || null;
}

export function getEventManager() {
    if (typeof window === 'undefined') return null;
    return window.eventManager || null;
}

export function applyLocationFlagBioHighlight(spec) {
    if (typeof window === 'undefined') return;
    window.LocationFlagHelpers?.applyBioConnectionCodexHighlight?.(spec);
}
