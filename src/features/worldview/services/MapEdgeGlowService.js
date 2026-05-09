/**
 * MapEdgeGlowService
 * Shows a rising white glow on the edge of the unwrapped map when the user
 * tries to drag past the clamped borders (similar to the main menu hover glow).
 *
 * Loaded via <script> tag; attaches to window.MapEdgeGlowService.
 */
class MapEdgeGlowService {
    static _instance = null;

    static getInstance() {
        if (!MapEdgeGlowService._instance) {
            MapEdgeGlowService._instance = new MapEdgeGlowService();
        }
        return MapEdgeGlowService._instance;
    }

    constructor() {
        this.container = null;
        this.root = null;
        this.edges = {};
        this.intensity = { left: 0, right: 0, top: 0, bottom: 0 };
        this.lastHitTs = 0;
        this.activeUntil = 0;
        this.active = { left: false, right: false, top: false, bottom: false };
        this.raf = null;
    }

    ensure(container) {
        if (!container) return;
        if (this.container === container && this.root && this.root.parentElement) return;

        this.container = container;

        // Remove old root if it exists (in case of DOM rebuilds)
        if (this.root && this.root.parentElement) {
            this.root.parentElement.removeChild(this.root);
        }

        const root = document.createElement('div');
        root.className = 'map-edge-glow';
        root.setAttribute('aria-hidden', 'true');

        const makeEdge = (side) => {
            const el = document.createElement('div');
            el.className = `map-edge-glow__edge map-edge-glow__edge--${side}`;
            el.style.opacity = '0';
            root.appendChild(el);
            return el;
        };

        this.edges = {
            left: makeEdge('left'),
            right: makeEdge('right'),
            top: makeEdge('top'),
            bottom: makeEdge('bottom')
        };

        // Ensure container can host absolutely positioned overlay
        const computed = window.getComputedStyle(container);
        if (computed.position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(root);
        this.root = root;
    }

    /**
     * Register a border hit. `overshoot` should be roughly 0..1 (how hard we pushed).
     */
    hit({ left = false, right = false, top = false, bottom = false, overshoot = 1 } = {}) {
        if (!this.container) {
            const c = document.getElementById('globe-container');
            if (c) this.ensure(c);
        }
        if (!this.root) return;

        const now = performance.now();
        this.lastHitTs = now;
        // Keep the glow "latched" for a short window even if pointermove events are sparse.
        // This makes it stay visibly glowing as long as the user keeps dragging into the border.
        this.activeUntil = now + 220;
        this.active = { left: !!left, right: !!right, top: !!top, bottom: !!bottom };

        const boost = Math.max(0.05, Math.min(1, overshoot));
        // Approach a target intensity rather than "one-shot" pulses.
        const target = 0.35 + 0.65 * boost; // 0.35..1.0
        const rise = 0.28 * boost;
        const decayOnHit = 0.06; // slight decay for non-hit edges even while dragging

        const apply = (side, isHit) => {
            if (isHit) {
                this.intensity[side] = Math.min(1, Math.max(this.intensity[side], target) + rise * 0.35);
            } else {
                this.intensity[side] = Math.max(0, this.intensity[side] - decayOnHit);
            }
        };

        apply('left', left);
        apply('right', right);
        apply('top', top);
        apply('bottom', bottom);

        this._render();
        this._startDecayLoop();
    }

    _startDecayLoop() {
        if (this.raf) return;
        const tick = () => {
            const now = performance.now();
            const idleMs = now - this.lastHitTs;

            const isActive = now < this.activeUntil && (this.active.left || this.active.right || this.active.top || this.active.bottom);

            // After a brief idle, fade out smoothly.
            if (!isActive && idleMs > 80) {
                const k = Math.min(1, (idleMs - 80) / 320); // fade window
                const decay = 0.06 + 0.26 * k;
                this.intensity.left = Math.max(0, this.intensity.left - decay);
                this.intensity.right = Math.max(0, this.intensity.right - decay);
                this.intensity.top = Math.max(0, this.intensity.top - decay);
                this.intensity.bottom = Math.max(0, this.intensity.bottom - decay);
                this._render();
            } else if (isActive) {
                // While actively pushing into an edge, keep it visibly present.
                // (No decay between sparse move events.)
                this._render();
            }

            const any =
                this.intensity.left > 0.001 ||
                this.intensity.right > 0.001 ||
                this.intensity.top > 0.001 ||
                this.intensity.bottom > 0.001;

            if (any) {
                this.raf = requestAnimationFrame(tick);
            } else {
                this.raf = null;
            }
        };
        this.raf = requestAnimationFrame(tick);
    }

    _render() {
        if (!this.edges.left) return;
        const set = (side) => {
            const v = Math.max(0, Math.min(1, this.intensity[side]));
            const el = this.edges[side];
            if (!el) return;
            el.style.opacity = String(v);
        };
        set('left');
        set('right');
        set('top');
        set('bottom');
    }
}

// Export for CommonJS (optional) + global attach for script-tag usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapEdgeGlowService;
}
if (typeof window !== 'undefined') {
    window.MapEdgeGlowService = MapEdgeGlowService;
}

