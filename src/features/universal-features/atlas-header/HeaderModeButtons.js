/**
 * HeaderModeButtons — mounts primary mode-entry header buttons.
 *
 * Left hub (`#headerHubButtonGroup`): World, Codex, Story, Gallery.
 * Right hub: Home.
 *
 * Each tile delegates to the matching `runXComponents` global from the orchestrator.
 *
 * Loaded by the `ModeOrchestrator` under the `headerNav` loader key.
 */

import { createHeaderHubButton } from './HeaderHubButton.js';
import { createLoadingLockHandler } from '../atlas-shared-ui/loading/LoadingLockProtocol.js';
import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';
import { setRunOperation } from '../atlas-mode-runtime/loadingOverlayState.js';
import { attachHomeButtonHandler } from './HomeButtonHandler.js';

function attachWorldviewBootstrap() {
    const headerGlobeBtn = document.getElementById('headerInteractiveGlobeBtn');
    if (!headerGlobeBtn) return;

    // Worldview launches inside its own mode shell — the chooser hub paints
    // 3D Globe / 2D Map options the same way Data Archive paints categories.
    const launchGlobe = createLoadingLockHandler(window.runWorldComponents, setRunOperation);
    headerGlobeBtn.addEventListener('click', function bootstrapGlobe(e) {
        e.stopPropagation();
        e.preventDefault();
        void launchGlobe();
    }, true);
}

function attachCodexBootstrap() {
    const headerCodexBtn = document.getElementById('headerWorldCodexBtn');
    if (!headerCodexBtn) return;
    headerCodexBtn.addEventListener('click', function bootstrapCodex(e) {
        e.stopPropagation();
        e.preventDefault();
        if (typeof window.runCodexComponents === 'function') {
            void window.runCodexComponents(false);
        }
    }, true);
}

function attachHeroBiographyBootstrap() {
    const btn = document.getElementById('headerHeroBiographyBtn');
    if (!btn) return;
    const launch = createLoadingLockHandler(window.runGalleryComponents, setRunOperation);
    btn.addEventListener('click', function bootstrapHeroBiography(e) {
        e.stopPropagation();
        e.preventDefault();
        void launch();
    }, true);
}

function attachStoryTimelineBootstrap() {
    const btn = document.getElementById('headerStoryTimelineBtn');
    if (!btn) return;
    const launch = createLoadingLockHandler(window.runStoryComponents, setRunOperation);
    btn.addEventListener('click', function bootstrapStoryTimeline(e) {
        e.stopPropagation();
        e.preventDefault();
        void launch();
    }, true);
}

export function loadHeaderModeButtons() {
    createHeaderHubButton({
        id: 'headerInteractiveGlobeBtn',
        className: '',
        title: 'World',
        label: 'World',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Interactive%20Worldview.png',
        iconAlt: 'World',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerInteractiveGlobeIcon',
        headerOrder: 15
    });
    attachWorldviewBootstrap();

    createHeaderHubButton({
        id: 'headerWorldCodexBtn',
        className: '',
        title: 'Codex',
        label: 'Codex',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Connection%20Codex.png',
        iconAlt: 'Codex',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerWorldCodexIcon',
        headerOrder: 16
    });
    attachCodexBootstrap();

    createHeaderHubButton({
        id: 'headerStoryTimelineBtn',
        className: '',
        title: 'Story',
        label: 'Story',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Story%20Timeline.png',
        iconAlt: 'Story',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerStoryTimelineIcon',
        headerOrder: 17,
    });
    attachStoryTimelineBootstrap();

    createHeaderHubButton({
        id: 'headerHeroBiographyBtn',
        className: '',
        title: 'Gallery',
        label: 'Gallery',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Hero%20Biography.png',
        iconAlt: 'Gallery',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerHeroBiographyIcon',
        headerOrder: 18,
    });
    attachHeroBiographyBootstrap();

    createHeaderHubButton({
        id: 'homeBtn',
        className: '',
        title: 'Return to Home',
        label: 'Home',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Home%20Button.png',
        iconAlt: 'Home',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'homeBtnIcon',
        headerOrder: 70
    });
    const homeButton = document.getElementById('homeBtn');
    if (homeButton) {
        attachHomeButtonHandler(homeButton);
    }

    updateStatus('✓ Header mode buttons loaded', 'success');
}
