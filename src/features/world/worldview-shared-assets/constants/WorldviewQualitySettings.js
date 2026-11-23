/**
 * Globe/world render quality tiers — VRAM, fill-rate, transport density, and motion.
 * Persist: localStorage `globe-quality-tier` = low | medium | high
 * Runtime: window.globeQuality / setGlobeQuality / cycleGlobeQuality
 */

export const GLOBE_QUALITY_STORAGE_KEY = 'globe-quality-tier';
export const GLOBE_QUALITY_TIERS = Object.freeze(['low', 'medium', 'high']);

const TIER_PRESETS = Object.freeze({
    low: Object.freeze({
        textureMaxEdge: 2048,
        anisotropy: 2,
        dprCapDesktop: 1.5,
        dprCapMobile: 1.25,
        antialias: false,
        earthSegments: 32,
        shellSegments: 32,
        auroraSegments: 40,
        maxTrains: 6,
        maxPlanes: 4,
        maxBoats: 6,
        decorSatellites: 8,
        planeTrailInterval: 5,
        boatTrailInterval: 4,
        trailsEnabled: true,
        auroraEnabled: false,
        cloudsEnabled: true,
        patternWaveEnabled: false,
        shootingStarsEnabled: false,
        earthUseStandardMaterial: false
    }),
    medium: Object.freeze({
        textureMaxEdge: 4096,
        anisotropy: 4,
        dprCapDesktop: 1.75,
        dprCapMobile: 1.5,
        antialias: true,
        earthSegments: 48,
        shellSegments: 48,
        auroraSegments: 56,
        maxTrains: 10,
        maxPlanes: 7,
        maxBoats: 10,
        decorSatellites: 12,
        planeTrailInterval: 3,
        boatTrailInterval: 3,
        trailsEnabled: true,
        auroraEnabled: true,
        cloudsEnabled: true,
        patternWaveEnabled: true,
        shootingStarsEnabled: true,
        earthUseStandardMaterial: true
    }),
    high: Object.freeze({
        textureMaxEdge: 4096,
        anisotropy: 8,
        dprCapDesktop: 2.0,
        dprCapMobile: 1.75,
        antialias: true,
        earthSegments: 64,
        shellSegments: 64,
        auroraSegments: 72,
        maxTrains: 15,
        maxPlanes: 10,
        maxBoats: 15,
        decorSatellites: 18,
        planeTrailInterval: 2,
        boatTrailInterval: 2,
        trailsEnabled: true,
        auroraEnabled: true,
        cloudsEnabled: true,
        patternWaveEnabled: true,
        shootingStarsEnabled: true,
        earthUseStandardMaterial: true
    })
});

let _tier = null;
let _reducedMotion = null;
let _snapshotCache = null;

function _isNarrowViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
}

function _detectPreferredTier() {
    if (typeof window === 'undefined') return 'medium';
    try {
        const cores = navigator.hardwareConcurrency || 4;
        const mem = navigator.deviceMemory; // Chrome only, GiB
        const narrow = _isNarrowViewport();
        const dpr = window.devicePixelRatio || 1;
        if (narrow || (typeof mem === 'number' && mem <= 4) || cores <= 4 || dpr >= 3) {
            return 'low';
        }
        if (cores >= 8 && (typeof mem !== 'number' || mem >= 8) && dpr <= 2) {
            return 'high';
        }
        return 'medium';
    } catch {
        return 'medium';
    }
}

function _readStoredTier() {
    try {
        const v = localStorage.getItem(GLOBE_QUALITY_STORAGE_KEY);
        if (GLOBE_QUALITY_TIERS.includes(v)) return v;
    } catch {
        /* ignore */
    }
    return null;
}

export function prefersReducedMotion() {
    if (_reducedMotion != null) return _reducedMotion;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        _reducedMotion = false;
        return false;
    }
    _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return _reducedMotion;
}

/** Call once after DOM ready to keep in sync with OS changes. */
export function installReducedMotionListener() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
        _reducedMotion = mq.matches;
        _invalidateSnapshotCache();
        const snap = getGlobeQualitySnapshot();
        window.globeQuality = snap;
        window.dispatchEvent(new CustomEvent('globe-quality-change', { detail: snap }));
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', sync);
    else if (typeof mq.addListener === 'function') mq.addListener(sync);
}

export function getGlobeQualityTier() {
    if (!_tier) {
        _tier = _readStoredTier() || _detectPreferredTier();
    }
    return _tier;
}

export function getGlobeQualityPreset(tier = getGlobeQualityTier()) {
    return TIER_PRESETS[tier] || TIER_PRESETS.medium;
}

export function getGlobeQualitySnapshot() {
    if (_snapshotCache) return _snapshotCache;
    const tier = getGlobeQualityTier();
    const preset = getGlobeQualityPreset(tier);
    const reduced = prefersReducedMotion();
    _snapshotCache = {
        tier,
        reducedMotion: reduced,
        ...preset,
        /* Reduced motion softens motion-heavy features regardless of tier. */
        trailsEnabled: preset.trailsEnabled && !reduced,
        shootingStarsEnabled: preset.shootingStarsEnabled && !reduced,
        patternWaveEnabled: preset.patternWaveEnabled && !reduced,
        autoRotateAllowed: !reduced
    };
    return _snapshotCache;
}

function _invalidateSnapshotCache() {
    _snapshotCache = null;
}

export function setGlobeQualityTier(tier, { persist = true } = {}) {
    if (!GLOBE_QUALITY_TIERS.includes(tier)) return getGlobeQualitySnapshot();
    _tier = tier;
    _invalidateSnapshotCache();
    if (persist) {
        try {
            localStorage.setItem(GLOBE_QUALITY_STORAGE_KEY, tier);
        } catch {
            /* ignore */
        }
    }
    const snap = getGlobeQualitySnapshot();
    if (typeof window !== 'undefined') {
        window.globeQuality = snap;
        window.dispatchEvent(new CustomEvent('globe-quality-change', { detail: snap }));
    }
    return snap;
}

export function cycleGlobeQualityTier() {
    const cur = getGlobeQualityTier();
    const idx = GLOBE_QUALITY_TIERS.indexOf(cur);
    const next = GLOBE_QUALITY_TIERS[(idx + 1) % GLOBE_QUALITY_TIERS.length];
    return setGlobeQualityTier(next);
}

export function getTransportCaps() {
    const q = getGlobeQualitySnapshot();
    const mobileHalf = _isNarrowViewport();
    return {
        maxTrains: mobileHalf ? Math.max(3, Math.ceil(q.maxTrains / 2)) : q.maxTrains,
        maxPlanes: mobileHalf ? Math.max(2, Math.ceil(q.maxPlanes / 2)) : q.maxPlanes,
        maxBoats: mobileHalf ? Math.max(3, Math.ceil(q.maxBoats / 2)) : q.maxBoats,
        decorSatellites: mobileHalf ? Math.max(4, Math.ceil(q.decorSatellites / 2)) : q.decorSatellites
    };
}

export function getRendererQualityOpts() {
    const q = getGlobeQualitySnapshot();
    const narrow = _isNarrowViewport();
    return {
        /* MSAA is expensive on mobile fill-rate; desktop follows tier. */
        antialias: narrow ? false : !!q.antialias,
        dprCap: narrow ? q.dprCapMobile : q.dprCapDesktop
    };
}

/** Wire globals for console / keyboard shortcuts. */
export function exposeGlobeQualityGlobals() {
    if (typeof window === 'undefined') return;
    window.globeQuality = getGlobeQualitySnapshot();
    window.setGlobeQuality = (tier) => {
        const snap = setGlobeQualityTier(tier);
        window.globeQuality = snap;
        return snap;
    };
    window.cycleGlobeQuality = () => {
        const snap = cycleGlobeQualityTier();
        window.globeQuality = snap;
        return snap;
    };
    installReducedMotionListener();
    window.globeQuality = getGlobeQualitySnapshot();
}

exposeGlobeQualityGlobals();
