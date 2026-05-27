/**
 * Single-select state for Hero Biography chips + main-stage hero title.
 */

import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';

/** @type {HTMLElement | null} */
let activeWrap = null;

/** @type {HTMLElement | null} */
let titleEl = null;

/**
 * @param {HTMLElement} mainEl
 */
export function initHeroBiographySelection(mainEl) {
    titleEl = document.createElement('h1');
    titleEl.className = 'hero-biography-mode__hero-title';
    titleEl.setAttribute('aria-live', 'polite');
    mainEl.appendChild(titleEl);
}

function clearChipVisual(wrap, chip) {
    if (!wrap || !chip) return;
    wrap.classList.remove('hero-biography-hero-filters__chip-wrap--active');
    chip.classList.remove('hero-biography-hero-filters__chip--active');
    chip.setAttribute('aria-pressed', 'false');
}

function applyChipVisual(wrap, chip) {
    wrap.classList.add('hero-biography-hero-filters__chip-wrap--active');
    chip.classList.add('hero-biography-hero-filters__chip--active');
    chip.setAttribute('aria-pressed', 'true');
}

function setTitle(displayName) {
    if (!titleEl) return;
    if (!displayName) {
        titleEl.textContent = '';
        titleEl.classList.remove('is-visible');
        return;
    }
    titleEl.textContent = displayName;
    titleEl.classList.add('is-visible');
}

/**
 * @param {HTMLElement} wrap
 * @param {HTMLElement} chip
 * @param {string} displayName
 * @returns {boolean} True if chip is now selected.
 */
export function toggleHeroBiographyChip(wrap, chip, displayName) {
    const isSame = activeWrap === wrap;

    if (isSame) {
        clearChipVisual(wrap, chip);
        activeWrap = null;
        setTitle('');
        return false;
    }

    if (activeWrap) {
        const prevChip = activeWrap.querySelector('.hero-biography-hero-filters__chip');
        clearChipVisual(activeWrap, prevChip);
    }

    applyChipVisual(wrap, chip);
    activeWrap = wrap;
    setTitle(displayName);
    const labelText = chip.querySelector('.filter-label-text');
    if (labelText) {
        requestAnimationFrame(() => fitHeroChipLabelText(labelText));
    }
    return true;
}

export function clearHeroBiographySelection() {
    if (activeWrap) {
        const chip = activeWrap.querySelector('.hero-biography-hero-filters__chip');
        clearChipVisual(activeWrap, chip);
        activeWrap = null;
    }
    setTitle('');
}

export function destroyHeroBiographySelection() {
    clearHeroBiographySelection();
    titleEl = null;
}
