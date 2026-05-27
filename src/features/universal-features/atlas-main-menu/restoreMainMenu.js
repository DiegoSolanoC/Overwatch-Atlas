import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';
import { broadcastModeChange } from '../atlas-mode-runtime/mode-lifecycle/broadcastModeChange.js';

/**
 * @param {{ menu: boolean }} loadedComponents
 * @param {() => Promise<void>} loadMenu
 */
async function ensureMenuLoaded(loadedComponents, loadMenu) {
    if (!loadedComponents.menu) {
        updateStatus('Loading menu components...', 'info');
        await loadMenu();
    }
}

function showMenuShell() {
    const testContainer = document.querySelector('.test-container');
    const menuButtons = testContainer ? testContainer.querySelector('.main-menu-buttons') : null;

    if (testContainer) {
        testContainer.style.display = 'flex';
        testContainer.classList.remove('fading');
        testContainer.style.opacity = '1';
        testContainer.style.visibility = 'visible';
    }

    if (menuButtons) {
        menuButtons.style.display = 'flex';
        menuButtons.style.visibility = 'visible';
        menuButtons.style.opacity = '1';
    }
}

function hideGlobeShell() {
    const globeContainer = document.getElementById('globe-container');
    if (!globeContainer) return;
    globeContainer.style.display = 'none';
    globeContainer.classList.remove('loaded');
    globeContainer.style.position = '';
    globeContainer.style.top = '';
    globeContainer.style.left = '';
}

function hideRotateSubBar() {
    const rotateSubBar = document.getElementById('headerRotateSubBar');
    if (rotateSubBar) {
        rotateSubBar.style.display = 'none';
    }
}

function resetFooterAndNewsTicker() {
    const footer = document.querySelector('footer');
    if (footer) {
        footer.classList.remove('timeline-loaded');
    }
    if (window.newsTickerService && typeof window.newsTickerService.clear === 'function') {
        window.newsTickerService.clear();
    }
}

function closeSidePanelsAndToggles() {
    const eventSlide = document.getElementById('eventSlide');
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    const filtersPanel = document.getElementById('filtersPanel');

    if (eventSlide) eventSlide.classList.remove('open');
    if (eventsManagePanel) eventsManagePanel.classList.remove('open');
    if (filtersPanel) filtersPanel.classList.remove('open');

    const eventsManageToggle = document.getElementById('eventsManageToggle');
    const filtersToggle = document.getElementById('filtersToggle');
    if (eventsManageToggle) eventsManageToggle.classList.remove('active');
    if (filtersToggle) filtersToggle.classList.remove('active');
}

function removeGlobeMapChooserChrome() {
    const testContainer = document.querySelector('.test-container');
    document.getElementById('globeMapLaunchHost')?.remove();
    document.getElementById('globeMapLaunchHubOverlay')?.remove();
    if (testContainer) {
        delete testContainer.dataset.globeMapChoiceHidden;
        delete testContainer.dataset.globeMapChoicePrevDisplay;
    }
}

/**
 * Brings the main menu back after a mode (Globe / Codex / Data Archive) exits.
 *
 * Responsibilities:
 *   1. Re-load menu components if they were unloaded.
 *   2. Make `.test-container` and its `.main-menu-buttons` visible again.
 *   3. Hide the globe container and reset its inline positioning.
 *   4. Hide the rotation subbar.
 *   5. (When `preserveNewsTicker` is `false`) restore the dark-blue footer and
 *      clear the news ticker � these are kept around when the user is just
 *      switching from one mode straight to another.
 *   6. Close any side panels (event slide, events-manage, filters) and remove
 *      any in-flight Globe / Map chooser overlay.
 *   7. Dispatch `appmodechange` with `mode: 'menu'` so the header hub clears
 *      its highlight.
 *
 * The function takes the orchestrator's `loadedComponents` flag bag and the
 * menu loader as inputs so it doesn't need to be a class method.
 *
 * @param {Object} ctx
 * @param {{ menu: boolean }} ctx.loadedComponents - The orchestrator's loaded-state map.
 * @param {() => Promise<void>} ctx.loadMenu       - Loader for the menu components.
 * @param {boolean} [preserveNewsTicker=false]     - Skip footer/ticker reset.
 */
export async function restoreMainMenu(ctx, preserveNewsTicker = false) {
    const { loadedComponents, loadMenu } = ctx;

    await ensureMenuLoaded(loadedComponents, loadMenu);
    showMenuShell();
    hideGlobeShell();
    hideRotateSubBar();

    if (!preserveNewsTicker) {
        resetFooterAndNewsTicker();
    }

    closeSidePanelsAndToggles();
    removeGlobeMapChooserChrome();
    broadcastModeChange('menu');
}
