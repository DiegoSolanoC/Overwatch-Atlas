/**
 * WorldviewMarkerHoverCallout - Marker hover label + diagonal connector.
 * Globe and map: DOM overlay (SVG line + clickable label panel).
 */

const HOVER_CALLOUT_RENDER_ORDER = 1000;
const HOVER_CALLOUT_LINE_RENDER_ORDER = 999;
/** Gap between marker and label anchor (screen px). */
const CALLOUT_SCREEN_OFFSET = { x: 44, y: -36 };
const CALLOUT_GLOBE_SCREEN_OFFSET = { x: 72, y: -62 };
const CALLOUT_EDGE_MARGIN = 16;
const CALLOUT_PANEL_ESTIMATE_W = 220;
const CALLOUT_PANEL_ESTIMATE_H = 80;
const CALLOUT_PANEL_THUMB_PX = 52;
const CALLOUT_LINE_DRAW_MS = 280;
const CALLOUT_PANEL_POP_MS = 300;
/** Extend connector past the panel anchor corner so it meets the 2px border + radius (screen px). */
const CALLOUT_LINE_PANEL_TUCK_PX = 4;
const CALLOUT_LINE_PANEL_TUCK_GLOBE_PX = 5;

/** @deprecated map alias */
const MAP_DOM_OFFSET = CALLOUT_SCREEN_OFFSET;
const MAP_DOM_EDGE_MARGIN = CALLOUT_EDGE_MARGIN;
const MAP_DOM_PANEL_ESTIMATE_W = CALLOUT_PANEL_ESTIMATE_W;
const MAP_DOM_PANEL_ESTIMATE_H = CALLOUT_PANEL_ESTIMATE_H;
const MAP_DOM_LINE_DRAW_MS = CALLOUT_LINE_DRAW_MS;
const MAP_DOM_PANEL_POP_MS = CALLOUT_PANEL_POP_MS;

const PALETTE_ACCENTS = {
    blue: 0x2196f3,
    gray: 0xffffff,
    crimson: 0xef5350,
    nulled: 0xb388ff,
};

const PALETTE_PANEL_STYLES = {
    blue: { bg: 'rgb(6, 14, 28)', border: '#2196f3', glow: 'rgba(33, 150, 243, 0.35)' },
    gray: { bg: 'rgb(14, 14, 16)', border: '#e8e8e8', glow: 'rgba(255, 255, 255, 0.22)' },
    crimson: { bg: 'rgb(22, 8, 10)', border: '#ef5350', glow: 'rgba(239, 83, 80, 0.35)' },
    nulled: { bg: 'rgb(16, 8, 24)', border: '#b388ff', glow: 'rgba(179, 136, 255, 0.35)' },
};

function readPaletteKey() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('colorPalette') : null;
    if (saved === 'gray') return 'gray';
    if (saved === 'crimson') return 'crimson';
    if (saved === 'nulled') return 'nulled';
    return 'blue';
}

function hexToCss(hex) {
    const n = (hex >>> 0) & 0xffffff;
    return `#${n.toString(16).padStart(6, '0')}`;
}

function easeCelestialIn(t) {
    const x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
}

class WorldviewMarkerHoverCallout {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
        this.activeMarker = null;
        this._mode = null;
        this.lineMesh = null;
        this.panelSprite = null;
        this._panelTexture = null;
        this._panelCanvas = null;
        this._panelAspect = 1.6;
        this._paletteKey = readPaletteKey();
        this._frozenPanelWorldHeight = 0.1;
        this._frozenPanelWorldWidth = 0.16;
        this._frozenLineRadius = 0.004;
        this._frozenAnchorDir = 'bl';
        this._glAnimPlayedKey = null;
        this._glAnimPhase = 'done';
        this._glAnimStartTime = 0;
        this._glLineProgress = 1;
        this._glPanelProgress = 1;
        this._cameraRight = new THREE.Vector3();
        this._cameraUp = new THREE.Vector3();
        this._cameraForward = new THREE.Vector3();
        this._scratchCorner = new THREE.Vector3();
        this._scratchLineEnd = new THREE.Vector3();
        this._scratchPanelCenter = new THREE.Vector3();
        this._markerWorld = new THREE.Vector3();
        this._scratchPanelPos = new THREE.Vector3();
        this._scratchNdc = new THREE.Vector3();
        this._scratchScale = new THREE.Vector3();
        this._scratchDir = new THREE.Vector3();
        this._scratchMid = new THREE.Vector3();
        this._scratchQuat = new THREE.Quaternion();
        this._yAxis = new THREE.Vector3(0, 1, 0);
        this._scratchRay = new THREE.Raycaster();
        this._scratchRayNdc = new THREE.Vector2();
        this._domRoot = null;
        this._domSvg = null;
        this._domLine = null;
        this._domPanelWrap = null;
        this._domPanel = null;
        this._domParent = null;
        this._domAnchor = null;
        this._domAnchorBtn = null;
        this._mapDomOffset = { ...CALLOUT_SCREEN_OFFSET };
        this._domAnimPlayedKey = null;
        this._domAnimPhase = 'idle';
        this._domLineAnimHandler = null;
        this._domPanelAnimHandler = null;
        this._domLineAnimTimer = null;
        this._domPanelAnimTimer = null;
        this._panelImageCache = new Map();
        this._panelImageLoadId = 0;
        this._panelPreviewImage = null;
        this._overlapGroup = null;
        this._calloutStackMarkers = null;
        this._overlapCyclingPausedByCallout = false;
        this._onCalloutStackRowClickBound = (e) => this._onCalloutStackRowClick(e);
        this._onCalloutPanelPointerDownBound = (e) => e.stopPropagation();
    }

    _getMarkerService() {
        return window.globeController?.interactionController?.markerService || null;
    }

    _onCalloutStackRowClick(event) {
        event.preventDefault();
        event.stopPropagation();
        const marker = event.currentTarget?.__calloutMarker;
        if (!marker?.userData || marker.userData.isLocked || marker.userData.isInteractive === false) {
            return;
        }
        const ic = window.globeController?.interactionController;
        const ms = this._getMarkerService();
        ms?.dismissPinnedMarkerCallout?.();
        ms?.activateEventMarker?.(marker, {
            onZoomToMarker: (m) => ic?.zoomToMarker?.(m),
            onResetCamera: () => ic?.resetCameraToDefault?.(),
            fromCallout: true,
        });
    }

    _wireCalloutStackRow(rowEl, marker) {
        if (!rowEl) return;
        rowEl.__calloutMarker = marker;
        if (rowEl.__calloutClickWired) return;
        rowEl.__calloutClickWired = true;
        rowEl.addEventListener('click', this._onCalloutStackRowClickBound);
        rowEl.addEventListener('mousedown', this._onCalloutPanelPointerDownBound);
        rowEl.addEventListener('pointerdown', this._onCalloutPanelPointerDownBound);
    }

    _pauseOverlapCyclingForCallout() {
        if (this._overlapCyclingPausedByCallout) return;
        window.globeEventMarkerManager?.pauseOverlapCycling?.();
        window.globeController?.map2dLite?.pauseOverlapCycling?.();
        this._overlapCyclingPausedByCallout = true;
    }

    _resumeOverlapCyclingForCallout() {
        if (!this._overlapCyclingPausedByCallout) return;
        window.globeEventMarkerManager?.resumeOverlapCycling?.();
        window.globeController?.map2dLite?.resumeOverlapCycling?.();
        this._overlapCyclingPausedByCallout = false;
    }

    _resolveOverlapActivationMarkers(marker) {
        if (!marker) {
            this._overlapGroup = null;
            return [];
        }

        const isMapStub = !!marker.userData?.isMap2dLiteProxy;
        let group = null;
        let activationMarkers = null;

        if (this._isMapDomMode() || isMapStub) {
            const map2d = window.globeController?.map2dLite;
            group = map2d?.overlapGroups?.find((g) =>
                g.markers?.some((entry) => entry.stub === marker),
            );
            if (group && group.markers.length > 1) {
                activationMarkers = group.markers
                    .map((entry) => entry.stub)
                    .filter(Boolean);
            }
        } else {
            group = window.globeEventMarkerManager?.overlapGroups?.find((g) =>
                g.markers?.includes(marker),
            );
            if (group && group.markers.length > 1) {
                activationMarkers = group.markers.slice();
            }
        }

        if (!activationMarkers || activationMarkers.length <= 1) {
            this._overlapGroup = null;
            return [marker];
        }

        activationMarkers = activationMarkers.filter(
            (m) => m?.userData && !m.userData.isLocked && m.userData.isInteractive !== false,
        );
        if (activationMarkers.length <= 1) {
            this._overlapGroup = null;
            return activationMarkers.length === 1 ? activationMarkers : [marker];
        }

        const pageEvents = window.eventManager?.getDockTimelineEvents?.() || [];
        activationMarkers.sort((a, b) => {
            const ea = a.userData?.event;
            const eb = b.userData?.event;
            const ia = pageEvents.indexOf(ea);
            const ib = pageEvents.indexOf(eb);
            if (ia >= 0 && ib >= 0) return ia - ib;
            if (ia >= 0) return -1;
            if (ib >= 0) return 1;
            return String(a.userData?.eventName || '').localeCompare(String(b.userData?.eventName || ''));
        });

        this._overlapGroup = group;
        return activationMarkers;
    }

    _isStackRowCurrent(marker) {
        const group = this._overlapGroup;
        if (!group || group.markers.length <= 1) return false;

        if (marker.userData?.isMap2dLiteProxy) {
            const idx = group.markers.findIndex((entry) => entry.stub === marker);
            return idx >= 0 && idx === group.currentIndex;
        }

        const idx = group.markers.indexOf(marker);
        return idx >= 0 && idx === group.currentIndex;
    }

    _isMapDomMode() {
        return !!window.globeController?.map2dLite?.isVisible?.();
    }

    _getScene() {
        return this.sceneModel?.getScene?.() || null;
    }

    _getCamera() {
        return this.sceneModel?.getCamera?.() || null;
    }

    _getGlobeContainer() {
        return document.getElementById('globe-container');
    }

    _getMarkerAnchorScale(marker) {
        marker.getWorldScale(this._scratchScale);
        const avgScale = (this._scratchScale.x + this._scratchScale.y + this._scratchScale.z) / 3;
        const geoRadius = marker.geometry?.parameters?.radius;
        if (Number.isFinite(geoRadius) && geoRadius > 0) {
            return Math.max(0.008, geoRadius * avgScale);
        }
        return Math.max(0.008, avgScale * 0.015);
    }

    _resolveEventNumber(eventObj) {
        if (!eventObj) return null;
        if (window.eventManager?.events) {
            const index = window.eventManager.events.findIndex((e) => e === eventObj);
            if (index >= 0) return index + 1;
        }
        const dataModel = window.globeController?.dataModel;
        if (window.EventSlideShowHelpers?.getGlobalEventNumber1Based) {
            return window.EventSlideShowHelpers.getGlobalEventNumber1Based(eventObj, dataModel);
        }
        return null;
    }

    _getPreviewLines(marker) {
        const eventObj = marker?.userData?.event;
        const badge = window.SummaryInfoBadge;
        const variantIndex =
            marker?.userData?.variantIndex !== undefined ? marker.userData.variantIndex : undefined;
        if (badge?.getHoverPreviewLines) {
            return badge.getHoverPreviewLines(eventObj, { variantIndex });
        }
        return {
            primary: String(eventObj?.name || '').replace(/<[^>]+>/g, ''),
            otherVariants: [],
            era: '',
            yearLine: 'Year Unknown',
        };
    }

    _resolvePreviewDisplayEvent(marker) {
        const eventObj = marker?.userData?.event;
        if (!eventObj) return null;
        const variantIndex = marker?.userData?.variantIndex ?? 0;
        if (Array.isArray(eventObj.variants) && eventObj.variants.length > 0) {
            return eventObj.variants[variantIndex] || eventObj.variants[0] || eventObj;
        }
        return eventObj;
    }

    _resolvePreviewImagePath(marker) {
        const displayEvent = this._resolvePreviewDisplayEvent(marker);
        if (!displayEvent) return null;
        const plainName = String(displayEvent.name || '').replace(/<[^>]+>/g, '').trim();
        if (window.NavigationImageHelpers?.getEventImagePath) {
            return window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
        }
        if (window.eventManager?.getEventImagePath) {
            return window.eventManager.getEventImagePath(
                displayEvent.name,
                displayEvent.image,
                'story',
            );
        }
        return displayEvent.image || null;
    }

    _getPanelContent(marker) {
        const lines = this._getPreviewLines(marker);
        const eventNum = this._resolveEventNumber(marker?.userData?.event);
        const eraLine = lines.era ? String(lines.era).trim() : '';
        const yearLine = lines.yearLine ? String(lines.yearLine).trim() : '';
        const variants = Array.isArray(lines.otherVariants) ? lines.otherVariants.slice(0, 2) : [];
        const imagePath = this._resolvePreviewImagePath(marker);
        const displayEvent = this._resolvePreviewDisplayEvent(marker);
        const badgeApi = typeof window !== 'undefined' ? window.PreviewBadgeHoverDisplay : null;
        const previewBadges = badgeApi?.buildPreviewBadgeIconsFromTarget
            ? badgeApi.buildPreviewBadgeIconsFromTarget(displayEvent)
            : null;
        return {
            numLine: eventNum != null ? String(eventNum) : '',
            yearLine,
            eraLine,
            title: lines.primary || '',
            variants,
            imagePath: imagePath || null,
            primaryRowFlag: lines.primaryRowFlag || null,
            previewBadges,
        };
    }

    _wrapCanvasLines(ctx, text, maxWidth) {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';
        for (let i = 0; i < words.length; i++) {
            const test = current ? `${current} ${words[i]}` : words[i];
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current);
                current = words[i];
            } else {
                current = test;
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    _roundCanvasRect(ctx, x, y, w, h, r) {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            return;
        }
        ctx.beginPath();
        ctx.rect(x, y, w, h);
    }

    _drawPanelThumb(ctx, x, y, size, previewImage) {
        this._roundCanvasRect(ctx, x, y, size, size, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();
        if (!previewImage || !previewImage.complete || !previewImage.naturalWidth) return;
        const iw = previewImage.naturalWidth;
        const ih = previewImage.naturalHeight;
        const scale = Math.max(size / iw, size / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.save();
        this._roundCanvasRect(ctx, x, y, size, size, 4);
        ctx.clip();
        ctx.drawImage(previewImage, x + (size - dw) * 0.5, y + (size - dh) * 0.5, dw, dh);
        ctx.restore();
    }

    _loadPanelPreviewImage(imagePath) {
        if (!imagePath) return Promise.resolve(null);
        const cached = this._panelImageCache.get(imagePath);
        if (cached) {
            if (cached.complete && cached.naturalWidth) return Promise.resolve(cached);
            return new Promise((resolve) => {
                cached.addEventListener('load', () => resolve(cached), { once: true });
                cached.addEventListener('error', () => resolve(null), { once: true });
            });
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.decoding = 'async';
            img.addEventListener('load', () => {
                this._panelImageCache.set(imagePath, img);
                resolve(img);
            }, { once: true });
            img.addEventListener('error', () => resolve(null), { once: true });
            img.src = imagePath;
        });
    }

    _requestWebglPanelImage(marker, imagePath) {
        if (!imagePath || this._isMapDomMode()) return;
        const loadId = ++this._panelImageLoadId;
        this._loadPanelPreviewImage(imagePath).then((img) => {
            if (loadId !== this._panelImageLoadId) return;
            if (this.activeMarker !== marker) return;
            this._panelPreviewImage = img;
            this._ensureWebglPanel(marker, true);
        });
    }

    _buildPanelTexture(marker, previewImage) {
        const paletteKey = readPaletteKey();
        this._paletteKey = paletteKey;
        const style = PALETTE_PANEL_STYLES[paletteKey] || PALETTE_PANEL_STYLES.blue;
        const accentHex = PALETTE_ACCENTS[paletteKey] || PALETTE_ACCENTS.blue;
        const accentCss = hexToCss(accentHex);
        const content = this._getPanelContent(marker);
        const thumb = previewImage !== undefined ? previewImage : this._panelPreviewImage;
        const hasThumbSlot = !!content.imagePath;
        const hasThumbImage = !!(thumb && thumb.complete && thumb.naturalWidth);

        const canvasW = hasThumbSlot ? 248 : 200;
        const padX = 8;
        const padY = 8;
        const thumbSize = CALLOUT_PANEL_THUMB_PX;
        const thumbGap = 8;
        const textX = hasThumbSlot ? padX + thumbSize + thumbGap : padX;
        const innerW = canvasW - textX - padX;

        const canvas = this._panelCanvas || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const titleFont = '700 11px "Segoe UI", system-ui, sans-serif';
        const subFont = '500 9px "Segoe UI", system-ui, sans-serif';

        ctx.font = titleFont;
        const titleLines = this._wrapCanvasLines(ctx, content.title, innerW);
        const variantRows = [];
        for (let i = 0; i < content.variants.length; i++) {
            ctx.font = subFont;
            variantRows.push(...this._wrapCanvasLines(ctx, content.variants[i], innerW));
        }

        let textH = padY;
        const numYearLine = this._formatNumYearLine(content);
        if (numYearLine) textH += 12;
        if (content.eraLine) textH += 11;
        textH += titleLines.length * 13;
        if (variantRows.length) textH += 3 + variantRows.length * 11;
        textH += padY;

        const canvasH = Math.max(hasThumbSlot ? thumbSize + padY * 2 : 48, Math.ceil(textH));
        canvas.width = canvasW;
        canvas.height = canvasH;
        this._panelCanvas = canvas;
        this._panelAspect = canvasW / canvasH;
        if (!this._isMapDomMode()) {
            this._frozenPanelWorldWidth = this._frozenPanelWorldHeight * this._panelAspect;
        }

        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();
        ctx.shadowColor = style.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = style.bg;
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 2;
        this._roundCanvasRect(ctx, 1, 1, canvasW - 2, canvasH - 2, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();

        if (hasThumbSlot) {
            this._drawPanelThumb(ctx, padX, padY, thumbSize, hasThumbImage ? thumb : null);
        }

        let y = padY;
        if (numYearLine) {
            ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
            ctx.fillStyle = accentCss;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(numYearLine, textX, y);
            y += 12;
        }

        if (content.eraLine) {
            ctx.font = subFont;
            ctx.fillStyle = accentCss;
            ctx.fillText(content.eraLine, textX, y);
            y += 11;
        }

        ctx.font = titleFont;
        ctx.fillStyle = '#f5f8ff';
        for (let i = 0; i < titleLines.length; i++) {
            ctx.fillText(titleLines[i], textX, y);
            y += 13;
        }

        if (variantRows.length) {
            y += 3;
            ctx.font = subFont;
            ctx.fillStyle = 'rgba(220, 228, 240, 0.82)';
            for (let i = 0; i < variantRows.length; i++) {
                ctx.fillText(variantRows[i], textX, y);
                y += 11;
            }
        }

        const tex = this._panelTexture || new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        this._panelTexture = tex;
        return tex;
    }

    _applyAlwaysOnTopMaterial(material) {
        if (!material) return;
        material.depthTest = false;
        material.depthWrite = false;
        material.transparent = true;
        material.needsUpdate = true;
    }

    _freezeLayout(marker) {
        this._mapDomOffset = { ...CALLOUT_SCREEN_OFFSET };
        if (this._isMapDomMode()) return;
        const anchorScale = this._getMarkerAnchorScale(marker);
        this._frozenPanelWorldHeight = anchorScale * 14;
        this._frozenPanelWorldWidth = this._frozenPanelWorldHeight * (this._panelAspect || 1.6);
        this._frozenLineRadius = anchorScale * 0.5;
    }

    _calloutPanelBBox(anchorDir, px, py, w, h) {
        switch (anchorDir) {
            case 'br':
                return { left: px - w, right: px, top: py - h, bottom: py };
            case 'tl':
                return { left: px, right: px + w, top: py, bottom: py + h };
            case 'tr':
                return { left: px - w, right: px, top: py, bottom: py + h };
            case 'bl':
            default:
                return { left: px, right: px + w, top: py - h, bottom: py };
        }
    }

    _calloutPanelOverflow(box, visible) {
        let overflow = 0;
        if (box.left < visible.left) overflow += visible.left - box.left;
        if (box.right > visible.right) overflow += box.right - visible.right;
        if (box.top < visible.top) overflow += visible.top - box.top;
        if (box.bottom > visible.bottom) overflow += box.bottom - visible.bottom;
        return overflow;
    }

    _resolveCalloutScreenLayout(mx, my, visible, panelWidth, panelHeight, offX, offY, hints = {}) {
        const ox = Math.abs(offX);
        const oy = Math.abs(offY);
        const layoutScale = hints.layoutScale || 1;
        const w = Math.max(80, (panelWidth || CALLOUT_PANEL_ESTIMATE_W) * layoutScale);
        const h = Math.max(40, (panelHeight || CALLOUT_PANEL_ESTIMATE_H) * layoutScale);

        const bl = { anchorDir: 'bl', px: mx + ox, py: my - oy };
        const br = { anchorDir: 'br', px: mx - ox, py: my - oy };
        const tl = { anchorDir: 'tl', px: mx + ox, py: my + oy };
        const tr = { anchorDir: 'tr', px: mx - ox, py: my + oy };
        const candidates = hints.candidateOrder === 'left-first'
            ? [br, tr, bl, tl]
            : [bl, br, tl, tr];

        const preferLeft = hints.preferLeft !== undefined
            ? hints.preferLeft
            : mx > (visible.left + visible.right) * 0.52;
        const preferDown = hints.preferDown !== undefined
            ? hints.preferDown
            : my < (visible.top + visible.bottom) * 0.48;
        const matchBias = hints.matchBias ?? -4;
        const mismatchBias = hints.mismatchBias ?? 4;

        let best = candidates[0];
        let bestScore = Infinity;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const box = this._calloutPanelBBox(c.anchorDir, c.px, c.py, w, h);
            const overflow = this._calloutPanelOverflow(box, visible);

            let bias = 0;
            const opensLeft = c.anchorDir === 'br' || c.anchorDir === 'tr';
            const opensDown = c.anchorDir === 'tl' || c.anchorDir === 'tr';
            if (preferLeft === opensLeft) bias += matchBias;
            else bias += mismatchBias;
            if (preferDown === opensDown) bias += matchBias;
            else bias += mismatchBias;

            const score = overflow * 100 + bias;
            if (score < bestScore) {
                bestScore = score;
                best = c;
            }
        }

        return {
            px: best.px,
            py: best.py,
            anchorDir: best.anchorDir,
            cornerX: best.px,
            cornerY: best.py,
        };
    }

    /**
     * Nudge the line endpoint slightly past the panel anchor corner along the connector
     * so the stroke overlaps the label border (avoids a sub-pixel gap at rounded corners).
     */
    _tuckCalloutLineEnd(mx, my, cornerX, cornerY, tuckPx) {
        const dx = cornerX - mx;
        const dy = cornerY - my;
        const len = Math.hypot(dx, dy);
        const tuck = Number(tuckPx) || CALLOUT_LINE_PANEL_TUCK_PX;
        if (len < 1e-6) return { x: cornerX, y: cornerY };
        const scale = tuck / len;
        return { x: cornerX + dx * scale, y: cornerY + dy * scale };
    }

    _getCelestialMapLayoutHints(anchor, mx, my) {
        const map2d = window.globeController?.map2dLite;
        const host = anchor?.celestialHost;
        const root = map2d?.root;
        let preferDown;
        if (host && root) {
            const rootRect = root.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();
            const viewportMy = hostRect.top - rootRect.top + my;
            preferDown = viewportMy < root.clientHeight * 0.45;
        }
        return {
            layoutScale: anchor?.mapScale || 1,
            preferLeft: true,
            preferDown,
            matchBias: -48,
            mismatchBias: 24,
            candidateOrder: 'left-first',
        };
    }

    _getCalloutAnimKey(marker, anchorDir) {
        const stack = this._calloutStackMarkers;
        if (stack && stack.length > 1) {
            const ids = stack.map((m) => {
                const e = m?.userData?.event;
                const vi = m?.userData?.variantIndex ?? 0;
                return `${e?.name || ''}|${vi}`;
            }).join(';');
            return `stack:${ids}|${anchorDir}`;
        }
        const e = marker?.userData?.event;
        const name = (e && e.name) ? String(e.name) : '';
        const vi = marker?.userData?.variantIndex ?? 0;
        return `${name}|${vi}|${anchorDir}`;
    }

    _findMapDomButton(marker) {
        if (marker?.__map2dLiteBtn) {
            return marker.__map2dLiteBtn;
        }
        const map2d = window.globeController?.map2dLite;
        if (!map2d || !marker?.userData) return null;
        const ud = marker.userData;
        const containers = [
            map2d.markersEl,
            map2d._moonMarkersEl,
            map2d._marsMarkersEl,
            map2d._orbitMarkersEl,
        ];
        for (let c = 0; c < containers.length; c++) {
            const container = containers[c];
            if (!container) continue;
            const buttons = container.querySelectorAll('.map-2d-lite__marker');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                if (btn.__map2dLiteStub === marker) {
                    return btn;
                }
                const id = btn.__map2dLiteIdentity;
                if (!id?.event) continue;
                if (id.event === ud.event && (id.variantIndex ?? 0) === (ud.variantIndex ?? 0)) {
                    return btn;
                }
            }
        }
        return null;
    }

    _resolveMapDomAnchor(marker, btn) {
        if (!this._isMapDomMode()) {
            const container = this._getGlobeContainer();
            if (!container) return null;
            return {
                parent: container,
                width: container.clientWidth || 1,
                height: container.clientHeight || 1,
                isGlobeScreen: true,
            };
        }

        const map2d = window.globeController?.map2dLite;
        if (!map2d || !btn) return null;

        const locationType = marker?.userData?.locationType || 'earth';
        if (locationType === 'earth') {
            // Screen-space over the viewport so dock-hover zoom does not balloon labels
            // or skew leader-line layout (offsetWidth is unscaled under CSS transforms).
            if (!map2d.viewport) return null;
            return {
                parent: map2d.viewport,
                width: map2d.viewport.clientWidth || 1,
                height: map2d.viewport.clientHeight || 1,
                isEarthScreen: true,
                mapScale: map2d._scale ?? 1,
            };
        }

        if (!map2d.root) return null;
        const host = btn.closest('.map-2d-lite__celestial-host');
        if (!host) return null;
        // Keep celestial callouts inside their panel host so the leader line
        // originates from that panel's placement (moon/mars/orbit stack).
        return {
            parent: host,
            width: host.clientWidth || 1,
            height: host.clientHeight || 1,
            isCelestial: true,
            mapScale: 1,
            celestialHost: host,
        };
    }

    _setCelestialCalloutHostOpen(host, open) {
        if (!host) return;
        host.classList.toggle('map-2d-lite__celestial-host--callout-open', !!open);
    }

    _getMapDomButtonCenter(btn, anchor) {
        const map2d = window.globeController?.map2dLite;

        if (anchor?.isEarthScreen && map2d) {
            const u = parseFloat(btn.style.left);
            const v = parseFloat(btn.style.top);
            if (!Number.isFinite(u) || !Number.isFinite(v)) {
                return { x: 0, y: 0 };
            }
            const wx = (u / 100) * (map2d._baseW || 1000);
            const wy = (v / 100) * (map2d._baseH || 500);
            const scale = map2d._scale ?? 1;
            return {
                x: (map2d._tx ?? 0) + wx * scale,
                y: (map2d._ty ?? 0) + wy * scale,
            };
        }

        if (anchor?.isCelestial) {
            const host = anchor.celestialHost || anchor.parent;
            const u = parseFloat(btn.style.left);
            const v = parseFloat(btn.style.top);
            const w = anchor.width || host?.clientWidth || 1;
            const h = anchor.height || host?.clientHeight || 1;
            if (!Number.isFinite(u) || !Number.isFinite(v)) {
                return { x: 0, y: 0 };
            }
            return {
                x: (u / 100) * w,
                y: (v / 100) * h,
            };
        }

        const u = parseFloat(btn.style.left);
        const v = parseFloat(btn.style.top);
        if (!Number.isFinite(u) || !Number.isFinite(v)) {
            return { x: 0, y: 0 };
        }
        return {
            x: (u / 100) * anchor.width,
            y: (v / 100) * anchor.height,
        };
    }

    _getMapVisibleBounds(marker, anchor) {
        if (anchor?.isGlobeScreen) {
            return this._getGlobeScreenVisibleBounds(anchor.parent);
        }

        const margin = MAP_DOM_EDGE_MARGIN;

        if (anchor?.isEarthScreen) {
            const w = anchor.width || anchor.parent?.clientWidth || 1;
            const h = anchor.height || anchor.parent?.clientHeight || 1;
            return {
                left: margin,
                top: margin,
                right: w - margin,
                bottom: h - margin,
            };
        }

        const locationType = marker?.userData?.locationType || 'earth';

        if (locationType !== 'earth' || anchor?.isCelestial) {
            const map2d = window.globeController?.map2dLite;
            const host = anchor?.celestialHost || (anchor?.isCelestial ? anchor.parent : null);
            const root = map2d?.root;
            if (host && root) {
                const rootRect = root.getBoundingClientRect();
                const hostRect = host.getBoundingClientRect();
                const ox = hostRect.left - rootRect.left;
                const oy = hostRect.top - rootRect.top;
                return {
                    left: margin - ox,
                    top: margin - oy,
                    right: root.clientWidth - margin - ox,
                    bottom: root.clientHeight - margin - oy,
                };
            }
            return {
                left: margin,
                top: margin,
                right: (anchor.width || 1) - margin,
                bottom: (anchor.height || 1) - margin,
            };
        }

        const map2d = window.globeController?.map2dLite;
        const vw = map2d?.viewport?.clientWidth || 0;
        const vh = map2d?.viewport?.clientHeight || 0;
        const tx = map2d?._tx ?? 0;
        const ty = map2d?._ty ?? 0;
        const scale = map2d?._scale ?? 1;
        if (!vw || !vh || scale <= 0) {
            return {
                left: margin,
                top: margin,
                right: anchor.width - margin,
                bottom: anchor.height - margin,
            };
        }

        return {
            left: -tx / scale + margin,
            top: -ty / scale + margin,
            right: (vw - tx) / scale - margin,
            bottom: (vh - ty) / scale - margin,
        };
    }

    _resolveMapDomPanelLayout(mx, my, anchor, marker, panelWidth, panelHeight) {
        const visible = this._getMapVisibleBounds(marker, anchor);
        const hints = anchor?.isCelestial ? this._getCelestialMapLayoutHints(anchor, mx, my) : undefined;
        const off = anchor?.isGlobeScreen ? CALLOUT_GLOBE_SCREEN_OFFSET : this._mapDomOffset;
        return this._resolveCalloutScreenLayout(
            mx,
            my,
            visible,
            panelWidth,
            panelHeight,
            off.x,
            off.y,
            hints,
        );
    }

    _applyMapDomPanelAnchor(anchorDir) {
        if (!this._domPanelWrap) return;
        const dirs = ['bl', 'br', 'tl', 'tr'];
        for (let i = 0; i < dirs.length; i++) {
            this._domPanelWrap.classList.toggle(
                `map-hover-callout__panel-wrap--anchor-${dirs[i]}`,
                dirs[i] === anchorDir,
            );
        }
    }

    _getMapDomAnimKey(marker, anchorDir) {
        return this._getCalloutAnimKey(marker, anchorDir);
    }

    _clearMapDomAnimHandlers() {
        if (this._domLineAnimTimer) {
            clearTimeout(this._domLineAnimTimer);
            this._domLineAnimTimer = null;
        }
        if (this._domPanelAnimTimer) {
            clearTimeout(this._domPanelAnimTimer);
            this._domPanelAnimTimer = null;
        }
        if (this._domLine && this._domLineAnimHandler) {
            this._domLine.removeEventListener('animationend', this._domLineAnimHandler);
            this._domLineAnimHandler = null;
        }
        if (this._domPanel && this._domPanelAnimHandler) {
            this._domPanel.removeEventListener('animationend', this._domPanelAnimHandler);
            this._domPanelAnimHandler = null;
        }
        if (this._domLine) {
            this._domLine.classList.remove('map-hover-callout__line--draw');
        }
        if (this._domPanelWrap) {
            this._domPanelWrap.classList.remove('map-hover-callout__panel-wrap--waiting');
        }
        if (this._domPanel) {
            this._domPanel.classList.remove('map-hover-callout__panel--enter');
        }
        this._domAnimPhase = 'idle';
    }

    _applyMapDomPanelShownState() {
        if (!this._domPanelWrap || !this._domPanel) return;
        this._domPanelWrap.classList.remove('map-hover-callout__panel-wrap--waiting');
        this._domPanel.classList.remove('map-hover-callout__panel--enter');
        this._domPanel.style.opacity = '1';
        this._domPanel.style.transform = 'scaleY(1)';
    }

    _setMapDomLineGeometry(mx, my, lineEndX, lineEndY, lineLen) {
        if (!this._domLine) return;
        this._domLine.setAttribute('x1', String(mx));
        this._domLine.setAttribute('y1', String(my));
        this._domLine.setAttribute('x2', String(lineEndX));
        this._domLine.setAttribute('y2', String(lineEndY));
        this._domLine.style.strokeDasharray = `${lineLen}`;
        this._domLine.style.setProperty('--callout-line-len', `${lineLen}`);
    }

    _setMapDomLineFullyDrawn(lineLen) {
        if (!this._domLine) return;
        this._domLine.style.strokeDasharray = `${lineLen}`;
        this._domLine.style.strokeDashoffset = '0';
        this._domLine.classList.remove('map-hover-callout__line--draw');
    }

    _showMapDomPanelImmediately() {
        if (!this._domPanelWrap || !this._domPanel) return;
        this._applyMapDomPanelShownState();
    }

    _startMapDomEnterAnimation(lineLen) {
        if (!this._domLine || !this._domPanelWrap || !this._domPanel) return;

        this._clearMapDomAnimHandlers();
        this._domAnimPhase = 'line';

        this._domLine.style.strokeDasharray = `${lineLen}`;
        this._domLine.style.strokeDashoffset = `${lineLen}`;
        this._domLine.style.setProperty('--callout-line-len', `${lineLen}`);
        this._domPanelWrap.classList.add('map-hover-callout__panel-wrap--waiting');
        this._domPanel.classList.remove('map-hover-callout__panel--enter');
        this._domPanel.style.opacity = '';
        this._domPanel.style.transform = '';

        this._domLineAnimHandler = () => {
            if (this._domLineAnimTimer) {
                clearTimeout(this._domLineAnimTimer);
                this._domLineAnimTimer = null;
            }
            this._domLineAnimHandler = null;
            if (this._domAnimPhase !== 'line') return;
            this._setMapDomLineFullyDrawn(lineLen);
            this._domAnimPhase = 'panel';
            this._domPanelWrap.classList.remove('map-hover-callout__panel-wrap--waiting');
            this._domPanel.classList.add('map-hover-callout__panel--enter');
            this._domPanelAnimHandler = () => {
                if (this._domPanelAnimTimer) {
                    clearTimeout(this._domPanelAnimTimer);
                    this._domPanelAnimTimer = null;
                }
                this._domPanelAnimHandler = null;
                if (this._domAnimPhase !== 'panel') return;
                this._domAnimPhase = 'done';
                this._applyMapDomPanelShownState();
            };
            this._domPanel.addEventListener('animationend', this._domPanelAnimHandler, { once: true });
            this._domPanelAnimTimer = setTimeout(() => {
                if (this._domPanelAnimHandler) {
                    this._domPanel.removeEventListener('animationend', this._domPanelAnimHandler);
                    this._domPanelAnimHandler();
                }
            }, MAP_DOM_PANEL_POP_MS + 50);
        };

        requestAnimationFrame(() => {
            if (!this._domLine) return;
            this._domLine.classList.add('map-hover-callout__line--draw');
            this._domLine.addEventListener('animationend', this._domLineAnimHandler, { once: true });
            this._domLineAnimTimer = setTimeout(() => {
                if (this._domLineAnimHandler) {
                    this._domLine.removeEventListener('animationend', this._domLineAnimHandler);
                    this._domLineAnimHandler();
                }
            }, MAP_DOM_LINE_DRAW_MS + 50);
        });
    }

    _ensureDomRoot(marker, btn) {
        const anchor = this._resolveMapDomAnchor(marker, btn);
        if (!anchor?.parent) return null;

        if (!this._domRoot || this._domParent !== anchor.parent) {
            this._disposeDom();
            this._domParent = anchor.parent;
            this._domRoot = document.createElement('div');
            this._domRoot.className = 'map-hover-callout';
            this._domSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._domSvg.setAttribute('class', 'map-hover-callout__svg');
            this._domLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            this._domLine.setAttribute('class', 'map-hover-callout__line');
            this._domSvg.appendChild(this._domLine);
            this._domPanelWrap = document.createElement('div');
            this._domPanelWrap.className = 'map-hover-callout__panel-wrap';
            this._domPanel = document.createElement('div');
            this._domPanel.className = 'map-hover-callout__panel';
            this._domPanel.setAttribute('role', 'group');
            this._domPanelWrap.appendChild(this._domPanel);
            this._domRoot.appendChild(this._domSvg);
            this._domRoot.appendChild(this._domPanelWrap);
            anchor.parent.appendChild(this._domRoot);
        }

        this._domAnchor = anchor;
        return this._domRoot;
    }

    _updateDomCallout(marker) {
        if (marker?.userData?.isMap2dLiteProxy && !this._isMapDomMode()) {
            this.hide();
            return;
        }

        if (this._isMapDomMode() && marker && !marker.userData?.isMap2dLiteProxy) {
            const mapBtn = this._domAnchorBtn || this._findMapDomButton(marker);
            if (!mapBtn) {
                this.hide();
                return;
            }
        }

        const isGlobeScreen = !this._isMapDomMode();
        const btn = isGlobeScreen ? null : (this._domAnchorBtn || this._findMapDomButton(marker));
        if (!isGlobeScreen && !btn) {
            if (this._domRoot) {
                this._disposeDom();
            }
            return;
        }

        const root = this._ensureDomRoot(marker, btn);
        const anchor = this._domAnchor;
        if (!root || !anchor) return;

        const paletteKey = readPaletteKey();
        if (paletteKey !== this._paletteKey) {
            this._paletteKey = paletteKey;
            this._renderDomPanel(marker, paletteKey);
        }

        let mx;
        let my;
        if (anchor.isGlobeScreen) {
            const camera = this._getCamera();
            if (!camera) return;
            marker.getWorldPosition(this._markerWorld);
            const ndc = this._scratchNdc.copy(this._markerWorld).project(camera);
            if (ndc.z > 1) {
                root.style.display = 'none';
                return;
            }
            ({ mx, my } = this._markerScreenPosition(marker, camera, anchor.parent));
            anchor.width = anchor.parent.clientWidth || 1;
            anchor.height = anchor.parent.clientHeight || 1;
            this._setCelestialCalloutHostOpen(this._celestialCalloutHost, false);
            this._celestialCalloutHost = null;
            root.classList.remove('map-hover-callout--celestial');
            root.classList.remove('map-hover-callout--map');
            root.classList.add('map-hover-callout--globe');
            root.style.transform = '';
            root.style.transformOrigin = '';
        } else {
            root.classList.remove('map-hover-callout--globe');
            ({ x: mx, y: my } = this._getMapDomButtonCenter(btn, anchor));
        }

        root.style.display = 'block';
        if (anchor.isCelestial) {
            const host = anchor.celestialHost;
            if (this._celestialCalloutHost && this._celestialCalloutHost !== host) {
                this._setCelestialCalloutHostOpen(this._celestialCalloutHost, false);
            }
            this._celestialCalloutHost = host || null;
            this._setCelestialCalloutHostOpen(host, true);
            // Host-local coords; no map-zoom scale (dock hover stays readable).
            anchor.mapScale = 1;
            anchor.width = host?.clientWidth || anchor.parent?.clientWidth || 1;
            anchor.height = host?.clientHeight || anchor.parent?.clientHeight || 1;
            root.classList.add('map-hover-callout--celestial');
            root.classList.add('map-hover-callout--map');
            root.style.transformOrigin = '';
            root.style.transform = '';
        } else if (anchor.isEarthScreen) {
            this._setCelestialCalloutHostOpen(this._celestialCalloutHost, false);
            this._celestialCalloutHost = null;
            root.classList.remove('map-hover-callout--celestial');
            root.classList.add('map-hover-callout--map');
            if (anchor.parent) {
                anchor.width = anchor.parent.clientWidth || 1;
                anchor.height = anchor.parent.clientHeight || 1;
            }
            root.style.transform = '';
            root.style.transformOrigin = '';
        } else {
            this._setCelestialCalloutHostOpen(this._celestialCalloutHost, false);
            this._celestialCalloutHost = null;
            root.classList.remove('map-hover-callout--celestial');
            root.classList.remove('map-hover-callout--map');
            root.style.transform = '';
            root.style.transformOrigin = '';
        }

        this._applyMapDomPanelAnchor('bl');
        this._domPanelWrap.style.visibility = 'hidden';
        this._domPanelWrap.style.left = `${mx}px`;
        this._domPanelWrap.style.top = `${my}px`;

        const stackLen = this._calloutStackMarkers?.length || 1;
        const stackRowEstimate = anchor.isGlobeScreen ? 148 : 64;
        const stackEstimateH = stackLen > 1
            ? 40 + stackLen * stackRowEstimate + 32
            : (anchor.isGlobeScreen ? 180 : MAP_DOM_PANEL_ESTIMATE_H);
        const panelWidth = this._domPanel.offsetWidth
            || (anchor.isGlobeScreen ? 480 : MAP_DOM_PANEL_ESTIMATE_W);
        const panelHeight = this._domPanel.offsetHeight || stackEstimateH;

        if (stackLen > 1) {
            this._pauseOverlapCyclingForCallout();
        }
        const layout = this._resolveMapDomPanelLayout(
            mx,
            my,
            anchor,
            marker,
            panelWidth,
            panelHeight,
        );

        this._domPanelWrap.style.visibility = '';
        this._applyMapDomPanelAnchor(layout.anchorDir);
        this._domPanelWrap.style.left = `${layout.px}px`;
        this._domPanelWrap.style.top = `${layout.py}px`;

        const cornerX = layout.cornerX;
        const cornerY = layout.cornerY;

        const tuckPx = anchor.isGlobeScreen
            ? CALLOUT_LINE_PANEL_TUCK_GLOBE_PX
            : CALLOUT_LINE_PANEL_TUCK_PX;
        const lineEnd = this._tuckCalloutLineEnd(mx, my, cornerX, cornerY, tuckPx);
        const lineEndX = lineEnd.x;
        const lineEndY = lineEnd.y;
        const lineLen = Math.hypot(lineEndX - mx, lineEndY - my) || 1;

        this._domSvg.setAttribute('width', String(anchor.width));
        this._domSvg.setAttribute('height', String(anchor.height));
        this._domSvg.setAttribute('viewBox', `0 0 ${anchor.width} ${anchor.height}`);
        this._setMapDomLineGeometry(mx, my, lineEndX, lineEndY, lineLen);

        const animKey = this._getMapDomAnimKey(marker, layout.anchorDir);
        if (animKey !== this._domAnimPlayedKey) {
            this._domAnimPlayedKey = animKey;
            this._startMapDomEnterAnimation(lineLen);
        } else if (this._domAnimPhase === 'done') {
            this._setMapDomLineFullyDrawn(lineLen);
            this._applyMapDomPanelShownState();
        } else if (this._domAnimPhase === 'panel') {
            this._setMapDomLineFullyDrawn(lineLen);
        } else if (this._domAnimPhase === 'line') {
            this._setMapDomLineGeometry(mx, my, lineEndX, lineEndY, lineLen);
        }
    }

    _applyDomPanelChrome(style) {
        if (!this._domPanel) return;
        this._domPanel.style.background = style.bg;
        this._domPanel.style.borderColor = style.border;
        this._domPanel.style.boxShadow = `0 0 14px ${style.glow}`;
        this._domPanel.style.setProperty('--callout-glow', style.glow);
        this._domPanel.style.setProperty('--callout-border', style.border);
        if (this._domLine) {
            this._domLine.style.stroke = style.border;
        }
    }

    _appendPanelThumb(parentEl, imagePath, compact) {
        if (!imagePath) {
            parentEl.classList.add('map-hover-callout__panel-inner--no-thumb');
            return;
        }
        const thumb = document.createElement('div');
        thumb.className = compact
            ? 'map-hover-callout__thumb map-hover-callout__thumb--compact'
            : 'map-hover-callout__thumb';
        const img = document.createElement('img');
        img.className = 'map-hover-callout__thumb-img';
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        img.src = imagePath;
        img.addEventListener('error', () => {
            thumb.remove();
            parentEl.classList.add('map-hover-callout__panel-inner--no-thumb');
        }, { once: true });
        thumb.appendChild(img);
        parentEl.appendChild(thumb);
    }

    _appendNumYearFlag(row, flagEntry) {
        if (!flagEntry?.filename) return;
        const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
        if (!lh || typeof lh.flagSrc !== 'function') return;
        const slot = document.createElement('span');
        slot.className = 'map-hover-callout__num-year-flag';
        const img = document.createElement('img');
        img.className = 'map-hover-callout__num-year-flag-img';
        img.src = lh.flagSrc(String(flagEntry.filename).trim());
        img.alt = flagEntry.alt != null ? String(flagEntry.alt).trim() : '';
        img.decoding = 'async';
        img.draggable = false;
        img.setAttribute('aria-hidden', 'true');
        slot.appendChild(img);
        row.appendChild(slot);
    }

    _appendNumYearRow(body, content, accentCss) {
        const numPart = content.numLine ? `#${content.numLine}` : '';
        const yearPart = content.yearLine ? String(content.yearLine).trim() : '';
        if (!numPart && !yearPart) return;

        const row = document.createElement('div');
        row.className = 'map-hover-callout__num-year';

        if (numPart) {
            const num = document.createElement('span');
            num.className = 'map-hover-callout__num';
            num.style.color = accentCss;
            num.textContent = numPart;
            row.appendChild(num);
        }
        if (numPart && yearPart) {
            const sep = document.createElement('span');
            sep.className = 'map-hover-callout__num-year-sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '|';
            row.appendChild(sep);
        }
        if (yearPart) {
            const year = document.createElement('span');
            year.className = 'map-hover-callout__year';
            year.style.color = accentCss;
            year.textContent = yearPart;
            row.appendChild(year);
        }
        this._appendNumYearFlag(row, content.primaryRowFlag);
        body.appendChild(row);
    }

    _formatNumYearLine(content) {
        const parts = [];
        if (content.numLine) parts.push(`#${content.numLine}`);
        if (content.yearLine) {
            if (parts.length) parts.push('|');
            parts.push(String(content.yearLine).trim());
        }
        return parts.join(' ');
    }

    _appendPanelBody(body, content, accentCss, options = {}) {
        const { includeVariants = true } = options;

        this._appendNumYearRow(body, content, accentCss);

        if (content.eraLine) {
            const era = document.createElement('div');
            era.className = 'map-hover-callout__era';
            era.style.color = accentCss;
            era.textContent = content.eraLine;
            body.appendChild(era);
        }

        const title = document.createElement('div');
        title.className = 'map-hover-callout__title';
        title.textContent = content.title;
        body.appendChild(title);

        if (includeVariants) {
            for (let i = 0; i < content.variants.length; i++) {
                const row = document.createElement('div');
                row.className = 'map-hover-callout__variant';
                row.textContent = content.variants[i];
                body.appendChild(row);
            }
        }
    }

    _appendPanelBadges(parentEl, content, options = {}) {
        if (!parentEl || !content?.previewBadges) return null;
        const badgeApi = typeof window !== 'undefined' ? window.PreviewBadgeHoverDisplay : null;
        if (
            !badgeApi?.appendPreviewBadgeIconRow
            || !badgeApi.hasPreviewBadgeIcons?.(content.previewBadges)
        ) {
            return null;
        }
        const slot = document.createElement('div');
        slot.className = 'map-hover-callout__badges';
        badgeApi.appendPreviewBadgeIconRow(slot, content.previewBadges, {
            compact: !!options.compact,
        });
        if (!slot.firstChild) return null;
        parentEl.appendChild(slot);
        return slot;
    }

    _buildDomStackRow(marker, accentCss, compact) {
        const content = this._getPanelContent(marker);
        const rowBtn = document.createElement('button');
        rowBtn.type = 'button';
        rowBtn.className = 'map-hover-callout__stack-row';
        if (this._isStackRowCurrent(marker)) {
            rowBtn.classList.add('map-hover-callout__stack-row--current');
        }
        const label = [content.numLine, content.title].filter(Boolean).join(' — ');
        rowBtn.setAttribute('aria-label', label ? `Open ${label}` : 'Open event details');

        const inner = document.createElement('div');
        inner.className = compact
            ? 'map-hover-callout__panel-inner map-hover-callout__panel-inner--compact'
            : 'map-hover-callout__panel-inner';
        this._appendPanelThumb(inner, content.imagePath, compact);

        const body = document.createElement('div');
        body.className = 'map-hover-callout__body';
        this._appendPanelBody(body, content, accentCss, {
            includeVariants: false,
            compact,
        });
        inner.appendChild(body);
        this._appendPanelBadges(inner, content, { compact });
        inner.classList.toggle(
            'map-hover-callout__panel-inner--has-badges',
            !!inner.querySelector('.map-hover-callout__badges')
        );
        rowBtn.appendChild(inner);
        this._wireCalloutStackRow(rowBtn, marker);
        return rowBtn;
    }

    _renderDomPanel(marker, paletteKey) {
        if (!this._domPanel) return;
        const style = PALETTE_PANEL_STYLES[paletteKey] || PALETTE_PANEL_STYLES.blue;
        const accentCss = hexToCss(PALETTE_ACCENTS[paletteKey] || PALETTE_ACCENTS.blue);
        const stackMarkers = this._resolveOverlapActivationMarkers(marker);
        this._calloutStackMarkers = stackMarkers;
        const isStack = stackMarkers.length > 1;

        if (isStack) {
            this._pauseOverlapCyclingForCallout();
        } else {
            this._resumeOverlapCyclingForCallout();
        }

        this._domPanel.replaceChildren();
        this._domPanel.classList.toggle('map-hover-callout__panel--stack', isStack);
        this._applyDomPanelChrome(style);

        if (isStack) {
            for (let i = 0; i < stackMarkers.length; i++) {
                this._domPanel.appendChild(this._buildDomStackRow(stackMarkers[i], accentCss, true));
            }
            return;
        }

        const soloMarker = stackMarkers[0] || marker;
        const content = this._getPanelContent(soloMarker);
        const rowBtn = document.createElement('button');
        rowBtn.type = 'button';
        rowBtn.className = 'map-hover-callout__stack-row map-hover-callout__stack-row--solo';
        rowBtn.setAttribute('aria-label', 'Open event details');

        const inner = document.createElement('div');
        inner.className = 'map-hover-callout__panel-inner';
        this._appendPanelThumb(inner, content.imagePath, false);

        const body = document.createElement('div');
        body.className = 'map-hover-callout__body';
        this._appendPanelBody(body, content, accentCss);
        inner.appendChild(body);
        this._appendPanelBadges(inner, content);
        inner.classList.toggle(
            'map-hover-callout__panel-inner--has-badges',
            !!inner.querySelector('.map-hover-callout__badges')
        );
        rowBtn.appendChild(inner);
        this._wireCalloutStackRow(rowBtn, soloMarker);
        this._domPanel.appendChild(rowBtn);
    }

    _purgeAllCalloutDom() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.map-hover-callout').forEach((el) => {
            try {
                el.remove();
            } catch (_) {}
        });
    }

    _disposeDom() {
        this._resumeOverlapCyclingForCallout();
        this._overlapGroup = null;
        this._calloutStackMarkers = null;
        this._clearMapDomAnimHandlers();
        this._domAnimPlayedKey = null;
        this._domAnimPhase = 'idle';
        this._setCelestialCalloutHostOpen(this._celestialCalloutHost, false);
        this._celestialCalloutHost = null;
        if (this._domRoot?.parentNode) {
            this._domRoot.parentNode.removeChild(this._domRoot);
        }
        this._domRoot = null;
        this._domSvg = null;
        this._domLine = null;
        this._domPanelWrap = null;
        this._domPanel = null;
        this._domParent = null;
        this._domAnchor = null;
        this._domAnchorBtn = null;
        this._celestialCalloutHost = null;
        this._purgeAllCalloutDom();
    }

    _disposeWebgl() {
        this._glAnimPlayedKey = null;
        this._glAnimPhase = 'done';
        this._glLineProgress = 1;
        this._glPanelProgress = 1;
        if (this.lineMesh) {
            const scene = this._getScene();
            if (scene && this.lineMesh.parent === scene) {
                scene.remove(this.lineMesh);
            }
            this.lineMesh.geometry?.dispose?.();
            this.lineMesh.material?.dispose?.();
            this.lineMesh = null;
        }
        if (this.panelSprite) {
            const scene = this._getScene();
            if (scene && this.panelSprite.parent === scene) {
                scene.remove(this.panelSprite);
            }
            this.panelSprite.material?.dispose?.();
            this.panelSprite = null;
        }
        if (this._panelTexture) {
            this._panelTexture.dispose();
            this._panelTexture = null;
        }
        this._panelCanvas = null;
        this._panelPreviewImage = null;
        this._panelImageLoadId++;
    }

    _ensureWebglPanel(marker, skipImageFetch) {
        const content = this._getPanelContent(marker);
        if (!skipImageFetch && content.imagePath && !this._panelPreviewImage) {
            this._buildPanelTexture(marker, null);
        } else {
            this._buildPanelTexture(marker);
        }
        const tex = this._panelTexture;
        if (!tex) return;

        if (!skipImageFetch && content.imagePath) {
            this._requestWebglPanelImage(marker, content.imagePath);
        }

        if (!this.panelSprite) {
            const material = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                depthTest: false,
                depthWrite: false,
            });
            this.panelSprite = new THREE.Sprite(material);
            this.panelSprite.renderOrder = HOVER_CALLOUT_RENDER_ORDER;
            this.panelSprite.frustumCulled = false;
            const scene = this._getScene();
            if (scene) scene.add(this.panelSprite);
        } else if (this.panelSprite.material) {
            this.panelSprite.material.map = tex;
            this._applyAlwaysOnTopMaterial(this.panelSprite.material);
        }
    }

    _ensureWebglLine(accentHex) {
        if (!this.lineMesh) {
            const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
            const material = new THREE.MeshBasicMaterial({
                color: accentHex,
                transparent: true,
                opacity: 0.92,
                depthTest: false,
                depthWrite: false,
            });
            this.lineMesh = new THREE.Mesh(geometry, material);
            this.lineMesh.renderOrder = HOVER_CALLOUT_LINE_RENDER_ORDER;
            this.lineMesh.frustumCulled = false;
            const scene = this._getScene();
            if (scene) scene.add(this.lineMesh);
        } else if (this.lineMesh.material?.color) {
            this.lineMesh.material.color.setHex(accentHex);
            this._applyAlwaysOnTopMaterial(this.lineMesh.material);
        }
    }

    _getGlobeScreenVisibleBounds(container) {
        const m = CALLOUT_EDGE_MARGIN;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        return { left: m, top: m, right: w - m, bottom: h - m };
    }

    _markerScreenPosition(marker, camera, container) {
        marker.getWorldPosition(this._markerWorld);
        const ndc = this._scratchNdc.copy(this._markerWorld).project(camera);
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        return {
            mx: (ndc.x * 0.5 + 0.5) * w,
            my: (-ndc.y * 0.5 + 0.5) * h,
        };
    }

    _screenToWorldAtMarkerDepth(screenX, screenY, camera, markerWorld, container, target) {
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        this._scratchRayNdc.x = (screenX / w) * 2 - 1;
        this._scratchRayNdc.y = -(screenY / h) * 2 + 1;
        this._scratchRay.setFromCamera(this._scratchRayNdc, camera);
        const dist = camera.position.distanceTo(markerWorld);
        this._scratchRay.ray.at(dist, target);
    }

    _computeWebglPanelCenter(cornerWorld, anchorDir, panelW, panelH, camera, progress) {
        camera.updateMatrixWorld();
        camera.matrixWorld.extractBasis(this._cameraRight, this._cameraUp, this._cameraForward);
        const p = Math.max(0, Math.min(1, progress));
        const hw = panelW * 0.5 * p;
        const hh = panelH * 0.5 * p;
        const center = this._scratchPanelCenter.copy(cornerWorld);
        switch (anchorDir) {
            case 'br':
                center.addScaledVector(this._cameraRight, -hw).addScaledVector(this._cameraUp, hh);
                break;
            case 'tl':
                center.addScaledVector(this._cameraRight, hw).addScaledVector(this._cameraUp, -hh);
                break;
            case 'tr':
                center.addScaledVector(this._cameraRight, -hw).addScaledVector(this._cameraUp, -hh);
                break;
            case 'bl':
            default:
                center.addScaledVector(this._cameraRight, hw).addScaledVector(this._cameraUp, hh);
                break;
        }
        return center;
    }

    _startGlEnterAnimation(animKey) {
        this._glAnimPlayedKey = animKey;
        this._glAnimPhase = 'line';
        this._glAnimStartTime = performance.now();
        this._glLineProgress = 0;
        this._glPanelProgress = 0;
    }

    _advanceGlAnimation() {
        if (this._glAnimPhase === 'done') return;
        const now = performance.now();
        const elapsed = now - this._glAnimStartTime;
        if (this._glAnimPhase === 'line') {
            const t = Math.min(1, elapsed / CALLOUT_LINE_DRAW_MS);
            this._glLineProgress = easeCelestialIn(t);
            if (t >= 1) {
                this._glAnimPhase = 'panel';
                this._glAnimStartTime = now;
                this._glLineProgress = 1;
            }
        } else if (this._glAnimPhase === 'panel') {
            const t = Math.min(1, elapsed / CALLOUT_PANEL_POP_MS);
            this._glPanelProgress = easeCelestialIn(t);
            if (t >= 1) {
                this._glAnimPhase = 'done';
                this._glPanelProgress = 1;
            }
        }
    }

    _updateWebglCallout(marker) {
        const camera = this._getCamera();
        const container = this._getGlobeContainer();
        if (!camera || !container) return;

        const paletteKey = readPaletteKey();
        if (paletteKey !== this._paletteKey) {
            this._paletteKey = paletteKey;
            this._ensureWebglPanel(marker);
            this._ensureWebglLine(PALETTE_ACCENTS[paletteKey] || PALETTE_ACCENTS.blue);
        }

        const { mx, my } = this._markerScreenPosition(marker, camera, container);
        const visible = this._getGlobeScreenVisibleBounds(container);
        const panelScreenW = CALLOUT_PANEL_ESTIMATE_W;
        const panelScreenH = CALLOUT_PANEL_ESTIMATE_H;
        const layout = this._resolveCalloutScreenLayout(
            mx,
            my,
            visible,
            panelScreenW,
            panelScreenH,
            CALLOUT_SCREEN_OFFSET.x,
            CALLOUT_SCREEN_OFFSET.y,
        );
        this._frozenAnchorDir = layout.anchorDir;

        const animKey = this._getCalloutAnimKey(marker, layout.anchorDir);
        if (animKey !== this._glAnimPlayedKey) {
            this._startGlEnterAnimation(animKey);
        }
        if (this._glAnimPhase !== 'done') {
            this._advanceGlAnimation();
        } else {
            this._glLineProgress = 1;
            this._glPanelProgress = 1;
        }

        this._screenToWorldAtMarkerDepth(
            layout.cornerX,
            layout.cornerY,
            camera,
            this._markerWorld,
            container,
            this._scratchCorner,
        );

        const glTuck = this._tuckCalloutLineEnd(
            mx,
            my,
            layout.cornerX,
            layout.cornerY,
            CALLOUT_LINE_PANEL_TUCK_GLOBE_PX,
        );
        const tuckSx = glTuck.x;
        const tuckSy = glTuck.y;
        this._screenToWorldAtMarkerDepth(
            tuckSx,
            tuckSy,
            camera,
            this._markerWorld,
            container,
            this._scratchLineEnd,
        );

        const panelW = this._frozenPanelWorldWidth;
        const panelH = this._frozenPanelWorldHeight;

        if (this.lineMesh) {
            const start = this._markerWorld;
            const fullEnd = this._scratchLineEnd;
            this._scratchDir.subVectors(fullEnd, start);
            const fullLen = this._scratchDir.length();
            if (fullLen > 1e-6) {
                this._scratchDir.normalize();
                const currentLen = fullLen * this._glLineProgress;
                this._scratchMid.copy(start).addScaledVector(this._scratchDir, currentLen * 0.5);
                this.lineMesh.position.copy(this._scratchMid);
                this._scratchQuat.setFromUnitVectors(this._yAxis, this._scratchDir);
                this.lineMesh.quaternion.copy(this._scratchQuat);
                const r = this._frozenLineRadius;
                this.lineMesh.scale.set(r, Math.max(0.001, currentLen), r);
                this.lineMesh.visible = currentLen > 0.001;
            } else {
                this.lineMesh.visible = false;
            }
        }

        if (this.panelSprite) {
            const showPanel = this._glPanelProgress > 0.001;
            this.panelSprite.visible = showPanel;
            if (showPanel) {
                const center = this._computeWebglPanelCenter(
                    this._scratchCorner,
                    layout.anchorDir,
                    panelW,
                    panelH,
                    camera,
                    this._glPanelProgress,
                );
                this.panelSprite.position.copy(center);
                const pw = panelW * this._glPanelProgress;
                const ph = panelH * this._glPanelProgress;
                this.panelSprite.scale.set(Math.max(0.001, pw), Math.max(0.001, ph), 1);
            }
        }

    }

    show(marker) {
        if (!marker || marker.userData?.isLocked || marker.userData?.isInteractive === false) {
            this.hide();
            return;
        }

        const nextMode = 'dom';
        if (this.activeMarker !== marker || this._mode !== nextMode || !this._domRoot) {
            this.hide();
            this.activeMarker = marker;
            this._mode = nextMode;
            this._paletteKey = readPaletteKey();
            this._domAnchorBtn = this._isMapDomMode() ? this._findMapDomButton(marker) : null;
            this._freezeLayout(marker);
            this._ensureDomRoot(marker, this._domAnchorBtn);
            this._renderDomPanel(marker, this._paletteKey);
        }

        this.update();
    }

    /**
     * Tear down DOM overlay when the map/globe surface changes (avoids stale callouts in the old container).
     */
    resetForViewModeChange() {
        this._domAnimPlayedKey = null;
        this._domAnimPhase = 'idle';
        this._disposeDom();
        this.activeMarker = null;
        this._mode = null;
        this._domAnchorBtn = null;
    }

    clearAllOnViewModeChange() {
        this.resetForViewModeChange();
        this._disposeWebgl();
        this._overlapGroup = null;
        this._calloutStackMarkers = null;
        this._panelPreviewImage = null;
        this._panelImageLoadId++;
    }

    hide() {
        this._overlapGroup = null;
        this._calloutStackMarkers = null;
        this.activeMarker = null;
        this._mode = null;
        this._panelPreviewImage = null;
        this._panelImageLoadId++;
        this._disposeWebgl();
        this._disposeDom();
    }

    update() {
        if (!this.activeMarker) return;

        const eventSlide = document.getElementById('eventSlide');
        if (eventSlide?.classList.contains('open')) {
            this.hide();
            return;
        }

        const marker = this.activeMarker;
        if (!marker.userData || (!marker.parent && !marker.userData.isMap2dLiteProxy)) {
            this.hide();
            return;
        }

        if (marker.userData.isMap2dLiteProxy && !this._isMapDomMode()) {
            this.hide();
            return;
        }

        this._updateDomCallout(marker);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldviewMarkerHoverCallout;
}

if (typeof window !== 'undefined') {
    window.WorldviewMarkerHoverCallout = WorldviewMarkerHoverCallout;
}
