import { triggerHomeExit } from '../../universal-features/atlas-header/triggerHomeExit.js';
import {
    clearHeroBiographyDockHeroFilter,
    refreshHeroBiographyDockPagination,
} from './heroBiographyDockTimeline.js';
import {
    mountHeroBiographyHeroFilterBar,
    unmountHeroBiographyHeroFilterBar,
} from './HeroBiographyHeroFilterBar.js';

const HOST_ID = 'atlasGalleryHost';

function hideMenuAndGlobe() {
    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = 'none';
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.setProperty('display', 'none', 'important');
    }
    document.getElementById('eventsManagePanel')?.classList.remove('open');

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.display = 'none';
    }
}

/** @param {object} [_options] Reserved for future mount options. */
export async function mountGalleryMode(_options = {}) {
    unmountGalleryMode();
    hideMenuAndGlobe();

    const content = document.getElementById('content');
    if (!content) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'story-viewer-container gallery-mode active';
    host.setAttribute('role', 'main');
    host.setAttribute('aria-label', 'Gallery');

    const main = document.createElement('div');
    main.className = 'gallery-mode__main';
    main.setAttribute('aria-label', 'Hero biography content');
    host.appendChild(main);

    try {
        await mountHeroBiographyHeroFilterBar(host, main);
    } catch (err) {
        console.warn('[gallery] Failed to load hero filters:', err);
        const errNote = document.createElement('p');
        errNote.className = 'gallery-mode__error';
        errNote.textContent = 'Could not load hero filters.';
        main.appendChild(errNote);
    }

    content.appendChild(host);

    const onEscape = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        triggerHomeExit();
    };
    document.addEventListener('keydown', onEscape);
    host._heroBiographyEscape = onEscape;
}

export async function unmountGalleryMode() {
    const host = document.getElementById(HOST_ID);
    if (host?._heroBiographyEscape) {
        document.removeEventListener('keydown', host._heroBiographyEscape);
    }
    unmountHeroBiographyHeroFilterBar();
    clearHeroBiographyDockHeroFilter();
    refreshHeroBiographyDockPagination();
    host?.remove();

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }
}

/** @deprecated Use {@link mountGalleryMode} */
export const mountHeroBiographyMode = mountGalleryMode;
/** @deprecated Use {@link unmountGalleryMode} */
export const unmountHeroBiographyMode = unmountGalleryMode;
