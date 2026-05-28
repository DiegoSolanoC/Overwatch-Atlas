/**
 * WorldviewZoomControls — wires the floating zoom in / reset / out buttons.
 *
 * The buttons delegate to whichever mode is currently active:
 *   • Codex mode   → `window.CodexCanvasService.{zoomIn,resetView,zoomOut}`
 *   • Globe mode   → `window.globeController.interactionController.{zoomIn,resetToDefault,zoomOut}`
 *
 * Visibility: shown only in Codex or loaded Worldview (globe/map), not on the main
 * menu or Data Archive. Archive is detected via persisted mode + story viewer shell.
 *
 * Lives in `world/worldview-controls-ui/runtime/` because the controls are owned by the
 * world/codex modes — AppInitializer only kicks the setup off at boot time.
 */

import { ATLAS_MODE, isAtlasMode } from '../../../universal-features/atlas-mode-runtime/atlasModes.js';
import { getCurrentModeOrMenu } from '../../../universal-features/atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';
import { eventsPanelMountedInStoryArchive } from '../../../data-workshop/archive-support/ArchiveEnvironmentChecks.js';

let zoomControlsLifecycleInitialized = false;
let waitingForGlobeReady = false;

/**
 * The globe controller's `interactionController` is what powers the zoom
 * buttons in worldview mode. It only appears once the globe finishes
 * loading, which can happen after `setupZoomControls()` first runs at boot
 * time. These constants drive a short polling loop that re-runs setup once
 * the controller shows up so the buttons start working without a refresh.
 */
const GLOBE_READY_POLL_INTERVAL_MS = 500;
const GLOBE_READY_POLL_TIMEOUT_MS = 10_000;

function isGlobeInteractionReady() {
    return !!(window.globeController && window.globeController.interactionController);
}

function pollUntilGlobeReadyThenRebind() {
    if (waitingForGlobeReady) return;
    waitingForGlobeReady = true;

    const handle = setInterval(() => {
        if (!isGlobeInteractionReady()) return;
        clearInterval(handle);
        waitingForGlobeReady = false;
        setupZoomControls();
    }, GLOBE_READY_POLL_INTERVAL_MS);

    setTimeout(() => {
        clearInterval(handle);
        waitingForGlobeReady = false;
    }, GLOBE_READY_POLL_TIMEOUT_MS);
}

function isCodexModeActive() {
    return typeof document !== 'undefined' && document.body.classList.contains('codex-mode-active');
}

/** Data Archive / story viewer — zoom is for panning the globe or codex board only. */
function isDataArchiveActive() {
    if (isAtlasMode(getCurrentModeOrMenu(), ATLAS_MODE.DATA_WORKSHOP)) return true;
    const story = document.getElementById('storyViewerContainer');
    if (story?.classList.contains('active')) return true;
    return eventsPanelMountedInStoryArchive();
}

function getZoomControlsElements() {
    return {
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomControls: document.getElementById('zoomControls')
    };
}

function isMenuVisible() {
    const testContainer = document.querySelector('.test-container');
    if (!testContainer) return false;
    if (testContainer.style.display === 'none') return false;
    if (testContainer.style.opacity === '0') return false;
    const cs = window.getComputedStyle(testContainer);
    if (cs.display === 'none') return false;
    return parseFloat(cs.opacity) > 0;
}

function buildVisibilityUpdater(zoomControls) {
    return function updateZoomControlsVisibility() {
        if (!zoomControls) return;
        const globeContainer = document.getElementById('globe-container');
        const globeLoaded = globeContainer && globeContainer.classList.contains('loaded');
        const codexActive = isCodexModeActive();

        if (isDataArchiveActive()) {
            zoomControls.classList.remove('visible');
        } else if (codexActive || (globeLoaded && !isMenuVisible())) {
            zoomControls.classList.add('visible');
        } else {
            zoomControls.classList.remove('visible');
        }
    };
}

function bindZoomButtonHandlers(zoomInBtn, zoomResetBtn, zoomOutBtn) {
    zoomInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isCodexModeActive()) {
            const cx = window.CodexCanvasService;
            if (cx && typeof cx.zoomIn === 'function') cx.zoomIn();
        } else if (window.globeController && window.globeController.interactionController) {
            window.globeController.interactionController.zoomIn();
        }
    });

    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCodexModeActive()) {
                const cx = window.CodexCanvasService;
                if (cx && typeof cx.resetView === 'function') cx.resetView();
            } else if (window.globeController && window.globeController.interactionController) {
                window.globeController.interactionController.resetToDefault();
            }
        });
    }

    zoomOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isCodexModeActive()) {
            const cx = window.CodexCanvasService;
            if (cx && typeof cx.zoomOut === 'function') cx.zoomOut();
        } else if (window.globeController && window.globeController.interactionController) {
            window.globeController.interactionController.zoomOut();
        }
    });
}

function observeVisibilityChanges(updateZoomControlsVisibility) {
    const globeContainer = document.getElementById('globe-container');
    const testContainer = document.querySelector('.test-container');
    const observer = new MutationObserver(updateZoomControlsVisibility);
    if (globeContainer) {
        observer.observe(globeContainer, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    if (testContainer) {
        observer.observe(testContainer, { attributes: true, attributeFilter: ['style'] });
    }
    if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    const storyContainer = document.getElementById('storyViewerContainer');
    if (storyContainer) {
        observer.observe(storyContainer, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    window.addEventListener('appmodechange', updateZoomControlsVisibility);

    // Belt-and-suspenders: poll every 500ms in case the observers miss a change
    // (e.g. a class flip that happens before they're attached).
    const POLL_VISIBILITY_INTERVAL_MS = 500;
    setInterval(updateZoomControlsVisibility, POLL_VISIBILITY_INTERVAL_MS);
}

export function setupZoomControls() {
    const { zoomInBtn, zoomResetBtn, zoomOutBtn, zoomControls } = getZoomControlsElements();

    if (zoomInBtn && zoomOutBtn && !zoomControlsLifecycleInitialized) {
        zoomControlsLifecycleInitialized = true;

        const updateZoomControlsVisibility = buildVisibilityUpdater(zoomControls);

        bindZoomButtonHandlers(zoomInBtn, zoomResetBtn, zoomOutBtn);
        observeVisibilityChanges(updateZoomControlsVisibility);
    }

    // Always run an immediate update so the controls match current state
    // even on the second invocation (when the lifecycle is already wired).
    const updateNow = buildVisibilityUpdater(zoomControls);
    updateNow();

    // If the globe's interaction controller hasn't appeared yet, schedule
    // a re-setup for when it does. Caller (e.g. AppInitializer at boot)
    // doesn't have to know about this — the service owns its own readiness.
    if (!isGlobeInteractionReady()) {
        pollUntilGlobeReadyThenRebind();
    }
}
