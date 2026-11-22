/**
 * Intel (Gallery) entity-swap performance probe.
 *
 * Enable: localStorage.setItem('intelPerf', '1') then reload.
 * Or: window.IntelEntitySwapPerf.enable() then swap heroes in Filters.
 *
 * Logs timed stages + longtasks so we can see whether the hitch is dock,
 * archive description, connections list, or the per-entity canvas prewarm.
 */

const STORAGE_KEY = 'intelPerf';

/** @type {PerformanceObserver | null} */
let longTaskObserver = null;
/** @type {{ name: string, duration: number, startTime: number }[]} */
let longTasks = [];
/** @type {{ name: string, t: number, swapId: number }[]} */
let marks = [];
/** @type {Map<string, number>} */
let openSpans = new Map();
let armedUntil = 0;
let swapId = 0;
let activeSwapId = 0;

function enabled() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function now() {
    return performance.now();
}

function isLive() {
    return enabled() || armedUntil > now();
}

function ensureLongTaskObserver() {
    if (longTaskObserver || typeof PerformanceObserver === 'undefined') return;
    try {
        longTaskObserver = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
                longTasks.push({
                    name: e.name || 'longtask',
                    duration: e.duration,
                    startTime: e.startTime,
                });
                if (isLive()) {
                    console.warn(
                        `[intelPerf longtask] ${e.duration.toFixed(1)}ms @ ${e.startTime.toFixed(1)}`,
                    );
                }
            }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: false });
    } catch (_) {
        longTaskObserver = null;
    }
}

/**
 * @param {string} name
 * @param {{ swapId?: number }} [meta]
 */
export function intelPerfMark(name, meta = {}) {
    if (!isLive() && !enabled()) return;
    const t = now();
    const sid = meta.swapId ?? activeSwapId;
    marks.push({ name, t, swapId: sid });
    try {
        performance.mark(`intelPerf:${name}`);
    } catch (_) {
        /* ignore */
    }
    if (isLive()) {
        console.info(`[intelPerf #${sid} +${t.toFixed(1)}ms] ${name}`);
    }
}

/**
 * @param {string} name
 */
export function intelPerfBegin(name) {
    if (!isLive() && !enabled()) return;
    openSpans.set(name, now());
    intelPerfMark(`${name}:begin`);
}

/**
 * @param {string} name
 */
export function intelPerfEnd(name) {
    if (!isLive() && !enabled()) return;
    const t0 = openSpans.get(name);
    openSpans.delete(name);
    const dt = t0 != null ? now() - t0 : NaN;
    intelPerfMark(
        Number.isFinite(dt) ? `${name}:end (+${dt.toFixed(1)}ms)` : `${name}:end`,
    );
}

/**
 * Start a new entity-swap session (call at the top of applyBioSelection / filter pick).
 * Quiet unless `localStorage.intelPerf=1` or `force` (manual `IntelEntitySwapPerf.arm()`).
 * @param {string} [label]
 * @param {number} [armMs]
 * @param {boolean} [force]
 */
export function intelPerfArmSwap(label = 'entity-swap', armMs = 2500, force = false) {
    swapId += 1;
    activeSwapId = swapId;
    if (!enabled() && !force) return activeSwapId;

    ensureLongTaskObserver();
    armedUntil = now() + armMs;
    longTasks = [];
    marks = [];
    openSpans = new Map();
    intelPerfMark(`arm:${label}`);
    window.setTimeout(() => intelPerfSummarize(label), Math.min(armMs + 50, 2800));
    return activeSwapId;
}

/**
 * @param {string} [label]
 */
export function intelPerfSummarize(label = 'entity-swap') {
    if (!enabled() && armedUntil <= now() && !marks.length) return null;
    const totalLong = longTasks.reduce((s, x) => s + x.duration, 0);
    const stageCosts = [];
    for (const m of marks) {
        const match = /:end \(\+(\d+(?:\.\d+)?)ms\)$/.exec(m.name);
        if (match) {
            stageCosts.push({
                stage: m.name.replace(/:end \(\+[\d.]+ms\)$/, ''),
                ms: Number(match[1]),
                swapId: m.swapId,
            });
        }
    }
    stageCosts.sort((a, b) => b.ms - a.ms);
    const summary = {
        label,
        swapId: activeSwapId,
        longTaskCount: longTasks.length,
        longTaskTotalMs: Math.round(totalLong),
        worstLongTaskMs: Math.round(Math.max(0, ...longTasks.map((x) => x.duration), 0)),
        topStages: stageCosts.slice(0, 8),
        marks: marks.map((m) => `#${m.swapId} ${m.name}@${m.t.toFixed(0)}`),
    };
    console.info('[intelPerf summary]', summary);
    if (stageCosts.length) console.table(stageCosts.slice(0, 12));
    if (longTasks.length) console.table(longTasks);
    return summary;
}

export function initIntelEntitySwapPerfProbe() {
    if (typeof window === 'undefined') return;
    window.IntelEntitySwapPerf = {
        arm: (label, ms) => intelPerfArmSwap(label, ms, true),
        mark: intelPerfMark,
        begin: intelPerfBegin,
        end: intelPerfEnd,
        summarize: intelPerfSummarize,
        enable: () => {
            try {
                localStorage.setItem(STORAGE_KEY, '1');
            } catch (_) {
                /* ignore */
            }
            ensureLongTaskObserver();
            console.info(
                '[intelPerf] enabled — reload, then swap Intel entities (Filters chips). Console will name the slow stages.',
            );
        },
        disable: () => {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (_) {
                /* ignore */
            }
        },
        isEnabled: enabled,
    };
    if (enabled()) {
        ensureLongTaskObserver();
        console.info('[intelPerf] active (localStorage.intelPerf=1)');
    }
}

if (typeof window !== 'undefined') {
    initIntelEntitySwapPerfProbe();
}
