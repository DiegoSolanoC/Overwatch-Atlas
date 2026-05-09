/**
 * Dev-only: bare range input to spin the sun around world Y (no chrome).
 *
 * Shown when: ?devSun=1, localStorage.devSunSlider=1, localhost, or github.io (Pages).
 * Yaw: sessionStorage `devSunYawDeg`.
 */

import { applySunBackgroundForViewport } from '../presentation/views/helpers/GlobeInitHelpers.js';

const STORAGE_KEY = 'devSunYawDeg';

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

function readStoredYaw() {
    try {
        const s = window.sessionStorage.getItem(STORAGE_KEY);
        if (s == null) return 0;
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
    } catch (_) {
        return 0;
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

/**
 * Update sun slider visibility based on lighting state and map mode
 * @param {object} controller - Globe controller
 */
export function updateSunSliderVisibility(controller) {
    const slider = document.querySelector('.dev-sun-yaw-panel');
    if (!slider) return;

    const lightingVisible = controller.sceneModel.getGlobeLightingVisible ? controller.sceneModel.getGlobeLightingVisible() : true;
    const isMap = controller.sceneModel.getMapViewEnabled ? controller.sceneModel.getMapViewEnabled() : !!controller.sceneModel.isMapView;

    // Hide slider if lighting is off OR in map mode
    const shouldShow = lightingVisible && !isMap;
    slider.style.opacity = shouldShow ? '1' : '0';
    slider.style.pointerEvents = shouldShow ? 'auto' : 'none';
    console.log('[DevSunYawControl] Slider visibility updated:', shouldShow, 'lightingVisible:', lightingVisible, 'isMap:', isMap);
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

    // Check if slider element already exists in DOM
    const sliderExists = document.querySelector('.dev-sun-yaw-panel__range') !== null;
    console.log('[DevSunYawControl] Slider exists in DOM:', sliderExists);
    
    if (_installed && sliderExists) {
        console.log('[DevSunYawControl] Already installed and slider exists, skipping');
        return;
    }

    // Reset installed flag if slider doesn't exist (it was removed)
    if (_installed && !sliderExists) {
        console.log('[DevSunYawControl] Slider was removed, resetting installed flag');
        _installed = false;
    }

    _installed = true;
    console.log('[DevSunYawControl] Installing dev sun yaw control');

    const wrap = document.createElement('div');
    wrap.setAttribute('data-dev-sun-yaw', '');
    wrap.className = 'dev-sun-yaw-panel';

    const range = document.createElement('input');
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
        console.log('[DevSunYawControl] Sun slider input event, value:', value);
        writeStoredYaw(value);
        applyYawToScene(controller, value);
        const sunBg = controller.sceneModel.getSunBackground?.() ?? controller.sceneModel.sunBackground;
        if (sunBg && sunBg.sprite) {
            console.log('[DevSunYawControl] Sun sprite position:', sunBg.sprite.position);
        }
        if (sunBg && sunBg.light) {
            console.log('[DevSunYawControl] Sun light position:', sunBg.light.position);
        }
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

    wrap.appendChild(range);

    const host = document.getElementById('globe-container') || document.body;
    host.appendChild(wrap);
    console.log('[DevSunYawControl] Slider appended to host, host id:', host.id);
    console.log('[DevSunYawControl] Slider element exists in DOM:', document.querySelector('.dev-sun-yaw-panel__range') !== null);

    applyYawToScene(controller, Number(range.value));
}
