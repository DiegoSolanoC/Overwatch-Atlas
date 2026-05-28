/**
 * Show / hide the Hero Biography bottom chip strip (keyboard H + dock toggle).
 * Toggle wiring mirrors WorldviewGlobeToggles.setupAutoRotateToggle().
 */

import { createHeaderHubButton } from '../../universal-features/atlas-header/HeaderHubButton.js';
import { loadSoundEffect } from '../../universal-features/atlas-sound-effects/loadSoundEffects.js';

const HOST_ID = 'atlasGalleryHost';
const TOGGLE_ID = 'heroBiographyChipStripToggle';
const ICON_ID = 'heroBiographySelectHeroIcon';
const DOCK_PARENT_ID = 'dockGlobeRailLeft';
const STRIP_HIDDEN_CLASS = 'gallery-hero-filters--hidden';
const HOST_COLLAPSED_CLASS = 'gallery-mode--hero-filters-collapsed';

const SELECT_HERO_ICON =
    'src/assets/images/Icons/Mode%20Icons/Hero%20Biography.png';

const ICON_HTML =
    `<img src="${SELECT_HERO_ICON}" alt="Select hero" style="width: 100%; height: 100%; object-fit: contain;">`;

/** @type {HTMLElement | null} */
let hostEl = null;

/** @type {HTMLElement | null} */
let stripEl = null;

/** @type {HTMLButtonElement | null} */
let toggleBtn = null;

let stripVisible = true;

export function isHeroBiographyModeActive() {
    return !!document.getElementById(HOST_ID);
}

function ensureSelectHeroIcon() {
    const iconEl = document.getElementById(ICON_ID);
    if (iconEl) {
        iconEl.innerHTML = ICON_HTML;
    }
}

function applyStripVisibility() {
    if (stripEl) {
        stripEl.classList.toggle(STRIP_HIDDEN_CLASS, !stripVisible);
        stripEl.setAttribute('aria-hidden', stripVisible ? 'false' : 'true');
    }
    if (hostEl) {
        hostEl.classList.toggle(HOST_COLLAPSED_CLASS, !stripVisible);
    }
    if (toggleBtn) {
        if (stripVisible) {
            toggleBtn.classList.remove('toggle-off');
        } else {
            toggleBtn.classList.add('toggle-off');
        }
        ensureSelectHeroIcon();
    }
}

/**
 * @param {Event | null} event
 */
function handleSelectHeroToggle(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play('rotationToggle');
    }

    stripVisible = !stripVisible;
    applyStripVisibility();

    if (toggleBtn && window.flashButton) {
        window.flashButton(toggleBtn, stripVisible ? 'flash-green' : 'flash-red');
    }
}

/**
 * @returns {boolean} True when the strip is visible.
 */
export function toggleHeroBiographyChipStrip() {
    handleSelectHeroToggle(null);
    return stripVisible;
}

/**
 * @returns {boolean} True when the toggle was handled (Hero Biography mode active).
 */
export function toggleHeroBiographyChipStripIfActive() {
    if (!isHeroBiographyModeActive()) return false;
    const btn = toggleBtn || document.getElementById(TOGGLE_ID);
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
}

/**
 * @param {HTMLElement} host
 * @param {HTMLElement} strip
 */
export function bindHeroBiographyChipStrip(host, strip) {
    hostEl = host;
    stripEl = strip;
    stripVisible = true;
    applyStripVisibility();
}

function wireSelectHeroToggle(btn) {
    if (typeof btn._heroSelectToggleTeardown === 'function') {
        try {
            btn._heroSelectToggleTeardown();
        } catch (_) { /* ignore */ }
    }

    const ac = new AbortController();
    const signal = ac.signal;
    btn._heroSelectToggleTeardown = () => {
        ac.abort();
        btn._heroSelectToggleTeardown = null;
    };

    ensureSelectHeroIcon();

    btn.addEventListener('mousedown', (event) => {
        event.stopPropagation();
    }, { signal });

    btn.addEventListener('mouseup', (event) => {
        event.stopPropagation();
    }, { signal });

    let touchStartTime = 0;
    btn.addEventListener('touchstart', (event) => {
        event.stopPropagation();
        touchStartTime = Date.now();
    }, { signal });

    btn.addEventListener('touchend', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (Date.now() - touchStartTime < 300) {
            handleSelectHeroToggle(event);
        }
    }, { signal });

    btn.addEventListener('click', handleSelectHeroToggle, { signal });
}

export function mountHeroBiographyChipStripToggle() {
    unmountHeroBiographyChipStripToggle();
    hostEl = document.getElementById(HOST_ID);

    loadSoundEffect(
        'rotationToggle',
        'src/assets/audio/sfx/Rotation Toggle.mp3',
    );

    document.getElementById(TOGGLE_ID)?.remove();

    const dockParent = document.getElementById(DOCK_PARENT_ID);
    const parentId = dockParent ? DOCK_PARENT_ID : HOST_ID;

    const btn = createHeaderHubButton({
        id: TOGGLE_ID,
        className: 'dock-globe-rail__btn gallery-select-hero-toggle',
        title: 'Toggle hero selection',
        label: 'Select Hero',
        iconPath: SELECT_HERO_ICON,
        iconAlt: 'Select hero',
        parentId,
        baseClass: 'globe-control-btn',
        iconSpanId: ICON_ID,
        headerOrder: 1,
    });

    if (!btn?.isConnected) {
        console.warn('[gallery] Select Hero toggle could not mount');
        return;
    }

    if (!dockParent) {
        btn.classList.add('gallery-select-hero-toggle--floating');
    }

    btn.style.setProperty('display', 'flex', 'important');
    toggleBtn = btn;
    stripVisible = true;
    applyStripVisibility();
    wireSelectHeroToggle(btn);
}

export function unmountHeroBiographyChipStripToggle() {
    const btn = document.getElementById(TOGGLE_ID);
    if (btn && typeof btn._heroSelectToggleTeardown === 'function') {
        try {
            btn._heroSelectToggleTeardown();
        } catch (_) { /* ignore */ }
    }
    btn?.remove();
    toggleBtn = null;
}

export function unmountHeroBiographyChipStripControls() {
    unmountHeroBiographyChipStripToggle();
    stripEl = null;
    hostEl = null;
    stripVisible = true;
}
