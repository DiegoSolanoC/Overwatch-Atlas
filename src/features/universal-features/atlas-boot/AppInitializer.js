/**
 * AppInitializer — the index landing boot sequence.
 *
 * Runs on `DOMContentLoaded`:
 *   1. Marks the body as `app-timeline-default` (simplified default UX).
 *   2. Hides the sidebar on production hosting (GitHub Pages / public site).
 *   3. Shows the loading overlay, waits briefly so `LoadingOrchestrator`
 *      publishes its globals, then in order: loads Universal Features,
 *      loads the Main Menu, and finally mounts the Event System Load Out
 *      (filters panel, pagination dock, news ticker, standalone slide,
 *      manage panel listeners). The overlay only drops once all three
 *      have finished.
 *   4. Wires up cleanup on `beforeunload` / `pagehide` so the globe
 *      releases its WebGL/Three.js resources.
 *   5. Triggers `HeaderModeSynchronization` (`setupHeaderHub`,
 *      `setupOfficialSiteLinkSound`), `setupZoomControls`, and related
 *      helpers — they live in their own modules now.
 *
 * Loaded as an ES module (see `<script type="module">` in index.html).
 * Renamed from `page-init.js` — the old name was historical and vague.
 */

import {
    setupHeaderHub,
    setupOfficialSiteLinkSound
} from '../atlas-header/HeaderModeSynchronization.js';
import { setupZoomControls } from '../../world/worldview-controls-ui/runtime/WorldviewZoomControls.js';
import { loadEventSystem } from '../../system-interface/interface-load-unload/EventSystemLoadOut.js?v=100';
import {
    setRunOperation,
    showLoadingOverlay,
    hideLoadingOverlay
} from '../atlas-mode-runtime/loadingOverlayState.js';

// Side-effect imports: these modules publish globals consumed by
// non-module scripts loaded via classic <script> tags.
import '../atlas-sound-effects/welcomeSoundEffect.js';

// === Constants =========================================================

/** Wait for LoadingOrchestrator (a separate module) to attach its globals before driving them. */
const COMPONENT_LOADER_GLOBALS_READY_MS = 500;
/** Retry once if `runUniversalFeatures` still isn't on `window` after the initial wait. */
const COMPONENT_LOADER_RETRY_MS = 1000;
/** Brief fade after auto-load completes before the overlay disappears. */
const OVERLAY_FADE_OUT_MS = 300;

// === Production env detection ==========================================
// Fires for *any* non-local host so the debug sidebar disappears in
// production (GitHub Pages and similar static hosting).

function isProductionEnv() {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') ||
        hostname.includes('github.com') ||
        (hostname !== 'localhost' &&
            hostname !== '127.0.0.1' &&
            !hostname.startsWith('192.168.') &&
            !hostname.startsWith('10.') &&
            window.location.protocol !== 'file:');
}

if (isProductionEnv()) {
    document.addEventListener('DOMContentLoaded', function () {
        const sidebar = document.getElementById('sidebar');
        const sidebarIndicator = document.getElementById('sidebarIndicator');
        if (sidebar) {
            sidebar.style.display = 'none';
            sidebar.style.visibility = 'hidden';
        }
        if (sidebarIndicator) {
            sidebarIndicator.style.display = 'none';
            sidebarIndicator.style.visibility = 'hidden';
        }
    });
}

// === Main boot sequence ================================================

/**
 * Boot-time overlay control. We delegate to `loadingOverlayState` so the
 * `isRunOperation` flag is set for the *entire* boot chain — that flag
 * makes both `runUniversalFeatures` and `runMenuComponents` skip their own
 * `hideLoadingOverlay()` in `finally`, keeping the overlay opaque from the
 * very first paint until `dropBootOverlay()` is called.
 */
function openBootOverlay() {
    setRunOperation(true);
    showLoadingOverlay();
}

function dropBootOverlay() {
    setRunOperation(false);
    setTimeout(function () {
        hideLoadingOverlay();
    }, OVERLAY_FADE_OUT_MS);
}

function writeOverlayStatus(message) {
    const overlayStatusContent = document.getElementById('overlayStatusContent');
    if (!overlayStatusContent) return;
    overlayStatusContent.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'test-status-item info';
    item.textContent = message;
    overlayStatusContent.appendChild(item);
}

async function autoLoadUniversalFeatures(logPrefix) {
    if (typeof window.runUniversalFeatures === 'function') {
        try {
            // `keepOverlay: true` so the overlay stays up across the
            // Universal → Menu → Event System chain (we drop it once at
            // the very end via `dropBootOverlay()`).
            await window.runUniversalFeatures({ keepOverlay: true });
            console.log(`${logPrefix} ✓ Universal Features auto-loaded`);
        } catch (error) {
            console.error(`${logPrefix} Error auto-loading Universal Features:`, error);
            writeOverlayStatus('Error loading features');
        }
        return;
    }
    console.warn(`${logPrefix} runUniversalFeatures not available yet, retrying...`);
    setTimeout(async function () {
        if (typeof window.runUniversalFeatures === 'function') {
            await window.runUniversalFeatures({ keepOverlay: true });
        }
    }, COMPONENT_LOADER_RETRY_MS);
}

async function autoLoadMenuComponents(logPrefix) {
    if (typeof window.runMenuComponents !== 'function') return;
    try {
        await window.runMenuComponents({ keepOverlay: true });
        console.log(`${logPrefix} ✓ Menu Components auto-loaded`);
    } catch (error) {
        console.error(`${logPrefix} Error auto-loading Menu Components:`, error);
    }
}

/**
 * Mount the Event System Load Out as part of the boot sequence so it's
 * already wired (manage panel listeners, pagination dock, filters panel,
 * news ticker, standalone slide) by the time the loading overlay drops.
 * The Home button no longer tears this down — it stays alive for the
 * lifetime of the page.
 */
async function autoLoadEventSystem(logPrefix) {
    writeOverlayStatus('Loading Event System...');
    try {
        await loadEventSystem(null);
        console.log(`${logPrefix} ✓ Event System auto-loaded`);
    } catch (error) {
        console.error(`${logPrefix} Error auto-loading Event System:`, error);
        writeOverlayStatus('Error loading Event System');
    }
}

function attachGlobeDestroyOnPageExit() {
    const destroyGlobe = () => {
        if (window.globeController) {
            window.globeController.destroy();
        }
    };
    window.addEventListener('beforeunload', destroyGlobe);
    // pagehide is more reliable than beforeunload on mobile.
    window.addEventListener('pagehide', destroyGlobe);
}

window.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('app-timeline-default');

    const pageName = window.location.pathname.split('/').pop() || 'index.html';
    const logPrefix = `[${pageName}]`;

    // Open the overlay AND lock the run-operation flag so neither
    // `runUniversalFeatures` nor `runMenuComponents` can prematurely drop
    // it during their own `finally` blocks.
    openBootOverlay();

    setTimeout(async function () {
        console.log(`${logPrefix} Auto-loading Universal Features...`);
        writeOverlayStatus('Loading...');

        // Always start fresh on a new page load — never auto-resume an old mode.
        localStorage.removeItem('currentMode');

        await autoLoadUniversalFeatures(logPrefix);
        await autoLoadMenuComponents(logPrefix);
        await autoLoadEventSystem(logPrefix);

        // `body.app-booted` lifts the entry.css mask that hid every body
        // child during boot. Set it BEFORE the overlay starts fading so
        // the reveal is atomic (overlay fades over a fully-painted UI).
        document.body.classList.add('app-booted');

        dropBootOverlay();
    }, COMPONENT_LOADER_GLOBALS_READY_MS);

    attachGlobeDestroyOnPageExit();
});

// === Header hub + zoom controls + official-site SFX ====================
// Each helper is idempotent and lives in its own module; we just kick them
// off here at boot so the rest of the app can rely on them being wired.

// `setupZoomControls` is idempotent and self-heals: if the globe's
// interaction controller isn't ready yet, it polls internally and re-runs
// once the globe loads — no boot-side babysitting required.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHeaderHub);
    document.addEventListener('DOMContentLoaded', setupZoomControls);
    document.addEventListener('DOMContentLoaded', setupOfficialSiteLinkSound);
} else {
    setupHeaderHub();
    setupZoomControls();
    setupOfficialSiteLinkSound();
}
