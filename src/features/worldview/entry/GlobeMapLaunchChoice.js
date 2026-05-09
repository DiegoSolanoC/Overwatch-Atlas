/**
 * Globe vs map launch chooser — same shell as Data Archive hub: fills `main#content`
 * (`story-viewer-container story-viewer-container--hub`), not a body-level overlay.
 * Uses `story-archive-category-hub__*` tiles + world art; writes `mapGlobePreToggle` then `launchGlobe`.
 * Entry matches Data Archive: mode-switch SFX, loading overlay ~800ms, menu hidden while waiting.
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from '../../universal-features/managers/LoadingOverlayManager.js';

const HOST_ID = 'globeMapLaunchHost';
/** @deprecated — removed from body; teardown still clears if present */
const LEGACY_OVERLAY_ID = 'globeMapLaunchHubOverlay';
const HUB_ID = 'globeMapCategoryHub';

const IMG_GLOBE = 'src/assets/images/World%20View/Globe.png';
const IMG_MAP = 'src/assets/images/World%20View/Map.png';

/** @type {((e: KeyboardEvent) => void) | null} */
let _activeKeyHandler = null;

/** Same cue as `ComponentOrchestrator.playModeSwitchSound` when opening a mode from the menu. */
function playModeSwitchSound(isAutoLoad) {
    if (isAutoLoad || !window.SoundEffectsManager) return;
    const sfx = window.SoundEffectsManager;
    if (sfx.sounds && sfx.sounds.modeSwitch) {
        sfx.play('modeSwitch');
        return;
    }
    sfx.loadSound('modeSwitch', 'src/assets/audio/sfx/Mode Switch.mp3');
    setTimeout(() => sfx.play('modeSwitch'), 100);
}

function playStoryArchiveStyleChoiceSfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds.eventManager) {
        sfx.play('eventManager');
        return;
    }
    if (typeof sfx.loadSound === 'function') {
        sfx.loadSound('eventManager', 'src/assets/audio/sfx/Event Manager.mp3');
        setTimeout(() => {
            if (sfx.sounds && sfx.sounds.eventManager) {
                sfx.play('eventManager');
            }
        }, 60);
    }
}

/** Main menu + header label for the timeline (globe vs map is chosen after click). */
export const INTERACTIVE_WORLDVIEW_LABEL = 'Interactive Worldview';

/** Main menu description; view mode no longer swaps this copy. */
export const INTERACTIVE_WORLDVIEW_DESC =
    'Visualize the Story through a 3D Globe or 2D Map';

/**
 * Refresh header + main menu copy for the timeline entry (fixed strings).
 * @param {boolean} [_startOnMap] Ignored — kept for call-site compatibility.
 */
export function syncGlobeMapLaunchLabels(_startOnMap) {
    const labelText = INTERACTIVE_WORLDVIEW_LABEL;
    const descText = INTERACTIVE_WORLDVIEW_DESC;

    const headerGlobeBtn = document.getElementById('headerInteractiveGlobeBtn');
    if (headerGlobeBtn) {
        const labelEl = headerGlobeBtn.querySelector('.header-hub-btn-label');
        if (labelEl) labelEl.textContent = labelText;
        headerGlobeBtn.title = labelText;
        const iconSpan = document.getElementById('headerInteractiveGlobeIcon');
        if (iconSpan) iconSpan.setAttribute('aria-label', labelText);
    }

    const mainMenuGlobeBtn = document.getElementById('runGlobeBtn');
    if (mainMenuGlobeBtn) {
        const labelEl = mainMenuGlobeBtn.querySelector('.main-menu-label');
        const descEl =
            mainMenuGlobeBtn.querySelector('.main-menu-external-label__desc') ||
            mainMenuGlobeBtn.querySelector('.main-menu-description');
        if (labelEl) labelEl.textContent = labelText;
        if (descEl) {
            descEl.textContent = descText;
        }
        mainMenuGlobeBtn.title = labelText;
    }
}

function hideTestContainerForGlobeChoice() {
    const tc = document.querySelector('.test-container');
    if (!tc || tc.dataset.globeMapChoiceHidden === '1') return;
    tc.dataset.globeMapChoicePrevDisplay = tc.style.display || '';
    tc.dataset.globeMapChoiceHidden = '1';
    tc.style.display = 'none';
}

function restoreTestContainerAfterGlobeChoice() {
    const tc = document.querySelector('.test-container');
    if (!tc || tc.dataset.globeMapChoiceHidden !== '1') return;
    const prev = tc.dataset.globeMapChoicePrevDisplay;
    delete tc.dataset.globeMapChoiceHidden;
    delete tc.dataset.globeMapChoicePrevDisplay;
    if (prev == null || prev === '') {
        tc.style.removeProperty('display');
    } else {
        tc.style.display = prev;
    }
}

function detachKeyHandler() {
    if (_activeKeyHandler) {
        document.removeEventListener('keydown', _activeKeyHandler);
        _activeKeyHandler = null;
    }
}

/**
 * @param {boolean} restoreMenu — restore `.test-container` (Cancel / Escape only)
 */
function teardownGlobeMapLaunchHost(restoreMenu) {
    detachKeyHandler();
    document.getElementById(HOST_ID)?.remove();
    document.getElementById(LEGACY_OVERLAY_ID)?.remove();
    if (restoreMenu) {
        restoreTestContainerAfterGlobeChoice();
    }
}

/**
 * Build two hub tiles (same markup as ComponentOrchestrator._buildStoryArchiveCategoryHub grid tiles).
 * @param {(startOnMap: boolean) => void} onPick
 */
function buildGlobeMapCategoryHub(onPick) {
    const root = document.createElement('div');
    root.id = HUB_ID;
    root.className = 'story-archive-category-hub story-archive-category-hub--globe-map';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Choose globe or map');

    const gridSlot = document.createElement('div');
    gridSlot.className = 'story-archive-category-hub__grid';

    const tiles = [
        { id: 'globe', label: '3D Globe', src: IMG_GLOBE, startOnMap: false },
        { id: 'map', label: '2D Map', src: IMG_MAP, startOnMap: true }
    ];

    tiles.forEach((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'story-archive-category-hub__tile';
        btn.dataset.globeMapChoice = t.id;
        btn.innerHTML = `
                <span class="story-archive-category-hub__figure" aria-hidden="true">
                    <img class="story-archive-category-hub__img" src="${t.src}" alt="" width="160" height="160" decoding="async" draggable="false" />
                </span>
                <span class="story-archive-category-hub__label">${t.label}</span>
            `;
        btn.title = `Open timeline as ${t.label}`;
        btn.addEventListener('click', () => {
            playStoryArchiveStyleChoiceSfx();
            onPick(t.startOnMap);
        });
        gridSlot.appendChild(btn);
    });

    root.appendChild(gridSlot);
    return root;
}

const GLOBE_MAP_CHOICE_LOAD_MS = 800;

/**
 * @param {{ launchGlobe: () => void | Promise<void>, isAutoLoad?: boolean }} options
 */
export async function openGlobeMapLaunchChoice(options) {
    const { launchGlobe, isAutoLoad = false } = options || {};
    if (typeof launchGlobe !== 'function') {
        console.warn('[GlobeMapLaunchChoice] launchGlobe missing');
        return;
    }

    teardownGlobeMapLaunchHost(true);

    const content = document.getElementById('content');
    if (!content) {
        console.warn('[GlobeMapLaunchChoice] #content missing');
        return;
    }

    hideTestContainerForGlobeChoice();

    const startedOwnOverlay = !getRunOperation();
    if (startedOwnOverlay) {
        setRunOperation(true);
        showLoadingOverlay();
    }
    playModeSwitchSound(isAutoLoad);
    await new Promise((r) => setTimeout(r, GLOBE_MAP_CHOICE_LOAD_MS));
    if (startedOwnOverlay) {
        setRunOperation(false);
        hideLoadingOverlay();
    }

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'story-viewer-container story-viewer-container--hub globe-map-launch-host';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-labelledby', 'globeMapLaunchHubHeading');

    const inner = document.createElement('div');
    inner.className = 'globe-map-launch-in-content__inner';

    const heading = document.createElement('h2');
    heading.id = 'globeMapLaunchHubHeading';
    heading.className = 'globe-map-launch-hub-heading';
    heading.textContent = 'Choose view';

    const sub = document.createElement('p');
    sub.className = 'globe-map-launch-hub-lead';
    sub.textContent = 'Pick how the timeline opens.';

    const finishCancel = () => {
        teardownGlobeMapLaunchHost(true);
    };

    _activeKeyHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            finishCancel();
        }
    };
    document.addEventListener('keydown', _activeKeyHandler);

    const runChoice = (startOnMap) => {
        teardownGlobeMapLaunchHost(false);
        try {
            localStorage.setItem('mapGlobePreToggle', startOnMap ? 'true' : 'false');
            syncGlobeMapLaunchLabels(startOnMap);
        } catch (_) {}
        void Promise.resolve(launchGlobe()).catch((err) => {
            console.error('[GlobeMapLaunchChoice] launch failed', err);
            restoreTestContainerAfterGlobeChoice();
        });
    };

    const hub = buildGlobeMapCategoryHub(runChoice);

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'story-viewer-action-btn story-archive-category-hub-dismiss';
    btnCancel.setAttribute('title', 'Return to main menu');
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', () => finishCancel());

    inner.appendChild(heading);
    inner.appendChild(sub);
    inner.appendChild(hub);
    inner.appendChild(btnCancel);
    host.appendChild(inner);
    content.appendChild(host);

    requestAnimationFrame(() => {
        host.classList.add('active');
    });

    hub.querySelector('button')?.focus();
}

if (typeof window !== 'undefined') {
    window.openGlobeMapLaunchChoice = openGlobeMapLaunchChoice;
    window.syncGlobeMapLaunchLabels = syncGlobeMapLaunchLabels;
}
