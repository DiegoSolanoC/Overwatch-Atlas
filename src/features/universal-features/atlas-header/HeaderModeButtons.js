/**
 * HeaderModeButtons — mounts primary mode-entry header buttons.
 *
 * Left hub (`#headerHubButtonGroup`): Home, World, Codex, Story, Intel.
 * Right hub: Gallery, Theater, Archive, Workshop, Palette (Palette is mounted by
 * `PaletteLoaders` at double width so the right strip still reads as five segments).
 *
 * Each tile delegates to the matching `runXComponents` global from the orchestrator.
 * On mobile portrait main menu: first tap slides to that mode; second tap selects it.
 *
 * Loaded by the `ModeOrchestrator` under the `headerNav` loader key.
 */

import { createHeaderHubButton } from './HeaderHubButton.js';
import { createLoadingLockHandler } from '../atlas-shared-ui/loading/LoadingLockProtocol.js';
import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';
import { setRunOperation } from '../atlas-mode-runtime/loadingOverlayState.js';
import { attachHomeButtonHandler } from './HomeButtonHandler.js';
import { tryMobileMenuHeaderTap } from '../atlas-main-menu/mobileMainMenuHeaderBridge.js';

/**
 * @param {string} btnId
 * @param {string} modeId - Matches MAIN_MENU_MOBILE_MODES id
 * @param {Function | null | undefined} launchFn
 */
function attachModeBootstrap(btnId, modeId, launchFn) {
    const btn = document.getElementById(btnId);
    if (!btn || typeof launchFn !== 'function') return;

    btn.addEventListener('click', function bootstrapMode(e) {
        e.stopPropagation();
        e.preventDefault();
        if (tryMobileMenuHeaderTap(modeId, launchFn)) return;
        void launchFn();
    }, true);
}

function attachWorldviewBootstrap() {
    const launchGlobe = createLoadingLockHandler(window.runWorldComponents, setRunOperation);
    attachModeBootstrap('headerInteractiveGlobeBtn', 'world', launchGlobe);
}

function attachCodexBootstrap() {
    attachModeBootstrap('headerWorldCodexBtn', 'codex', () => {
        if (typeof window.runCodexComponents === 'function') {
            void window.runCodexComponents(false);
        }
    });
}

function attachHeroBiographyBootstrap() {
    const launch = createLoadingLockHandler(
        window.runIntelComponents || window.runGalleryComponents,
        setRunOperation,
    );
    attachModeBootstrap('headerHeroBiographyBtn', 'intel', launch);
}

function attachStoryTimelineBootstrap() {
    const launch = createLoadingLockHandler(window.runStoryComponents, setRunOperation);
    attachModeBootstrap('headerStoryTimelineBtn', 'story', launch);
}

function attachDialogueTheaterBootstrap() {
    if (typeof window.runDialogueTheaterComponents !== 'function') return;
    const launch = createLoadingLockHandler(window.runDialogueTheaterComponents, setRunOperation);
    attachModeBootstrap('headerDialogueTheaterBtn', 'theater', launch);
}

function attachOfficialArchiveBootstrap() {
    const run = typeof window.runOfficialArchiveComponents === 'function'
        ? window.runOfficialArchiveComponents
        : window.runOfficialResourcesComponents;
    if (typeof run !== 'function') return;
    const launch = createLoadingLockHandler(run, setRunOperation);
    attachModeBootstrap('headerOfficialArchiveBtn', 'archive', launch);
}

function attachGalleryHubBootstrap() {
    if (typeof window.runGalleryHubComponents !== 'function') return;
    const launch = createLoadingLockHandler(window.runGalleryHubComponents, setRunOperation);
    attachModeBootstrap('headerGalleryHubBtn', 'gallery', launch);
}

export function loadHeaderModeButtons() {
    createHeaderHubButton({
        id: 'homeBtn',
        className: '',
        title: 'Return to Home',
        label: 'Home',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Home%20Button.png',
        iconAlt: 'Home',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'homeBtnIcon',
        headerOrder: 10
    });
    const homeButton = document.getElementById('homeBtn');
    if (homeButton) {
        attachHomeButtonHandler(homeButton);
    }

    createHeaderHubButton({
        id: 'headerInteractiveGlobeBtn',
        className: '',
        title: 'World',
        label: 'World',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Worldview.png',
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
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Codex.png',
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
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Story.png',
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
        title: 'Intel',
        label: 'Intel',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Intel.png',
        iconAlt: 'Intel',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerHeroBiographyIcon',
        headerOrder: 18,
    });
    attachHeroBiographyBootstrap();

    /* Match main-menu order: Theater → Archive → Gallery */
    createHeaderHubButton({
        id: 'headerDialogueTheaterBtn',
        className: '',
        title: 'Theater',
        label: 'Theater',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Theater.png',
        iconAlt: 'Theater',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerDialogueTheaterIcon',
        headerOrder: 48,
    });
    attachDialogueTheaterBootstrap();

    createHeaderHubButton({
        id: 'headerOfficialArchiveBtn',
        className: '',
        title: 'Archive',
        label: 'Archive',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Archive.png',
        iconAlt: 'Archive',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerOfficialArchiveIcon',
        headerOrder: 50,
    });
    attachOfficialArchiveBootstrap();

    createHeaderHubButton({
        id: 'headerGalleryHubBtn',
        className: '',
        title: 'Gallery',
        label: 'Gallery',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Gallery.png',
        iconAlt: 'Gallery',
        parentId: 'headerHubRightButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerGalleryHubIcon',
        headerOrder: 55,
    });
    attachGalleryHubBootstrap();

    updateStatus('✓ Header mode buttons loaded', 'success');
}
