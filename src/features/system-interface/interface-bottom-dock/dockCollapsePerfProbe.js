/**
 * Dock collapse vs side-panel open/close performance probe.
 *
 * Enable: localStorage.setItem('dockPerf', '1') then reload.
 * Or: window.DockCollapsePerf.arm() then toggle dock / open a side panel.
 *
 * Logs long-tasks + marks so we can see what actually blocks Codex.
 */

const STORAGE_KEY = 'dockPerf';

/** @type {PerformanceObserver | null} */
let longTaskObserver = null;
/** @type {{ name: string, duration: number, startTime: number }[]} */
let longTasks = [];
/** @type {{ name: string, t: number }[]} */
let marks = [];
let armedUntil = 0;
let wrapInstalled = false;

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

function mark(name) {
    const t = now();
    marks.push({ name, t });
    try {
        performance.mark(`dockPerf:${name}`);
    } catch (_) {
        /* ignore */
    }
    if (enabled() || armedUntil > t) {
        console.info(`[dockPerf +${t.toFixed(1)}ms] ${name}`);
    }
}

function arm(ms = 2000) {
    armedUntil = now() + ms;
    longTasks = [];
    marks = [];
    ensureLongTaskObserver();
    mark('arm');
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
                if (enabled() || armedUntil > now()) {
                    console.warn(
                        `[dockPerf longtask] ${e.duration.toFixed(1)}ms @ ${e.startTime.toFixed(1)}`,
                    );
                }
            }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: false });
    } catch (_) {
        longTaskObserver = null;
    }
}

function summarize(label) {
    const totalLong = longTasks.reduce((s, x) => s + x.duration, 0);
    const summary = {
        label,
        longTaskCount: longTasks.length,
        longTaskTotalMs: Math.round(totalLong),
        worstLongTaskMs: Math.round(Math.max(0, ...longTasks.map((x) => x.duration), 0)),
        marks: marks.map((m) => `${m.name}@${m.t.toFixed(0)}`),
    };
    console.info('[dockPerf summary]', summary);
    if (longTasks.length) console.table(longTasks);
    return summary;
}

/**
 * Wrap dock toggle + side chrome tween so collapse paths are comparable to panel open.
 */
function installWrappers() {
    if (wrapInstalled || typeof window === 'undefined') return;
    wrapInstalled = true;

    const wrapToggle = () => {
        const api = window.PaginationDockCollapse;
        if (!api?.toggle || api.toggle.__dockPerfWrapped) return;
        const orig = api.toggle.bind(api);
        const wrapped = (...args) => {
            arm(900);
            mark('dock-toggle:before');
            const t0 = now();
            const result = orig(...args);
            mark(`dock-toggle:after (+${(now() - t0).toFixed(1)}ms sync)`);
            window.setTimeout(() => summarize('dock-collapse'), 480);
            return result;
        };
        wrapped.__dockPerfWrapped = true;
        api.toggle = wrapped;
    };

    wrapToggle();
    window.setTimeout(wrapToggle, 0);
    window.setTimeout(wrapToggle, 1000);
}

export function initDockCollapsePerfProbe() {
    if (typeof window === 'undefined') return;
    window.DockCollapsePerf = {
        arm,
        mark,
        summarize,
        enable: () => {
            try {
                localStorage.setItem(STORAGE_KEY, '1');
            } catch (_) {
                /* ignore */
            }
            ensureLongTaskObserver();
            console.info('[dockPerf] enabled — reload, then toggle dock / open side panels');
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
    installWrappers();
    if (enabled()) {
        ensureLongTaskObserver();
        console.info('[dockPerf] active (localStorage.dockPerf=1)');
    }
}

if (typeof window !== 'undefined') {
    initDockCollapsePerfProbe();
}
