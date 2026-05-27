/**
 * HeaderModeSynchronization — keeps header hub chrome aligned with app mode.
 *
 * Two responsibilities live here:
 *   1. `setupHeaderHub` — delegated click handling for mode-tagged buttons
 *      (Timeline, Codex, Bios, Exit) sitting in `#headerHub` and
 *      `#headerHubRight`, plus active-state highlighting and exit-button
 *      visibility that follow the current mode.
 *   2. `setupOfficialSiteLinkSound` — plays the "filterConfirm" SFX when
 *      the center title badge (the Overwatch Atlas link) is clicked.
 *
 * Both are wired on `DOMContentLoaded`. They live in `BootUp/` because
 * they're chrome that exists on every page regardless of mode.
 *
 * Renamed from `HeaderHubModeButtons.js`.
 */

import {
    getCurrentModeOrMenu,
    setCurrentMode
} from '../atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';

function isTimelineActuallyLoaded() {
    const globeContainer = document.getElementById('globe-container');
    return !!(globeContainer && globeContainer.classList.contains('loaded') && window.globeController);
}

function applyExitButtonVisibility(rightHub, effective) {
    const exitBtn = rightHub
        ? (rightHub.querySelector('.header-hub-btn--exit') || rightHub.querySelector('.header-hub-btn[data-action="menu"]'))
        : null;
    if (!exitBtn) return;

    const simplified = document.body.classList.contains('app-timeline-default');
    if (simplified) {
        exitBtn.style.display = 'none';
        return;
    }
    const show = (effective === 'globe') && isTimelineActuallyLoaded();
    exitBtn.style.display = show ? '' : 'none';
}

function applyActiveModeHighlight(hubs, effective) {
    hubs.forEach((hub) => {
        const btns = Array.from(hub.querySelectorAll('.header-hub-btn'));
        btns.forEach((b) => b.classList.remove('header-hub-btn--active'));
    });
    if (effective === 'globe') {
        const leftHub = document.getElementById('headerHub');
        const timelineBtn = leftHub ? leftHub.querySelector('.header-hub-btn[data-mode="globe"]') : null;
        if (timelineBtn) timelineBtn.classList.add('header-hub-btn--active');
    }
    if (effective === 'codex') {
        const codexBtn = document.getElementById('codexToggle');
        if (codexBtn) codexBtn.classList.add('header-hub-btn--active');
    }
}

function buildSetActive(hubs) {
    return (mode) => {
        const requested = (mode === 'globe') ? 'globe' : (mode === 'menu' ? 'menu' : mode);
        // Refresh-while-in-globe edge case: localStorage may say "globe" but
        // the timeline assets aren't actually loaded yet. Fall back to menu.
        const effective = (requested === 'globe' && !isTimelineActuallyLoaded()) ? 'menu' : requested;

        applyActiveModeHighlight(hubs, effective);

        const rightHub = document.getElementById('headerHubRight');
        applyExitButtonVisibility(rightHub, effective);

        // Keep storage sane so a later refresh doesn't re-enter a phantom globe state.
        if (effective === 'menu') {
            setCurrentMode('menu');
        }
    };
}

function attachModeButtonClickDelegation(hubs) {
    const onHubClick = (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.header-hub-btn') : null;
        if (!btn) return;
        // Only intercept actual mode buttons (Timeline / Glossary / Bios / Exit).
        // Other header-hub buttons (Filters / Events / Map / etc.) keep their own handlers.
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
}

function attachCodexButtonDelegation() {
    const leftHubForCodex = document.getElementById('headerHub');
    if (!leftHubForCodex || leftHubForCodex.dataset.codexDelegateAttached) return;
    leftHubForCodex.dataset.codexDelegateAttached = '1';
    leftHubForCodex.addEventListener('click', function (e) {
        const btn = e.target && e.target.closest ? e.target.closest('#codexToggle') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const svc = window.CodexModeService;
        if (svc && typeof svc.enterCodexMode === 'function') {
            void svc.enterCodexMode();
        }
    }, true);
}

export function setupHeaderHub() {
    const hubs = [
        document.getElementById('headerHub'),
        document.getElementById('headerHubRight')
    ].filter(Boolean);
    if (hubs.length === 0) return;

    const setActive = buildSetActive(hubs);

    attachModeButtonClickDelegation(hubs);
    attachCodexButtonDelegation();

    setActive(getCurrentModeOrMenu());

    window.addEventListener('appmodechange', (ev) => {
        setActive(ev?.detail?.mode || 'menu');
    });
}

export function setupOfficialSiteLinkSound() {
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
