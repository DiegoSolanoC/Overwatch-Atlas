import { triggerHomeExit } from '../../universal-features/atlas-header/triggerHomeExit.js';
import {
    clearHeroBiographyDockHeroFilter,
    refreshHeroBiographyDockPagination,
} from './heroBiographyDockTimeline.js';
import {
    mountGalleryBiographyStage,
    unmountGalleryBiographyStage,
} from './HeroBiographyHeroFilterBar.js';
import { closeFiltersPanelForGalleryExit } from './galleryFiltersBridge.js';
import { initIntelEntitySwapPerfProbe } from './intelEntitySwapPerfProbe.js';
import {
    isIntelHeroesSelectVisible,
    mountIntelHeroesSelect,
    showIntelEntityView,
    showIntelHeroesSelect,
    unmountIntelHeroesSelect,
} from './intelHeroesSelect.js';

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
    initIntelEntitySwapPerfProbe();
    unmountGalleryMode();
    hideMenuAndGlobe();

    const content = document.getElementById('content');
    if (!content) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'story-viewer-container gallery-mode active gallery-mode--heroes-select';
    host.setAttribute('role', 'main');
    host.setAttribute('aria-label', 'Intel');

    const main = document.createElement('div');
    main.className = 'gallery-mode__main';
    main.setAttribute('aria-label', 'Hero biography content');
    host.appendChild(main);

    content.appendChild(host);

    try {
        await mountGalleryBiographyStage(host, main);
    } catch (err) {
        console.warn('[gallery] Failed to mount biography stage:', err);
        const errNote = document.createElement('p');
        errNote.className = 'gallery-mode__error';
        errNote.textContent = 'Could not load gallery stage.';
        main.appendChild(errNote);
    }

    try {
        await mountIntelHeroesSelect(host);
    } catch (err) {
        console.warn('[gallery] Failed to mount intel heroes select:', err);
    }

    /* Deep-link from Codex / Story / Archive — skip select and open the entity. */
    try {
        const { consumePendingGalleryBioFocus, focusBioEntityInOpenGallery } =
            await import('./openBioEntityInGallery.js');
        const pending = consumePendingGalleryBioFocus();
        if (pending?.name) {
            const ok = await focusBioEntityInOpenGallery(pending.kind, pending.name);
            if (ok) showIntelEntityView();
        }
    } catch (err) {
        console.warn('[gallery] Pending intel focus failed:', err);
    }

    const onEscape = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (!isIntelHeroesSelectVisible()) {
            showIntelHeroesSelect();
            return;
        }
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
    closeFiltersPanelForGalleryExit();
    unmountIntelHeroesSelect();
    unmountGalleryBiographyStage();
    clearHeroBiographyDockHeroFilter();
    refreshHeroBiographyDockPagination();
    host?.remove();

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }
}

export function isGalleryModeActive() {
    return !!document.getElementById(HOST_ID);
}
