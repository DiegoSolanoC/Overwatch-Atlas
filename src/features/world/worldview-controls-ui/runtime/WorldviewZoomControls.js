/**
 * WorldviewZoomControls — stylized zoom slider + reset at dock center-top.
 *
 * Delegates to whichever mode is active:
 *   • Codex mode   → `window.CodexCanvasService`
 *   • Globe/map    → `window.globeController.interactionController`
 *
 * Hidden +/- buttons remain in the DOM for keyboard shortcuts.
 */

import { ATLAS_MODE, isAtlasMode } from '../../../universal-features/atlas-mode-runtime/atlasModes.js';
import { getCurrentModeOrMenu } from '../../../universal-features/atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';
import { eventsPanelMountedInStoryArchive } from '../../../data-workshop/archive-support/ArchiveEnvironmentChecks.js';
import { installStageSliderNub } from './stageSliderNub.js';

const ZOOM_NUB_ICON = 'src/assets/images/Icons/Utility%20Icons/Zoom%20Icon.png';

let zoomControlsLifecycleInitialized = false;
let waitingForGlobeReady = false;
let sliderSyncPaused = false;

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
        zoomSlider: document.getElementById('zoomSlider'),
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

function readActiveZoomNormalized() {
    if (isCodexModeActive()) {
        const cx = window.CodexCanvasService;
        if (cx && typeof cx.getZoomNormalized === 'function') return cx.getZoomNormalized();
        return 0;
    }
    const ic = window.globeController?.interactionController;
    if (ic && typeof ic.getZoomNormalized === 'function') return ic.getZoomNormalized();
    return 0;
}

function writeActiveZoomNormalized(t) {
    if (isCodexModeActive()) {
        const cx = window.CodexCanvasService;
        if (cx && typeof cx.setZoomNormalized === 'function') cx.setZoomNormalized(t);
        return;
    }
    const ic = window.globeController?.interactionController;
    if (ic && typeof ic.setZoomNormalized === 'function') ic.setZoomNormalized(t);
}

function syncSliderFromScene(zoomSlider) {
    if (!zoomSlider || sliderSyncPaused) return;
    const t = readActiveZoomNormalized();
    const next = Math.round(Math.max(0, Math.min(1, t)) * 100);
    if (Number(zoomSlider.value) !== next) {
        zoomSlider.value = String(next);
    }
    if (typeof zoomSlider.__stageNubSync === 'function') {
        zoomSlider.__stageNubSync();
    }
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
            const { zoomSlider } = getZoomControlsElements();
            syncSliderFromScene(zoomSlider);
        } else {
            zoomControls.classList.remove('visible');
        }
    };
}

function bindZoomButtonHandlers(zoomInBtn, zoomResetBtn, zoomOutBtn, zoomSlider) {
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCodexModeActive()) {
                const cx = window.CodexCanvasService;
                if (cx && typeof cx.zoomIn === 'function') cx.zoomIn();
            } else if (window.globeController?.interactionController) {
                window.globeController.interactionController.zoomIn();
            }
            syncSliderFromScene(zoomSlider);
        });
    }

    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCodexModeActive()) {
                const cx = window.CodexCanvasService;
                if (cx && typeof cx.resetView === 'function') cx.resetView();
            } else if (window.globeController?.interactionController) {
                window.globeController.interactionController.resetToDefault();
            }
            syncSliderFromScene(zoomSlider);
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCodexModeActive()) {
                const cx = window.CodexCanvasService;
                if (cx && typeof cx.zoomOut === 'function') cx.zoomOut();
            } else if (window.globeController?.interactionController) {
                window.globeController.interactionController.zoomOut();
            }
            syncSliderFromScene(zoomSlider);
        });
    }

    if (zoomSlider) {
        const applyFromSlider = () => {
            const t = Number(zoomSlider.value) / 100;
            writeActiveZoomNormalized(t);
        };
        zoomSlider.addEventListener('pointerdown', () => { sliderSyncPaused = true; });
        zoomSlider.addEventListener('pointerup', () => { sliderSyncPaused = false; syncSliderFromScene(zoomSlider); });
        zoomSlider.addEventListener('pointercancel', () => { sliderSyncPaused = false; });
        zoomSlider.addEventListener('input', applyFromSlider);
        zoomSlider.addEventListener('change', () => {
            sliderSyncPaused = false;
            applyFromSlider();
        });
    }

    window.addEventListener('atlas-zoom-changed', () => syncSliderFromScene(zoomSlider));
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

    const POLL_VISIBILITY_INTERVAL_MS = 500;
    setInterval(updateZoomControlsVisibility, POLL_VISIBILITY_INTERVAL_MS);
}

export function setupZoomControls() {
    const { zoomInBtn, zoomResetBtn, zoomOutBtn, zoomSlider, zoomControls } = getZoomControlsElements();

    if ((zoomSlider || (zoomInBtn && zoomOutBtn)) && !zoomControlsLifecycleInitialized) {
        zoomControlsLifecycleInitialized = true;

        const updateZoomControlsVisibility = buildVisibilityUpdater(zoomControls);

        bindZoomButtonHandlers(zoomInBtn, zoomResetBtn, zoomOutBtn, zoomSlider);
        observeVisibilityChanges(updateZoomControlsVisibility);
    }

    if (zoomSlider) {
        const shell = zoomSlider.closest('.stage-slider-shell') || zoomSlider.parentElement;
        installStageSliderNub(shell, zoomSlider, ZOOM_NUB_ICON);
    }

    const updateNow = buildVisibilityUpdater(zoomControls);
    updateNow();
    syncSliderFromScene(zoomSlider);

    if (!isGlobeInteractionReady()) {
        pollUntilGlobeReadyThenRebind();
    }
}
