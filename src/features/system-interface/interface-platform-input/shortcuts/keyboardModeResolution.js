/**
 * The keyboard layer drives three subtly different UIs — globe timeline,
 * Codex (events table, no globe), and the standalone TEST harness — so before
 * dispatching pagination keys we need to resolve which dataModel / uiView /
 * standalone-slide pair is active right now.
 *
 * `codexOrGlobeDataModel` and `codexOrGlobeUiView` walk the candidate chain;
 * `canUseTimelinePaginationShortcuts` says whether A/D and digit keys should
 * page events given the current mode + DOM state.
 */

export function isGlobeTimelineMode() {
    const mode = (typeof localStorage !== 'undefined' && localStorage.getItem('currentMode')) || '';
    const normalized = mode.toString().toLowerCase().replace(/[\s_-]/g, '');
    return (normalized === 'world' || normalized === 'globe' || normalized === 'timeline') && !!window.globeController;
}

export function isCodexModeActive() {
    return typeof document !== 'undefined' && document.body && document.body.classList.contains('codex-mode-active');
}

export function codexOrGlobeDataModel() {
    const gc = window.globeController;
    if (gc && gc.dataModel) return gc.dataModel;
    const br = window.__codexEventSlideBridge;
    if (br && br.dataModel) return br.dataModel;
    /* Standalone event system (TEST harness). */
    if (window.eventManager?.events) return window.eventManager;
    return null;
}

export function codexOrGlobeUiView() {
    const gc = window.globeController;
    if (gc && gc.uiView) return gc.uiView;
    const br = window.__codexEventSlideBridge;
    if (br && br.uiView) return br.uiView;
    if (window.standaloneEventSlide) return window.standaloneEventSlide;
    return null;
}

export function canNavigateGlobePages() {
    const dm = codexOrGlobeDataModel();
    return dm && typeof dm.getTotalEventPages === 'function' && dm.getTotalEventPages() > 1;
}

/** Globe timeline or Codex: same events UI / dataModel (bridge), but no WebGL globe. */
export function canUseTimelinePaginationShortcuts() {
    if (isGlobeTimelineMode()) return true;
    /* Standalone TEST mode: pagination dock is present and standaloneEventSlide is active. */
    const hasPaginationDock = !!document.getElementById('paginationDock');
    const hasStandaloneSlide = !!window.standaloneEventSlide;
    if (hasPaginationDock && hasStandaloneSlide) return true;
    if (!isCodexModeActive()) return false;
    return !!(codexOrGlobeDataModel() && codexOrGlobeUiView());
}
