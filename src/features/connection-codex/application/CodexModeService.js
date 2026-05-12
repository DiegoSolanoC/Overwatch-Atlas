/**
 * Codex mode: alternate to the timeline globe/map. Unloads WebGL + map layer while keeping events UI.
 *
 * Load progress (overlay bar + status text) is driven through the shared
 * `createLoadProgressTracker` so Codex feels the same as Worldview and
 * Data Archive: every stage has a label, the bar reflects the
 * declared-stages-done percentage, and it reaches 100% on success.
 */

import { initCodexCanvas, destroyCodexCanvas } from '../services/CodexCanvasService.js';
import { createLoadProgressTracker } from '../../universal-features/runtime/loadProgressTracker.js';
import { updateStatus } from '../../universal-features/runtime/statusFeed.js';

const CODEX_ROOT_ID = 'codex-view-root';

/**
 * Declared stages for `enterCodexMode`. We always declare the timeline
 * shutdown stage even when there is no live globe to tear down — that
 * way it simply skips and the bar still totals 100%.
 */
const CODEX_LOAD_STAGES = Object.freeze([
    { id: 'shutdownTimeline', label: 'Shutting down timeline (WebGL + map + transport)' },
    { id: 'mountShell', label: 'Mounting Codex shell' },
    { id: 'loadCanvas', label: 'Loading Codex canvas + layout' }
]);

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

/**
 * DOM-only Codex shell mount: clears `#globe-container`, attaches the
 * Codex root element, and flips the mode classes. Separated from
 * `initCodexCanvas` so the staged loader can report a real percentage
 * for "mount shell" before the slower "load canvas + layout" stage.
 *
 * @returns {HTMLElement|null} The created Codex root element.
 */
async function mountCodexShellDom() {
    const container = document.getElementById('globe-container');
    if (!container) return null;

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

    return root;
}

/**
 * Legacy entry: mount the DOM and immediately load the Codex canvas in
 * one call. Kept for external callers (`window.CodexModeService.applyCodexShell`
 * and the `index.js` re-export); `enterCodexMode` now drives the two
 * halves separately so each can contribute its own percentage.
 */
export async function applyCodexShell() {
    const root = await mountCodexShellDom();
    if (!root) return;

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
    window.__codexSetLoadingOverlayLine = (text) => updateStatus(text, 'info');

    const progress = createLoadProgressTracker({
        modeLabel: 'Codex',
        stages: CODEX_LOAD_STAGES
    });
    progress.start('🚀 Starting Codex…');

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
            await progress.runStage(
                'shutdownTimeline',
                async () => {
                    await yieldForLoadingOverlayPaint();
                    await window.unloadGlobeBase({ preserveEventsUi: true });
                },
                { beginMessage: '→ Codex — shutting down timeline (WebGL + map + transport)…' }
            );
        } else {
            progress.skipStage(
                'shutdownTimeline',
                '→ Codex — no live timeline to shut down, skipping…'
            );
        }

        await progress.runStage(
            'mountShell',
            async () => {
                await yieldForLoadingOverlayPaint();
                await mountCodexShellDom();
            },
            { beginMessage: '→ Codex — mounting Codex shell…' }
        );

        await progress.runStage(
            'loadCanvas',
            async ({ setProgress }) => {
                const root = document.getElementById(CODEX_ROOT_ID);
                if (!root) {
                    throw new Error('Codex root element missing after shell mount');
                }
                setProgress(0.2);
                await initCodexCanvas(root);
                setProgress(0.9);
                try {
                    if (window.NavigationPaginationHelpers?.clearEventPageSliderSuppressFromGlobe) {
                        window.NavigationPaginationHelpers.clearEventPageSliderSuppressFromGlobe();
                    }
                } catch (_) { /* ignore */ }
            },
            { beginMessage: '→ Codex — loading Codex canvas + layout…' }
        );

        progress.finish('✓ Codex ready');
        opened = true;
    } catch (err) {
        console.warn('CodexModeService.enterCodexMode', err);
        progress.fail(err && err.message ? `Could not open Codex: ${err.message}` : 'Could not open Codex');
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
