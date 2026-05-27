/** CodexNodePlacement — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { generateNodeId, heroNamesLooselyEqualCodex } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { applyLocationFlagBioHighlight, getEventManager, playSoundEffect, updateAppStatus } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { CODEX_FRAME_PATH, CODEX_IMG_BASE_PX, CODEX_JUNCTION_BASE_PX, CODEX_SCALE_MAX, CODEX_SCALE_MIN, codexCountryFlagSrc, normalizeCodexCountryKey, resolveCodexNodeScale } from './CodexNodePortraitMetrics.js';
import { codexFrameVariantForId, codexHexRotationDegreesForId } from './CodexNodeVisualHash.js';
import { observeCodexImage } from '../../codex-node-drawing/lazy-images/CodexImageLazyLoad.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { hexToRgba } from '../../codex-node-drawing/svg/CodexPresentationUtils.js';
import { scheduleUpdateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS } from '../../codex-canvas/core/canvasConstants.js';

function findCodexDuplicatePortraitNodeId(kind, heroName, faction, countryKey) {
    if (!Array.isArray(s.codexAllNodes)) return '';
    if (kind === 'hero' && String(heroName || '').trim()) {
        const t = String(heroName).trim();
        for (let i = 0; i < s.codexAllNodes.length; i += 1) {
            const n = s.codexAllNodes[i];
            if (n && n.kind === 'hero' && heroNamesLooselyEqualCodex(n.heroName, t)) return n.id;
        }
    } else if (kind === 'npc' && String(heroName || '').trim()) {
        const t = String(heroName).trim().toLowerCase();
        for (let j = 0; j < s.codexAllNodes.length; j += 1) {
            const n = s.codexAllNodes[j];
            if (n && n.kind === 'npc' && String(n.npcName || '').trim().toLowerCase() === t) return n.id;
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





function applyNodeScale(el, scale, skipRedraw) {
    const nodeScale = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(scale) || 1));
    el.dataset.codexScale = String(nodeScale);
    const junction = el.classList.contains('codex-node--junction');
    const simplified = el.classList.contains('codex-node--simplified');
    const basePx = junction ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX;
    const px = basePx * nodeScale;
    if (junction) {
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
    } else if (simplified) {
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
    }
    const nodeId = el.dataset.codexNodeId;
    if (nodeId) {
        const nodeObj = s.codexAllNodes.find((n) => n && n.id === nodeId);
        if (nodeObj) nodeObj.scale = nodeScale;
    }
    if (!skipRedraw) redrawCodexEdges();
}

function createCodexNodeElement(x, y, kind, heroName, faction, opts = {}) {
    const el = document.createElement('div');
    el.className = 'codex-node';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String(++s.nodeZ);
    el.dataset.codexNodeId = opts.id || generateNodeId();

    el.dataset.codexKind = kind;

    if (opts.bgColor) {
        el.dataset.codexBgColor = opts.bgColor;
    }
    if (kind === 'junction') {
        el.classList.add('codex-node--junction');
        const dot = document.createElement('div');
        dot.className = 'codex-node__junction';
        dot.setAttribute('aria-hidden', 'true');
        el.appendChild(dot);
        applyNodeScale(el, resolveCodexNodeScale('junction', opts.scale));
        bindCodexNodeInteraction(el);
        return el;
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
        imgSrc = `src/assets/images/Filters/Factions/${encodeURIComponent(faction.filename)}.png`;
        imgAlt = faction.displayName || '';
    }

    const frameSrc = `${CODEX_FRAME_PATH}${frameVariant}.png`;

    el.classList.add('codex-node--simplified');
    el.style.setProperty('--codex-hex-rotation', `${hexRotationDeg}deg`);

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'codex-node__img-wrapper';

    const img = document.createElement('img');
    img.className = 'codex-node__img';
    img.draggable = false;
    img.decoding = 'async';
    img.alt = imgAlt;
    img.onerror = () => { img.style.opacity = '0.35'; };
    if (opts.skipLazyLoad) { img.src = imgSrc; }
    else { img.dataset.src = imgSrc; observeCodexImage(img); }

    imgWrapper.appendChild(img);

    const frame = document.createElement('img');
    frame.className = 'codex-node__frame';
    frame.alt = '';
    frame.draggable = false;
    frame.decoding = 'async';
    frame.setAttribute('aria-hidden', 'true');
    if (opts.skipLazyLoad) { frame.src = frameSrc; }
    else { frame.dataset.src = frameSrc; observeCodexImage(frame); }

    el.appendChild(imgWrapper);

    const bg = document.createElement('div');
    bg.className = 'codex-node__bg';
    const savedBgColor = el.dataset.codexBgColor || '#ffffff';
    bg.style.background = hexToRgba(savedBgColor, 0.5);
    imgWrapper.appendChild(bg);

    el.appendChild(frame);

    const portraitKind = kind === 'faction'
        ? 'faction'
        : kind === 'country'
            ? 'country'
            : kind === 'npc'
                ? 'npc'
                : 'hero';
    applyNodeScale(el, resolveCodexNodeScale(portraitKind, opts.scale));
    bindCodexNodeInteraction(el);
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
    (s.codexWorldEl || s.root).appendChild(el);

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
        /* Dev virtual scroll: mark as rendered so updateCodexVirtualScroll does not call
         * placeLoadedCodexNodeRecord again (would append a second DOM node and orphan the first). */
        if (nodeId) s.codexRenderedNodeIds.add(nodeId);

        api.markNodeVisualUnsaved(el);
        api.markCodexLayoutDirty();
        api.selectCodexNode(el);
    }
    if (!opts.skipRedraw) redrawCodexEdges();
    return el;
}

function bindCodexNodeInteraction(el) {
    el.addEventListener('contextmenu', (e) => {
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
                // Remove from s.codexAllNodes for save persistence
                s.codexAllNodes = s.codexAllNodes.filter(n => !ids.includes(n.id));
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
            // Remove from s.codexAllNodes for save persistence
            s.codexAllNodes = s.codexAllNodes.filter(n => n.id !== nid);
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
    }, true);

    el.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && s.codexMode === 'dev' && el.dataset.codexNodeId) {
            s.codexNodeDeleteLastRightTs.delete(el.dataset.codexNodeId);
        }
        if (e.button !== 0) return;
        e.stopPropagation();
        api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

        // Prevent selection of filtered-out nodes
        if (el.classList.contains('codex-node--filtered-out')) {
            return;
        }
        
        // In View Mode, allow selection but not editing/moving
        if (s.codexMode === 'view') {
            // Play node select sound
            playSoundEffect('nodeSelect');
            // Select the node
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
            shiftKey: !!e.shiftKey
        };
        document.addEventListener('pointermove', api.onPointerMoveMaybeDrag, capOpts);
        document.addEventListener('pointerup', api.onPointerUpMaybeSelect, capOpts);
        document.addEventListener('pointercancel', api.onPointerUpMaybeSelect, capOpts);
    });
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
api.maybeOpenStoryArchiveFromCodexNodeEl = maybeOpenStoryArchiveFromCodexNodeEl;
api.codexNodeElSupportsStoryArchiveLink = codexNodeElSupportsStoryArchiveLink;
api.codexBioLinkSpecFromNodeEl = codexBioLinkSpecFromNodeEl;
