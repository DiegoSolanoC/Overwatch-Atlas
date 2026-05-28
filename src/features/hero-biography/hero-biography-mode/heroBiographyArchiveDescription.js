/**
 * Floating heroes-archive description on the left of Hero Biography stage.
 */

import {
    clearHeroesArchiveEventsCache,
    findHeroArchiveEntryByFilterKey,
    getHeroArchiveBioDescription,
    loadHeroesArchiveEvents,
} from './heroBiographyArchiveData.js';

/** @type {HTMLElement | null} */
let panelEl = null;

/** @type {HTMLElement | null} */
let bodyEl = null;

/** @type {HTMLElement | null} */
let emptyEl = null;

let loadGeneration = 0;

function setVisible(show) {
    if (!panelEl) return;
    panelEl.classList.toggle('is-visible', show);
    panelEl.setAttribute('aria-hidden', show ? 'false' : 'true');
}

/**
 * @param {HTMLElement} hostEl — `#atlasHeroBiographyHost`
 */
export function initHeroBiographyArchiveDescription(hostEl) {
    if (panelEl) return;

    panelEl = document.createElement('aside');
    panelEl.className = 'hero-biography-mode__archive-description';
    panelEl.setAttribute('aria-label', 'Hero biography');
    panelEl.setAttribute('aria-hidden', 'true');

    bodyEl = document.createElement('div');
    bodyEl.className = 'hero-biography-mode__archive-description-body';

    emptyEl = document.createElement('p');
    emptyEl.className = 'hero-biography-mode__archive-description-empty';
    emptyEl.textContent = 'No biography written yet for this hero.';

    panelEl.append(bodyEl, emptyEl);
    hostEl.appendChild(panelEl);
}

/**
 * @param {string | null} heroFilterKey
 */
export async function setHeroBiographyArchiveDescriptionHero(heroFilterKey) {
    const gen = ++loadGeneration;
    if (!panelEl || !bodyEl || !emptyEl) return;

    const key = heroFilterKey ? String(heroFilterKey).trim() : '';
    if (!key) {
        bodyEl.textContent = '';
        emptyEl.hidden = true;
        setVisible(false);
        return;
    }

    let description = null;
    try {
        const events = await loadHeroesArchiveEvents();
        if (gen !== loadGeneration) return;
        const entry = findHeroArchiveEntryByFilterKey(key, events);
        description = getHeroArchiveBioDescription(entry);
    } catch (err) {
        console.warn('[hero-biography] Could not load archive description:', err);
    }

    if (gen !== loadGeneration) return;

    if (description) {
        bodyEl.textContent = description;
        emptyEl.hidden = true;
        setVisible(true);
    } else {
        bodyEl.textContent = '';
        emptyEl.hidden = false;
        setVisible(true);
    }
}

export function destroyHeroBiographyArchiveDescription() {
    loadGeneration += 1;
    panelEl?.remove();
    panelEl = null;
    bodyEl = null;
    emptyEl = null;
    clearHeroesArchiveEventsCache();
}
