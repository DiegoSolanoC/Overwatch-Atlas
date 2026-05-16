/**
 * Codex cord packet simulation (per directed edge) and RAF-backed SVG animation.
 * Canvas registers node/graph callbacks once per mount; edge redraw calls `syncCodexCordPacketState`.
 */

import {
    CODEX_EDGE_FILTER_PAD_PX,
    CODEX_PACKET_COUNT_MAX,
    CODEX_PACKET_COUNT_MIN,
    CODEX_PACKET_METEOR_CORE_MIN_PULSE,
    CODEX_PACKET_PULSE_DECAY_MAX_SEC,
    CODEX_PACKET_PULSE_DECAY_MIN_SEC,
    CODEX_PACKET_PULSE_OPACITY_LOW_MULT,
    CODEX_PACKET_PULSE_OPACITY_PEAK_MULT,
    CODEX_PACKET_PULSE_PAD_LOW_MULT,
    CODEX_PACKET_PULSE_PAD_PEAK_MULT,
    CODEX_PACKET_PULSE_RISE_MAX_SEC,
    CODEX_PACKET_PULSE_RISE_MIN_SEC,
    CODEX_PACKET_PULSE_WIDTH_LOW_MULT,
    CODEX_PACKET_PULSE_WIDTH_PEAK_MULT,
    CODEX_PACKET_SPEED_MAX,
    CODEX_PACKET_SPEED_MIN
} from '../../codex-camera/viewport/CodexCanvasTuning.js';
import { edgeDirectedKey } from '../../codex-edges/topology/CodexGraphPrimitives.js';
import { appendCordFilteredLineGroup, appendCordPlainLineGroup } from '../svg/CodexCordSvgElements.js';

/** @type {CodexCordPacketRuntime|null} */
let _rt = null;

/** @type {number} */
let cordAnimRafId = 0;
let cordAnimLastTs = 0;

/**
 * Per directed edge: polyline metrics + light-packet sim state.
 * @type {Map<string, { fromId: string, toId: string, active: boolean, packets: object[] }>}
 */
const cordPacketState = new Map();

/**
 * @typedef {object} CodexCordPacketRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => object} getVisualPrefs
 * @property {() => { min: number, max: number }} getPacketStrokeRange
 * @property {(nodeId: string) => boolean} codexNodeIsJunctionWaypoint
 * @property {(edge: { fromId: string, toId: string }) => boolean} edgeCordShowsYellow
 * @property {(fromId: string, toId: string) => string[]} samplePacketTailNodeIds
 * @property {(fromId: string, toId: string, tailNodeIds: string[]) => ({ x: number, y: number }[]|null)} tryBuildPacketWorldPoints
 * @property {(nodeId: string) => HTMLElement|null} codexNodeElById
 * @property {(el: HTMLElement) => { x: number, y: number }} getNodeCenterWorldPx
 */

export function registerCodexCordPacketRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexCordPacketRuntime() {
    codexStopCordAnimRafOnly();
    cordPacketState.clear();
    _rt = null;
}

export function deleteCodexCordPacketStateForKey(key) {
    cordPacketState.delete(key);
}

/** Stop RAF and clear packet sim (runtime stays registered — e.g. full board strip). */
export function stopCordAnimAndClearCordPacketState() {
    codexStopCordAnimRafOnly();
    cordPacketState.clear();
}

/**
 * @param {{ pts: { x: number, y: number }[], segLens: number[], totalLen: number }} p
 */
function recomputePacketPolylineMetrics(p) {
    const pts = p.pts;
    const segs = [];
    let total = 0;
    if (!pts || pts.length < 2) {
        p.segLens = [];
        p.totalLen = 0;
        return;
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
        const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segs.push(d);
        total += d;
    }
    p.segLens = segs;
    p.totalLen = total;
}

/**
 * Refreshes `p.pts` from node centers; keeps or re-samples `p.tailNodeIds` if the chain is invalid.
 * @param {{ tailNodeIds?: string[], pts: { x: number, y: number }[], segLens: number[], totalLen: number }} p
 */
function syncPacketPathToEdge(p, fromId, toId) {
    if (!_rt) return;
    let tail = Array.isArray(p.tailNodeIds) ? p.tailNodeIds : null;
    if (tail == null) {
        tail = _rt.samplePacketTailNodeIds(fromId, toId);
        p.tailNodeIds = tail;
    }
    let pts = _rt.tryBuildPacketWorldPoints(fromId, toId, tail);
    if (!pts) {
        tail = _rt.samplePacketTailNodeIds(fromId, toId);
        p.tailNodeIds = tail;
        pts = _rt.tryBuildPacketWorldPoints(fromId, toId, tail);
    }
    if (!pts) {
        const a = _rt.codexNodeElById(fromId);
        const b = _rt.codexNodeElById(toId);
        p.tailNodeIds = [];
        if (!a || !b) {
            p.pts = [];
        } else {
            p.pts = [_rt.getNodeCenterWorldPx(a), _rt.getNodeCenterWorldPx(b)];
        }
    } else {
        p.pts = pts;
    }
    recomputePacketPolylineMetrics(p);
}

function sampleCodexPacketPulseProfile() {
    return {
        pulseRiseSec:
            CODEX_PACKET_PULSE_RISE_MIN_SEC
            + Math.random() * (CODEX_PACKET_PULSE_RISE_MAX_SEC - CODEX_PACKET_PULSE_RISE_MIN_SEC),
        pulseDecaySec:
            CODEX_PACKET_PULSE_DECAY_MIN_SEC
            + Math.random() * (CODEX_PACKET_PULSE_DECAY_MAX_SEC - CODEX_PACKET_PULSE_DECAY_MIN_SEC)
    };
}

/**
 * Meteor flash: steep ease-out to peak during rise, then exponential decay (short glare, not a long ramp).
 */
function codexPacketPulseStrength(ageSec, riseSec, decayTauSec) {
    if (ageSec <= 0) return 0;
    if (riseSec < 1e-6) return 0;
    if (ageSec < riseSec) {
        const t = ageSec / riseSec;
        return 1 - (1 - t) ** 4;
    }
    const tau = Math.max(decayTauSec, 1e-6);
    return Math.exp(-(ageSec - riseSec) / tau);
}

function ensureCodexPacketPulseFields(p) {
    if (p.pulseRiseSec == null || p.pulseDecaySec == null) {
        const s = sampleCodexPacketPulseProfile();
        p.pulseRiseSec = s.pulseRiseSec;
        p.pulseDecaySec = s.pulseDecaySec;
    }
    if (p.pulseAgeSec == null) p.pulseAgeSec = 0;
}

function createCodexCordPacketsForEdge(fromId, toId) {
    if (!_rt) return [];
    const n =
        CODEX_PACKET_COUNT_MIN
        + Math.floor(Math.random() * (CODEX_PACKET_COUNT_MAX - CODEX_PACKET_COUNT_MIN + 1));
    const packets = [];
    const { min: pwMin, max: pwMax } = _rt.getPacketStrokeRange();
    for (let i = 0; i < n; i += 1) {
        const pulse = sampleCodexPacketPulseProfile();
        const p = {
            headT: Math.random(),
            speed: CODEX_PACKET_SPEED_MIN + Math.random() * (CODEX_PACKET_SPEED_MAX - CODEX_PACKET_SPEED_MIN),
            lengthT: 0.014 + Math.pow(Math.random(), 1.75) * 0.072,
            width: pwMin + Math.random() * (pwMax - pwMin),
            pts: [],
            segLens: [],
            totalLen: 0,
            pulseRiseSec: pulse.pulseRiseSec,
            pulseDecaySec: pulse.pulseDecaySec,
            pulseAgeSec: 0
        };
        syncPacketPathToEdge(p, fromId, toId);
        packets.push(p);
    }
    return packets;
}

/**
 * @param {{ edge: { fromId: string, toId: string } }[]} edgePolys
 */
export function syncCodexCordPacketState(edgePolys) {
    if (!_rt) return;
    const seen = new Set();
    edgePolys.forEach(({ edge }) => {
        const { fromId, toId } = edge;
        if (_rt.codexNodeIsJunctionWaypoint(fromId)) return;
        const key = edgeDirectedKey(fromId, toId);
        seen.add(key);
        let st = cordPacketState.get(key);
        if (!st) {
            st = {
                fromId,
                toId,
                active: false,
                packets: createCodexCordPacketsForEdge(fromId, toId)
            };
            cordPacketState.set(key, st);
        } else {
            st.fromId = fromId;
            st.toId = toId;
            st.packets.forEach((p) => {
                syncPacketPathToEdge(p, fromId, toId);
            });
        }
        st.active = _rt.edgeCordShowsYellow(edge);
    });
    cordPacketState.forEach((_, k) => {
        if (!seen.has(k)) cordPacketState.delete(k);
    });
}

/** World point at arc length `s` (0 … totalLen) along cord polyline. */
function codexPointAtArcLength(poly, s) {
    const { pts, segLens, totalLen } = poly;
    if (!pts?.length) return { x: 0, y: 0 };
    const cl = Math.max(0, Math.min(totalLen, s));
    if (totalLen < 1e-6) return { x: pts[0].x, y: pts[0].y };
    let cum = 0;
    for (let i = 0; i < segLens.length; i += 1) {
        const sl = segLens[i];
        const segEnd = cum + sl;
        if (cl <= segEnd + 1e-9 || i === segLens.length - 1) {
            const u = sl < 1e-6 ? 1 : (cl - cum) / sl;
            const uu = Math.max(0, Math.min(1, u));
            return {
                x: pts[i].x + uu * (pts[i + 1].x - pts[i].x),
                y: pts[i].y + uu * (pts[i + 1].y - pts[i].y)
            };
        }
        cum = segEnd;
    }
    return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

/**
 * Ordered points along the cord from arc `tTail` to `tHead`, inserting waypoint vertices so the
 * packet can be drawn as separate strokes per leg (no diagonal across corners; reads as transfer).
 * @returns {{ x: number, y: number }[]}
 */
function buildCodexPacketCordPolylinePoints(poly, tTail, tHead) {
    const { pts, segLens, totalLen } = poly;
    if (!pts?.length || totalLen < 1e-6) return [];
    const s0 = Math.max(0, Math.min(totalLen, tTail * totalLen));
    const s1 = Math.max(0, Math.min(totalLen, tHead * totalLen));
    if (s1 <= s0 + 1e-4) return [];
    const list = [];
    const eps = 0.45;
    const pushPt = (p) => {
        const prev = list[list.length - 1];
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > eps) list.push(p);
    };
    pushPt(codexPointAtArcLength(poly, s0));
    let cum = 0;
    for (let i = 0; i < segLens.length; i += 1) {
        const segEnd = cum + segLens[i];
        if (s0 < segEnd - 1e-6 && segEnd < s1 - 1e-6) {
            pushPt({ x: pts[i + 1].x, y: pts[i + 1].y });
        }
        cum = segEnd;
    }
    pushPt(codexPointAtArcLength(poly, s1));
    return list;
}

/**
 * One filtered stroke per cord leg so energy meets at waypoints instead of cutting the corner.
 */
function appendCodexCordPacketAlongCord(pktG, ns, poly, tTail, tHead, {
    stroke,
    strokeWidth,
    strokeOpacity,
    filterUrl,
    padStrokeWidth
}) {
    const pathPts = buildCodexPacketCordPolylinePoints(poly, tTail, tHead);
    if (pathPts.length < 2) return;
    for (let i = 0; i < pathPts.length - 1; i += 1) {
        const ax = pathPts[i].x;
        const ay = pathPts[i].y;
        const bx = pathPts[i + 1].x;
        const by = pathPts[i + 1].y;
        if (Math.hypot(bx - ax, by - ay) < 0.4) continue;
        appendCordFilteredLineGroup(pktG, ns, {
            x1: ax,
            y1: ay,
            x2: bx,
            y2: by,
            stroke,
            strokeWidth,
            strokeOpacity: String(strokeOpacity),
            filterUrl,
            lineClass: 'codex-edge-packet',
            padStrokeWidth
        });
    }
}

/** Bright unfiltered core along the same legs as `appendCodexCordPacketAlongCord` (draw after glow). */
function appendCodexCordMeteorCoreAlongCord(pktG, ns, poly, tTail, tHead, {
    stroke,
    strokeWidth,
    strokeOpacity
}) {
    const pathPts = buildCodexPacketCordPolylinePoints(poly, tTail, tHead);
    if (pathPts.length < 2) return;
    for (let i = 0; i < pathPts.length - 1; i += 1) {
        const ax = pathPts[i].x;
        const ay = pathPts[i].y;
        const bx = pathPts[i + 1].x;
        const by = pathPts[i + 1].y;
        if (Math.hypot(bx - ax, by - ay) < 0.4) continue;
        appendCordPlainLineGroup(pktG, ns, {
            x1: ax,
            y1: ay,
            x2: bx,
            y2: by,
            stroke,
            strokeWidth,
            strokeOpacity: String(strokeOpacity),
            lineClass: 'codex-edge-packet-meteor-core'
        });
    }
}

export function codexStopCordAnimRafOnly() {
    if (cordAnimRafId) {
        cancelAnimationFrame(cordAnimRafId);
        cordAnimRafId = 0;
    }
    cordAnimLastTs = 0;
}

function codexCordAnimationTick(ts) {
    cordAnimRafId = requestAnimationFrame(codexCordAnimationTick);
    if (!_rt) {
        codexStopCordAnimRafOnly();
        return;
    }
    const root = _rt.getRoot();
    if (!root || !document.body.contains(root)) {
        codexStopCordAnimRafOnly();
        cordPacketState.clear();
        return;
    }
    const svg = root.querySelector('.codex-edges-layer');
    const pktG = svg?.querySelector('.codex-edge-packets');
    if (!pktG || cordPacketState.size === 0) return;

    const dt = cordAnimLastTs ? Math.min(0.055, (ts - cordAnimLastTs) / 1000) : 1 / 60;
    cordAnimLastTs = ts;

    const ns = 'http://www.w3.org/2000/svg';
    while (pktG.firstChild) pktG.removeChild(pktG.firstChild);

    const visualPrefs = _rt.getVisualPrefs();

    cordPacketState.forEach((st) => {
        st.packets.forEach((p) => {
            if (!p.pts || p.pts.length < 2 || p.totalLen < 1e-3) return;
            ensureCodexPacketPulseFields(p);
            p.headT += p.speed * dt;
            if (p.headT > 1) {
                p.headT %= 1;
                p.tailNodeIds = _rt.samplePacketTailNodeIds(st.fromId, st.toId);
                syncPacketPathToEdge(p, st.fromId, st.toId);
                p.speed = CODEX_PACKET_SPEED_MIN
                    + Math.random() * (CODEX_PACKET_SPEED_MAX - CODEX_PACKET_SPEED_MIN);
                p.lengthT = 0.014 + Math.pow(Math.random(), 1.75) * 0.072;
                const { min: pwMin, max: pwMax } = _rt.getPacketStrokeRange();
                p.width = pwMin + Math.random() * (pwMax - pwMin);
                const pulse = sampleCodexPacketPulseProfile();
                p.pulseRiseSec = pulse.pulseRiseSec;
                p.pulseDecaySec = pulse.pulseDecaySec;
                p.pulseAgeSec = 0;
            }
            p.pulseAgeSec += dt;
            const pulseStr = codexPacketPulseStrength(
                p.pulseAgeSec,
                p.pulseRiseSec,
                p.pulseDecaySec
            );
            const baseOpac = visualPrefs.packetOpacity;
            const opLow = CODEX_PACKET_PULSE_OPACITY_LOW_MULT;
            const opHigh = CODEX_PACKET_PULSE_OPACITY_PEAK_MULT;
            const effOpac = Math.min(
                1,
                baseOpac * (opLow + pulseStr * (opHigh - opLow))
            );
            const wLow = CODEX_PACKET_PULSE_WIDTH_LOW_MULT;
            const wHigh = CODEX_PACKET_PULSE_WIDTH_PEAK_MULT;
            const effWidth = p.width * (wLow + pulseStr * (wHigh - wLow));
            const padBase = CODEX_EDGE_FILTER_PAD_PX * visualPrefs.packetThicknessMult;
            const pLow = CODEX_PACKET_PULSE_PAD_LOW_MULT;
            const pHigh = CODEX_PACKET_PULSE_PAD_PEAK_MULT;
            const padW = Math.round(padBase * (pLow + pulseStr * (pHigh - pLow)));
            const tailT = Math.max(0, p.headT - p.lengthT);
            const packetStroke = st.active
                ? visualPrefs.packetColorActive
                : visualPrefs.packetColorIdle;
            appendCodexCordPacketAlongCord(pktG, ns, p, tailT, p.headT, {
                stroke: packetStroke,
                strokeWidth: effWidth,
                strokeOpacity: effOpac,
                filterUrl: 'url(#codex-edge-packet-pink-soft)',
                padStrokeWidth: padW
            });
            if (pulseStr > CODEX_PACKET_METEOR_CORE_MIN_PULSE) {
                const coreBoost = pulseStr * pulseStr;
                const coreW = p.width * (0.38 + 1.05 * pulseStr);
                const coreOpac = Math.min(1, 0.15 + 0.92 * coreBoost);
                appendCodexCordMeteorCoreAlongCord(pktG, ns, p, tailT, p.headT, {
                    stroke: '#fff6e8',
                    strokeWidth: coreW,
                    strokeOpacity: coreOpac
                });
            }
        });
    });
}

export function ensureCodexCordAnimationLoop() {
    if (cordAnimRafId) return;
    cordAnimLastTs = 0;
    cordAnimRafId = requestAnimationFrame(codexCordAnimationTick);
}
