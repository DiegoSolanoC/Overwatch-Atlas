/**
 * Pan/zoom, pointer input, and marker lock animations for {@link WorldviewMapLiteLayer}.
 */
import { EVENT_MARKER_LOCKED_HEX, getMarkerColor } from '../../../system-interface/interface-globe-markers/styling/markerColors.js';
import { getMap2dLiteMarkerDiameterPx } from '../../../system-interface/interface-globe-markers/styling/markerSizes.js';
import {
    DOM_LITE_MARKER_TRANSITION_MS,
    MAP2D_LOCK_TRANSITION_MS,
    awakeningWaveMaxScale,
    hexToCss,
    hexToRgb,
    isMap2dLiteAwakeningEvent
} from '../WorldviewMapLitePrimitives.js';

export const mixin = {
    zoomIn() {
        this._zoomAtViewportCenter(1.12);
    },

    zoomOut() {
        this._zoomAtViewportCenter(1 / 1.12);
    },

    _zoomAtViewportCenter(factor) {
        if (!this.viewport) return;
        const w = this.viewport.clientWidth;
        const h = this.viewport.clientHeight;
        const mx = w / 2;
        const my = h / 2;
        this._zoomAt(mx, my, factor);
    },

    _zoomAt(mx, my, factor) {
        const next = Math.max(this._minScale, Math.min(this._maxScale, this._scale * factor));
        if (Math.abs(next - this._scale) < 1e-6) return;
        const wx = (mx - this._tx) / this._scale;
        const wy = (my - this._ty) / this._scale;
        this._scale = next;
        this._tx = mx - wx * this._scale;
        this._ty = my - wy * this._scale;
        this._clampPan();
        this._applyTransform();
    },

    _applyTransform() {
        if (!this.world) return;
        this.world.style.transform = `translate(${this._tx}px, ${this._ty}px) scale(${this._scale})`;
        if (typeof window !== 'undefined' && window.globeController?.requestMapLiteSync) {
            window.globeController.requestMapLiteSync();
        }
    },

    _clampPan() {
        if (!this.viewport) return;
        const vw = this.viewport.clientWidth;
        const vh = this.viewport.clientHeight;
        const sw = this._baseW * this._scale;
        const sh = this._baseH * this._scale;
        const minX = Math.min(0, vw - sw);
        const maxX = Math.max(0, vw - sw);
        const minY = Math.min(0, vh - sh);
        const maxY = Math.max(0, vh - sh);
        this._tx = Math.max(minX, Math.min(maxX, this._tx));
        this._ty = Math.max(minY, Math.min(maxY, this._ty));
    },

    _onWheel(e) {
        if (!this.isVisible()) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = this.viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY * 0.001;
        const factor = Math.exp(-delta * 0.15);
        this._zoomAt(mx, my, factor);
    },

    _onPointerDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.map-2d-lite__marker')) return;
        this._dragging = true;
        this._moved = false;
        this._lastClientX = e.clientX;
        this._lastClientY = e.clientY;
        this._dragPid = e.pointerId;
        this.viewport.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', this._boundMove);
        window.addEventListener('pointerup', this._boundUp);
        window.addEventListener('pointercancel', this._boundUp);
    },

    _onPointerMove(e) {
        if (!this._dragging) return;
        const dx = e.clientX - this._lastClientX;
        const dy = e.clientY - this._lastClientY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
        this._lastClientX = e.clientX;
        this._lastClientY = e.clientY;
        this._tx += dx;
        this._ty += dy;
        this._clampPan();
        this._applyTransform();
    },

    _onPointerUp(e) {
        if (!this._dragging) return;
        this._dragging = false;
        window.removeEventListener('pointermove', this._boundMove);
        window.removeEventListener('pointerup', this._boundUp);
        window.removeEventListener('pointercancel', this._boundUp);
        if (this._dragPid != null) {
            try {
                this.viewport.releasePointerCapture(this._dragPid);
            } catch (_) { /* ignore */ }
            this._dragPid = null;
        }
    },

    _animateCelestialHostsExitIfVisible() {
        const hosts = [this._moonHost, this._marsHost, this._orbitHost].filter(Boolean);
        const visible = hosts.filter((h) => {
            try {
                return window.getComputedStyle(h).display !== 'none';
            } catch (_) {
                return false;
            }
        });
        if (visible.length === 0) return Promise.resolve();
        return Promise.all(
            visible.map(
                (host) =>
                    new Promise((resolve) => {
                        host.classList.remove('map-2d-lite__celestial-host--enter');
                        host.style.transition = `transform ${DOM_LITE_MARKER_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
                        host.style.transformOrigin = '50% 50%';
                        host.style.transform = 'scaleY(0)';
                        window.setTimeout(() => {
                            host.style.transition = '';
                            host.style.transform = '';
                            resolve();
                        }, DOM_LITE_MARKER_TRANSITION_MS + 50);
                    })
            )
        ).then(() => {});
    },

    _animateDomMarkersExit() {
        const earth = [...this.markersEl.querySelectorAll('.map-2d-lite__marker-body')];
        const moon = this._moonMarkersEl
            ? [...this._moonMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const mars = this._marsMarkersEl
            ? [...this._marsMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const orbit = this._orbitMarkersEl
            ? [...this._orbitMarkersEl.querySelectorAll('.map-2d-lite__marker-body')]
            : [];
        const bodies = [...earth, ...moon, ...mars, ...orbit];
        if (bodies.length === 0) return Promise.resolve();
        bodies.forEach((body) => {
            body.querySelector('.map-2d-lite__marker-disk')?.classList.remove('map-2d-lite__marker-disk--pulse');
        });
        return Promise.all(
            bodies.map(
                (body) =>
                    new Promise((resolve) => {
                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            body.removeEventListener('animationend', onEnd);
                            resolve();
                        };
                        const onEnd = (e) => {
                            const n = e.animationName || '';
                            if (n.includes('map2d-lite-marker-exit')) finish();
                        };
                        body.addEventListener('animationend', onEnd);
                        body.classList.add('map-2d-lite__marker-body--exit');
                        window.setTimeout(finish, DOM_LITE_MARKER_TRANSITION_MS + 80);
                    })
            )
        ).then(() => {});
    },

    _onClick(e) {
        if (this._moved) return;
        if (e.target.closest('.map-2d-lite__marker')) return;
        const ui = window.globeController?.uiView;
        if (ui?.currentEventMarker) {
            ui.hideEventSlide();
        }
        if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
            window.closeTimelineMusicFiltersPanelsIfOpen();
        }
    },

    _animateDomMarkerToLocked(btn, stub) {
        return new Promise((resolve) => {
            if (!btn || !stub?.userData) {
                resolve();
                return;
            }
            stub.userData.isLocked = true;
            const disk = btn.querySelector('.map-2d-lite__marker-disk');
            const wave = btn.querySelector('.map-2d-lite__marker-wave');
            disk?.classList.remove('map-2d-lite__marker-disk--pulse');
            btn.classList.remove('map-2d-lite__marker--awakening');
            btn.style.removeProperty('--map2d-wave-max-scale');

            btn.style.transition = `transform ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
            if (disk) {
                disk.style.transition = `background-color ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.67, 1)`;
                disk.style.backgroundColor = hexToCss(EVENT_MARKER_LOCKED_HEX);
            }
            if (wave) {
                wave.style.transition = `opacity ${Math.min(200, MAP2D_LOCK_TRANSITION_MS)}ms ease-out`;
                wave.style.opacity = '0';
            }
            btn.classList.add('map-2d-lite__marker--locked');
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            const fr = hexToRgb(EVENT_MARKER_LOCKED_HEX);
            btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);

            window.setTimeout(() => {
                btn.style.transition = '';
                if (disk) disk.style.transition = '';
                if (wave?.parentNode) wave.remove();
                resolve();
            }, MAP2D_LOCK_TRANSITION_MS + 40);
        });
    },

    _animateDomMarkerToUnlocked(btn, stub) {
        return new Promise((resolve) => {
            if (!btn || !stub?.userData) {
                resolve();
                return;
            }
            stub.userData.isLocked = false;
            const id = btn.__map2dLiteIdentity;
            const fullEvent = id?.event;
            if (!fullEvent) {
                resolve();
                return;
            }

            const body = btn.querySelector('.map-2d-lite__marker-body');
            const disk = btn.querySelector('.map-2d-lite__marker-disk');
            const isMain = true;
            const fillHex = getMarkerColor(isMain);

            btn.style.transition = `transform ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
            if (disk) {
                disk.style.transition = `background-color ${MAP2D_LOCK_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
                disk.style.backgroundColor = hexToCss(fillHex);
            }
            btn.classList.remove('map-2d-lite__marker--locked');
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');

            if (body && disk && !body.querySelector('.map-2d-lite__marker-wave')) {
                const wv = document.createElement('span');
                wv.className = 'map-2d-lite__marker-wave';
                wv.setAttribute('aria-hidden', 'true');
                body.insertBefore(wv, disk);
            }

            const waveHex = Number.isFinite(stub.userData.originalColor)
                ? stub.userData.originalColor
                : 0xffaa00;
            const wr = hexToRgb(waveHex);
            btn.style.setProperty('--map2d-pulse-rgb', `${wr.r},${wr.g},${wr.b}`);
            const fr = hexToRgb(fillHex);
            btn.style.setProperty('--map2d-fill-rgb', `${fr.r},${fr.g},${fr.b}`);

            const awakening = isMap2dLiteAwakeningEvent(fullEvent);
            if (awakening) {
                btn.classList.add('map-2d-lite__marker--awakening');
                const u = parseFloat(btn.style.left) / 100;
                const v = parseFloat(btn.style.top) / 100;
                const d = parseFloat(btn.style.width) || getMap2dLiteMarkerDiameterPx(this._baseW, isMain);
                btn.style.setProperty(
                    '--map2d-wave-max-scale',
                    String(awakeningWaveMaxScale(u, v, this._baseW, this._baseH, d))
                );
            } else {
                btn.classList.remove('map-2d-lite__marker--awakening');
                btn.style.removeProperty('--map2d-wave-max-scale');
            }

            window.setTimeout(() => {
                btn.style.transition = '';
                if (disk) disk.style.transition = '';
                disk?.classList.add('map-2d-lite__marker-disk--pulse');
                resolve();
            }, MAP2D_LOCK_TRANSITION_MS + 40);
        });
    },

};
