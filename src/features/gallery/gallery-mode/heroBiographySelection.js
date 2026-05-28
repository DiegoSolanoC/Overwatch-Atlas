/**
 * Single-select state for Hero Biography chips + main-stage title, look picker, portrait.
 */

import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';
import {
    buildHeroBiographyLookPath,
    DEFAULT_HERO_BIO_LOOK,
} from './heroBiographyHeroicImagePaths.js';
import {
    clearHeroBiosLooksCache,
    getLooksForHero,
    loadHeroBiosLooksMap,
} from './loadHeroBiosLooks.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    clearHeroBiographyDockHeroFilter,
    refreshHeroBiographyDockPagination,
    setBioBiographyDockFilter,
} from './heroBiographyDockTimeline.js';
import { resetHeroBiographyDockLookHoverState } from './heroBiographyDockLookHover.js';
import { wireHeroBiographyPortraitCopy } from './heroBiographyPortraitCopy.js';
import {
    applyHeroBiographyPortraitScale,
    clearHeroBiographyPortraitScaleCache,
    preloadHeroBiographyPortraitReference,
    resetHeroBiographyPortraitScale,
} from './heroBiographyPortraitScale.js';
import {
    destroyHeroBiographyLookRangesEditor,
    initHeroBiographyLookRangesEditor,
    isHeroBiographyLookRangesEditorEnabled,
    setHeroBiographyLookRangesEditorHero,
    syncHeroBiographyLookRangeEditorLook,
} from './heroBiographyLookRangesEditor.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';
import { clearHeroBiographyLookRangesCache } from './heroBiographyLookRangesStorage.js';
import {
    destroyHeroBiographyPhraseButton,
    initHeroBiographyPhraseButton,
    setHeroBiographyPhraseButtonHero,
} from './heroBiographyPhraseButton.js';
import {
    cancelHeroSelectionPhraseSchedule,
    stopHeroBiographyPhrase,
} from './heroBiographyPhrasePlayer.js';
import { clearHeroPhrasesCache } from './loadHeroPhrases.js';
import {
    destroyHeroBiographyArchiveDescription,
    initHeroBiographyArchiveDescription,
    setBioBiographyArchiveDescription,
} from './heroBiographyArchiveDescription.js';

/** @type {HTMLElement | null} */
let activeWrap = null;

/** @type {HTMLElement | null} */
let headerEl = null;

/** @type {HTMLElement | null} */
let titleEl = null;

/** @type {HTMLElement | null} */
let controlsRowEl = null;

/** @type {HTMLElement | null} */
let rangesRowEl = null;

/** @type {HTMLSelectElement | null} */
let lookSelectEl = null;

/** @type {HTMLElement | null} */
let portraitEl = null;

/** @type {HTMLImageElement | null} */
let portraitImg = null;

/** @type {Record<string, string[]> | null} */
let heroBiosLooksMap = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let currentCategory = 'heroes';

/** @type {string | null} */
let currentFilterKey = null;

let currentLook = DEFAULT_HERO_BIO_LOOK;
/** @type {string | null} */
let hoverPreviewLook = null;
let portraitLoadId = 0;

/** @type {AbortController | null} */
let portraitCopyAc = null;

function rewirePortraitCopy() {
    portraitCopyAc?.abort();
    portraitCopyAc = new AbortController();
    if (portraitImg) {
        wireHeroBiographyPortraitCopy(portraitImg, portraitCopyAc.signal);
    }
}

async function ensureHeroBiosLooksMap() {
    if (!heroBiosLooksMap) {
        heroBiosLooksMap = await loadHeroBiosLooksMap();
    }
    return heroBiosLooksMap;
}

/**
 * @param {HTMLElement} hostEl
 * @param {HTMLElement} mainEl
 */
export function initHeroBiographySelection(hostEl, mainEl) {
    portraitEl = document.createElement('div');
    portraitEl.className = 'gallery-mode__portrait';
    portraitEl.setAttribute('aria-hidden', 'true');

    portraitImg = document.createElement('img');
    portraitImg.className = 'gallery-mode__portrait-img';
    portraitImg.decoding = 'async';

    const empty = document.createElement('p');
    empty.className = 'gallery-mode__portrait-empty';
    empty.textContent = 'Heroic portrait not available yet';

    portraitEl.append(portraitImg, empty);
    hostEl.insertBefore(portraitEl, mainEl.nextSibling);
    preloadHeroBiographyPortraitReference();

    headerEl = document.createElement('div');
    headerEl.className = 'gallery-mode__hero-header';

    titleEl = document.createElement('h1');
    titleEl.className = 'gallery-mode__hero-title';

    controlsRowEl = document.createElement('div');
    controlsRowEl.className = 'gallery-mode__controls-row';

    const lookField = document.createElement('div');
    lookField.className = 'gallery-mode__look-field';

    const lookLabel = document.createElement('label');
    lookLabel.className = 'gallery-mode__look-select-label';
    lookLabel.setAttribute('for', 'heroBiographyLookSelect');
    lookLabel.textContent = 'Look';

    lookSelectEl = document.createElement('select');
    lookSelectEl.id = 'heroBiographyLookSelect';
    lookSelectEl.className = 'gallery-mode__look-select';
    lookSelectEl.title = 'Change hero look';
    lookSelectEl.addEventListener('change', () => {
        if (!currentFilterKey || currentCategory !== 'heroes' || !lookSelectEl) return;
        hoverPreviewLook = null;
        currentLook = lookSelectEl.value;
        if (isHeroBiographyLookRangesEditorEnabled()) {
            syncHeroBiographyLookRangeEditorLook(currentLook);
        }
        setHeroPortrait(
            currentFilterKey,
            titleEl?.textContent || '',
            currentLook,
        );
    });

    lookField.append(lookLabel, lookSelectEl);
    controlsRowEl.appendChild(lookField);

    headerEl.append(titleEl, controlsRowEl);

    if (isHeroBiographyLocalDev()) {
        rangesRowEl = document.createElement('div');
        rangesRowEl.className = 'gallery-mode__ranges-row';
        headerEl.appendChild(rangesRowEl);
        initHeroBiographyLookRangesEditor(rangesRowEl);
    }

    mainEl.appendChild(headerEl);

    initHeroBiographyArchiveDescription(hostEl);

    rewirePortraitCopy();

    initHeroBiographyPhraseButton(controlsRowEl);
}

/**
 * @returns {{ heroFilterKey: string | null, currentLook: string } | null}
 */
export function getActiveHeroBiographySelection() {
    if (!currentFilterKey) return null;
    return {
        category: currentCategory,
        filterKey: currentFilterKey,
        heroFilterKey: currentCategory === 'heroes' ? currentFilterKey : null,
        currentLook,
    };
}

function syncHeroOnlyControlsVisibility() {
    const isHero = currentCategory === 'heroes';
    if (portraitEl) {
        portraitEl.style.display = isHero ? '' : 'none';
    }
    if (controlsRowEl) {
        const lookField = controlsRowEl.querySelector('.gallery-mode__look-field');
        if (lookField) lookField.hidden = !isHero;
    }
    if (rangesRowEl) {
        rangesRowEl.hidden = !isHero;
    }
}

/**
 * @param {string} lookName
 */
export function previewHeroBiographyLook(lookName) {
    if (!currentFilterKey || currentCategory !== 'heroes') return;
    if (hoverPreviewLook === lookName) return;

    hoverPreviewLook = lookName;
    if (lookSelectEl && lookSelectEl.value !== lookName) {
        lookSelectEl.value = lookName;
    }
    setHeroPortrait(
        currentFilterKey,
        titleEl?.textContent || '',
        lookName,
    );
}

/**
 * Persist the look chosen from dock hover (or manual pick) as the active selection.
 * @param {string} lookName
 */
export function commitHeroBiographyLook(lookName) {
    if (!currentFilterKey || currentCategory !== 'heroes' || !lookName) return;

    hoverPreviewLook = null;
    currentLook = lookName;
    if (lookSelectEl && lookSelectEl.value !== lookName) {
        lookSelectEl.value = lookName;
    }
    setHeroPortrait(
        currentFilterKey,
        titleEl?.textContent || '',
        lookName,
    );
}

function clearChipVisual(wrap, chip) {
    if (!wrap || !chip) return;
    wrap.classList.remove('gallery-hero-filters__chip-wrap--active');
    chip.classList.remove('gallery-hero-filters__chip--active');
    chip.setAttribute('aria-pressed', 'false');
}

function applyChipVisual(wrap, chip) {
    wrap.classList.add('gallery-hero-filters__chip-wrap--active');
    chip.classList.add('gallery-hero-filters__chip--active');
    chip.setAttribute('aria-pressed', 'true');
}

function setHeaderVisible(visible) {
    if (!headerEl) return;
    headerEl.classList.toggle('is-visible', visible);
    headerEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setTitle(displayName) {
    if (!titleEl) return;
    if (!displayName) {
        titleEl.textContent = '';
        setHeaderVisible(false);
        return;
    }
    titleEl.textContent = displayName;
    setHeaderVisible(true);
}

/**
 * @param {string[]} looks
 */
function populateLookSelect(looks) {
    if (!lookSelectEl) return;
    lookSelectEl.replaceChildren();
    for (const look of looks) {
        const opt = document.createElement('option');
        opt.value = look;
        opt.textContent = look;
        lookSelectEl.appendChild(opt);
    }
    const hasMultiple = looks.length > 1;
    lookSelectEl.disabled = !hasMultiple;
    lookSelectEl.classList.toggle('is-single', !hasMultiple);
}

/**
 * @param {string | null} heroFilterKey
 * @param {string} displayName
 * @param {string} lookName
 */
function setHeroPortrait(heroFilterKey, displayName, lookName) {
    if (!portraitEl || !portraitImg) return;

    if (!heroFilterKey) {
        portraitEl.classList.remove('is-visible', 'has-image');
        portraitEl.setAttribute('aria-hidden', 'true');
        portraitImg.onload = null;
        portraitImg.onerror = null;
        portraitImg.removeAttribute('src');
        delete portraitImg.dataset.heroBioLook;
        delete portraitImg.dataset.heroBioHero;
        portraitImg.alt = '';
        resetHeroBiographyPortraitScale(portraitImg);
        return;
    }

    const look = lookName || DEFAULT_HERO_BIO_LOOK;
    const alt = displayName ? `${displayName} — ${look}` : look;
    const heroKey = String(heroFilterKey).trim();

    if (
        portraitImg.dataset.heroBioHero === heroKey &&
        portraitImg.dataset.heroBioLook === look &&
        portraitEl.classList.contains('has-image') &&
        portraitImg.getAttribute('src')
    ) {
        portraitEl.classList.add('is-visible');
        portraitEl.setAttribute('aria-hidden', 'false');
        if (portraitImg.alt !== alt) portraitImg.alt = alt;
        if (portraitImg.naturalWidth) {
            void applyHeroBiographyPortraitScale(portraitImg, heroKey);
        }
        return;
    }

    portraitEl.classList.add('is-visible');
    portraitEl.classList.remove('has-image');
    portraitEl.setAttribute('aria-hidden', 'false');

    portraitImg.onload = null;
    portraitImg.onerror = null;
    portraitImg.removeAttribute('src');
    resetHeroBiographyPortraitScale(portraitImg);
    portraitImg.dataset.heroBioHero = heroKey;
    portraitImg.dataset.heroBioLook = look;
    portraitImg.alt = alt;

    const src = buildHeroBiographyLookPath(heroFilterKey, look);
    const loadId = ++portraitLoadId;

    portraitImg.onload = () => {
        if (loadId !== portraitLoadId) return;
        if (portraitImg.dataset.heroBioHero !== heroKey) return;
        void applyHeroBiographyPortraitScale(portraitImg, heroKey);
        portraitEl?.classList.add('has-image');
    };
    portraitImg.onerror = () => {
        if (loadId !== portraitLoadId) return;
        if (portraitImg.dataset.heroBioHero !== heroKey) return;
        portraitEl?.classList.remove('has-image');
        portraitImg.removeAttribute('src');
        delete portraitImg.dataset.heroBioLook;
        delete portraitImg.dataset.heroBioHero;
        resetHeroBiographyPortraitScale(portraitImg);
    };

    portraitImg.src = src;

    if (portraitImg.complete && portraitImg.naturalWidth) {
        void applyHeroBiographyPortraitScale(portraitImg, heroKey);
        portraitEl.classList.add('has-image');
    }
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} displayName
 */
async function applyBioSelection(category, filterKey, displayName) {
    const cat = normalizeBioBiographyCategory(category);
    resetHeroBiographyDockLookHoverState();
    cancelHeroSelectionPhraseSchedule();
    stopHeroBiographyPhrase();
    hoverPreviewLook = null;
    currentCategory = cat;
    currentFilterKey = filterKey;
    currentLook = DEFAULT_HERO_BIO_LOOK;
    syncHeroOnlyControlsVisibility();

    if (cat === 'heroes') {
        /** @type {string[]} */
        let looks = [DEFAULT_HERO_BIO_LOOK];
        try {
            const map = await ensureHeroBiosLooksMap();
            looks = getLooksForHero(map, filterKey);
            populateLookSelect(looks);
            currentLook = looks.includes(DEFAULT_HERO_BIO_LOOK)
                ? DEFAULT_HERO_BIO_LOOK
                : looks[0];
            if (lookSelectEl) {
                lookSelectEl.value = currentLook;
            }
        } catch (err) {
            console.warn('[gallery] Could not load hero looks:', err);
            looks = [DEFAULT_HERO_BIO_LOOK];
            populateLookSelect(looks);
            if (lookSelectEl) lookSelectEl.value = DEFAULT_HERO_BIO_LOOK;
        }
        setHeroPortrait(filterKey, displayName, currentLook);
        setHeroBiographyLookRangesEditorHero(filterKey, currentLook);
        void setHeroBiographyPhraseButtonHero(filterKey);
    } else {
        populateLookSelect([]);
        setHeroPortrait(null, '', DEFAULT_HERO_BIO_LOOK);
        setHeroBiographyLookRangesEditorHero(null);
        void setHeroBiographyPhraseButtonHero(null);
    }

    setBioBiographyDockFilter(cat, filterKey, displayName);
    void setBioBiographyArchiveDescription(cat, filterKey, displayName);
    refreshHeroBiographyDockPagination();
}

function clearHeroSelectionUi() {
    resetHeroBiographyDockLookHoverState();
    cancelHeroSelectionPhraseSchedule();
    stopHeroBiographyPhrase();
    hoverPreviewLook = null;
    currentCategory = 'heroes';
    currentFilterKey = null;
    currentLook = DEFAULT_HERO_BIO_LOOK;
    syncHeroOnlyControlsVisibility();
    populateLookSelect([]);
    setHeroBiographyLookRangesEditorHero(null);
    void setHeroBiographyPhraseButtonHero(null);
    void setBioBiographyArchiveDescription(null, null);
    setTitle('');
    setHeroPortrait(null, '', DEFAULT_HERO_BIO_LOOK);
    clearHeroBiographyDockHeroFilter();
    refreshHeroBiographyDockPagination();
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {HTMLElement} wrap
 * @param {HTMLElement} chip
 * @param {string} displayName
 * @param {string} filterKey
 * @returns {boolean} True if chip is now selected.
 */
export function toggleBioBiographyChip(category, wrap, chip, displayName, filterKey) {
    const isSame = activeWrap === wrap;

    if (isSame) {
        clearChipVisual(wrap, chip);
        activeWrap = null;
        clearHeroSelectionUi();
        return false;
    }

    if (activeWrap) {
        const prevChip = activeWrap.querySelector('.gallery-hero-filters__chip');
        clearChipVisual(activeWrap, prevChip);
    }

    applyChipVisual(wrap, chip);
    activeWrap = wrap;
    setTitle(displayName);
    void applyBioSelection(category, filterKey, displayName);

    const labelText = chip.querySelector('.filter-label-text');
    if (labelText) {
        requestAnimationFrame(() => fitHeroChipLabelText(labelText));
    }
    return true;
}

/**
 * @param {HTMLElement} wrap
 * @param {HTMLElement} chip
 * @param {string} displayName
 * @param {string} heroFilterKey
 * @returns {boolean}
 */
export function toggleHeroBiographyChip(wrap, chip, displayName, heroFilterKey) {
    return toggleBioBiographyChip('heroes', wrap, chip, displayName, heroFilterKey);
}

/** Clears entity selection when switching archive category tabs. */
export function clearBioBiographyChipSelectionForCategoryChange() {
    if (activeWrap) {
        const chip = activeWrap.querySelector('.gallery-hero-filters__chip');
        clearChipVisual(activeWrap, chip);
        activeWrap = null;
    }
    clearHeroSelectionUi();
}

export function clearHeroBiographySelection() {
    if (activeWrap) {
        const chip = activeWrap.querySelector('.gallery-hero-filters__chip');
        clearChipVisual(activeWrap, chip);
        activeWrap = null;
    }
    clearHeroSelectionUi();
}

export function destroyHeroBiographySelection() {
    clearHeroBiographySelection();
    destroyHeroBiographyLookRangesEditor();
    destroyHeroBiographyPhraseButton();
    destroyHeroBiographyArchiveDescription();
    portraitCopyAc?.abort();
    portraitCopyAc = null;
    clearHeroBiosLooksCache();
    clearHeroBiographyLookRangesCache();
    clearHeroPhrasesCache();
    heroBiosLooksMap = null;
    clearHeroBiographyPortraitScaleCache();
    headerEl = null;
    titleEl = null;
    controlsRowEl = null;
    rangesRowEl = null;
    lookSelectEl = null;
    portraitEl = null;
    portraitImg = null;
}
