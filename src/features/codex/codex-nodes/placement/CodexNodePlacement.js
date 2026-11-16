/** CodexNodePlacement — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { generateNodeId, heroNamesLooselyEqualCodex } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { npcNamesLooselyEqual } from '../../../system-interface/interface-shared/npcNameAliases.js';
import { applyLocationFlagBioHighlight, getEventManager, playSoundEffect, updateAppStatus } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { CODEX_FRAME_PATH, CODEX_IMG_BASE_PX, CODEX_JUNCTION_BASE_PX, CODEX_SCALE_MAX, CODEX_SCALE_MIN, codexCountryFlagSrc, normalizeCodexCountryKey, resolveCodexNodeScale } from './CodexNodePortraitMetrics.js';
import { codexFrameVariantForId, codexHexRotationDegreesForId } from './CodexNodeVisualHash.js';
import { observeCodexImage } from '../../codex-node-drawing/lazy-images/CodexImageLazyLoad.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { animateCodexNodeHoverMaskScale, readCodexNodeHoverVisualScale } from '../../codex-node-drawing/svg/CodexNodeFrameSvg.js';
import { scheduleUpdateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS } from '../../codex-canvas/core/canvasConstants.js';
import {
    isCodexNodeBgDefault,
    resolveCodexNodeBgColor,
} from './CodexNodeBgColor.js';
import { buildFactionDefaultImagePath } from '../../../system-interface/interface-filter-menu/images/factionImagePaths.js';

function findCodexDuplicatePortraitNodeId(kind, heroName, faction, countryKey) {
    if (!Array.isArray(s.codexAllNodes)) return '';
    if (kind === 'hero' && String(heroName || '').trim()) {
        const t = String(heroName).trim();
        for (let i = 0; i < s.codexAllNodes.length; i += 1) {
            const n = s.codexAllNodes[i];
            if (n && n.kind === 'hero' && heroNamesLooselyEqualCodex(n.heroName, t)) return n.id;
        }
    } else if (kind === 'npc' && String(heroName || '').trim()) {
        const t = String(heroName).trim();
        for (let j = 0; j < s.codexAllNodes.length; j += 1) {
            const n = s.codexAllNodes[j];
            if (n && n.kind === 'npc' && npcNamesLooselyEqual(n.npcName, t)) return n.id;
        }
    } else if (kind === 'faction' && faction && faction.filename) {
        const fn = String(faction.filename).trim();
        for (let k = 0; k < s.codexAllNodes.length; k += 1) {
            const n = s.codexAllNodes[k];
            if (n && n.kind === 'faction' && String(n.factionFilename || '').trim() === fn) return n.id;
        }
    } else if (kind === 'country' && countryKey) {
        const ck = String(countryKey).trim();
        for (let m = 0; m < s.codexAllNodes.length; m += 1) {
            const n = s.codexAllNodes[m];
            if (n && n.kind === 'country' && String(n.countryKey || '').trim() === ck) return n.id;
        }
    }
    return '';
}





function applyNodeScale(el, scale, skipRedraw, opts = {}) {
    const nodeScale = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(scale) || 1));
    el.dataset.codexScale = String(nodeScale);
    const junction = el.classList.contains('codex-node--junction');
    const simplified = el.classList.contains('codex-node--simplified');
    const basePx = junction ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX;
    const px = basePx * nodeScale;
    if (junction || simplified) {
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
    }
    if (!opts.skipLayoutSync) {
        const nodeId = el.dataset.codexNodeId;
        if (nodeId) {
            const nodeObj = s.codexNodeLayoutById instanceof Map
                ? s.codexNodeLayoutById.get(nodeId)
                : null;
            if (nodeObj) nodeObj.scale = nodeScale;
        }
    }
    if (!skipRedraw) redrawCodexEdges();
}

/** @type {HTMLElement|null} */
let portraitNodeTemplate = null;
/** @type {HTMLElement|null} */
let junctionNodeTemplate = null;

function getPortraitNodeTemplate() {
    if (portraitNodeTemplate) return portraitNodeTemplate;
    const el = document.createElement('div');
    el.className = 'codex-node codex-node--simplified';
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'codex-node__img-wrapper';
    const img = document.createElement('img');
    img.className = 'codex-node__img';
    img.draggable = false;
    img.decoding = 'async';
    const bg = document.createElement('div');
    bg.className = 'codex-node__bg';
    imgWrapper.append(img, bg);
    const frame = document.createElement('img');
    frame.className = 'codex-node__frame';
    frame.alt = '';
    frame.draggable = false;
    frame.decoding = 'async';
    frame.setAttribute('aria-hidden', 'true');
    el.append(imgWrapper, frame);
    portraitNodeTemplate = el;
    return el;
}

function getJunctionNodeTemplate() {
    if (junctionNodeTemplate) return junctionNodeTemplate;
    const el = document.createElement('div');
    el.className = 'codex-node codex-node--junction';
    const dot = document.createElement('div');
    dot.className = 'codex-node__junction';
    dot.setAttribute('aria-hidden', 'true');
    el.appendChild(dot);
    junctionNodeTemplate = el;
    return el;
}

function armCodexNodeEnterFade(el) {
    if (!(el instanceof HTMLElement)) return;
    el.classList.add('codex-node--enter');
    const clear = () => {
        el.classList.remove('codex-node--enter');
        el.removeEventListener('animationend', clear);
    };
    el.addEventListener('animationend', clear);
}

function createCodexNodeElement(x, y, kind, heroName, faction, opts = {}) {
    const fromSaved = opts.fromSaved === true;
    const skipImageObserve = opts.skipImageObserve === true;
    const scaleOpts = fromSaved ? { skipLayoutSync: true } : undefined;

    if (kind === 'junction') {
        const el = /** @type {HTMLElement} */ (getJunctionNodeTemplate().cloneNode(true));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.zIndex = String(++s.nodeZ);
        el.dataset.codexNodeId = opts.id || generateNodeId();
        el.dataset.codexKind = 'junction';
        if (!opts.skipEnterFade) armCodexNodeEnterFade(el);
        applyNodeScale(el, resolveCodexNodeScale('junction', opts.scale), true, scaleOpts);
        ensureCodexNodeInteractionDelegation();
        return el;
    }

    const el = /** @type {HTMLElement} */ (getPortraitNodeTemplate().cloneNode(true));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String(++s.nodeZ);
    el.dataset.codexNodeId = opts.id || generateNodeId();
    el.dataset.codexKind = kind;
    if (!opts.skipEnterFade) armCodexNodeEnterFade(el);

    if (!isCodexNodeBgDefault(opts.bgColor)) {
        el.dataset.codexBgColor = resolveCodexNodeBgColor(opts.bgColor);
    }
    if (kind === 'hero') {
        el.dataset.codexHero = heroName || '';
    } else if (kind === 'npc') {
        el.dataset.codexNpc = heroName || '';
    } else if (kind === 'country') {
        const ck = normalizeCodexCountryKey(opts.countryKey);
        el.dataset.codexCountryKey = ck || '';
    } else if (faction) {
        el.dataset.codexFactionFile = faction.filename || '';
        el.dataset.codexFactionDisplay = faction.displayName || faction.filename || '';
    }

    const nid = el.dataset.codexNodeId;
    const frameVariant = codexFrameVariantForId(nid);
    const hexRotationDeg = codexHexRotationDegreesForId(nid);
    el.dataset.codexFrameVariant = String(frameVariant);
    el.dataset.codexHexRotation = String(hexRotationDeg);
    el.style.setProperty('--codex-hex-rotation', `${hexRotationDeg}deg`);

    let imgSrc = '';
    let imgAlt = '';
    if (kind === 'hero') {
        imgSrc = `src/assets/images/Filters/Heroes/${encodeURIComponent(heroName)}.png`;
        imgAlt = heroName || 'Hero';
    } else if (kind === 'npc') {
        imgSrc = `src/assets/images/Filters/NPCs/${encodeURIComponent(heroName)}.png`;
        imgAlt = heroName || 'NPC';
    } else if (kind === 'country') {
        const ck = el.dataset.codexCountryKey || '';
        imgSrc = codexCountryFlagSrc(ck);
        imgAlt = ck || 'Country';
    } else {
        imgSrc = buildFactionDefaultImagePath(faction.filename);
        imgAlt = faction.displayName || '';
    }

    const imgWrapper = /** @type {HTMLElement} */ (el.firstElementChild);
    const img = /** @type {HTMLImageElement} */ (imgWrapper.firstElementChild);
    const bg = /** @type {HTMLElement} */ (imgWrapper.lastElementChild);
    const frame = /** @type {HTMLImageElement} */ (el.lastElementChild);

    // Frame variants are shared (3) — browser cache hits after the first of each.
    frame.src = `${CODEX_FRAME_PATH}${frameVariant}.png`;
    img.alt = imgAlt;
    img.onerror = () => {
        img.style.opacity = '0.35';
        el.classList.remove('codex-node--portrait-loading');
    };

    el.classList.add('codex-node--portrait-loading');
    if (opts.skipLazyLoad) {
        img.src = imgSrc;
        const clearLoading = () => el.classList.remove('codex-node--portrait-loading');
        img.addEventListener('load', clearLoading, { once: true });
        if (img.complete && img.naturalWidth > 0) clearLoading();
    } else {
        img.dataset.src = imgSrc;
        if (!skipImageObserve) observeCodexImage(img);
    }

    bg.style.backgroundColor = resolveCodexNodeBgColor(el.dataset.codexBgColor);

    const portraitKind = kind === 'faction'
        ? 'faction'
        : kind === 'country'
            ? 'country'
            : kind === 'npc'
                ? 'npc'
                : 'hero';
    applyNodeScale(el, resolveCodexNodeScale(portraitKind, opts.scale), true, scaleOpts);
    ensureCodexNodeInteractionDelegation();
    return el;
}

function placeCodexNode(x, y, kind, heroName, faction, opts = {}) {
    if (!s.root) return undefined;
    if (kind === 'npc' && !String(heroName || '').trim()) return undefined;
    if (kind === 'country' && !normalizeCodexCountryKey(opts.countryKey)) return undefined;
    const scale = resolveCodexNodeScale(kind, opts.scale);
    const { x: cx, y: cy } = api.clampCodexNodeTopLeftToWorld(x, y, scale, kind);
    const fromSaved = opts.fromSaved === true;
    if (!fromSaved) {
        const dup = findCodexDuplicatePortraitNodeId(kind, heroName, faction, opts.countryKey);
        if (dup) {
            updateAppStatus(
                'A Codex node already exists for this hero, faction, NPC, or country. Each entity can only appear once.',
                'warning'
            );
            return undefined;
        }
    }
    const el = createCodexNodeElement(cx, cy, kind, heroName, faction, { ...opts, scale });
    const mountParent = opts.mountParent || s.codexWorldEl || s.root;
    mountParent.appendChild(el);

    // Add to Map for O(1) lookups (performance optimization)
    const nodeId = el.dataset.codexNodeId;
    if (nodeId) {
        s.codexNodeElements.set(nodeId, el);
    }

    // Add to s.codexAllNodes for save persistence (only for new nodes, not loaded from save)
    if (!fromSaved) {
        const newNode = {
            id: nodeId,
            kind: kind,
            x: cx,
            y: cy,
            scale: scale
        };
        if (kind === 'hero' && heroName) {
            newNode.heroName = heroName;
        } else if (kind === 'faction' && faction) {
            newNode.factionFilename = faction.filename;
            newNode.factionDisplay = faction.displayName || faction.filename;
        } else if (kind === 'npc' && heroName) {
            newNode.npcName = heroName;
        } else if (kind === 'country' && opts.countryKey) {
            newNode.countryKey = opts.countryKey;
        }
        s.codexAllNodes.push(newNode);
        if (nodeId) {
            if (!(s.codexNodeLayoutById instanceof Map)) s.codexNodeLayoutById = new Map();
            s.codexNodeLayoutById.set(nodeId, newNode);
            /* Mark rendered so virtual scroll does not place a duplicate DOM node. */
            s.codexRenderedNodeIds.add(nodeId);
        }

        api.markNodeVisualUnsaved(el);
        api.markCodexLayoutDirty();
        api.selectCodexNode(el);
    }
    // Filters are off on cold open — skip per-node class churn during bulk load.
    if (!fromSaved || s.codexFilterReachableNodeIds) {
        api.applyCodexNodeFilterClassesToEl?.(el);
    }
    if (!fromSaved && s.codexTargetedSelectionActive) api.syncCodexTargetedSelectionDom();
    if (!fromSaved && kind === 'faction') {
        void import('../../codex-bio-archive-sync/timeline/CodexFactionPortraitLookSync.js')
            .then((m) => m.applyCodexFactionPortraitLooksNow())
            .catch(() => {});
    }
    if (!opts.skipRedraw) redrawCodexEdges();
    return el;
}

function closestCodexNodeEl(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('.codex-node');
}

function onCodexNodeDelegatedContextMenu(e) {
    const el = closestCodexNodeEl(e.target);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    // Prevent deletion in view mode
    if (s.codexMode === 'view') return;

    const now = Date.now();
    api.pruneStaleCodexSelection();
    const inSelection = s.codexSelectedNodeEls.has(el);
    const multi = s.codexSelectedNodeEls.size > 1 && inSelection;

    if (multi) {
        const bulkAge = now - s.codexBulkNodeDeleteArmedAt;
        if (bulkAge < DOUBLE_RIGHT_MS && s.codexBulkNodeDeleteArmedAt > 0) {
            const toRemove = [...s.codexSelectedNodeEls].filter((n) => s.root && s.root.contains(n));
            const ids = toRemove.map((n) => n.dataset.codexNodeId).filter(Boolean);
            api.clearPendingCodexDeleteState();
            api.removeEdgesForDeletedNodesWithJunctionBridging(ids);
            s.codexAllNodes = s.codexAllNodes.filter((n) => !ids.includes(n.id));
            api.markCodexLayoutDirty();
            s.codexSelectedNodeEls.clear();
            s.codexPrimarySelectedNodeEl = null;
            for (const id of ids) api.unregisterCodexNodeRenderTracking(id);
            toRemove.forEach((n) => n.remove());
            api.applyCodexSelectionToDom();
            redrawCodexEdges();
            api.updateCodexToolbar();
            scheduleUpdateCodexVirtualScroll();
        } else {
            api.clearPendingCodexDeleteState();
            s.codexBulkNodeDeleteArmedAt = now;
            s.codexSelectedNodeEls.forEach((n) => {
                if (s.root && s.root.contains(n)) n.classList.add('codex-node--pending-delete');
            });
            redrawCodexEdges();
        }
        return;
    }

    s.codexBulkNodeDeleteArmedAt = 0;
    const nid = el.dataset.codexNodeId;
    if (!nid) return;
    const prevTs = s.codexNodeDeleteLastRightTs.get(nid) || 0;
    if (prevTs > 0 && now - prevTs < DOUBLE_RIGHT_MS) {
        s.codexNodeDeleteLastRightTs.delete(nid);
        api.clearPendingCodexDeleteState();
        api.removeEdgesForDeletedNodesWithJunctionBridging([nid]);
        s.codexAllNodes = s.codexAllNodes.filter((n) => n.id !== nid);
        api.markCodexLayoutDirty();
        s.codexSelectedNodeEls.delete(el);
        if (s.codexPrimarySelectedNodeEl === el) {
            const rest = [...s.codexSelectedNodeEls];
            s.codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
        }
        api.applyCodexSelectionToDom();
        api.unregisterCodexNodeRenderTracking(nid);
        el.remove();
        redrawCodexEdges();
        api.updateCodexToolbar();
        scheduleUpdateCodexVirtualScroll();
    } else {
        api.clearPendingCodexDeleteState();
        el.classList.add('codex-node--pending-delete');
        s.codexNodeDeleteLastRightTs.set(nid, now);
        redrawCodexEdges();
    }
}

function onCodexNodeDelegatedPointerDown(e) {
    const el = closestCodexNodeEl(e.target);
    if (!el) return;
    if (e.button === 0 && s.codexMode === 'dev' && el.dataset.codexNodeId) {
        s.codexNodeDeleteLastRightTs.delete(el.dataset.codexNodeId);
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

    if (
        el.classList.contains('codex-node--filtered-out')
        || el.classList.contains('codex-node--target-hidden')
    ) {
        return;
    }

    if (s.codexMode === 'view') {
        playSoundEffect('nodeSelect');
        api.selectCodexNode(el);
        maybeOpenStoryArchiveFromCodexNodeEl(el);
        return;
    }

    if (s.codexInteractionMode === 'network') {
        e.preventDefault();
        api.handleNetworkNodeActivate(el);
        return;
    }
    api.cancelPointerPending();
    api.cancelBackgroundPanPointerPending();

    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!s.root) return;

    let maxX;
    let maxY;
    let grabOffX;
    let grabOffY;
    let layerLeft = 0;
    let layerTop = 0;

    if (s.codexWorldEl) {
        maxX = Math.max(0, CODEX_WORLD_W - w);
        maxY = Math.max(0, CODEX_WORLD_H - h);
        const pw = api.clientToWorldCodex(e.clientX, e.clientY);
        grabOffX = pw.x - baseLeft;
        grabOffY = pw.y - baseTop;
    } else {
        const layer = s.hitLayerEl || s.root;
        const lr = layer.getBoundingClientRect();
        const layoutScale = api.getCodexBodyLayoutPerViewportPx();
        layerLeft = lr.left;
        layerTop = lr.top;
        maxX = Math.max(0, s.root.clientWidth - w);
        maxY = Math.max(0, s.root.clientHeight - h);
        grabOffX = (e.clientX - lr.left) / layoutScale - baseLeft;
        grabOffY = (e.clientY - lr.top) / layoutScale - baseTop;
    }

    s.pointerPending = {
        el,
        dragGroup: api.selectDragGroupForNode(el),
        pointerId: e.pointerId,
        baseLeft,
        baseTop,
        layerLeft,
        layerTop,
        maxX,
        maxY,
        grabOffX,
        grabOffY,
        startCX: e.clientX,
        startCY: e.clientY,
        shiftKey: !!e.shiftKey,
    };
    document.addEventListener('pointermove', api.onPointerMoveMaybeDrag, capOpts);
    document.addEventListener('pointerup', api.onPointerUpMaybeSelect, capOpts);
    document.addEventListener('pointercancel', api.onPointerUpMaybeSelect, capOpts);
}

function onCodexNodeDelegatedPointerOver(e) {
    const el = closestCodexNodeEl(e.target);
    if (!el) return;
    if (closestCodexNodeEl(e.relatedTarget) === el) return;

    if (!el.classList.contains('codex-node--junction') && s.codexMode !== 'view') {
        animateCodexNodeHoverMaskScale(el, readCodexNodeHoverVisualScale(el), () => {
            api.syncCodexEdgeNodeMaskDom?.();
        });
    }
    if (typeof api.onCodexNodeTargetedRoutePointerEnter === 'function') {
        api.onCodexNodeTargetedRoutePointerEnter(el);
    }
    if (typeof api.onCodexNodeFilterRoutePointerEnter === 'function') {
        api.onCodexNodeFilterRoutePointerEnter(el);
    }
}

function onCodexNodeDelegatedPointerOut(e) {
    const el = closestCodexNodeEl(e.target);
    if (!el) return;
    if (closestCodexNodeEl(e.relatedTarget) === el) return;

    if (!el.classList.contains('codex-node--junction') && s.codexMode !== 'view') {
        animateCodexNodeHoverMaskScale(el, 1, () => {
            api.syncCodexEdgeNodeMaskDom?.();
        });
    }
    if (typeof api.onCodexNodeTargetedRoutePointerLeave === 'function') {
        api.onCodexNodeTargetedRoutePointerLeave(e, el);
    }
    if (typeof api.onCodexNodeFilterRoutePointerLeave === 'function') {
        api.onCodexNodeFilterRoutePointerLeave(e, el);
    }
}

function teardownCodexNodeInteractionDelegation() {
    const host = s.codexNodeInteractionHost;
    if (!host) return;
    host.removeEventListener('contextmenu', onCodexNodeDelegatedContextMenu, true);
    host.removeEventListener('pointerdown', onCodexNodeDelegatedPointerDown);
    host.removeEventListener('pointerover', onCodexNodeDelegatedPointerOver);
    host.removeEventListener('pointerout', onCodexNodeDelegatedPointerOut);
    s.codexNodeInteractionHost = null;
}

/**
 * One listener set on the world — avoids ~4 listeners × thousands of nodes at mount.
 */
function ensureCodexNodeInteractionDelegation() {
    const host = s.codexWorldEl || s.root;
    if (!host) return;
    if (s.codexNodeInteractionHost === host) return;
    teardownCodexNodeInteractionDelegation();
    host.addEventListener('contextmenu', onCodexNodeDelegatedContextMenu, true);
    host.addEventListener('pointerdown', onCodexNodeDelegatedPointerDown);
    host.addEventListener('pointerover', onCodexNodeDelegatedPointerOver);
    host.addEventListener('pointerout', onCodexNodeDelegatedPointerOut);
    s.codexNodeInteractionHost = host;
}

/** @deprecated Prefer ensureCodexNodeInteractionDelegation — kept for call-site compat. */
function bindCodexNodeInteraction(_el) {
    ensureCodexNodeInteractionDelegation();
}

function maybeOpenStoryArchiveFromCodexNodeEl(nodeEl, opts) {
    if (s.codexMode !== 'view') return;
    if (!nodeEl) return;
    const em = getEventManager();
    if (!em) return;
    const o = opts || {};
    const highlight = o.codexConnectionHighlight || null;
    const scheduleHighlight = () => {
        if (!highlight || !String(highlight.name || '').trim()) return;
        const run = () => {
            applyLocationFlagBioHighlight(highlight);
        };
        requestAnimationFrame(() => requestAnimationFrame(run));
    };
    const kind = nodeEl.dataset.codexKind || '';

    if (kind === 'hero') {
        const heroName = String(nodeEl.dataset.codexHero || '').trim();
        if (!heroName) return;
        void (async () => {
            await api.openHeroArchiveEntryFromCodexHeroName(heroName);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'npc') {
        const npc = String(nodeEl.dataset.codexNpc || '').trim();
        if (!npc || typeof em.openNpcArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openNpcArchiveEventByName(npc);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'faction') {
        const token = String(
            nodeEl.dataset.codexFactionDisplay || nodeEl.dataset.codexFactionFile || ''
        ).trim();
        if (!token || typeof em.openFactionArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openFactionArchiveEventByName(token);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'country') {
        const ck = String(nodeEl.dataset.codexCountryKey || '').trim();
        if (!ck || typeof em.openLocationArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openLocationArchiveEventByName(ck);
            scheduleHighlight();
        })();
    }
}

function codexNodeElSupportsStoryArchiveLink(el) {
    if (!el?.dataset) return false;
    const k = el.dataset.codexKind || '';
    return k === 'hero' || k === 'npc' || k === 'faction' || k === 'country';
}

function codexBioLinkSpecFromNodeEl(el) {
    if (!el?.dataset) return null;
    const k = el.dataset.codexKind || '';
    if (k === 'hero') {
        const name = String(el.dataset.codexHero || '').trim();
        return name ? { kind: 'hero', name } : null;
    }
    if (k === 'npc') {
        const name = String(el.dataset.codexNpc || '').trim();
        return name ? { kind: 'npc', name } : null;
    }
    if (k === 'faction') {
        const name = String(
            el.dataset.codexFactionDisplay || el.dataset.codexFactionFile || ''
        ).trim();
        return name ? { kind: 'faction', name } : null;
    }
    return null;
}

api.findCodexDuplicatePortraitNodeId = findCodexDuplicatePortraitNodeId;
api.applyNodeScale = applyNodeScale;
api.createCodexNodeElement = createCodexNodeElement;
api.placeCodexNode = placeCodexNode;
api.bindCodexNodeInteraction = bindCodexNodeInteraction;
api.ensureCodexNodeInteractionDelegation = ensureCodexNodeInteractionDelegation;
api.teardownCodexNodeInteractionDelegation = teardownCodexNodeInteractionDelegation;
api.maybeOpenStoryArchiveFromCodexNodeEl = maybeOpenStoryArchiveFromCodexNodeEl;
api.codexNodeElSupportsStoryArchiveLink = codexNodeElSupportsStoryArchiveLink;
api.codexBioLinkSpecFromNodeEl = codexBioLinkSpecFromNodeEl;
