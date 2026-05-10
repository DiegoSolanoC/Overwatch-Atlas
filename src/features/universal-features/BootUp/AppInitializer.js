/**
 * AppInitializer — the index landing boot sequence.
 *
 * Runs on `DOMContentLoaded`:
 *   1. Marks the body as `app-timeline-default` (simplified default UX).
 *   2. Hides the sidebar on production hosting (GitHub Pages / public site).
 *   3. Shows the loading overlay, waits briefly so `LoadingOrchestrator`
 *      publishes its globals, then loads Universal Features and the
 *      Main Menu via the orchestrator.
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
} from './header/HeaderModeSynchronization.js';
import { setupZoomControls } from '../../Interactive-Worldview/services/ZoomControlsService.js';

// Side-effect imports: these modules publish globals consumed by
// non-module scripts loaded via classic <script> tags.
import '../Audio/WelcomeStartup.js';

// === Constants =========================================================

/** Wait for LoadingOrchestrator (a separate module) to attach its globals before driving them. */
const COMPONENT_LOADER_GLOBALS_READY_MS = 500;
/** Retry once if `runUniversalFeatures` still isn't on `window` after the initial wait. */
const COMPONENT_LOADER_RETRY_MS = 1000;
/** Brief fade after auto-load completes before the overlay disappears. */
const OVERLAY_FADE_OUT_MS = 300;

// === GitHub Pages detection ============================================
// Distinct from `MainMenu/isGitHubPages.js` (which is narrower and gates
// dev-only menu affordances). This one fires for *any* non-local host so
// the debug sidebar disappears in production.

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

function showLoadingOverlayElement(loadingOverlay) {
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
}

function hideLoadingOverlayElement(loadingOverlay) {
    setTimeout(function () {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
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
            await window.runUniversalFeatures({ keepOverlay: false });
            console.log(`${logPrefix} ✓ Universal Features auto-loaded`);
        } catch (error) {
            console.error(`${logPrefix} Error auto-loading Universal Features:`, error);
            writeOverlayStatus('Error loading features');
        }
        return;
    }
    // First retry path — the loader module may not have published globals yet.
    console.warn(`${logPrefix} runUniversalFeatures not available yet, retrying...`);
    setTimeout(async function () {
        if (typeof window.runUniversalFeatures === 'function') {
            await window.runUniversalFeatures({ keepOverlay: false });
        }
    }, COMPONENT_LOADER_RETRY_MS);
}

async function autoLoadMenuComponents(logPrefix) {
    if (typeof window.runMenuComponents !== 'function') return;
    try {
        await window.runMenuComponents();
        console.log(`${logPrefix} ✓ Menu Components auto-loaded`);
    } catch (error) {
        console.error(`${logPrefix} Error auto-loading Menu Components:`, error);
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

    const loadingOverlay = document.getElementById('loadingOverlay');
    const pageName = window.location.pathname.split('/').pop() || 'index.html';
    const logPrefix = `[${pageName}]`;

    showLoadingOverlayElement(loadingOverlay);

    setTimeout(async function () {
        console.log(`${logPrefix} Auto-loading Universal Features...`);
        writeOverlayStatus('Loading...');

        // Always start fresh on a new page load — never auto-resume an old mode.
        localStorage.removeItem('currentMode');

        await autoLoadUniversalFeatures(logPrefix);
        await autoLoadMenuComponents(logPrefix);

        hideLoadingOverlayElement(loadingOverlay);
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
