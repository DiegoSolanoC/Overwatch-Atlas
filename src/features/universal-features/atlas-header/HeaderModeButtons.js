/**
 * HeaderModeButtons — mounts primary mode-entry header buttons.
 *
 * Left hub (`#headerHubButtonGroup`): Interactive Worldview, Connection Codex,
 * Data Archive, Hero Biography, Story Timeline, Dialogue Theater.
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
    const launchGlobe = createLoadingLockHandler(window.runGlobeComponents, setRunOperation);
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
        if (typeof window.runGlossaryComponents === 'function') {
            void window.runGlossaryComponents(false);
        }
    }, true);
}

function attachDataArchiveBootstrap() {
    const headerStoryBtn = document.getElementById('headerStoryViewerBtn');
    if (!headerStoryBtn) return;
    headerStoryBtn.addEventListener('click', function bootstrapStory(e) {
        e.stopPropagation();
        e.preventDefault();
        if (typeof window.runBiographyComponents === 'function') {
            void window.runBiographyComponents(false);
        }
    }, true);
}

function attachHeroBiographyBootstrap() {
    const btn = document.getElementById('headerHeroBiographyBtn');
    if (!btn) return;
    const launch = createLoadingLockHandler(window.runHeroBiographyComponents, setRunOperation);
    btn.addEventListener('click', function bootstrapHeroBiography(e) {
        e.stopPropagation();
        e.preventDefault();
        void launch();
    }, true);
}

function attachStoryTimelineBootstrap() {
    const btn = document.getElementById('headerStoryTimelineBtn');
    if (!btn) return;
    const launch = createLoadingLockHandler(window.runStoryTimelineComponents, setRunOperation);
    btn.addEventListener('click', function bootstrapStoryTimeline(e) {
        e.stopPropagation();
        e.preventDefault();
        void launch();
    }, true);
}

function attachDialogueTheaterBootstrap() {
    const btn = document.getElementById('headerDialogueTheaterBtn');
    if (!btn) return;
    const launch = createLoadingLockHandler(window.runDialogueTheaterComponents, setRunOperation);
    btn.addEventListener('click', function bootstrapDialogueTheater(e) {
        e.stopPropagation();
        e.preventDefault();
        void launch();
    }, true);
}

export function loadHeaderModeButtons() {
    createHeaderHubButton({
        id: 'headerInteractiveGlobeBtn',
        className: '',
        title: 'Interactive Worldview',
        label: 'Interactive Worldview',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Interactive%20Worldview.png',
        iconAlt: 'Interactive Worldview',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerInteractiveGlobeIcon',
        headerOrder: 15
    });
    attachWorldviewBootstrap();

    createHeaderHubButton({
        id: 'headerWorldCodexBtn',
        className: '',
        title: 'Connection Codex',
        label: 'Connection Codex',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Connection%20Codex.png',
        iconAlt: 'Connection Codex',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerWorldCodexIcon',
        headerOrder: 16
    });
    attachCodexBootstrap();

    createHeaderHubButton({
        id: 'headerStoryViewerBtn',
        className: '',
        title: 'Data Archive',
        label: 'Data Archive',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Data%20Archive.png',
        iconAlt: 'Data Archive',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerStoryViewerIcon',
        headerOrder: 17
    });
    attachDataArchiveBootstrap();

    createHeaderHubButton({
        id: 'headerHeroBiographyBtn',
        className: '',
        title: 'Hero Biography',
        label: 'Hero Biography',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Hero%20Biography.png',
        iconAlt: 'Hero Biography',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerHeroBiographyIcon',
        headerOrder: 18,
    });
    attachHeroBiographyBootstrap();

    createHeaderHubButton({
        id: 'headerStoryTimelineBtn',
        className: '',
        title: 'Story Timeline',
        label: 'Story Timeline',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Story%20Timeline.png',
        iconAlt: 'Story Timeline',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerStoryTimelineIcon',
        headerOrder: 19,
    });
    attachStoryTimelineBootstrap();

    createHeaderHubButton({
        id: 'headerDialogueTheaterBtn',
        className: '',
        title: 'Dialogue Theater',
        label: 'Dialogue Theater',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Dialogue%20Theater.png',
        iconAlt: 'Dialogue Theater',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerDialogueTheaterIcon',
        headerOrder: 20,
    });
    attachDialogueTheaterBootstrap();

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
