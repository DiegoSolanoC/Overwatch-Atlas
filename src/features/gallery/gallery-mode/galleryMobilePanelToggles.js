/**
 * Mobile Intel mode panel toggles — Show Intel / Connections / Visuals.
 * Exclusive switch (default Visuals). Chrome matches World / Codex dock chips.
 */

import { createHeaderHubButton } from '../../universal-features/atlas-header/HeaderHubButton.js';
import { loadSoundEffect } from '../../universal-features/atlas-sound-effects/loadSoundEffects.js';

const HOST_ID = 'atlasGalleryHost';
const DOCK_PARENT_ID = 'dockGlobeRailLeft';

/** @typedef {'intel' | 'connections' | 'visuals'} GalleryMobilePanel */

const PANEL_HOST_CLASSES = {
    intel: 'gallery-mode--mobile-panel-intel',
    connections: 'gallery-mode--mobile-panel-connections',
    visuals: 'gallery-mode--mobile-panel-visuals',
};

const TOGGLES = [
    {
        id: 'galleryShowIntelToggle',
        iconId: 'galleryShowIntelIcon',
        panel: /** @type {GalleryMobilePanel} */ ('intel'),
        label: 'Show Intel',
        title: 'Show Intel — biography and category info',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Intel.png',
        headerOrder: 20,
    },
    {
        id: 'galleryShowConnectionsToggle',
        iconId: 'galleryShowConnectionsIcon',
        panel: /** @type {GalleryMobilePanel} */ ('connections'),
        label: 'Show Connections',
        title: 'Show Connections — relationship graph',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Codex.png',
        headerOrder: 21,
    },
    {
        id: 'galleryShowVisualsToggle',
        iconId: 'galleryShowVisualsIcon',
        panel: /** @type {GalleryMobilePanel} */ ('visuals'),
        label: 'Show Visuals',
        title: 'Show Visuals — look, phrase, and character art',
        iconPath: 'src/assets/images/Icons/Mode%20Icons/Gallery.png',
        headerOrder: 22,
    },
];

/** @type {GalleryMobilePanel} */
let activePanel = 'visuals';

/** @type {Map<string, HTMLButtonElement>} */
const buttonsById = new Map();

/**
 * @returns {GalleryMobilePanel}
 */
export function getGalleryMobilePanel() {
    return activePanel;
}

/**
 * @param {HTMLElement | null} host
 * @param {GalleryMobilePanel} panel
 */
function applyHostPanelClass(host, panel) {
    if (!host) return;
    for (const cls of Object.values(PANEL_HOST_CLASSES)) {
        host.classList.remove(cls);
    }
    host.classList.add(PANEL_HOST_CLASSES[panel]);
    host.dataset.galleryMobilePanel = panel;
}

function syncToggleUi() {
    for (const def of TOGGLES) {
        const btn = buttonsById.get(def.id) || document.getElementById(def.id);
        if (!(btn instanceof HTMLButtonElement)) continue;
        const on = def.panel === activePanel;
        btn.classList.toggle('toggle-off', !on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
}

/**
 * @param {GalleryMobilePanel} panel
 * @param {{ flash?: boolean, sound?: boolean }} [opts]
 */
export function setGalleryMobilePanel(panel, opts = {}) {
    const next = panel === 'intel' || panel === 'connections' || panel === 'visuals'
        ? panel
        : 'visuals';
    const changed = next !== activePanel;
    activePanel = next;

    const host = document.getElementById(HOST_ID);
    applyHostPanelClass(host, activePanel);
    syncToggleUi();

    if (!changed) return;

    if (opts.sound !== false && window.SoundEffectsManager) {
        window.SoundEffectsManager.play('rotationToggle');
    }
    if (opts.flash !== false) {
        const def = TOGGLES.find((entry) => entry.panel === activePanel);
        const btn = def ? buttonsById.get(def.id) || document.getElementById(def.id) : null;
        if (btn && window.flashButton) {
            window.flashButton(btn, 'flash-orange');
        }
    }
}

/**
 * @param {HTMLButtonElement} btn
 * @param {GalleryMobilePanel} panel
 * @param {string} teardownKey
 */
function wirePanelToggle(btn, panel, teardownKey) {
    if (typeof btn[teardownKey] === 'function') {
        try {
            btn[teardownKey]();
        } catch (_) { /* ignore */ }
    }

    const ac = new AbortController();
    const signal = ac.signal;
    btn[teardownKey] = () => {
        ac.abort();
        btn[teardownKey] = null;
    };

    const activate = (event) => {
        event?.stopPropagation?.();
        event?.preventDefault?.();
        setGalleryMobilePanel(panel);
    };

    btn.addEventListener('mousedown', (event) => event.stopPropagation(), { signal });
    btn.addEventListener('mouseup', (event) => event.stopPropagation(), { signal });

    let touchStartTime = 0;
    btn.addEventListener('touchstart', (event) => {
        event.stopPropagation();
        touchStartTime = Date.now();
    }, { signal });

    btn.addEventListener('touchend', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (Date.now() - touchStartTime < 300) activate(event);
    }, { signal });

    btn.addEventListener('click', activate, { signal });
}

/**
 * @param {(typeof TOGGLES)[number]} def
 * @returns {HTMLButtonElement | null}
 */
function mountOneToggle(def) {
    const dockParent = document.getElementById(DOCK_PARENT_ID);
    if (!dockParent) return null;

    document.getElementById(def.id)?.remove();

    const btn = createHeaderHubButton({
        id: def.id,
        className: `dock-globe-rail__btn gallery-mobile-panel-toggle gallery-mobile-panel-toggle--${def.panel}`,
        title: def.title,
        label: def.label,
        iconPath: def.iconPath,
        iconAlt: def.label,
        parentId: DOCK_PARENT_ID,
        baseClass: 'globe-control-btn',
        iconSpanId: def.iconId,
        headerOrder: def.headerOrder,
        mobileParentId: DOCK_PARENT_ID,
        mobileClassName: `dock-globe-rail__btn gallery-mobile-panel-toggle gallery-mobile-panel-toggle--${def.panel}`,
    });

    if (!(btn instanceof HTMLButtonElement) || !btn.isConnected) return null;

    /* Visibility is CSS-owned so #eventSlide.open can hide these chips. */
    btn.style.removeProperty('display');
    btn.setAttribute('aria-pressed', def.panel === activePanel ? 'true' : 'false');
    wirePanelToggle(btn, def.panel, '_galleryMobilePanelTeardown');
    buttonsById.set(def.id, btn);
    return btn;
}

export function mountGalleryMobilePanelToggles() {
    unmountGalleryMobilePanelToggles();

    loadSoundEffect(
        'rotationToggle',
        'src/assets/audio/sfx/Rotation Toggle.mp3',
    );

    activePanel = 'visuals';
    const host = document.getElementById(HOST_ID);
    // Select File strip is gone — keep collapsed so portrait/connections stay interactive.
    host?.classList.add('gallery-mode--hero-filters-collapsed');
    applyHostPanelClass(host, activePanel);

    for (const def of TOGGLES) {
        mountOneToggle(def);
    }
    syncToggleUi();
}

export function unmountGalleryMobilePanelToggles() {
    for (const def of TOGGLES) {
        const btn = document.getElementById(def.id);
        if (btn && typeof btn._galleryMobilePanelTeardown === 'function') {
            try {
                btn._galleryMobilePanelTeardown();
            } catch (_) { /* ignore */ }
        }
        btn?.remove();
    }
    buttonsById.clear();

    const host = document.getElementById(HOST_ID);
    if (host) {
        for (const cls of Object.values(PANEL_HOST_CLASSES)) {
            host.classList.remove(cls);
        }
        delete host.dataset.galleryMobilePanel;
    }
    activePanel = 'visuals';
}
