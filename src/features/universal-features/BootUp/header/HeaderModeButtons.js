/**
 * HeaderModeButtons — mounts the four primary mode-entry header buttons.
 *
 * Creates Interactive Worldview, Connection Codex, Data Archive (left hub),
 * and Home (right hub). Each gets a bootstrap click handler that delegates
 * to the appropriate `runXComponents` global the orchestrator publishes.
 *
 * Loaded by the `ModeOrchestrator` under the `headerNav` loader key.
 * (Renamed from `HeaderNavButtons.js`.)
 */

import { createHeaderHubButton } from './HeaderHubButton.js';
import { createLoadingLockHandler } from '../../ComponentSetUp/LoadingLockProtocol.js';
import { updateStatus } from '../../runtime/statusFeed.js';
import { setRunOperation } from '../../runtime/loadingOverlayState.js';
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

export function loadHeaderModeButtons() {
    createHeaderHubButton({
        id: 'headerInteractiveGlobeBtn',
        className: '',
        title: 'Interactive Worldview',
        label: 'Interactive Worldview',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Timeline%20Icon.png',
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
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Codex%20Icon.png',
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
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Story%20Icon.png',
        iconAlt: 'Data Archive',
        parentId: 'headerHubButtonGroup',
        baseClass: 'header-hub-btn header-hub-btn--icon',
        iconSpanId: 'headerStoryViewerIcon',
        headerOrder: 17
    });
    attachDataArchiveBootstrap();

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
