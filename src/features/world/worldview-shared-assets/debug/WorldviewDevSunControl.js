/**
 * Dev-only: bare range input to spin the sun around world Y (no chrome).
 *
 * Shown when: ?devSun=1, localStorage.devSunSlider=1, localhost, or github.io (Pages).
 * Yaw: sessionStorage `devSunYawDeg`.
 */

import { applySunBackgroundForViewport } from '../../worldview-globe-3d/views/helpers/WorldviewSunBackground.js';
import { installStageSliderNub } from '../../worldview-controls-ui/runtime/stageSliderNub.js';

const SUN_NUB_ICON = 'src/assets/images/Icons/Worldview%20Icons/Lighting%20Icon.png';

const STORAGE_KEY = 'devSunYawDeg_v2';

function isDevSunUiEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        const v = new URLSearchParams(window.location.search).get('devSun');
        if (v === '1' || v === 'true') return true;
    } catch (_) { /* ignore */ }
    try {
        if (window.localStorage.getItem('devSunSlider') === '1') return true;
    } catch (_) { /* ignore */ }
    const h = window.location.hostname;
    return (
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h.includes('github.io') ||
        h === 'pages.github.com'
    );
}

/** Mid-track default (180°) so the sun nub starts centered. */
const DEFAULT_SUN_YAW_DEG = 180;

function readStoredYaw() {
    try {
        const s = window.sessionStorage.getItem(STORAGE_KEY);
        if (s == null) return DEFAULT_SUN_YAW_DEG;
        const n = Number(s);
        return Number.isFinite(n) ? n : DEFAULT_SUN_YAW_DEG;
    } catch (_) {
        return DEFAULT_SUN_YAW_DEG;
    }
}

function writeStoredYaw(deg) {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, String(deg));
    } catch (_) { /* ignore */ }
}

function applyYawToScene(controller, deg) {
    const sunBg = controller.sceneModel.getSunBackground?.() ?? controller.sceneModel.sunBackground;
    if (!sunBg) return;
    sunBg.sunDevYawDeg = deg;
    applySunBackgroundForViewport(sunBg);
    if (controller.globeView && typeof controller.globeView.syncSunDirectionToShaders === 'function') {
        controller.globeView.syncSunDirectionToShaders();
    }
}

function isCodexModeActive() {
    return typeof document !== 'undefined' && document.body.classList.contains('codex-mode-active');
}

/**
 * Update sun slider visibility based on lighting, map mode, and app mode.
 * Sun is World/globe-only — hide in Codex (and whenever globe lighting isn't relevant).
 * @param {object} [controller] - Globe controller (optional; falls back to window.globeController)
 */
export function updateSunSliderVisibility(controller) {
    const slider = document.querySelector('.dev-sun-yaw-panel');
    const slot = document.getElementById('zoomSunSlot');
    if (!slider) return;

    const ctrl = controller || (typeof window !== 'undefined' ? window.globeController : null);
    const sceneModel = ctrl?.sceneModel;
    const lightingVisible = sceneModel?.getGlobeLightingVisible
        ? sceneModel.getGlobeLightingVisible()
        : true;
    const isMap = sceneModel?.getMapViewEnabled
        ? sceneModel.getMapViewEnabled()
        : !!sceneModel?.isMapView;
    const inCodex = isCodexModeActive();
    const globeAlive = !!(sceneModel && typeof document !== 'undefined'
        && document.getElementById('globe-container')?.classList.contains('loaded')
        && !document.getElementById('globe-container')?.classList.contains('codex-mode'));

    // World globe only: lighting on, not map, not Codex, globe stage still live
    const shouldShow = !!(globeAlive && lightingVisible && !isMap && !inCodex);
    slider.classList.toggle('dev-sun-yaw-panel--hidden', !shouldShow);
    slider.style.opacity = shouldShow ? '1' : '0';
    slider.style.pointerEvents = shouldShow ? 'auto' : 'none';
    if (slot) {
        slot.classList.toggle('zoom-sun-slot--empty', !shouldShow);
        slot.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }
}

let _modeVisibilityWired = false;

function wireSunSliderModeVisibility(controller) {
    if (_modeVisibilityWired || typeof window === 'undefined') return;
    _modeVisibilityWired = true;
    const refresh = () => updateSunSliderVisibility(controller || window.globeController);
    window.addEventListener('appmodechange', refresh);
    if (typeof MutationObserver !== 'undefined' && document.body) {
        const obs = new MutationObserver(refresh);
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
}

let _installed = false;

/** @param {{ sceneModel: object, globeView: object }} controller */
export function maybeInstallDevSunYawControl(controller) {
    console.log('[DevSunYawControl] maybeInstallDevSunYawControl called, _installed:', _installed, 'controller exists:', !!controller?.sceneModel);
    if (!controller?.sceneModel) return;
    if (!isDevSunUiEnabled()) {
        console.log('[DevSunYawControl] Dev sun UI not enabled');
        return;
    }

    const slot = document.getElementById('zoomSunSlot');
    const host = slot || document.getElementById('zoomControls') || document.getElementById('globe-container') || document.body;
    let wrap = document.querySelector('.dev-sun-yaw-panel');
    let range = document.querySelector('.dev-sun-yaw-panel__range');

    const ensureStageShell = (panel, input) => {
        if (!panel || !input) return;
        let shell = input.closest('.stage-slider-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'stage-slider-shell stage-slider-shell--sun';
            input.parentElement?.insertBefore(shell, input);
            shell.appendChild(input);
        }
        installStageSliderNub(shell, input, SUN_NUB_ICON);
    };

    /* Migrate an older top-of-globe install into the zoom stack. */
    if (wrap && host && wrap.parentElement !== host) {
        host.appendChild(wrap);
        ensureStageShell(wrap, range);
        _installed = true;
        applyYawToScene(controller, Number(range?.value) || readStoredYaw());
        wireSunSliderModeVisibility(controller);
        updateSunSliderVisibility(controller);
        return;
    }

    if (_installed && range) {
        ensureStageShell(wrap, range);
        wireSunSliderModeVisibility(controller);
        updateSunSliderVisibility(controller);
        return;
    }

    if (_installed && !range) {
        _installed = false;
    }

    _installed = true;

    wrap = document.createElement('div');
    wrap.setAttribute('data-dev-sun-yaw', '');
    wrap.className = 'dev-sun-yaw-panel';

    range = document.createElement('input');
    range.type = 'range';
    range.className = 'dev-sun-yaw-panel__range';
    range.min = '0';
    range.max = '360';
    range.step = '1';
    range.title = 'Sun yaw (dev, 0–360°)';
    range.setAttribute('aria-label', 'Sun yaw degrees (dev)');

    const initial = readStoredYaw();
    range.value = String(Math.round(((initial % 360) + 360) % 360));

    range.addEventListener('input', () => {
        const value = Number(range.value);
        writeStoredYaw(value);
        applyYawToScene(controller, value);
    });

    if (typeof range.setPointerCapture === 'function') {
        range.addEventListener('pointerdown', (e) => {
            if (e.pointerId != null) {
                try {
                    range.setPointerCapture(e.pointerId);
                } catch (_) { /* ignore */ }
            }
        });
        range.addEventListener('pointerup', (e) => {
            if (e.pointerId != null && typeof range.releasePointerCapture === 'function') {
                try {
                    if (range.hasPointerCapture(e.pointerId)) range.releasePointerCapture(e.pointerId);
                } catch (_) { /* ignore */ }
            }
        });
    }

    const stopGlobeSteal = (e) => {
        e.stopPropagation();
    };
    const dragEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel'];
    for (const ev of dragEvents) {
        wrap.addEventListener(ev, stopGlobeSteal, false);
    }

    const shell = document.createElement('div');
    shell.className = 'stage-slider-shell stage-slider-shell--sun';
    shell.appendChild(range);
    wrap.appendChild(shell);
    host.appendChild(wrap);
    installStageSliderNub(shell, range, SUN_NUB_ICON);

    applyYawToScene(controller, Number(range.value));
    wireSunSliderModeVisibility(controller);
    updateSunSliderVisibility(controller);
}
