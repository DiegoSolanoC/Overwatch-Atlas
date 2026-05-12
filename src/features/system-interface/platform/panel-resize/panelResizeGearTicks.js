/**
 * Gear-tick audio pool used while a resize handle is being dragged.
 *
 * The drag handler calls `playGearTick()` every `GEAR_TICK_EVERY_PX` of pointer
 * movement. We keep a small pool (`GEAR_TICK_POOL_SIZE`) of `Audio` elements
 * so that overlapping ticks don't cut each other off; if every slot is busy
 * we just skip the tick. Volume is sourced from the Sound Effects slider, the
 * same source the page-slider scrub and panel-dragger ticks use.
 *
 * `window.PanelResizeGearTick.{play, syncFromSoundEffectsVolume}` is exposed
 * because the volume slider lives outside this module and needs to push a
 * refresh after the user changes it (the pool is created lazily on first play).
 */

const GEAR_TICK_SRC = 'src/assets/audio/sfx/tick.mp3';
/** Pointer movement (px) before one tick is eligible. */
export const GEAR_TICK_EVERY_PX = 10;
/** Avoid stacking ticks faster than the clip can breathe (ms). */
const GEAR_TICK_MIN_INTERVAL_MS = 42;
const GEAR_TICK_POOL_SIZE = 6;
/** Base loudness; multiplied by Sound Effects slider. */
const GEAR_TICK_VOLUME_BASE = 0.36;

let gearTickPool = null;
let gearTickPoolIx = 0;
let lastGearTickPerfMs = 0;

function gearTickEffectiveVolume() {
    const sfx = typeof window !== 'undefined' ? window.SoundEffectsManager : null;
    const g =
        sfx && typeof sfx.volume === 'number' && !isNaN(sfx.volume)
            ? Math.max(0, Math.min(1, sfx.volume))
            : 0.5;
    return Math.max(0, Math.min(1, GEAR_TICK_VOLUME_BASE * g));
}

function getGearTickPool() {
    if (!gearTickPool) {
        gearTickPool = [];
        for (let i = 0; i < GEAR_TICK_POOL_SIZE; i++) {
            const a = new Audio(GEAR_TICK_SRC);
            a.preload = 'auto';
            a.volume = gearTickEffectiveVolume();
            gearTickPool.push(a);
        }
    }
    return gearTickPool;
}

function isGearSlotIdle(audioEl) {
    if (!audioEl.duration || !Number.isFinite(audioEl.duration) || audioEl.duration <= 0) {
        return audioEl.paused || audioEl.ended;
    }
    return audioEl.paused || audioEl.ended || audioEl.currentTime >= audioEl.duration - 0.02;
}

export function stopGearTicks() {
    if (!gearTickPool) return;
    gearTickPool.forEach(function (a) {
        try {
            a.pause();
            a.currentTime = 0;
        } catch (e) {
            /* ignore */
        }
    });
}

/** @returns {boolean} true if a tick actually played. */
export function playGearTick() {
    const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    if (now - lastGearTickPerfMs < GEAR_TICK_MIN_INTERVAL_MS) return false;

    const pool = getGearTickPool();
    const n = pool.length;
    for (let i = 0; i < n; i++) {
        const idx = (gearTickPoolIx + i) % n;
        const a = pool[idx];
        if (!isGearSlotIdle(a)) continue;
        try {
            a.currentTime = 0;
            a.volume = gearTickEffectiveVolume();
            const p = a.play();
            gearTickPoolIx = (idx + 1) % n;
            lastGearTickPerfMs = now;
            if (p && typeof p.catch === 'function') p.catch(function () {});
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

export function syncGearTickPoolVolume() {
    if (!gearTickPool || !gearTickPool.length) return;
    const v = gearTickEffectiveVolume();
    gearTickPool.forEach(function (a) {
        try {
            a.volume = v;
        } catch (e) {
            /* ignore */
        }
    });
}

/** Install the `window.PanelResizeGearTick` accessor used by the Sound Effects slider. */
export function installGearTickWindowApi() {
    if (typeof window === 'undefined') return;
    window.PanelResizeGearTick = {
        play: playGearTick,
        syncFromSoundEffectsVolume: syncGearTickPoolVolume
    };
}
