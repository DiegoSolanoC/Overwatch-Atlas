/**
 * Reusable SVG `<defs>` filters and cord stroke groups for Codex edges and animated packets.
 */

import { CODEX_CORD_STROKE_OPACITY, CODEX_EDGE_FILTER_PAD_PX } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

/**
 * Cord: dilate + blur with stacked halo; `blurLayers` controls glow strength (merge count before core).
 */
export function appendEdgeGlowFilter(defs, id, blurResultId, {
    stdDeviation,
    morphRadius,
    blurLayers,
    viewW = null,
    viewH = null
}) {
    const ns = 'http://www.w3.org/2000/svg';
    const morphResultId = `${blurResultId}Morph`;
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', id);
    if (viewW != null && viewH != null) {
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(viewW));
        filter.setAttribute('height', String(viewH));
    } else {
        filter.setAttribute('x', '-80%');
        filter.setAttribute('y', '-80%');
        filter.setAttribute('width', '260%');
        filter.setAttribute('height', '260%');
    }
    const morph = document.createElementNS(ns, 'feMorphology');
    morph.setAttribute('operator', 'dilate');
    morph.setAttribute('radius', String(morphRadius));
    morph.setAttribute('in', 'SourceGraphic');
    morph.setAttribute('result', morphResultId);
    const blur = document.createElementNS(ns, 'feGaussianBlur');
    blur.setAttribute('in', morphResultId);
    blur.setAttribute('stdDeviation', String(stdDeviation));
    blur.setAttribute('result', blurResultId);
    const merge = document.createElementNS(ns, 'feMerge');
    const nBlur = Math.max(1, Math.min(8, Math.round(blurLayers)));
    for (let b = 0; b < nBlur; b += 1) {
        const mn = document.createElementNS(ns, 'feMergeNode');
        mn.setAttribute('in', blurResultId);
        merge.appendChild(mn);
    }
    const mnCore = document.createElementNS(ns, 'feMergeNode');
    mnCore.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mnCore);
    filter.appendChild(morph);
    filter.appendChild(blur);
    filter.appendChild(merge);
    defs.appendChild(filter);
}

/** Packet halo: same stack pattern as cord glow; σ/morph passed in from visual prefs. */
export function appendSoftPacketGlowFilter(defs, id, blurResultId, {
    stdDeviation,
    morphRadius,
    blurLayers,
    viewW = null,
    viewH = null
}) {
    const ns = 'http://www.w3.org/2000/svg';
    const morphResultId = `${blurResultId}Morph`;
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', id);
    if (viewW != null && viewH != null) {
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(viewW));
        filter.setAttribute('height', String(viewH));
    } else {
        filter.setAttribute('x', '-80%');
        filter.setAttribute('y', '-80%');
        filter.setAttribute('width', '260%');
        filter.setAttribute('height', '260%');
    }
    const morph = document.createElementNS(ns, 'feMorphology');
    morph.setAttribute('operator', 'dilate');
    morph.setAttribute('radius', String(morphRadius));
    morph.setAttribute('in', 'SourceGraphic');
    morph.setAttribute('result', morphResultId);
    const blur = document.createElementNS(ns, 'feGaussianBlur');
    blur.setAttribute('in', morphResultId);
    blur.setAttribute('stdDeviation', String(stdDeviation));
    blur.setAttribute('result', blurResultId);
    const merge = document.createElementNS(ns, 'feMerge');
    const nBlur = Math.max(1, Math.min(8, Math.round(blurLayers)));
    for (let b = 0; b < nBlur; b += 1) {
        const mn = document.createElementNS(ns, 'feMergeNode');
        mn.setAttribute('in', blurResultId);
        merge.appendChild(mn);
    }
    const mnCore = document.createElementNS(ns, 'feMergeNode');
    mnCore.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mnCore);
    filter.appendChild(morph);
    filter.appendChild(blur);
    filter.appendChild(merge);
    defs.appendChild(filter);
}

/**
 * SVG filter region uses the painted bounds of filtered content. Pure H/V strokes have a
 * degenerate bbox, so glow clips differently than on diagonals. A zero-alpha fat stroke expands
 * the group bbox without visible contribution (opacity 0 on the line).
 */
export function appendCordFilteredLineGroup(parent, ns, {
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth,
    strokeOpacity = '1',
    filterUrl,
    lineClass,
    padStrokeWidth = CODEX_EDGE_FILTER_PAD_PX,
    edgeFromId,
    edgeToId
}) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('filter', filterUrl);
    if (edgeFromId && edgeToId) {
        g.classList.add('codex-edge-segment-group');
        g.setAttribute('data-codex-edge-from', String(edgeFromId));
        g.setAttribute('data-codex-edge-to', String(edgeToId));
    }
    const pad = document.createElementNS(ns, 'line');
    pad.classList.add('codex-edge-filter-pad');
    pad.setAttribute('x1', String(x1));
    pad.setAttribute('y1', String(y1));
    pad.setAttribute('x2', String(x2));
    pad.setAttribute('y2', String(y2));
    pad.setAttribute('stroke', '#ffffff');
    pad.setAttribute('stroke-opacity', '0');
    pad.setAttribute('stroke-width', String(padStrokeWidth));
    pad.setAttribute('stroke-linecap', 'round');
    pad.setAttribute('aria-hidden', 'true');
    const vis = document.createElementNS(ns, 'line');
    if (lineClass) vis.classList.add(lineClass);
    vis.setAttribute('x1', String(x1));
    vis.setAttribute('y1', String(y1));
    vis.setAttribute('x2', String(x2));
    vis.setAttribute('y2', String(y2));
    vis.setAttribute('stroke', stroke);
    vis.setAttribute('stroke-width', String(strokeWidth));
    vis.setAttribute('stroke-linecap', 'round');
    vis.setAttribute('stroke-opacity', strokeOpacity);
    g.appendChild(pad);
    g.appendChild(vis);
    parent.appendChild(g);
}

/** Unfiltered stroke (sharp core); no glow pad — used for meteor “white-hot” flash on top of filtered packets. */
export function appendCordPlainLineGroup(parent, ns, {
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth,
    strokeOpacity = '1',
    lineClass
}) {
    const g = document.createElementNS(ns, 'g');
    const vis = document.createElementNS(ns, 'line');
    if (lineClass) vis.classList.add(lineClass);
    vis.setAttribute('x1', String(x1));
    vis.setAttribute('y1', String(y1));
    vis.setAttribute('x2', String(x2));
    vis.setAttribute('y2', String(y2));
    vis.setAttribute('stroke', stroke);
    vis.setAttribute('stroke-width', String(strokeWidth));
    vis.setAttribute('stroke-linecap', 'round');
    vis.setAttribute('stroke-opacity', strokeOpacity);
    g.appendChild(vis);
    parent.appendChild(g);
}

/**
 * Same filter stack as appendCordFilteredLineGroup for a filled polygon (junction elbow).
 * Invisible stroked duplicate expands filter bbox like the cord pad line.
 */
export function appendCordFilteredPolygonGroup(parent, ns, {
    pointsStr,
    fill,
    fillOpacity = String(CODEX_CORD_STROKE_OPACITY),
    filterUrl,
    polyClass,
    padStrokeWidth = CODEX_EDGE_FILTER_PAD_PX
}) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('filter', filterUrl);
    const pad = document.createElementNS(ns, 'polygon');
    pad.classList.add('codex-edge-filter-pad');
    pad.setAttribute('points', pointsStr);
    pad.setAttribute('fill', 'none');
    pad.setAttribute('stroke', '#ffffff');
    pad.setAttribute('stroke-opacity', '0');
    pad.setAttribute('stroke-width', String(padStrokeWidth));
    pad.setAttribute('stroke-linejoin', 'round');
    pad.setAttribute('aria-hidden', 'true');
    const vis = document.createElementNS(ns, 'polygon');
    if (polyClass) vis.classList.add(polyClass);
    vis.setAttribute('points', pointsStr);
    vis.setAttribute('fill', fill);
    vis.setAttribute('fill-opacity', fillOpacity);
    vis.setAttribute('stroke', 'none');
    g.appendChild(pad);
    g.appendChild(vis);
    parent.appendChild(g);
    return g;
}
