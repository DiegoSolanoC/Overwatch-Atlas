/**
 * Worldview entry chooser — 3D Globe vs 2D Map.
 *
 * Mirrors Data Archive's category hub pattern:
 * `mountGlobeMapChooserHub({ onPick, onCancel })` synchronously appends a hub
 * inside `main#content` (using the same `story-viewer-container--hub` shell),
 * wires per-tile click handlers, and returns immediately. It does NOT manage
 * mode state, loading overlays, or wait for user input. The caller (the
 * orchestrator's `runGlobeComponents`) handles mode entry beforehand and the
 * actual globe-asset loading is kicked off from `onPick`.
 *
 * `syncGlobeMapLaunchLabels(startOnMap)` keeps the header + main menu copy in
 * sync after the user picks a view.
 */

const HOST_ID = 'globeMapLaunchHost';
/** @deprecated removed from body; teardown still clears if present */
const LEGACY_OVERLAY_ID = 'globeMapLaunchHubOverlay';
const HUB_ID = 'globeMapCategoryHub';

import { wireLoadingAssetImage } from '../../../universal-features/atlas-ui/loadingAssetSlot.js';

const IMG_GLOBE = 'src/assets/images/World%20View/Globe.png';
const IMG_MAP = 'src/assets/images/World%20View/Map.png';

/** @type {((e: KeyboardEvent) => void) | null} */
let _activeKeyHandler = null;

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
/** @deprecated Use {@link WORLD_MODE_LABEL} */
export const INTERACTIVE_WORLDVIEW_LABEL = 'World';
export const WORLD_MODE_LABEL = 'World';

/** Main menu description; view mode no longer swaps this copy. */
export const INTERACTIVE_WORLDVIEW_DESC =
    'Visualize the Story through a 3D Globe or 2D Map';

/**
 * Refresh header + main menu copy for the timeline entry (fixed strings).
 * @param {boolean} [_startOnMap] Ignored — kept for call-site compatibility.
 */
export function syncGlobeMapLaunchLabels(_startOnMap) {
    const labelText = WORLD_MODE_LABEL;
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

function detachKeyHandler() {
    if (_activeKeyHandler) {
        document.removeEventListener('keydown', _activeKeyHandler);
        _activeKeyHandler = null;
    }
}

/**
 * Tear down any in-flight chooser host. Idempotent.
 */
export function teardownGlobeMapChooserHub() {
    detachKeyHandler();
    document.getElementById(HOST_ID)?.remove();
    document.getElementById(LEGACY_OVERLAY_ID)?.remove();
}

/**
 * Build the two hub tiles (markup matches the Data Archive grid tiles).
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
        const hubImg = btn.querySelector('.story-archive-category-hub__img');
        const hubFigure = btn.querySelector('.story-archive-category-hub__figure');
        wireLoadingAssetImage(hubImg, { wrap: hubFigure });
        gridSlot.appendChild(btn);
    });

    root.appendChild(gridSlot);
    return root;
}

/**
 * Mount the 3D Globe / 2D Map chooser hub inside `main#content`, using the
 * same shell that Data Archive's category hub uses. Synchronous: appends the
 * host and returns. The caller drives the rest of the flow via callbacks:
 *
 *   - `onPick(startOnMap)` fires when the user picks a tile (`true` = 2D Map,
 *     `false` = 3D Globe). The host is removed before the callback runs.
 *   - `onCancel()` fires when the user presses Escape or the Cancel button.
 *
 * Pure UI helper: it does NOT touch mode state, the loading overlay, the
 * test container, or any sound effects (other than the per-tile click cue).
 *
 * @param {{ onPick: (startOnMap: boolean) => void, onCancel: () => void }} cb
 * @returns {HTMLElement | null} The host element, or `null` if `#content` is missing.
 */
export function mountGlobeMapChooserHub(cb) {
    const onPick = typeof cb?.onPick === 'function' ? cb.onPick : () => {};
    const onCancel = typeof cb?.onCancel === 'function' ? cb.onCancel : () => {};

    teardownGlobeMapChooserHub();

    const content = document.getElementById('content');
    if (!content) {
        console.warn('[GlobeMapLaunchChoice] #content missing');
        return null;
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

    let settled = false;
    const settle = (fn) => {
        if (settled) return;
        settled = true;
        teardownGlobeMapChooserHub();
        fn();
    };

    _activeKeyHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            settle(onCancel);
        }
    };
    document.addEventListener('keydown', _activeKeyHandler);

    const hub = buildGlobeMapCategoryHub((startOnMap) => {
        settle(() => onPick(startOnMap));
    });

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'story-viewer-action-btn story-archive-category-hub-dismiss';
    btnCancel.setAttribute('title', 'Return to main menu');
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', () => settle(onCancel));

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
    return host;
}

if (typeof window !== 'undefined') {
    window.mountGlobeMapChooserHub = mountGlobeMapChooserHub;
    window.teardownGlobeMapChooserHub = teardownGlobeMapChooserHub;
    window.syncGlobeMapLaunchLabels = syncGlobeMapLaunchLabels;
}
