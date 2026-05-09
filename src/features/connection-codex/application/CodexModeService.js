/**
 * Codex mode: alternate to the timeline globe/map. Unloads WebGL + map layer while keeping events UI.
 */

import { initCodexCanvas, destroyCodexCanvas } from '../services/CodexCanvasService.js';

const CODEX_ROOT_ID = 'codex-view-root';

function codexLoadingStatusHostEl() {
    return document.getElementById('overlayStatusContent');
}

function setCodexOverlayStatusLine(text) {
    // Use the standard updateStatus function for status messages
    if (typeof window.updateStatus === 'function') {
        window.updateStatus(text, 'info');
    }
}

function setCodexEntryOverlayChrome(active) {
    // No-op - main loading overlay handles chrome
}

/**
 * Long synchronous work (Three.js dispose, DOM) can delay painting the in-stage loader.
 * Yield so the browser can composite before that work runs.
 */
function yieldForLoadingOverlayPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 48);
            });
        });
    });
}

/**
 * Clears codex placeholder before (re)initializing the globe.
 * @param {HTMLElement|null} [container]
 */
export function clearCodexShellForGlobeInit(container) {
    const el = container || document.getElementById('globe-container');
    if (!el) return;
    // Always clear container when switching modes - ensures clean state
    el.innerHTML = '';
    document.body.classList.remove('codex-mode-active');
    el.classList.remove('codex-mode');
}

export async function applyCodexShell() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    // Clean slate: clear container and reset mode classes
    container.innerHTML = '';
    document.body.classList.remove('codex-mode-active');
    container.classList.remove('codex-mode');

    const root = document.createElement('div');
    root.id = CODEX_ROOT_ID;
    root.className = 'codex-view-root';
    root.setAttribute('aria-label', 'Codex');
    container.appendChild(root);

    container.style.display = 'block';
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    container.style.width = '100%';
    container.style.height = '100%';
    container.classList.remove('loaded');
    container.classList.add('codex-mode');
    document.body.classList.add('codex-mode-active');

    await initCodexCanvas(root);

    try {
        if (window.NavigationPaginationHelpers?.clearEventPageSliderSuppressFromGlobe) {
            window.NavigationPaginationHelpers.clearEventPageSliderSuppressFromGlobe();
        }
    } catch (_) { /* ignore */ }
}

export async function enterCodexMode() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    // If Codex is already properly initialized (has root element), skip
    if (container.querySelector('#codex-root')) {
        return;
    }

    if (typeof window.unloadGlobeBase !== 'function') {
        return;
    }

    window.__codexInlineLoaderActive = true;
    setCodexEntryOverlayChrome(true);
    window.__codexSetLoadingOverlayLine = setCodexOverlayStatusLine;

    let opened = false;
    try {
        await yieldForLoadingOverlayPaint();

        const gc = window.globeController;
        if (gc?.uiView) {
            window.__codexEventSlideBridge = {
                eventSlideManager: gc.uiView.eventSlideManager,
                uiView: gc.uiView,
                dataModel: gc.dataModel
            };
        }

        if (window.loadedComponents?.globeBase) {
            setCodexOverlayStatusLine('Shutting down timeline (WebGL, map, transport)…');
            await yieldForLoadingOverlayPaint();
            await window.unloadGlobeBase({ preserveEventsUi: true });
        }

        setCodexOverlayStatusLine('Building Codex canvas and loading your layout…');
        await yieldForLoadingOverlayPaint();
        await applyCodexShell();
        opened = true;
    } catch (err) {
        console.warn('CodexModeService.enterCodexMode', err);
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(`Could not open Codex: ${err?.message || 'unknown error'}`, 'error');
        }
    } finally {
        try {
            delete window.__codexSetLoadingOverlayLine;
            window.__codexInlineLoaderActive = false;
        } catch (_) { /* ignore */ }
        await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        setCodexEntryOverlayChrome(false);
    }

    if (!opened) return;

    try {
        localStorage.setItem('currentMode', 'codex');
    } catch (_) { /* ignore */ }

    try {
        window.dispatchEvent(new CustomEvent('appmodechange', { detail: { mode: 'codex' } }));
    } catch (_) { /* ignore */ }
}

if (typeof window !== 'undefined') {
    window.CodexModeService = {
        enterCodexMode,
        applyCodexShell,
        clearCodexShellForGlobeInit
    };
}
