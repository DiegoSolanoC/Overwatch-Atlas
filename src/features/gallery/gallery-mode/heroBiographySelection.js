/**
 * Single-select state for Hero Biography chips + main-stage title, look picker, portrait.
 */

import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';
import {
    buildHeroBiographyLookPath,
    DEFAULT_HERO_BIO_LOOK,
} from './heroBiographyHeroicImagePaths.js';
import {
    buildFactionImagePath,
    DEFAULT_FACTION_LOOK,
} from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';
import {
    clearHeroBiosLooksCache,
    getLooksForHero,
    loadHeroBiosLooksMap,
} from './loadHeroBiosLooks.js';
import {
    clearFactionBiosLooksCache,
    getLooksForFaction,
    loadFactionBiosLooksMap,
} from './loadFactionBiosLooks.js';
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
    setBioBiographyLookRangesEditorEntity,
    syncHeroBiographyLookRangeEditorLook,
} from './heroBiographyLookRangesEditor.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';
import { clearHeroBiographyLookRangesCache } from './heroBiographyLookRangesStorage.js';
import { clearFactionBiographyLookRangesCache } from './factionBiographyLookRangesStorage.js';
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

/** @type {Record<string, string[]> | null} */
let factionBiosLooksMap = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let currentCategory = 'heroes';

/** @type {string | null} */
let currentFilterKey = null;

/** @type {HTMLElement | null} */
let portraitEmptyEl = null;

let currentLook = DEFAULT_HERO_BIO_LOOK;
/** @type {string | null} */
let hoverPreviewLook = null;

function refreshConnectionPortraitLooks() {
    void import('./heroBiographyConnectionPortraitLooks.js')
        .then((m) => m.refreshGalleryConnectionPortraitLooks())
        .catch(() => {});
}
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

async function ensureFactionBiosLooksMap() {
    if (!factionBiosLooksMap) {
        factionBiosLooksMap = await loadFactionBiosLooksMap();
    }
    return factionBiosLooksMap;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @returns {string}
 */
function defaultLookForCategory(category) {
    return category === 'factions' ? DEFAULT_FACTION_LOOK : DEFAULT_HERO_BIO_LOOK;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @param {string} lookName
 * @returns {string}
 */
function buildArchivePortraitPath(category, filterKey, lookName) {
    if (category === 'factions') {
        return buildFactionImagePath(filterKey, lookName);
    }
    return buildHeroBiographyLookPath(filterKey, lookName);
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} filterKey
 * @returns {Promise<string[]>}
 */
async function loadLooksForArchiveEntity(category, filterKey) {
    if (category === 'factions') {
        const map = await ensureFactionBiosLooksMap();
        return getLooksForFaction(map, filterKey);
    }
    const map = await ensureHeroBiosLooksMap();
    return getLooksForHero(map, filterKey);
}

function updatePortraitEmptyMessage(category) {
    if (!portraitEmptyEl) return;
    portraitEmptyEl.textContent =
        category === 'factions'
            ? 'Faction logo not available yet'
            : 'Heroic portrait not available yet';
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
    portraitEmptyEl = empty;

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
        if (!currentFilterKey || !lookSelectEl) return;
        if (currentCategory !== 'heroes' && currentCategory !== 'factions') return;
        hoverPreviewLook = null;
        currentLook = lookSelectEl.value;
        if (
            (currentCategory === 'heroes' || currentCategory === 'factions') &&
            isHeroBiographyLookRangesEditorEnabled()
        ) {
            syncHeroBiographyLookRangeEditorLook(currentLook);
        }
        setArchivePortrait(
            currentCategory,
            currentFilterKey,
            titleEl?.textContent || '',
            currentLook,
        );
        refreshConnectionPortraitLooks();
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

function syncPortraitControlsVisibility() {
    const showPortrait = currentCategory === 'heroes' || currentCategory === 'factions';
    const showLookPicker = showPortrait;
    if (portraitEl) {
        portraitEl.style.display = showPortrait ? '' : 'none';
        portraitEl.classList.toggle('gallery-mode__portrait--faction', currentCategory === 'factions');
        portraitEl.classList.toggle('gallery-mode__portrait--hero', currentCategory === 'heroes');
    }
    if (controlsRowEl) {
        const lookField = controlsRowEl.querySelector('.gallery-mode__look-field');
        if (lookField) lookField.hidden = !showLookPicker;
    }
    if (rangesRowEl) {
        rangesRowEl.hidden = currentCategory !== 'heroes' && currentCategory !== 'factions';
    }
    updatePortraitEmptyMessage(currentCategory);
}

/** @deprecated internal alias */
function syncHeroOnlyControlsVisibility() {
    syncPortraitControlsVisibility();
}

/**
 * @param {string} lookName
 */
export function previewHeroBiographyLook(lookName) {
    if (!currentFilterKey || (currentCategory !== 'heroes' && currentCategory !== 'factions')) return;
    if (hoverPreviewLook === lookName) return;

    hoverPreviewLook = lookName;
    if (lookSelectEl && lookSelectEl.value !== lookName) {
        lookSelectEl.value = lookName;
    }
    setArchivePortrait(
        currentCategory,
        currentFilterKey,
        titleEl?.textContent || '',
        lookName,
    );
    void refreshConnectionPortraitLooks();
}

/**
 * Persist the look chosen from dock hover (or manual pick) as the active selection.
 * @param {string} lookName
 */
export function commitHeroBiographyLook(lookName) {
    if (!currentFilterKey || !lookName) return;
    if (currentCategory !== 'heroes' && currentCategory !== 'factions') return;

    hoverPreviewLook = null;
    currentLook = lookName;
    if (lookSelectEl && lookSelectEl.value !== lookName) {
        lookSelectEl.value = lookName;
    }
    setArchivePortrait(
        currentCategory,
        currentFilterKey,
        titleEl?.textContent || '',
        lookName,
    );
    void refreshConnectionPortraitLooks();
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
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string | null} filterKey
 * @param {string} displayName
 * @param {string} lookName
 */
function setArchivePortrait(category, filterKey, displayName, lookName) {
    if (!portraitEl || !portraitImg) return;

    const cat = normalizeBioBiographyCategory(category);

    if (!filterKey || (cat !== 'heroes' && cat !== 'factions')) {
        portraitEl.classList.remove('is-visible', 'has-image');
        portraitEl.setAttribute('aria-hidden', 'true');
        portraitImg.onload = null;
        portraitImg.onerror = null;
        portraitImg.removeAttribute('src');
        delete portraitImg.dataset.bioLook;
        delete portraitImg.dataset.bioEntity;
        delete portraitImg.dataset.bioCategory;
        portraitImg.alt = '';
        resetHeroBiographyPortraitScale(portraitImg);
        return;
    }

    const look = lookName || defaultLookForCategory(cat);
    const alt = displayName ? `${displayName} — ${look}` : look;
    const entityKey = String(filterKey).trim();

    if (
        portraitImg.dataset.bioEntity === entityKey &&
        portraitImg.dataset.bioLook === look &&
        portraitImg.dataset.bioCategory === cat &&
        portraitEl.classList.contains('has-image') &&
        portraitImg.getAttribute('src')
    ) {
        portraitEl.classList.add('is-visible');
        portraitEl.setAttribute('aria-hidden', 'false');
        if (portraitImg.alt !== alt) portraitImg.alt = alt;
        if (cat === 'heroes' && portraitImg.naturalWidth) {
            void applyHeroBiographyPortraitScale(portraitImg, entityKey);
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
    portraitImg.dataset.bioEntity = entityKey;
    portraitImg.dataset.bioLook = look;
    portraitImg.dataset.bioCategory = cat;
    portraitImg.alt = alt;

    const src = buildArchivePortraitPath(cat, filterKey, look);
    const loadId = ++portraitLoadId;

    portraitImg.onload = () => {
        if (loadId !== portraitLoadId) return;
        if (portraitImg.dataset.bioEntity !== entityKey) return;
        if (cat === 'heroes') {
            void applyHeroBiographyPortraitScale(portraitImg, entityKey);
        } else {
            resetHeroBiographyPortraitScale(portraitImg);
        }
        portraitEl?.classList.add('has-image');
    };
    portraitImg.onerror = () => {
        if (loadId !== portraitLoadId) return;
        if (portraitImg.dataset.bioEntity !== entityKey) return;
        portraitEl?.classList.remove('has-image');
        portraitImg.removeAttribute('src');
        delete portraitImg.dataset.bioLook;
        delete portraitImg.dataset.bioEntity;
        delete portraitImg.dataset.bioCategory;
        resetHeroBiographyPortraitScale(portraitImg);
    };

    portraitImg.src = src;

    if (portraitImg.complete && portraitImg.naturalWidth) {
        if (cat === 'heroes') {
            void applyHeroBiographyPortraitScale(portraitImg, entityKey);
        }
        portraitEl.classList.add('has-image');
    }
}

/**
 * @param {string | null} heroFilterKey
 * @param {string} displayName
 * @param {string} lookName
 */
function setHeroPortrait(heroFilterKey, displayName, lookName) {
    setArchivePortrait('heroes', heroFilterKey, displayName, lookName);
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
    currentLook = defaultLookForCategory(cat);
    syncPortraitControlsVisibility();

    if (cat === 'heroes' || cat === 'factions') {
        /** @type {string[]} */
        let looks = [defaultLookForCategory(cat)];
        try {
            looks = await loadLooksForArchiveEntity(cat, filterKey);
            populateLookSelect(looks);
            const preferred = defaultLookForCategory(cat);
            currentLook = looks.includes(preferred) ? preferred : looks[0];
            if (lookSelectEl) {
                lookSelectEl.value = currentLook;
            }
        } catch (err) {
            console.warn(`[gallery] Could not load ${cat} looks:`, err);
            looks = [defaultLookForCategory(cat)];
            populateLookSelect(looks);
            if (lookSelectEl) lookSelectEl.value = defaultLookForCategory(cat);
        }
        setArchivePortrait(cat, filterKey, displayName, currentLook);
        if (cat === 'heroes' || cat === 'factions') {
            setBioBiographyLookRangesEditorEntity(cat, filterKey, currentLook);
        } else {
            setBioBiographyLookRangesEditorEntity(null, null);
        }
        if (cat === 'heroes') {
            void setHeroBiographyPhraseButtonHero(filterKey);
        } else {
            void setHeroBiographyPhraseButtonHero(null);
        }
    } else {
        populateLookSelect([]);
        setArchivePortrait(null, null, '', defaultLookForCategory('heroes'));
        setBioBiographyLookRangesEditorEntity(null, null);
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
    syncPortraitControlsVisibility();
    populateLookSelect([]);
    setBioBiographyLookRangesEditorEntity(null, null);
    void setHeroBiographyPhraseButtonHero(null);
    void setBioBiographyArchiveDescription(null, null);
    setTitle('');
    setArchivePortrait(null, null, '', DEFAULT_HERO_BIO_LOOK);
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
    clearFactionBiosLooksCache();
    clearHeroBiographyLookRangesCache();
    clearFactionBiographyLookRangesCache();
    clearHeroPhrasesCache();
    heroBiosLooksMap = null;
    factionBiosLooksMap = null;
    clearHeroBiographyPortraitScaleCache();
    headerEl = null;
    titleEl = null;
    controlsRowEl = null;
    rangesRowEl = null;
    lookSelectEl = null;
    portraitEl = null;
    portraitImg = null;
    portraitEmptyEl = null;
}
