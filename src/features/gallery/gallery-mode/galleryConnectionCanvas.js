/**
 * Personal connection canvas for Gallery connections panel (separate from main Codex).
 */

import {
    CODEX_FRAME_PATH,
    CODEX_IMG_BASE_PX,
    CODEX_JUNCTION_BASE_PX,
    CODEX_SCALE_MIN,
    resolveCodexNodeScale,
} from '../../codex/codex-nodes/placement/CodexNodePortraitMetrics.js';
import { codexFrameVariantForId } from '../../codex/codex-nodes/placement/CodexNodeVisualHash.js';
import { resolveNpcCanonicalName } from '../../system-interface/interface-shared/npcNameAliases.js';
import { buildFactionDefaultImagePath } from '../../system-interface/interface-filter-menu/images/factionImagePaths.js';
import {
    CODEX_CORD_STROKE_OPACITY,
    CODEX_VISUAL_DEFAULTS,
    CODEX_ZOOM_FACTOR,
} from '../../codex/codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import {
    appendCordFilteredLineGroup,
    appendEdgeGlowFilter,
    appendSoftPacketGlowFilter,
} from '../../codex/codex-node-drawing/svg/CodexCordSvgElements.js';
import { appendCodexEdgeNodeMask } from '../../codex/codex-node-drawing/svg/CodexNodeFrameSvg.js';
import {
    buildGalleryConnectionCanvasModel,
    GALLERY_CONN_CANVAS_WORLD_H,
    GALLERY_CONN_CANVAS_WORLD_W,
    GALLERY_CONN_DEFAULT_DISPLAY,
    snapshotGalleryConnectionCanvas,
} from './galleryConnectionCanvasModel.js';
import { ensureCodexConnectionPayload } from '../../codex/codex-connections/CodexConnectionAccess.js';
import { hexToRgba, loadCodexNodesForGalleryStyle } from './galleryConnectionCanvasCodexStyle.js';
import {
    enrichGalleryCanvasNodeEntity,
    resolveGalleryFactionFilename,
} from './galleryConnectionCanvasEntityResolve.js';
import {
    applyGalleryOctilinearSnapOnDragRelease,
    appendGalleryEdgeAngleLabels,
    appendGalleryJunctionElbows,
    galleryNodeCenterFromEl,
} from './galleryConnectionCanvasOctilinear.js';
import { createGalleryConnectionPacketAnimator } from './galleryConnectionCanvasPackets.js';
import { DOUBLE_RIGHT_MS } from '../../codex/codex-canvas/core/canvasConstants.js';
import {
    appendGalleryEdgeHitLines,
    bindGalleryConnectionCanvasHover,
} from './galleryConnectionCanvasHover.js';
import { GALLERY_CONN_SCALE_MAX } from './galleryConnectionCanvasVisual.js';

const GALLERY_CORD_GLOW_FILTER_ID = 'gallery-conn-cord-violet-glow';
const GALLERY_PACKET_GLOW_FILTER_ID = 'gallery-conn-packet-pink-soft';
const GALLERY_CONN_NODE_ALPHA_MASK_ID = 'gallery-conn-edges-node-alpha-mask';

function formatGalleryScaleForInput(scale) {
    const n = Number(scale);
    if (!Number.isFinite(n)) return '';
    return String(Math.round(n * 1000) / 1000);
}

const ZOOM_MIN = 0.12;
const ZOOM_MAX = 2.5;
const ZOOM_FACTOR = 1.12;

/**
 * @param {string} [prefix]
 */
function genJunctionId(prefix = 'gcc-j') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {number} z
 */
function clampZoom(z) {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/**
 * @param {HTMLElement} el
 */
function nodeCenter(el) {
    return galleryNodeCenterFromEl(el);
}

/**
 * @param {HTMLElement} mountEl
 * @param {{
 *   canEdit?: boolean,
 *   onDirty?: () => void,
 *   onViewParked?: (view: { panX: number, panY: number, zoom: number }) => void,
 * }} [opts]
 */
export function createGalleryConnectionCanvas(mountEl, opts = {}) {
    const canEdit = !!opts.canEdit;
    let model = {
        nodes: [],
        edges: [],
        view: null,
        display: { ...GALLERY_CONN_DEFAULT_DISPLAY },
    };
    let dirty = false;
    let codexNodes = [];
    let selectedIds = new Set();
    let dragState = null;
    let panState = null;
    let viewPanX = 0;
    let viewPanY = 0;
    let viewZoom = 0.4;

    const root = document.createElement('div');
    root.className = 'gallery-conn-canvas';

    const zoomBar = document.createElement('div');
    zoomBar.className = 'gallery-conn-canvas__zoom-bar';
    zoomBar.setAttribute('role', 'group');
    zoomBar.setAttribute('aria-label', 'Canvas zoom');

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.type = 'button';
    zoomOutBtn.className = 'gallery-conn-canvas__zoom-btn';
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Zoom out';
    zoomOutBtn.setAttribute('aria-label', 'Zoom out');

    const zoomInBtn = document.createElement('button');
    zoomInBtn.type = 'button';
    zoomInBtn.className = 'gallery-conn-canvas__zoom-btn';
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom in';
    zoomInBtn.setAttribute('aria-label', 'Zoom in');

    const fitBtn = document.createElement('button');
    fitBtn.type = 'button';
    fitBtn.className = 'gallery-conn-canvas__zoom-btn gallery-conn-canvas__zoom-btn--fit';
    fitBtn.textContent = 'Fit';
    fitBtn.title = 'Fit graph in view';
    fitBtn.setAttribute('aria-label', 'Fit graph in view');

    const parkBtn = document.createElement('button');
    parkBtn.type = 'button';
    parkBtn.className = 'gallery-conn-canvas__zoom-btn gallery-conn-canvas__zoom-btn--park';
    parkBtn.textContent = 'Park';
    parkBtn.title = 'Save current pan and zoom as this canvas default view';
    parkBtn.setAttribute('aria-label', 'Park canvas view');

    zoomBar.append(zoomOutBtn, zoomInBtn, fitBtn, parkBtn);

    const displayBar = document.createElement('div');
    displayBar.className = 'gallery-conn-canvas__display-bar';
    displayBar.setAttribute('role', 'group');
    displayBar.setAttribute('aria-label', 'Canvas display options');

    /** @type {Record<string, HTMLInputElement>} */
    const displayToggles = {};

    function addDisplayToggle(key, label) {
        const lab = document.createElement('label');
        lab.className = 'gallery-conn-canvas__display-toggle';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.addEventListener('change', () => {
            model.display[key] = cb.checked;
            if (key === 'showBreaks') {
                syncBreaksDisplay();
            }
            redrawCanvasVisual();
            if (canEdit) markDirty();
        });
        lab.append(cb, document.createTextNode(` ${label}`));
        displayBar.append(lab);
        displayToggles[key] = cb;
    }

    addDisplayToggle('showAngles', 'Angles');
    addDisplayToggle('showBreaks', 'Breaks');
    addDisplayToggle('showPackets', 'Packets');
    addDisplayToggle('snapAngles', 'Snap');

    const scaleBar = document.createElement('div');
    scaleBar.className = 'gallery-conn-canvas__scale-bar codex-toolbar__row codex-toolbar__row--scale';
    scaleBar.hidden = true;

    const scaleDownBtn = document.createElement('button');
    scaleDownBtn.type = 'button';
    scaleDownBtn.className = 'codex-toolbar__scale-btn codex-toolbar__shrink';
    scaleDownBtn.textContent = '−';
    scaleDownBtn.title = 'Shrink selected node';

    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    scaleInput.className = 'codex-toolbar__scale-input';
    scaleInput.step = '0.05';
    scaleInput.min = String(CODEX_SCALE_MIN);
    scaleInput.max = String(GALLERY_CONN_SCALE_MAX);
    scaleInput.setAttribute('aria-label', 'Selected node scale');
    scaleInput.title = `Node scale ${CODEX_SCALE_MIN}–${GALLERY_CONN_SCALE_MAX}`;

    const scaleUpBtn = document.createElement('button');
    scaleUpBtn.type = 'button';
    scaleUpBtn.className = 'codex-toolbar__scale-btn codex-toolbar__grow';
    scaleUpBtn.textContent = '+';
    scaleUpBtn.title = 'Grow selected node';

    scaleBar.append(scaleDownBtn, scaleInput, scaleUpBtn);

    const toolbar = document.createElement('div');
    toolbar.className = 'gallery-conn-canvas__toolbar';
    toolbar.hidden = !canEdit;

    const breakBtn = document.createElement('button');
    breakBtn.type = 'button';
    breakBtn.className = 'gallery-mode__archive-description-btn gallery-conn-canvas__tool-btn';
    breakBtn.textContent = 'Add break';
    breakBtn.title = 'Insert a junction at the midpoint of a selected cord (or between two selected nodes)';
    breakBtn.disabled = true;

    const deleteBreakBtn = document.createElement('button');
    deleteBreakBtn.type = 'button';
    deleteBreakBtn.className =
        'gallery-mode__archive-description-btn gallery-conn-canvas__tool-btn gallery-conn-canvas__tool-btn--danger';
    deleteBreakBtn.textContent = 'Delete break';
    deleteBreakBtn.title = 'Remove the selected break junction and reconnect its neighbors';
    deleteBreakBtn.disabled = true;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className =
        'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--primary gallery-conn-canvas__tool-btn';
    saveBtn.textContent = 'Save layout';
    saveBtn.hidden = true;

    const hint = document.createElement('span');
    hint.className = 'gallery-conn-canvas__hint';
    hint.textContent = canEdit ? 'Drag background to pan · drag nodes to move' : 'Scroll wheel to zoom';

    toolbar.append(breakBtn, deleteBreakBtn, saveBtn, hint);

    const viewport = document.createElement('div');
    viewport.className = 'gallery-conn-canvas__viewport';
    viewport.setAttribute('tabindex', '0');
    viewport.setAttribute('aria-label', 'Personal connections canvas');

    const world = document.createElement('div');
    world.className = 'gallery-conn-canvas__world';
    world.style.width = `${GALLERY_CONN_CANVAS_WORLD_W}px`;
    world.style.height = `${GALLERY_CONN_CANVAS_WORLD_H}px`;

    hint.textContent = canEdit
        ? 'Drag to pan · click a cord then Add break · right-click a break twice to delete'
        : 'Drag background to pan · wheel to zoom';

    const edgesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    edgesSvg.setAttribute('class', 'gallery-conn-canvas__edges');
    edgesSvg.setAttribute('viewBox', `0 0 ${GALLERY_CONN_CANVAS_WORLD_W} ${GALLERY_CONN_CANVAS_WORLD_H}`);
    edgesSvg.setAttribute('aria-hidden', 'true');

    const edgesHitG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesHitG.setAttribute('class', 'gallery-conn-canvas__edges-hit');

    const edgesLinesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesLinesG.setAttribute('class', 'gallery-conn-canvas__edges-lines');

    const edgesElbowsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesElbowsG.setAttribute('class', 'gallery-conn-canvas__edges-elbows');

    const packetLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    packetLayer.setAttribute('class', 'gallery-conn-canvas__packets codex-edge-packets');

    const edgesMaskedG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesMaskedG.setAttribute('class', 'gallery-conn-canvas__edges-masked codex-edges-masked');
    edgesMaskedG.setAttribute('mask', `url(#${GALLERY_CONN_NODE_ALPHA_MASK_ID})`);
    edgesMaskedG.append(edgesLinesG, edgesElbowsG, packetLayer);

    const edgesDecorG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesDecorG.setAttribute('class', 'gallery-conn-canvas__edges-decor codex-edge-degree-labels');

    edgesSvg.append(edgesHitG, edgesMaskedG, edgesDecorG);

    world.append(edgesSvg);
    viewport.append(world);
    root.append(zoomBar, displayBar, scaleBar, toolbar, viewport);
    mountEl.replaceChildren(root);

    const packetAnimator = createGalleryConnectionPacketAnimator({
        getEdges: () => model.edges,
        getNodes: () => model.nodes,
        getNodeCenter: (id) => {
            const el = nodeEls.get(id);
            return el ? nodeCenter(el) : null;
        },
        isEnabled: () => model.display.showPackets === true,
        packetLayer,
        filterId: GALLERY_PACKET_GLOW_FILTER_ID,
    });

    /** @type {Map<string, HTMLElement>} */
    const nodeEls = new Map();
    let gallerySvgFiltersReady = false;
    let hoverController = null;

    hoverController = bindGalleryConnectionCanvasHover({
        edgesSvg,
        edgesHitG,
        getModel: () => model,
        getNodeEls: () => nodeEls,
        getNodeCenter: (id) => {
            const el = nodeEls.get(id);
            return el ? nodeCenter(el) : null;
        },
        isInteractionBlocked: () => !!dragState || !!panState,
        onHoverCleared: () => {
            restoreSelectedCordHighlight();
        },
    });

    /** @type {{ fromId: string, toId: string } | null} */
    let selectedCord = null;
    /** @type {Map<string, number>} */
    const junctionDeleteLastRightTs = new Map();
    /** @type {{ edge: { fromId: string, toId: string }, startX: number, startY: number } | null} */
    let cordSelectPending = null;

    function restoreSelectedCordHighlight() {
        if (!selectedCord) return;
        const stillThere =
            findEdge(selectedCord.fromId, selectedCord.toId)
            || findEdge(selectedCord.toId, selectedCord.fromId);
        if (!stillThere) {
            selectedCord = null;
            syncToolbar();
            return;
        }
        hoverController?.highlightEdge(selectedCord.fromId, selectedCord.toId);
    }

    function clearSelectedCord() {
        if (!selectedCord) return;
        selectedCord = null;
        hoverController?.clearHover();
        syncToolbar();
    }

    function setSelectedCord(edge) {
        if (!edge?.fromId || !edge?.toId) {
            clearSelectedCord();
            return;
        }
        selectedCord = { fromId: edge.fromId, toId: edge.toId };
        selectedIds = new Set();
        nodeEls.forEach((el) => {
            el.classList.remove('codex-node--selected', 'codex-node--pending-delete');
        });
        junctionDeleteLastRightTs.clear();
        hoverController?.highlightEdge(edge.fromId, edge.toId);
        syncToolbar();
        syncScaleBar();
    }

    function ensureGallerySvgFilters() {
        if (gallerySvgFiltersReady) return;
        const ns = 'http://www.w3.org/2000/svg';
        const defs = document.createElementNS(ns, 'defs');
        const vw = GALLERY_CONN_CANVAS_WORLD_W;
        const vh = GALLERY_CONN_CANVAS_WORLD_H;
        const prefs = CODEX_VISUAL_DEFAULTS;
        appendEdgeGlowFilter(defs, GALLERY_CORD_GLOW_FILTER_ID, 'galleryConnCordBlur', {
            stdDeviation: prefs.cordBlur,
            morphRadius: prefs.cordMorph,
            blurLayers: prefs.cordGlowLayers,
            viewW: vw,
            viewH: vh,
        });
        appendSoftPacketGlowFilter(defs, GALLERY_PACKET_GLOW_FILTER_ID, 'galleryConnPktBlur', {
            stdDeviation: prefs.cordBlur * prefs.packetBlurMult,
            morphRadius: prefs.cordMorph * prefs.packetMorphMult,
            blurLayers: prefs.packetGlowLayers,
            viewW: vw,
            viewH: vh,
        });
        edgesSvg.insertBefore(defs, edgesMaskedG);
        gallerySvgFiltersReady = true;
    }

    function rebuildGalleryEdgeNodeMask() {
        const ns = 'http://www.w3.org/2000/svg';
        const defs = edgesSvg.querySelector('defs');
        if (!defs) return;
        const old = defs.querySelector(`#${GALLERY_CONN_NODE_ALPHA_MASK_ID}`);
        if (old) old.remove();
        appendCodexEdgeNodeMask(
            defs,
            ns,
            GALLERY_CONN_CANVAS_WORLD_W,
            GALLERY_CONN_CANVAS_WORLD_H,
            null,
            {
                getRoot: () => world,
                getDebugUiVisible: () => false,
                maskId: GALLERY_CONN_NODE_ALPHA_MASK_ID,
            },
        );
    }

    function syncModelView() {
        model.view = { panX: viewPanX, panY: viewPanY, zoom: viewZoom };
    }

    function applyViewTransform() {
        viewZoom = clampZoom(viewZoom);
        world.style.transform = `translate(${viewPanX}px, ${viewPanY}px) scale(${viewZoom})`;
        syncModelView();
    }

    function markDirty() {
        dirty = true;
        if (saveBtn) saveBtn.hidden = !canEdit;
        opts.onDirty?.();
    }

    function clearDirty() {
        dirty = false;
        if (saveBtn) saveBtn.hidden = true;
    }

    function viewportCenterClient() {
        const r = viewport.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function markViewDirty() {
        syncModelView();
        if (canEdit) markDirty();
    }

    function zoomAtClient(clientX, clientY, newZoom) {
        const rect = viewport.getBoundingClientRect();
        const lx = clientX - rect.left;
        const ly = clientY - rect.top;
        const worldX = (lx - viewPanX) / viewZoom;
        const worldY = (ly - viewPanY) / viewZoom;
        viewZoom = clampZoom(newZoom);
        viewPanX = lx - worldX * viewZoom;
        viewPanY = ly - worldY * viewZoom;
        applyViewTransform();
        markViewDirty();
    }

    function fitViewToViewport() {
        const vpW = viewport.clientWidth || 280;
        const vpH = viewport.clientHeight || 240;
        viewZoom = clampZoom(Math.min(vpW / GALLERY_CONN_CANVAS_WORLD_W, vpH / GALLERY_CONN_CANVAS_WORLD_H) * 0.9);
        const scaledW = GALLERY_CONN_CANVAS_WORLD_W * viewZoom;
        const scaledH = GALLERY_CONN_CANVAS_WORLD_H * viewZoom;
        viewPanX = (vpW - scaledW) / 2;
        viewPanY = (vpH - scaledH) / 2;
        applyViewTransform();
    }

    function restoreOrFitView(savedView) {
        if (
            savedView
            && Number.isFinite(Number(savedView.zoom))
            && Number(savedView.zoom) > 0
        ) {
            viewPanX = Number(savedView.panX) || 0;
            viewPanY = Number(savedView.panY) || 0;
            viewZoom = clampZoom(Number(savedView.zoom));
            applyViewTransform();
            syncParkButtonState();
            return;
        }
        fitViewToViewport();
        syncParkButtonState();
    }

    function syncParkButtonState() {
        const v = model.view;
        const hasParkedView =
            v
            && Number.isFinite(Number(v.zoom))
            && Number(v.zoom) > 0;
        const matchesParked =
            hasParkedView
            && Math.abs(viewPanX - (Number(v.panX) || 0)) < 1
            && Math.abs(viewPanY - (Number(v.panY) || 0)) < 1
            && Math.abs(viewZoom - Number(v.zoom)) < 0.002;
        parkBtn.classList.toggle('gallery-conn-canvas__zoom-btn--parked', matchesParked);
        parkBtn.setAttribute('aria-pressed', matchesParked ? 'true' : 'false');
    }

    function parkCanvasView() {
        syncModelView();
        syncParkButtonState();
        opts.onViewParked?.({
            panX: viewPanX,
            panY: viewPanY,
            zoom: viewZoom,
        });
        if (canEdit) {
            markDirty();
        }
    }

    function findEdge(fromId, toId) {
        return model.edges.find((e) => e.fromId === fromId && e.toId === toId) || null;
    }

    function syncDisplayControls() {
        Object.keys(displayToggles).forEach((key) => {
            if (displayToggles[key]) {
                displayToggles[key].checked = model.display[key] !== false;
            }
        });
    }

    function syncScaleBar() {
        if (!canEdit) {
            scaleBar.hidden = true;
            return;
        }
        const one = selectedIds.size === 1 ? Array.from(selectedIds)[0] : '';
        const node = one ? model.nodes.find((n) => n.id === one) : null;
        const show = !!(node && node.kind !== 'junction');
        scaleBar.hidden = !show;
        if (!show) {
            scaleInput.value = '';
            scaleInput.disabled = true;
            scaleDownBtn.disabled = true;
            scaleUpBtn.disabled = true;
            return;
        }
        const el = nodeEls.get(node.id);
        const scale = typeof node.scale === 'number'
            ? node.scale
            : parseFloat(el?.dataset.codexScale) || resolveCodexNodeScale(node.entityKind || node.kind, undefined);
        scaleInput.disabled = false;
        scaleDownBtn.disabled = false;
        scaleUpBtn.disabled = false;
        scaleInput.value = formatGalleryScaleForInput(scale);
    }

    function syncBreaksDisplay() {
        root.classList.toggle('gallery-conn-canvas--breaks-hidden', model.display.showBreaks === false);
    }

    function syncToolbar() {
        if (!canEdit) return;
        const breaksVisible = model.display.showBreaks !== false;
        const pairSelected = selectedIds.size === 2;
        const cordSelected = !!selectedCord;
        breakBtn.disabled = (!pairSelected && !cordSelected) || !breaksVisible;
        let selectedJunction = false;
        selectedIds.forEach((id) => {
            const n = model.nodes.find((rec) => rec.id === id);
            if (n?.kind === 'junction') selectedJunction = true;
        });
        deleteBreakBtn.disabled = !selectedJunction || !breaksVisible;
    }

    function setSelection(ids) {
        selectedIds = new Set(ids);
        if (selectedIds.size > 0) {
            selectedCord = null;
        }
        nodeEls.forEach((el, id) => {
            el.classList.toggle('codex-node--selected', selectedIds.has(id));
            if (!selectedIds.has(id)) el.classList.remove('codex-node--pending-delete');
        });
        syncToolbar();
        syncScaleBar();
        if (selectedCord) restoreSelectedCordHighlight();
    }

    function redrawCanvasVisual() {
        ensureGallerySvgFilters();
        rebuildGalleryEdgeNodeMask();
        hoverController?.clearHover();
        while (edgesLinesG.firstChild) edgesLinesG.removeChild(edgesLinesG.firstChild);
        while (edgesElbowsG.firstChild) edgesElbowsG.removeChild(edgesElbowsG.firstChild);
        while (edgesDecorG.firstChild) edgesDecorG.removeChild(edgesDecorG.firstChild);

        const ns = 'http://www.w3.org/2000/svg';
        const prefs = CODEX_VISUAL_DEFAULTS;
        const cordFilterUrl = `url(#${GALLERY_CORD_GLOW_FILTER_ID})`;

        appendGalleryEdgeHitLines(edgesHitG, ns, model.edges, (id) => {
            const el = nodeEls.get(id);
            return el ? nodeCenter(el) : null;
        });

        for (let i = 0; i < model.edges.length; i += 1) {
            const edge = model.edges[i];
            const elFrom = nodeEls.get(edge.fromId);
            const elTo = nodeEls.get(edge.toId);
            if (!elFrom || !elTo) continue;
            const p0 = nodeCenter(elFrom);
            const p1 = nodeCenter(elTo);

            appendCordFilteredLineGroup(edgesLinesG, ns, {
                x1: p0.x,
                y1: p0.y,
                x2: p1.x,
                y2: p1.y,
                stroke: prefs.cordColor,
                strokeWidth: prefs.cordThickness,
                strokeOpacity: String(CODEX_CORD_STROKE_OPACITY),
                filterUrl: cordFilterUrl,
                lineClass: 'codex-edge-segment',
                edgeFromId: edge.fromId,
                edgeToId: edge.toId,
            });
        }

        if (model.display.showAngles) {
            appendGalleryEdgeAngleLabels(edgesDecorG, model.edges, nodeEls);
            appendGalleryJunctionElbows(edgesElbowsG, model.edges, nodeEls, cordFilterUrl);
        } else {
            appendGalleryJunctionElbows(edgesElbowsG, model.edges, nodeEls, cordFilterUrl);
        }

        packetAnimator.syncPacketState(model.edges);
        restoreSelectedCordHighlight();
    }

    /**
     * @param {HTMLElement} el
     * @param {object} node
     */
    function clampGalleryNodeScale(raw, kind) {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            return Math.min(resolveCodexNodeScale(kind, undefined), GALLERY_CONN_SCALE_MAX);
        }
        return Math.max(CODEX_SCALE_MIN, Math.min(GALLERY_CONN_SCALE_MAX, n));
    }

    function applyNodeScale(el, node) {
        const kind = node.kind === 'junction' ? 'junction' : node.entityKind || node.kind;
        const scale = clampGalleryNodeScale(node.scale, kind);
        node.scale = scale;
        const basePx = node.kind === 'junction' ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX;
        const px = basePx * scale;
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
        el.dataset.codexScale = String(scale);
    }

    /**
     * @param {object} node
     */
    function createNodeElement(node) {
        const el = document.createElement('div');
        el.className = 'codex-node gallery-conn-canvas__node';
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.dataset.codexNodeId = node.id;
        el.dataset.codexKind = node.kind;

        if (node.bgColor) el.dataset.codexBgColor = node.bgColor;

        if (node.kind === 'junction') {
            el.classList.add('codex-node--junction');
            const dot = document.createElement('div');
            dot.className = 'codex-node__junction';
            dot.setAttribute('aria-hidden', 'true');
            el.appendChild(dot);
            applyNodeScale(el, node);
            return el;
        }

        el.classList.add('codex-node--simplified');
        const frameVariant = codexFrameVariantForId(node.id);
        el.dataset.codexFrameVariant = String(frameVariant);
        el.style.setProperty('--codex-hex-rotation', '0deg');

        const kind = node.entityKind || node.kind;
        const name = node.entityName || '';
        let imgSrc = '';
        if (kind === 'hero') {
            const key = node.portraitKey || name;
            el.dataset.codexHero = key;
            imgSrc = `src/assets/images/Filters/Heroes/${encodeURIComponent(key)}.png`;
        } else if (kind === 'npc') {
            const key = resolveNpcCanonicalName(node.portraitKey || name);
            el.dataset.codexNpc = key;
            imgSrc = `src/assets/images/Filters/NPCs/${encodeURIComponent(key)}.png`;
        } else {
            const ff = node.factionFilename || resolveGalleryFactionFilename(name);
            const display = node.factionDisplay || name;
            el.dataset.codexFactionDisplay = display;
            el.dataset.codexFactionFile = ff || name;
            imgSrc = ff
                ? buildFactionDefaultImagePath(ff)
                : 'src/assets/images/Icons/Filter Icons/Faction Icon.png';
        }

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'codex-node__img-wrapper';

        const img = document.createElement('img');
        img.className = 'codex-node__img';
        img.draggable = false;
        img.decoding = 'async';
        img.alt = name;
        if (kind === 'faction') {
            const ffKey = node.factionFilename || resolveGalleryFactionFilename(name) || name;
            img.dataset.bioPortraitCategory = 'factions';
            img.dataset.bioPortraitKey = ffKey;
        }
        img.src = imgSrc;
        img.onerror = () => {
            img.onerror = null;
            if (kind === 'faction') {
                img.src = 'src/assets/images/Icons/Filter Icons/Faction Icon.png';
            }
            img.style.opacity = '0.35';
        };

        const bg = document.createElement('div');
        bg.className = 'codex-node__bg';
        bg.style.background = hexToRgba(node.bgColor || '#021887', 0.5);

        imgWrapper.append(bg, img);

        const frame = document.createElement('img');
        frame.className = 'codex-node__frame';
        frame.alt = '';
        frame.draggable = false;
        frame.decoding = 'async';
        frame.setAttribute('aria-hidden', 'true');
        frame.src = `${CODEX_FRAME_PATH}${frameVariant}.png`;

        el.append(imgWrapper, frame);
        applyNodeScale(el, node);
        return el;
    }

    function bindNodeInteraction(el, nodeId) {
        if (!canEdit) return;

        el.addEventListener('pointerenter', () => {
            hoverController?.onNodePointerEnter(nodeId);
        });
        el.addEventListener('pointerleave', (ev) => {
            hoverController?.onNodePointerLeave(ev, el);
        });

        el.addEventListener('contextmenu', (ev) => {
            const node = model.nodes.find((n) => n.id === nodeId);
            if (!node || node.kind !== 'junction') return;
            ev.preventDefault();
            ev.stopPropagation();
            armOrDeleteJunctionByRightClick(el, nodeId);
        }, true);

        el.addEventListener('pointerdown', (ev) => {
            if (ev.button === 0) {
                junctionDeleteLastRightTs.delete(nodeId);
                el.classList.remove('codex-node--pending-delete');
            }
            if (ev.button !== 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            el.setPointerCapture(ev.pointerId);

            const node = model.nodes.find((n) => n.id === nodeId);
            if (!node) return;

            dragState = {
                nodeId,
                startX: ev.clientX,
                startY: ev.clientY,
                origX: node.x,
                origY: node.y,
                moved: false,
            };
        });

        el.addEventListener('pointermove', (ev) => {
            if (!dragState || dragState.nodeId !== nodeId) return;
            const dx = (ev.clientX - dragState.startX) / viewZoom;
            const dy = (ev.clientY - dragState.startY) / viewZoom;
            if (Math.abs(dx) + Math.abs(dy) > 2) dragState.moved = true;

            const node = model.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            node.x = Math.max(0, Math.min(GALLERY_CONN_CANVAS_WORLD_W - 40, dragState.origX + dx));
            node.y = Math.max(0, Math.min(GALLERY_CONN_CANVAS_WORLD_H - 40, dragState.origY + dy));
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
            redrawCanvasVisual();
        });

        el.addEventListener('pointerup', (ev) => {
            if (!dragState || dragState.nodeId !== nodeId) return;
            el.releasePointerCapture(ev.pointerId);

            if (dragState.moved) {
                if (model.display.snapAngles) {
                    applyGalleryOctilinearSnapOnDragRelease(
                        new Set([nodeId]),
                        model.edges,
                        nodeEls,
                        model.nodes,
                        GALLERY_CONN_CANVAS_WORLD_W,
                        GALLERY_CONN_CANVAS_WORLD_H,
                    );
                    const n = model.nodes.find((rec) => rec.id === nodeId);
                    const nel = nodeEls.get(nodeId);
                    if (n && nel) {
                        n.x = parseFloat(nel.style.left) || n.x;
                        n.y = parseFloat(nel.style.top) || n.y;
                    }
                }
                redrawCanvasVisual();
                markDirty();
            } else {
                const next = new Set(selectedIds);
                if (ev.shiftKey) {
                    if (next.has(nodeId)) next.delete(nodeId);
                    else {
                        if (next.size >= 2) next.clear();
                        next.add(nodeId);
                    }
                } else {
                    next.clear();
                    next.add(nodeId);
                }
                setSelection(Array.from(next));
            }
            dragState = null;
        });

        el.addEventListener('click', (ev) => {
            ev.stopPropagation();
        });
    }

    function renderNodes() {
        nodeEls.forEach((el) => el.remove());
        nodeEls.clear();

        for (let i = 0; i < model.nodes.length; i += 1) {
            const node = model.nodes[i];
            enrichGalleryCanvasNodeEntity(node, codexNodes);
            const el = createNodeElement(node);
            world.appendChild(el);
            nodeEls.set(node.id, el);
            bindNodeInteraction(el, node.id);
        }
        syncBreaksDisplay();
        redrawCanvasVisual();
    }

    function nudgeSelectedNodeScale(factor) {
        if (!canEdit || selectedIds.size !== 1) return;
        const id = Array.from(selectedIds)[0];
        const node = model.nodes.find((n) => n.id === id);
        const el = nodeEls.get(id);
        if (!node || !el || node.kind === 'junction') return;
        const cur = parseFloat(el.dataset.codexScale) || node.scale || 1;
        const next = Math.max(CODEX_SCALE_MIN, Math.min(GALLERY_CONN_SCALE_MAX, cur * factor));
        node.scale = next;
        applyNodeScale(el, node);
        redrawCanvasVisual();
        markDirty();
        syncScaleBar();
    }

    function setSelectedNodeAbsoluteScale(raw) {
        if (!canEdit || selectedIds.size !== 1) return;
        const id = Array.from(selectedIds)[0];
        const node = model.nodes.find((n) => n.id === id);
        const el = nodeEls.get(id);
        if (!node || !el || node.kind === 'junction') return;
        const next = Math.max(CODEX_SCALE_MIN, Math.min(GALLERY_CONN_SCALE_MAX, Number(raw) || 1));
        node.scale = next;
        applyNodeScale(el, node);
        redrawCanvasVisual();
        markDirty();
        syncScaleBar();
    }

    /**
     * @param {{ fromId: string, toId: string }} edge
     */
    function insertBreakOnEdge(edge) {
        if (!canEdit || !edge || model.display.showBreaks === false) return false;
        const elFrom = nodeEls.get(edge.fromId);
        const elTo = nodeEls.get(edge.toId);
        if (!elFrom || !elTo) return false;

        const cA = nodeCenter(elFrom);
        const cB = nodeCenter(elTo);
        const scale = resolveCodexNodeScale('junction', undefined);
        const dim = CODEX_JUNCTION_BASE_PX * scale;
        const mx = (cA.x + cB.x) / 2;
        const my = (cA.y + cB.y) / 2;
        const jx = Math.max(0, Math.min(GALLERY_CONN_CANVAS_WORLD_W - dim, mx - dim / 2));
        const jy = Math.max(0, Math.min(GALLERY_CONN_CANVAS_WORLD_H - dim, my - dim / 2));
        const jId = genJunctionId();

        model.nodes.push({
            id: jId,
            kind: 'junction',
            role: null,
            entityKind: null,
            entityName: null,
            x: jx,
            y: jy,
            scale,
        });

        model.edges = model.edges.filter(
            (e) => !(e.fromId === edge.fromId && e.toId === edge.toId),
        );
        model.edges.push({ fromId: edge.fromId, toId: jId });
        model.edges.push({ fromId: jId, toId: edge.toId });

        selectedCord = null;
        setSelection([jId]);
        renderNodes();
        markDirty();
        return true;
    }

    function insertBreakBetweenSelected() {
        if (selectedCord) {
            const edge =
                findEdge(selectedCord.fromId, selectedCord.toId)
                || findEdge(selectedCord.toId, selectedCord.fromId)
                || selectedCord;
            if (insertBreakOnEdge(edge)) {
                window.updateAppStatus?.('Break inserted on selected cord.', 'success');
            }
            return;
        }
        if (selectedIds.size !== 2) return;
        const ids = Array.from(selectedIds);
        const edge = findEdge(ids[0], ids[1]) || findEdge(ids[1], ids[0]) || null;
        if (!edge) {
            window.updateAppStatus?.('Select two nodes that are directly connected, or click a cord.', 'warning');
            return;
        }
        if (insertBreakOnEdge(edge)) {
            window.updateAppStatus?.('Break inserted between selected nodes.', 'success');
        }
    }

    /**
     * @param {string} jId
     */
    function removeJunctionAndBridge(jId) {
        const incoming = model.edges.filter((e) => e.toId === jId);
        const outgoing = model.edges.filter((e) => e.fromId === jId);
        model.edges = model.edges.filter((e) => e.fromId !== jId && e.toId !== jId);
        for (let a = 0; a < incoming.length; a += 1) {
            for (let b = 0; b < outgoing.length; b += 1) {
                const fromId = incoming[a].fromId;
                const toId = outgoing[b].toId;
                if (!fromId || !toId || fromId === toId) continue;
                if (findEdge(fromId, toId) || findEdge(toId, fromId)) continue;
                model.edges.push({ fromId, toId });
            }
        }
        model.nodes = model.nodes.filter((n) => n.id !== jId);
        junctionDeleteLastRightTs.delete(jId);
    }

    /**
     * Remove selected junction(s), bridging their neighbors like Codex splice.
     */
    function deleteSelectedBreaks() {
        if (!canEdit || model.display.showBreaks === false) return;
        const junctionIds = Array.from(selectedIds).filter((id) => {
            const n = model.nodes.find((rec) => rec.id === id);
            return n?.kind === 'junction';
        });
        if (!junctionIds.length) {
            window.updateAppStatus?.('Select a break junction to delete.', 'warning');
            return;
        }

        for (let i = 0; i < junctionIds.length; i += 1) {
            removeJunctionAndBridge(junctionIds[i]);
        }

        setSelection([]);
        renderNodes();
        markDirty();
        window.updateAppStatus?.(
            junctionIds.length === 1 ? 'Break deleted.' : `${junctionIds.length} breaks deleted.`,
            'success',
        );
    }

    /**
     * Codex-style double right-click delete for a single break junction.
     * @param {HTMLElement} el
     * @param {string} nodeId
     */
    function armOrDeleteJunctionByRightClick(el, nodeId) {
        const node = model.nodes.find((n) => n.id === nodeId);
        if (!node || node.kind !== 'junction') return;
        const now = Date.now();
        const prevTs = junctionDeleteLastRightTs.get(nodeId) || 0;
        if (prevTs > 0 && now - prevTs < DOUBLE_RIGHT_MS) {
            junctionDeleteLastRightTs.delete(nodeId);
            el.classList.remove('codex-node--pending-delete');
            removeJunctionAndBridge(nodeId);
            setSelection([]);
            renderNodes();
            markDirty();
            window.updateAppStatus?.('Break deleted.', 'success');
            return;
        }
        nodeEls.forEach((other) => {
            if (other !== el) other.classList.remove('codex-node--pending-delete');
        });
        el.classList.add('codex-node--pending-delete');
        junctionDeleteLastRightTs.set(nodeId, now);
        setSelection([nodeId]);
    }

    /**
     * @param {Element|null|undefined} target
     * @returns {{ fromId: string, toId: string }|null}
     */
    function edgeFromHitTarget(target) {
        if (!(target instanceof Element)) return null;
        const hit = target.classList.contains('gallery-conn-canvas__edge-hit')
            ? target
            : target.closest?.('.gallery-conn-canvas__edge-hit');
        if (!hit) return null;
        const fromId = hit.getAttribute('data-codex-edge-from') || '';
        const toId = hit.getAttribute('data-codex-edge-to') || '';
        if (!fromId || !toId) return null;
        return findEdge(fromId, toId) || findEdge(toId, fromId) || { fromId, toId };
    }

    scaleDownBtn.addEventListener('click', () => nudgeSelectedNodeScale(1 / CODEX_ZOOM_FACTOR));
    scaleUpBtn.addEventListener('click', () => nudgeSelectedNodeScale(CODEX_ZOOM_FACTOR));
    scaleInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            scaleInput.blur();
        }
    });
    scaleInput.addEventListener('change', () => {
        if (scaleInput.disabled) return;
        const v = String(scaleInput.value || '').trim();
        if (v === '') {
            syncScaleBar();
            return;
        }
        setSelectedNodeAbsoluteScale(v);
    });

    breakBtn.addEventListener('click', insertBreakBetweenSelected);
    deleteBreakBtn.addEventListener('click', deleteSelectedBreaks);

    zoomOutBtn.addEventListener('click', () => {
        const c = viewportCenterClient();
        zoomAtClient(c.x, c.y, viewZoom / ZOOM_FACTOR);
    });

    zoomInBtn.addEventListener('click', () => {
        const c = viewportCenterClient();
        zoomAtClient(c.x, c.y, viewZoom * ZOOM_FACTOR);
    });

    fitBtn.addEventListener('click', () => {
        fitViewToViewport();
        markViewDirty();
        syncParkButtonState();
    });

    parkBtn.addEventListener('click', () => {
        parkCanvasView();
    });

    viewport.addEventListener(
        'wheel',
        (ev) => {
            ev.preventDefault();
            const factor = ev.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
            zoomAtClient(ev.clientX, ev.clientY, viewZoom * factor);
        },
        { passive: false },
    );

    viewport.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest('.codex-node')) return;

        const cordEdge =
            canEdit && model.display.showBreaks !== false
                ? edgeFromHitTarget(/** @type {Element} */ (ev.target))
                : null;
        if (cordEdge) {
            cordSelectPending = {
                edge: cordEdge,
                startX: ev.clientX,
                startY: ev.clientY,
            };
            viewport.setPointerCapture(ev.pointerId);
            return;
        }

        viewport.setPointerCapture(ev.pointerId);
        panState = {
            startX: ev.clientX,
            startY: ev.clientY,
            origPanX: viewPanX,
            origPanY: viewPanY,
            moved: false,
        };
        if (canEdit) {
            setSelection([]);
            clearSelectedCord();
        }
    });

    viewport.addEventListener('pointermove', (ev) => {
        if (cordSelectPending) {
            const dx = ev.clientX - cordSelectPending.startX;
            const dy = ev.clientY - cordSelectPending.startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) {
                panState = {
                    startX: cordSelectPending.startX,
                    startY: cordSelectPending.startY,
                    origPanX: viewPanX,
                    origPanY: viewPanY,
                    moved: true,
                };
                cordSelectPending = null;
                viewPanX = panState.origPanX + dx;
                viewPanY = panState.origPanY + dy;
                applyViewTransform();
            }
            return;
        }
        if (!panState) return;
        const dx = ev.clientX - panState.startX;
        const dy = ev.clientY - panState.startY;
        if (Math.abs(dx) + Math.abs(dy) > 2) panState.moved = true;
        viewPanX = panState.origPanX + dx;
        viewPanY = panState.origPanY + dy;
        applyViewTransform();
    });

    viewport.addEventListener('pointerup', (ev) => {
        if (cordSelectPending) {
            try {
                viewport.releasePointerCapture(ev.pointerId);
            } catch (_) {
                /* ignore */
            }
            const pending = cordSelectPending;
            cordSelectPending = null;
            setSelectedCord(pending.edge);
            return;
        }
        if (!panState) return;
        viewport.releasePointerCapture(ev.pointerId);
        if (panState.moved) markViewDirty();
        panState = null;
        syncParkButtonState();
    });

    function syncModelFromDom() {
        nodeEls.forEach((el, id) => {
            const node = model.nodes.find((n) => n.id === id);
            if (!node) return;
            node.x = parseFloat(el.style.left) || node.x;
            node.y = parseFloat(el.style.top) || node.y;
            const scale = parseFloat(el.dataset.codexScale);
            if (Number.isFinite(scale)) node.scale = scale;
        });
    }

    return {
        /**
         * @param {object|null} entry
         * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
         * @param {string} displayName
         * @param {string} filterKey
         * @param {object|null|undefined} savedCanvas
         */
        async load(entry, category, displayName, filterKey, savedCanvas) {
            codexNodes = await loadCodexNodesForGalleryStyle();
            let codexGraph = null;
            try {
                const payload = await ensureCodexConnectionPayload();
                if (payload?.nodes?.length) {
                    codexGraph = {
                        nodes: payload.nodes,
                        edges: payload.edges || [],
                        connections: payload.connections || [],
                    };
                }
            } catch (err) {
                console.warn('[gallery] Codex graph for neighbor cords failed:', err);
            }
            model = buildGalleryConnectionCanvasModel(
                entry,
                category,
                displayName,
                filterKey,
                savedCanvas,
                codexGraph,
            );
            if (!model.display) {
                model.display = { ...GALLERY_CONN_DEFAULT_DISPLAY };
            }
            syncDisplayControls();
            syncBreaksDisplay();
            clearDirty();
            setSelection([]);
            renderNodes();
            packetAnimator.start();
            requestAnimationFrame(() => {
                restoreOrFitView(model.view);
            });
        },

        refitView() {
            fitViewToViewport();
            syncParkButtonState();
        },

        destroy() {
            packetAnimator.stop();
            mountEl.replaceChildren();
            nodeEls.clear();
            dragState = null;
            panState = null;
            cordSelectPending = null;
            selectedCord = null;
            junctionDeleteLastRightTs.clear();
        },

        isDirty() {
            return dirty;
        },

        clearDirtyState() {
            clearDirty();
        },

        collectSnapshot() {
            syncModelFromDom();
            syncModelView();
            return snapshotGalleryConnectionCanvas(model);
        },

        getSaveButton() {
            return saveBtn;
        },

        hasContent() {
            return model.nodes.length > 1 || model.edges.length > 0;
        },
    };
}
