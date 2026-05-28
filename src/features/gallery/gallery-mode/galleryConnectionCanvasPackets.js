/**
 * Codex-style cord packet simulation for gallery personal connection canvas.
 * Packets follow polyline paths through junction breaks (leg-by-leg at corners).
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
    CODEX_PACKET_SPEED_MIN,
    CODEX_VISUAL_DEFAULTS,
} from '../../codex/codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { edgeDirectedKey } from '../../codex/codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    appendCordFilteredLineGroup,
    appendCordPlainLineGroup,
} from '../../codex/codex-node-drawing/svg/CodexCordSvgElements.js';
import {
    buildGalleryNodeKindMap,
    galleryNodeIsJunctionWaypoint,
    sampleGalleryPacketTailNodeIds,
    tryBuildGalleryPacketWorldPoints,
} from './galleryConnectionCanvasGraph.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Per directed edge: polyline metrics + light-packet sim state.
 * @type {Map<string, { fromId: string, toId: string, active: boolean, packets: object[] }>}
 */
const cordPacketState = new Map();

/** @type {number} */
let cordAnimRafId = 0;
let cordAnimLastTs = 0;

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

function sampleCodexPacketPulseProfile() {
    return {
        pulseRiseSec:
            CODEX_PACKET_PULSE_RISE_MIN_SEC
            + Math.random() * (CODEX_PACKET_PULSE_RISE_MAX_SEC - CODEX_PACKET_PULSE_RISE_MIN_SEC),
        pulseDecaySec:
            CODEX_PACKET_PULSE_DECAY_MIN_SEC
            + Math.random() * (CODEX_PACKET_PULSE_DECAY_MAX_SEC - CODEX_PACKET_PULSE_DECAY_MIN_SEC),
    };
}

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
        const profile = sampleCodexPacketPulseProfile();
        p.pulseRiseSec = profile.pulseRiseSec;
        p.pulseDecaySec = profile.pulseDecaySec;
    }
    if (p.pulseAgeSec == null) p.pulseAgeSec = 0;
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
                y: pts[i].y + uu * (pts[i + 1].y - pts[i].y),
            };
        }
        cum = segEnd;
    }
    return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

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

function appendCodexCordPacketAlongCord(pktG, ns, poly, tTail, tHead, {
    stroke,
    strokeWidth,
    strokeOpacity,
    filterUrl,
    padStrokeWidth,
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
            padStrokeWidth,
        });
    }
}

function appendCodexCordMeteorCoreAlongCord(pktG, ns, poly, tTail, tHead, {
    stroke,
    strokeWidth,
    strokeOpacity,
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
            lineClass: 'codex-edge-packet-meteor-core',
        });
    }
}

function stopCordAnimRafOnly() {
    if (cordAnimRafId) {
        cancelAnimationFrame(cordAnimRafId);
        cordAnimRafId = 0;
    }
    cordAnimLastTs = 0;
}

/**
 * @param {{
 *   getEdges: () => { fromId: string, toId: string }[],
 *   getNodes: () => { id: string, kind?: string, entityKind?: string }[],
 *   getNodeCenter: (id: string) => { x: number, y: number }|null,
 *   isEnabled: () => boolean,
 *   packetLayer: SVGGElement,
 *   filterId: string,
 * }} opts
 */
export function createGalleryConnectionPacketAnimator(opts) {
    let running = false;

    /**
     * @param {{ fromId: string, toId: string, tailNodeIds?: string[], pts: { x: number, y: number }[], segLens: number[], totalLen: number }} p
     * @param {string} fromId
     * @param {string} toId
     */
    function syncPacketPathToEdge(p, fromId, toId) {
        const edges = opts.getEdges();
        const kindMap = buildGalleryNodeKindMap(opts.getNodes());
        let tail = Array.isArray(p.tailNodeIds) ? p.tailNodeIds : null;
        if (tail == null) {
            tail = sampleGalleryPacketTailNodeIds(edges, kindMap, fromId, toId);
            p.tailNodeIds = tail;
        }
        let pts = tryBuildGalleryPacketWorldPoints(fromId, toId, tail, edges, opts.getNodeCenter);
        if (!pts) {
            tail = sampleGalleryPacketTailNodeIds(edges, kindMap, fromId, toId);
            p.tailNodeIds = tail;
            pts = tryBuildGalleryPacketWorldPoints(fromId, toId, tail, edges, opts.getNodeCenter);
        }
        if (!pts) {
            p.tailNodeIds = [];
            const p0 = opts.getNodeCenter(fromId);
            const p1 = opts.getNodeCenter(toId);
            p.pts = p0 && p1 ? [p0, p1] : [];
        } else {
            p.pts = pts;
        }
        recomputePacketPolylineMetrics(p);
    }

    function createCordPacketsForEdge(fromId, toId) {
        const n =
            CODEX_PACKET_COUNT_MIN
            + Math.floor(Math.random() * (CODEX_PACKET_COUNT_MAX - CODEX_PACKET_COUNT_MIN + 1));
        const packets = [];
        const prefs = CODEX_VISUAL_DEFAULTS;
        const base = prefs.cordThickness * prefs.packetThicknessMult;
        const pwMin = base * 0.97;
        const pwMax = base * 1.03;
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
                pulseAgeSec: 0,
            };
            syncPacketPathToEdge(p, fromId, toId);
            packets.push(p);
        }
        return packets;
    }

    function syncPacketState(edges) {
        const seen = new Set();
        const kindMap = buildGalleryNodeKindMap(opts.getNodes());
        for (let i = 0; i < edges.length; i += 1) {
            const { fromId, toId } = edges[i];
            if (galleryNodeIsJunctionWaypoint(kindMap, fromId)) continue;
            const key = edgeDirectedKey(fromId, toId);
            seen.add(key);
            let st = cordPacketState.get(key);
            if (!st) {
                st = {
                    fromId,
                    toId,
                    active: true,
                    packets: createCordPacketsForEdge(fromId, toId),
                };
                cordPacketState.set(key, st);
            } else {
                st.fromId = fromId;
                st.toId = toId;
                st.packets.forEach((p) => {
                    syncPacketPathToEdge(p, fromId, toId);
                });
            }
            st.active = true;
        }
        cordPacketState.forEach((_, k) => {
            if (!seen.has(k)) cordPacketState.delete(k);
        });
    }

    function codexCordAnimationTick(ts) {
        if (!running) return;
        cordAnimRafId = requestAnimationFrame(codexCordAnimationTick);
        if (!opts.isEnabled()) {
            opts.packetLayer.replaceChildren();
            return;
        }
        if (cordPacketState.size === 0) {
            opts.packetLayer.replaceChildren();
            return;
        }

        const dt = cordAnimLastTs ? Math.min(0.055, (ts - cordAnimLastTs) / 1000) : 1 / 60;
        cordAnimLastTs = ts;

        while (opts.packetLayer.firstChild) opts.packetLayer.removeChild(opts.packetLayer.firstChild);

        const visualPrefs = CODEX_VISUAL_DEFAULTS;
        const filterUrl = `url(#${opts.filterId})`;
        const edges = opts.getEdges();
        const kindMap = buildGalleryNodeKindMap(opts.getNodes());

        cordPacketState.forEach((st) => {
            st.packets.forEach((p) => {
                if (!p.pts || p.pts.length < 2 || p.totalLen < 1e-3) return;
                ensureCodexPacketPulseFields(p);
                p.headT += p.speed * dt;
                if (p.headT > 1) {
                    p.headT %= 1;
                    p.tailNodeIds = sampleGalleryPacketTailNodeIds(edges, kindMap, st.fromId, st.toId);
                    syncPacketPathToEdge(p, st.fromId, st.toId);
                    p.speed = CODEX_PACKET_SPEED_MIN
                        + Math.random() * (CODEX_PACKET_SPEED_MAX - CODEX_PACKET_SPEED_MIN);
                    p.lengthT = 0.014 + Math.pow(Math.random(), 1.75) * 0.072;
                    const base = visualPrefs.cordThickness * visualPrefs.packetThicknessMult;
                    p.width = base * 0.97 + Math.random() * (base * 0.06);
                    const pulse = sampleCodexPacketPulseProfile();
                    p.pulseRiseSec = pulse.pulseRiseSec;
                    p.pulseDecaySec = pulse.pulseDecaySec;
                    p.pulseAgeSec = 0;
                }
                p.pulseAgeSec += dt;
                const pulseStr = codexPacketPulseStrength(
                    p.pulseAgeSec,
                    p.pulseRiseSec,
                    p.pulseDecaySec,
                );
                const baseOpac = visualPrefs.packetOpacity;
                const effOpac = Math.min(
                    1,
                    baseOpac * (CODEX_PACKET_PULSE_OPACITY_LOW_MULT
                        + pulseStr * (CODEX_PACKET_PULSE_OPACITY_PEAK_MULT - CODEX_PACKET_PULSE_OPACITY_LOW_MULT)),
                );
                const effWidth = p.width * (CODEX_PACKET_PULSE_WIDTH_LOW_MULT
                    + pulseStr * (CODEX_PACKET_PULSE_WIDTH_PEAK_MULT - CODEX_PACKET_PULSE_WIDTH_LOW_MULT));
                const padBase = CODEX_EDGE_FILTER_PAD_PX * visualPrefs.packetThicknessMult;
                const padW = Math.round(padBase * (CODEX_PACKET_PULSE_PAD_LOW_MULT
                    + pulseStr * (CODEX_PACKET_PULSE_PAD_PEAK_MULT - CODEX_PACKET_PULSE_PAD_LOW_MULT)));
                const tailT = Math.max(0, p.headT - p.lengthT);
                const packetStroke = st.active
                    ? visualPrefs.packetColorActive
                    : visualPrefs.packetColorIdle;
                appendCodexCordPacketAlongCord(opts.packetLayer, NS, p, tailT, p.headT, {
                    stroke: packetStroke,
                    strokeWidth: effWidth,
                    strokeOpacity: effOpac,
                    filterUrl,
                    padStrokeWidth: padW,
                });
                if (pulseStr > CODEX_PACKET_METEOR_CORE_MIN_PULSE) {
                    const coreBoost = pulseStr * pulseStr;
                    appendCodexCordMeteorCoreAlongCord(opts.packetLayer, NS, p, tailT, p.headT, {
                        stroke: '#fff6e8',
                        strokeWidth: p.width * (0.38 + 1.05 * pulseStr),
                        strokeOpacity: Math.min(1, 0.15 + 0.92 * coreBoost),
                    });
                }
            });
        });
    }

    function start() {
        if (running) return;
        running = true;
        cordAnimLastTs = 0;
        cordAnimRafId = requestAnimationFrame(codexCordAnimationTick);
    }

    function stop() {
        running = false;
        stopCordAnimRafOnly();
        cordPacketState.clear();
        opts.packetLayer.replaceChildren();
    }

    return { start, stop, syncPacketState, filterId: opts.filterId };
}
