// Shared page initialization logic for main/index pages
// - Hides sidebar on GitHub Pages
// - Auto-loads Universal Features & Menu Components via test-loader
// - Manages loading overlay lifecycle
// - Sets up zoom controls visibility and click behavior

const WELCOME_SFX_URL = 'assets/audio/sfx/Welcome.mp3';
/** ms after overlay is shown — lets the screen settle before the greeting. */
const WELCOME_SFX_DELAY_MS = 650;
/** Quieter than typical UI SFX; scales with Sound Effects volume slider. */
const WELCOME_SFX_VOLUME_SCALE = 0.38;
const WELCOME_SFX_VOLUME_CAP = 0.28;
/** When startup theme + welcome path runs, music should be audible at this level. */
const STARTUP_WELCOME_MUSIC_VOLUME = 0.3;
const BORDER_IMAGE_DEBUG_STORAGE_KEY = 'debugBorderImageOverlay';

function setBorderImageDebugOverlay(enabled) {
    if (!document || !document.body) return;
    document.body.classList.toggle('debug-border-image-overlay', !!enabled);
    try {
        localStorage.setItem(BORDER_IMAGE_DEBUG_STORAGE_KEY, enabled ? '1' : '0');
    } catch (_) {
        /* ignore */
    }
}

function getBorderImageDebugOverlayEnabledFromStorage() {
    try {
        return localStorage.getItem(BORDER_IMAGE_DEBUG_STORAGE_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function shouldForceEnableBorderImageDebugOverlayFromQuery() {
    try {
        var qp = new URLSearchParams(window.location.search || '');
        var raw = (qp.get('debugBorderOverlay') || '').toString().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
    } catch (_) {
        return false;
    }
}

/**
 * Unmute and set music volume for the first-run startup theme + welcome SFX path.
 */
function applyStartupWelcomeMusicDefaults() {
    try {
        var mm = window.MusicManager;
        if (!mm || !mm.initialized || !mm.volumeService || !mm.backgroundMusic) {
            return;
        }
        mm.volumeService.stopFade();
        mm.backgroundMusic.muted = false;
        if (mm.muteBtn) {
            mm.muteBtn.classList.remove('active');
        }
        if (mm.iconService && typeof mm.iconService.updateMuteIcon === 'function') {
            mm.iconService.updateMuteIcon(false);
        }
        mm.volumeService.setTargetVolume(STARTUP_WELCOME_MUSIC_VOLUME);
        mm.volumeService.setVolume(STARTUP_WELCOME_MUSIC_VOLUME);
        mm.backgroundMusic.volume = STARTUP_WELCOME_MUSIC_VOLUME;
        if (mm.volumeSlider) {
            mm.volumeSlider.value = Math.round(STARTUP_WELCOME_MUSIC_VOLUME * 100);
        }
        if (mm.volumeValue) {
            mm.volumeValue.textContent = Math.round(STARTUP_WELCOME_MUSIC_VOLUME * 100) + '%';
        }
        if (typeof mm.saveMusicState === 'function') {
            mm.saveMusicState();
        }
    } catch (_) {
        /* ignore */
    }
}

/**
 * One-shot welcome SFX — only when the app plays a palette startup theme (see MusicManagerInitHelpers.loadMusicFiles).
 * Same eligibility as the first startup MP3: no restored music session, no current song yet, manifest non-empty, theme path exists.
 */
function scheduleWelcomeSoundForStartupTheme() {
    if (typeof window !== 'undefined' && window.__welcomeStartupSfxScheduled) {
        return;
    }
    if (typeof window !== 'undefined') {
        window.__welcomeStartupSfxScheduled = true;
    }
    applyStartupWelcomeMusicDefaults();
    window.setTimeout(function () {
        applyStartupWelcomeMusicDefaults();
        try {
            const audio = new Audio(WELCOME_SFX_URL);
            audio.preload = 'auto';
            const sfx = typeof window !== 'undefined' ? window.SoundEffectsManager : null;
            const base = sfx && typeof sfx.volume === 'number' && !isNaN(sfx.volume) ? sfx.volume : 0.55;
            const vol = Math.max(0.05, Math.min(WELCOME_SFX_VOLUME_CAP, base * WELCOME_SFX_VOLUME_SCALE));
            audio.volume = vol;
            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch(function () {
                    /* Autoplay policy — optional one retry after user gesture */
                    const retry = function () {
                        document.removeEventListener('click', retry, true);
                        document.removeEventListener('keydown', retry, true);
                        document.removeEventListener('touchstart', retry, true);
                        audio.play().catch(function () {});
                    };
                    document.addEventListener('click', retry, { capture: true, once: true });
                    document.addEventListener('keydown', retry, { capture: true, once: true });
                    document.addEventListener('touchstart', retry, { capture: true, once: true });
                });
            }
        } catch (_) {
            /* ignore */
        }
    }, WELCOME_SFX_DELAY_MS);
}

if (typeof window !== 'undefined') {
    window.scheduleWelcomeSoundForStartupTheme = scheduleWelcomeSoundForStartupTheme;
    window.applyStartupWelcomeMusicDefaults = applyStartupWelcomeMusicDefaults;
    window.setBorderImageDebugOverlay = setBorderImageDebugOverlay;
}

// Detect if we're running on GitHub Pages (or similar static hosting)
function isGitHubPages() {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') ||
        hostname.includes('github.com') ||
        (hostname !== 'localhost' &&
            hostname !== '127.0.0.1' &&
            !hostname.startsWith('192.168.') &&
            !hostname.startsWith('10.') &&
            window.location.protocol !== 'file:');
}

// Hide sidebar on GitHub Pages (navigation is handled by GitHub UI / direct links)
if (isGitHubPages()) {
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

// Auto-load Universal Features and Menu Components on landing pages
window.addEventListener('DOMContentLoaded', function () {
    // Simplified default UX: start directly in Global Timeline mode.
    document.body.classList.add('app-timeline-default');
    // Keep debug border overlays off by default; only explicit query can force-enable.
    setBorderImageDebugOverlay(false);
    if (shouldForceEnableBorderImageDebugOverlayFromQuery()) {
        setBorderImageDebugOverlay(true);
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const pageName = window.location.pathname.split('/').pop() || 'index.html';
    const logPrefix = `[${pageName}]`;

    // Show loading overlay immediately if present
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    // Update loading status using overlayStatusContent
    function updateLoadingStatus(message) {
        const overlayStatusContent = document.getElementById('overlayStatusContent');
        if (overlayStatusContent) {
            overlayStatusContent.innerHTML = '';
            const item = document.createElement('div');
            item.className = 'test-status-item info';
            item.textContent = message;
            overlayStatusContent.appendChild(item);
        }
    }

    // Wait a bit for component-loader to initialize and publish globals.
    setTimeout(async function () {
        console.log(`${logPrefix} Auto-loading Universal Features...`);
        updateLoadingStatus('Loading...');

        // Always clear any saved mode on fresh load — start blank
        localStorage.removeItem('currentMode');

        // Auto-load Universal Features (Palette + Music + Header)
        if (typeof window.runUniversalFeatures === 'function') {
            try {
                await window.runUniversalFeatures({ keepOverlay: false });
                console.log(`${logPrefix} ✓ Universal Features auto-loaded`);
            } catch (error) {
                console.error(`${logPrefix} Error auto-loading Universal Features:`, error);
                updateLoadingStatus('Error loading features');
            }
        } else {
            console.warn(`${logPrefix} runUniversalFeatures not available yet, retrying...`);
            setTimeout(async function () {
                if (typeof window.runUniversalFeatures === 'function') {
                    await window.runUniversalFeatures({ keepOverlay: false });
                }
            }, 1000);
        }

        // Auto-load Menu Components (Global Timeline, Glossary, Bios buttons)
        if (typeof window.runMenuComponents === 'function') {
            try {
                await window.runMenuComponents();
                console.log(`${logPrefix} ✓ Menu Components auto-loaded`);
            } catch (error) {
                console.error(`${logPrefix} Error auto-loading Menu Components:`, error);
            }
        }

        // Fade out loading overlay — globe is NOT auto-loaded
        setTimeout(function () {
            if (loadingOverlay) {
                loadingOverlay.classList.remove('active');
            }
        }, 300);

    }, 500); // Small delay to ensure component-loader.js is loaded

    // Cleanup on page unload to prevent memory leaks and freezing
    window.addEventListener('beforeunload', () => {
        if (window.globeController) {
            window.globeController.destroy();
        }
    });

    // Also handle pagehide (more reliable for mobile)
    window.addEventListener('pagehide', () => {
        if (window.globeController) {
            window.globeController.destroy();
        }
    });
});

// Header hub: mode switching buttons (Timeline / Glossary / Bios)
function setupHeaderHub() {
    const hubs = [
        document.getElementById('headerHub'),
        document.getElementById('headerHubRight')
    ].filter(Boolean);
    if (hubs.length === 0) return;

    const isTimelineActuallyLoaded = () => {
        const globeContainer = document.getElementById('globe-container');
        return !!(globeContainer && globeContainer.classList.contains('loaded') && window.globeController);
    };

    const setActive = (mode) => {
        const requested = (mode === 'globe') ? 'globe' : (mode === 'menu' ? 'menu' : mode);
        // If someone refreshes while localStorage says "globe", we should still start in menu mode
        // until timeline assets are actually loaded.
        const effective = (requested === 'globe' && !isTimelineActuallyLoaded()) ? 'menu' : requested;
        hubs.forEach((hub) => {
            const btns = Array.from(hub.querySelectorAll('.header-hub-btn'));
            btns.forEach((b) => b.classList.remove('header-hub-btn--active'));
        });
        // Only highlight Timeline when actually in globe mode (left hub).
        if (effective === 'globe') {
            const leftHub = document.getElementById('headerHub');
            const timelineBtn = leftHub ? leftHub.querySelector('.header-hub-btn[data-mode="globe"]') : null;
            if (timelineBtn) timelineBtn.classList.add('header-hub-btn--active');
        }

        if (effective === 'codex') {
            const codexBtn = document.getElementById('codexToggle');
            if (codexBtn) codexBtn.classList.add('header-hub-btn--active');
        }

        // Home/Exit should only appear while a mode's assets are actually loaded.
        // Right now only Timeline (globe) has assets, so it should only show there.
        const rightHub = document.getElementById('headerHubRight');
        const exitBtn = rightHub
            ? (rightHub.querySelector('.header-hub-btn--exit') || rightHub.querySelector('.header-hub-btn[data-action="menu"]'))
            : null;
        if (exitBtn) {
            const simplified = document.body.classList.contains('app-timeline-default');
            if (simplified) {
                exitBtn.style.display = 'none';
            } else {
                const show = (effective === 'globe') && isTimelineActuallyLoaded();
                exitBtn.style.display = show ? '' : 'none';
            }
        }

        // Keep storage sane: if we aren't actually in globe (assets not loaded), store "menu".
        if (effective === 'menu') {
            localStorage.setItem('currentMode', 'menu');
        }
    };

    const onHubClick = (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.header-hub-btn') : null;
        if (!btn) return;
        // Only intercept clicks for the actual mode buttons (Timeline/Glossary/Bios) or Exit.
        // Other header-hub buttons (Filters/Events/Map/etc.) must keep their own handlers.
        const mode = btn.dataset ? btn.dataset.mode : null;
        const action = btn.dataset ? btn.dataset.action : null;
        if (!mode && !action) return;
        e.preventDefault();
        e.stopPropagation();

        const target = mode || (action === 'menu' ? 'menu' : null);

        if (typeof window.appModeSwitch === 'function') {
            window.appModeSwitch(target);
        } else if (typeof window.restoreMainMenu === 'function') {
            window.restoreMainMenu();
        }
    };

    hubs.forEach((hub) => hub.addEventListener('click', onHubClick));

    const leftHubForCodex = document.getElementById('headerHub');
    if (leftHubForCodex && !leftHubForCodex.dataset.codexDelegateAttached) {
        leftHubForCodex.dataset.codexDelegateAttached = '1';
        leftHubForCodex.addEventListener(
            'click',
            function (e) {
                const btn = e.target && e.target.closest ? e.target.closest('#codexToggle') : null;
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();
                const svc = window.CodexModeService;
                if (svc && typeof svc.enterCodexMode === 'function') {
                    void svc.enterCodexMode();
                }
            },
            true
        );
    }

    // Initial state
    const currentMode = (localStorage.getItem('currentMode') || 'menu').toString().toLowerCase();
    setActive(currentMode);

    // Update on mode change
    window.addEventListener('appmodechange', (ev) => {
        setActive(ev?.detail?.mode || 'menu');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHeaderHub);
} else {
    setupHeaderHub();
}

// Zoom controls setup (shared between main/index pages)
// Guard: this function may run twice (DOMContentLoaded + delayed globe-ready poll).
// Without a guard, click handlers, MutationObservers, and intervals stack forever.
let zoomControlsLifecycleInitialized = false;

function setupZoomControls() {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomControls = document.getElementById('zoomControls');

    function isCodexModeActive() {
        return typeof document !== 'undefined' && document.body.classList.contains('codex-mode-active');
    }

    function updateZoomControlsVisibility() {
        if (!zoomControls) return;

        const globeContainer = document.getElementById('globe-container');
        const testContainer = document.querySelector('.test-container');

        const globeLoaded = globeContainer && globeContainer.classList.contains('loaded');
        const menuVisible = testContainer &&
            testContainer.style.display !== 'none' &&
            testContainer.style.opacity !== '0' &&
            window.getComputedStyle(testContainer).display !== 'none' &&
            parseFloat(window.getComputedStyle(testContainer).opacity) > 0;

        const codexActive = isCodexModeActive();

        if (codexActive || (globeLoaded && !menuVisible)) {
            zoomControls.classList.add('visible');
        } else {
            zoomControls.classList.remove('visible');
        }
    }

    if (zoomInBtn && zoomOutBtn && !zoomControlsLifecycleInitialized) {
        zoomControlsLifecycleInitialized = true;

        zoomInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isCodexModeActive()) {
                const cx = window.CodexCanvasService;
                if (cx && typeof cx.zoomIn === 'function') {
                    cx.zoomIn();
                }
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
                    if (cx && typeof cx.resetView === 'function') {
                        cx.resetView();
                    }
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
                if (cx && typeof cx.zoomOut === 'function') {
                    cx.zoomOut();
                }
            } else if (window.globeController && window.globeController.interactionController) {
                window.globeController.interactionController.zoomOut();
            }
        });

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

        window.addEventListener('appmodechange', updateZoomControlsVisibility);

        setInterval(updateZoomControlsVisibility, 500);
    }

    updateZoomControlsVisibility();
}

// Initialize zoom controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupZoomControls);
} else {
    setupZoomControls();
}

// Also setup after globe loads (in case it's not ready yet)
const checkGlobeAndSetupZoom = setInterval(() => {
    if (window.globeController && window.globeController.interactionController) {
        setupZoomControls();
        clearInterval(checkGlobeAndSetupZoom);
    }
}, 500);

// Clear interval after 10 seconds to avoid infinite checking
setTimeout(() => clearInterval(checkGlobeAndSetupZoom), 10000);

/** Center header badge → official site: same SFX as filters Confirm, then normal link (new tab). */
function setupOfficialSiteLinkSound() {
    const badge = document.getElementById('headerTitleBadge');
    if (!badge || badge.dataset.officialSiteSoundBound === '1') return;
    const href = badge.getAttribute('href');
    if (!href || href === '#') return;
    badge.dataset.officialSiteSoundBound = '1';
    badge.addEventListener('click', () => {
        const sfx = window.SoundEffectsManager;
        if (sfx && typeof sfx.play === 'function') {
            sfx.play('filterConfirm');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOfficialSiteLinkSound);
} else {
    setupOfficialSiteLinkSound();
}
