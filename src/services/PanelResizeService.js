/**
 * Desktop-only panel width resize: sets --user-panel-* on :root (see panel-resize.css + panel styles).
 * Custom widths are cleared when the panel closes (no localStorage).
 */
(function () {
    'use strict';

    var MOBILE_MQ = '(max-width: 768px)';

    var PANELS = [
        {
            id: 'eventSlide',
            name: 'Event info',
            edge: 'inner-right',
            cssVar: '--user-panel-event-width',
            defaultVar: '--panel-event-width',
            maxVar: '--panel-event-width-max'
        },
        {
            id: 'filtersPanel',
            name: 'Filters',
            edge: 'inner-left',
            cssVar: '--user-panel-filters-width',
            defaultVar: '--panel-filters-width',
            maxVar: '--panel-filters-width-max'
        },
        { id: 'musicPanel', name: 'Music', edge: 'inner-left', cssVar: '--user-panel-music-width', defaultVar: '--panel-music-width' },
        { id: 'eventsManagePanel', name: 'Manager', edge: 'inner-left', cssVar: '--user-panel-events-manage-width', defaultVar: '--panel-events-manage-width' }
    ];

    var LEGACY_STORAGE_KEYS = [
        'overwatch-timeline:panelW:event',
        'overwatch-timeline:panelW:filters',
        'overwatch-timeline:panelW:music',
        'overwatch-timeline:panelW:eventsManage'
    ];

    var GEAR_TICK_SRC = 'assets/audio/sfx/tick.mp3';
    /** Pointer movement (px) before one tick is eligible */
    var GEAR_TICK_EVERY_PX = 10;
    /** Avoid stacking ticks faster than the clip can breathe (ms) */
    var GEAR_TICK_MIN_INTERVAL_MS = 42;
    var GEAR_TICK_POOL_SIZE = 6;
    /** Base loudness; multiplied by Sound Effects slider (same as panel dragger + page-slider scrub ticks). */
    var GEAR_TICK_VOLUME_BASE = 0.36;

    function gearTickEffectiveVolume() {
        var sfx = typeof window !== 'undefined' ? window.SoundEffectsManager : null;
        var g =
            sfx && typeof sfx.volume === 'number' && !isNaN(sfx.volume)
                ? Math.max(0, Math.min(1, sfx.volume))
                : 0.5;
        return Math.max(0, Math.min(1, GEAR_TICK_VOLUME_BASE * g));
    }

    function syncGearTickPoolVolume() {
        if (!gearTickPool || !gearTickPool.length) {
            return;
        }
        var v = gearTickEffectiveVolume();
        gearTickPool.forEach(function (a) {
            try {
                a.volume = v;
            } catch (e) {
                /* ignore */
            }
        });
    }

    /** Cumulative px pulled past clamp before rim appears; then ramp to 1 over RIM_PULL_RAMP_PX more */
    var RIM_PULL_DEAD_PX = 28;
    var RIM_PULL_RAMP_PX = 90;

    /** Log one line on each resize drag release. Set true while tuning. */
    var LOG_DRAG_DISTANCE_ON_RELEASE = false;

    var gearTickPool = null;
    var gearTickPoolIx = 0;
    var lastGearTickPerfMs = 0;

    function getGearTickPool() {
        if (!gearTickPool) {
            gearTickPool = [];
            for (var i = 0; i < GEAR_TICK_POOL_SIZE; i++) {
                var a = new Audio(GEAR_TICK_SRC);
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

    function stopGearTicks() {
        if (!gearTickPool) {
            return;
        }
        gearTickPool.forEach(function (a) {
            try {
                a.pause();
                a.currentTime = 0;
            } catch (e) {
                /* ignore */
            }
        });
    }

    /** @returns {boolean} true if a tick actually played */
    function playGearTick() {
        var now =
            typeof performance !== 'undefined' && typeof performance.now === 'function'
                ? performance.now()
                : Date.now();
        if (now - lastGearTickPerfMs < GEAR_TICK_MIN_INTERVAL_MS) {
            return false;
        }

        var pool = getGearTickPool();
        var n = pool.length;
        var i;
        var a;
        for (i = 0; i < n; i++) {
            var idx = (gearTickPoolIx + i) % n;
            a = pool[idx];
            if (!isGearSlotIdle(a)) {
                continue;
            }
            try {
                a.currentTime = 0;
                a.volume = gearTickEffectiveVolume();
                var p = a.play();
                gearTickPoolIx = (idx + 1) % n;
                lastGearTickPerfMs = now;
                if (p && typeof p.catch === 'function') {
                    p.catch(function () {});
                }
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    function isMobile() {
        return window.matchMedia(MOBILE_MQ).matches;
    }

    function getDefaultPx(defaultVar) {
        var raw = getComputedStyle(document.documentElement).getPropertyValue(defaultVar).trim();
        var n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : 600;
    }

    /** Optional positive length from :root (returns null if missing/invalid). */
    function getOptionalPx(cssVar) {
        var raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
        var n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function maxPanelPx() {
        /* Allow nearly full viewport width; small gutter keeps map/map UI usable */
        return Math.max(400, Math.floor(window.innerWidth * 0.99 - 8));
    }

    function maxWidthForPanel(cfg) {
        var cap = maxPanelPx();
        if (cfg && cfg.maxVar) {
            var m = getOptionalPx(cfg.maxVar);
            if (m != null) {
                return Math.min(m, cap);
            }
        }
        return cap;
    }

    function clampWidth(px, cfg) {
        var min = getDefaultPx(cfg.defaultVar);
        var max = maxWidthForPanel(cfg);
        return Math.min(Math.max(px, min), max);
    }

    function clearUserWidth(cfg) {
        document.documentElement.style.removeProperty(cfg.cssVar);
    }

    function purgeLegacyStorage() {
        LEGACY_STORAGE_KEYS.forEach(function (key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                /* ignore */
            }
        });
    }

    var EVENT_TRAP_PAGE_ICON = 'assets/images/icons/Page Icon.png';
    var FILTERS_TRAP_EMPTY = 'assets/images/icons/Empty Filter Icon.png';
    var FILTERS_TRAP_ACTIVE = 'assets/images/icons/Filter Icon.png';
    var MUSIC_TRAP_ICON = 'assets/images/icons/Music Icon.png';

    function filtersTrapHasActiveSelection() {
        try {
            if (
                window.FilterService &&
                window.FilterService.stateManager &&
                window.FilterService.stateManager.selectedFilters
            ) {
                return window.FilterService.stateManager.selectedFilters.size > 0;
            }
        } catch (e) {
            /* ignore */
        }
        return !!(window.standaloneActiveFilters && window.standaloneActiveFilters.size > 0);
    }

    /** @param {HTMLImageElement|null|undefined} trapImg optional img from ensureHandle */
    function syncFiltersPanelTrapIcon(trapImg) {
        var img = trapImg;
        if (!img || !img.tagName || img.tagName.toLowerCase() !== 'img') {
            var panel = document.getElementById('filtersPanel');
            // Only update the filters-mode trapezium icon; keep music-mode icon untouched.
            img =
                panel &&
                panel.querySelector(
                    '.panel-resize-handle[data-panel-mode="filters"] .panel-resize-handle__trap-icon'
                );
        }
        if (!img || !img.tagName || img.tagName.toLowerCase() !== 'img') {
            return;
        }
        img.src = filtersTrapHasActiveSelection() ? FILTERS_TRAP_ACTIVE : FILTERS_TRAP_EMPTY;
    }

    function syncFiltersPanelTrapIconFromWindow() {
        syncFiltersPanelTrapIcon(null);
    }

    function currentWidthPx(cfg) {
        var curVar = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
        if (curVar) {
            var n = parseInt(curVar, 10);
            if (Number.isFinite(n) && n > 0) return n;
        }
        return getDefaultPx(cfg.defaultVar);
    }

    function ensureWatchPanelClose(panel, cfg) {
        if (!panel || panel.dataset.panelResizeCloseWatch === '1') return;
        panel.dataset.panelResizeCloseWatch = '1';
        var closeCleanupRaf = null;
        var obs = new MutationObserver(function () {
            if (panel.classList.contains('open')) return;
            if (closeCleanupRaf != null) return;
            closeCleanupRaf = requestAnimationFrame(function () {
                closeCleanupRaf = null;
                if (panel.classList.contains('open')) return;
                clearUserWidth(cfg);
                panel.classList.remove('panel-resize--at-limit');
                panel.style.removeProperty('--panel-resize-rim-strength');
            });
        });
        obs.observe(panel, { attributes: true, attributeFilter: ['class'] });
        if (!panel.classList.contains('open')) {
            clearUserWidth(cfg);
        }
    }

    function ensureHandle(panel, cfg) {
        if (!panel || panel.querySelector('.panel-resize-handle')) return;
        function createHandle(options) {
            var opts = options || {};
            var mode = opts.mode || 'filters';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'panel-resize-handle panel-resize-handle--' + cfg.edge + (opts.extraClass ? (' ' + opts.extraClass) : '');
            btn.setAttribute('aria-orientation', 'vertical');
            btn.setAttribute('aria-label', opts.ariaLabel || ('Resize ' + cfg.name + ' panel'));
            btn.title = opts.title || (cfg.name + ' panel - Drag to resize. Width resets when you close the panel. Double-click to reset now.');
            if (cfg.id === 'filtersPanel') {
                btn.dataset.panelMode = mode;
            }

            var pill = document.createElement('span');
            pill.className = 'panel-resize-handle__pill';
            pill.setAttribute('aria-hidden', 'true');
            var icon = document.createElement('img');
            icon.className = 'ui-pagination-arrow panel-resize-handle__arrow';
            icon.src = 'assets/images/icons/Arrow Icon.png';
            icon.alt = '';
            icon.decoding = 'async';
            icon.width = 22;
            icon.height = 22;
            icon.setAttribute('aria-hidden', 'true');
            /* inner-right: point right; inner-left: point left (default asset) */
            if (cfg.edge === 'inner-right') {
                icon.classList.add('ui-pagination-arrow--flip-h');
            }
            pill.appendChild(icon);
            if (cfg.id === 'eventSlide' || cfg.id === 'filtersPanel') {
                var trapLabel = document.createElement('span');
                trapLabel.className = 'panel-resize-handle__trap-label';
                trapLabel.setAttribute('aria-hidden', 'true');
                var trapImg = document.createElement('img');
                trapImg.className = 'panel-resize-handle__trap-icon';
                trapImg.alt = '';
                trapImg.decoding = 'async';
                trapImg.setAttribute('aria-hidden', 'true');
                if (cfg.id === 'eventSlide') {
                    trapImg.src = EVENT_TRAP_PAGE_ICON;
                } else if (mode === 'music') {
                    trapImg.src = MUSIC_TRAP_ICON;
                } else {
                    trapImg.src = FILTERS_TRAP_EMPTY;
                    syncFiltersPanelTrapIcon(trapImg);
                }
                trapLabel.appendChild(trapImg);
                btn.appendChild(trapLabel);
            }
            btn.appendChild(pill);
            return btn;
        }

        function attachHandleBehavior(btn) {
            var dragState = null;

            btn.addEventListener('dblclick', function (e) {
                e.preventDefault();
                clearUserWidth(cfg);
            });

            // Click to open panel when collapsed (for event slide and filters panel)
            btn.addEventListener('click', function (e) {
                if (!panel.classList.contains('open')) {
                    e.preventDefault();

                    if (cfg.id === 'eventSlide') {
                    // Check if event system is loaded
                    const testBtn = document.getElementById('testBtn');
                    const isEventSystemLoaded = testBtn && testBtn.dataset.loaded === 'true';

                    if (!isEventSystemLoaded) {
                        console.warn('[PanelResizeService] Event system not loaded, cannot open event slide');
                        // Optionally show a message to the user
                        if (window.updateStatus) {
                            window.updateStatus('Please load the Event System first to view events', 'warning');
                        }
                        return;
                    }

                    // Try to open last opened event, or first event if none
                    try {
                        const lastEventStr = localStorage.getItem('lastOpenedEvent');
                        let eventToOpen = null;

                        if (lastEventStr) {
                            eventToOpen = JSON.parse(lastEventStr);
                        }

                        // Get event manager
                        const eventManager = window.eventManager;

                        if (eventManager && eventManager.openEventFromList) {
                            let eventData = null;
                            let eventIndex = -1;
                            const events = eventManager.events || [];

                            if (eventToOpen) {
                                // Try to find the last opened event by name
                                eventIndex = events.findIndex(ev => ev.name === eventToOpen.name);
                                if (eventIndex >= 0) {
                                    eventData = events[eventIndex];
                                }
                            }

                            // If no last event or not found, get first event
                            if (!eventData && events.length > 0) {
                                eventData = events[0];
                                eventIndex = 0;
                            }

                            // Open the event using eventManager.openEventFromList
                            if (eventData && eventIndex >= 0) {
                                eventManager.openEventFromList(eventData, eventIndex);
                            } else {
                                console.warn('[PanelResizeService] No event data available, just opening panel');
                                panel.classList.add('open');
                            }
                        } else {
                            console.warn('[PanelResizeService] No event manager or openEventFromList available, just opening panel');
                            panel.classList.add('open');
                        }
                    } catch (err) {
                        console.error('[PanelResizeService] Failed to open last event:', err);
                        console.error('[PanelResizeService] Error stack:', err.stack);
                        // Fallback: just open the panel
                        panel.classList.add('open');
                    }

                        if (window.SoundEffectsManager?.play) {
                            window.SoundEffectsManager.play('eventClick');
                        }
                    } else if (cfg.id === 'filtersPanel') {
                        var mode = btn.dataset.panelMode === 'music' ? 'music' : 'filters';
                        if (window.FilterService && typeof window.FilterService.openPanelWithMode === 'function') {
                            window.FilterService.openPanelWithMode(mode);
                        } else {
                            panel.classList.add('open');
                        }
                        if (window.SoundEffectsManager?.play) {
                            window.SoundEffectsManager.play(mode === 'music' ? 'music' : 'filterButton');
                        }
                    }
                } else if (cfg.id === 'filtersPanel') {
                    // Shared panel is already open: clicking the other trapezium should switch modes.
                    var targetMode = btn.dataset.panelMode === 'music' ? 'music' : 'filters';
                    var currentMode = panel.dataset.panelMode === 'music' ? 'music' : 'filters';
                    if (targetMode !== currentMode) {
                        e.preventDefault();
                        if (window.FilterService && typeof window.FilterService.openPanelWithMode === 'function') {
                            window.FilterService.openPanelWithMode(targetMode);
                        }
                        if (window.SoundEffectsManager?.play) {
                            window.SoundEffectsManager.play(targetMode === 'music' ? 'music' : 'filterButton');
                        }
                    }
                }
            });

            function onPointerMove(ev) {
                if (!dragState || isMobile()) return;
                var pxMove = Math.abs(ev.clientX - dragState.lastPointerX);
                var dx = ev.clientX - dragState.startX;
                var raw;
                if (cfg.edge === 'inner-right') {
                    raw = dragState.startWidth + dx;
                } else {
                    raw = dragState.startWidth - dx;
                }
                var minW = getDefaultPx(cfg.defaultVar);
                var maxW = maxWidthForPanel(cfg);
                var next = clampWidth(raw, cfg);
                document.documentElement.style.setProperty(cfg.cssVar, next + 'px');

                var atLimit = raw < minW || raw > maxW;
                dragState.lastPointerX = ev.clientX;
                dragState.lastRawWidth = raw;
                dragState.totalAbsDx = (dragState.totalAbsDx || 0) + pxMove;

                if (atLimit) {
                    stopGearTicks();
                    dragState.gearAccum = 0;
                    dragState.limitPullAccum = (dragState.limitPullAccum || 0) + pxMove;
                    var over = dragState.limitPullAccum - RIM_PULL_DEAD_PX;
                    var t = over <= 0 ? 0 : Math.min(1, over / RIM_PULL_RAMP_PX);
                    t = t * t * (3 - 2 * t);
                    if (t > 0.008) {
                        panel.classList.add('panel-resize--at-limit');
                        panel.style.setProperty('--panel-resize-rim-strength', t.toFixed(4));
                    } else {
                        panel.classList.remove('panel-resize--at-limit');
                        panel.style.removeProperty('--panel-resize-rim-strength');
                    }
                    return;
                }

                dragState.limitPullAccum = 0;
                panel.classList.remove('panel-resize--at-limit');
                panel.style.removeProperty('--panel-resize-rim-strength');

                dragState.gearAccum += pxMove;
                while (dragState.gearAccum >= GEAR_TICK_EVERY_PX) {
                    if (!playGearTick()) {
                        break;
                    }
                    dragState.gearAccum -= GEAR_TICK_EVERY_PX;
                }
            }

            function endDrag() {
                if (!dragState) return;
                var ds = dragState;
                if (LOG_DRAG_DISTANCE_ON_RELEASE) {
                    var minW = getDefaultPx(cfg.defaultVar);
                    var maxW = maxWidthForPanel(cfg);
                    var finalW = currentWidthPx(cfg);
                    var widthDelta = finalW - ds.startWidth;
                    var travel = ds.totalAbsDx || 0;
                    var lastRaw =
                        typeof ds.lastRawWidth === 'number' && Number.isFinite(ds.lastRawWidth)
                            ? Math.round(ds.lastRawWidth)
                            : null;
                    var msg =
                        '[PanelResize drag end] ' +
                        cfg.name +
                        ' | pointer travel: ' +
                        Math.round(travel) +
                        'px | width: ' +
                        Math.round(ds.startWidth) +
                        '→' +
                        Math.round(finalW) +
                        ' (' +
                        (widthDelta >= 0 ? '+' : '') +
                        Math.round(widthDelta) +
                        'px) | clamp min/max: ' +
                        minW +
                        '/' +
                        maxW;
                    if (lastRaw != null) {
                        msg += ' | last raw (pre-clamp): ' + lastRaw;
                    }
                    console.log(msg);
                }
                stopGearTicks();
                panel.classList.remove('panel--resizing');
                panel.classList.remove('panel-resize--at-limit');
                panel.style.removeProperty('--panel-resize-rim-strength');
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', endDrag);
                window.removeEventListener('pointercancel', endDrag);
                try {
                    btn.releasePointerCapture(ds.pointerId);
                } catch (e) {
                    /* ignore */
                }
                dragState = null;
                var cur = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
                var n = parseInt(cur, 10);
                if (Number.isFinite(n)) {
                    var def = getDefaultPx(cfg.defaultVar);
                    if (n <= def) {
                        clearUserWidth(cfg);
                    }
                }
            }

            btn.addEventListener('pointerdown', function (ev) {
                if (ev.button !== 0 || isMobile()) return;
                ev.preventDefault();
                var w = currentWidthPx(cfg);
                dragState = {
                    startX: ev.clientX,
                    startWidth: w,
                    pointerId: ev.pointerId,
                    lastPointerX: ev.clientX,
                    gearAccum: 0,
                    limitPullAccum: 0,
                    totalAbsDx: 0,
                    lastRawWidth: w
                };
                stopGearTicks();
                panel.classList.remove('panel-resize--at-limit');
                panel.style.removeProperty('--panel-resize-rim-strength');
                panel.classList.add('panel--resizing');
                btn.setPointerCapture(ev.pointerId);
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
            });

            panel.appendChild(btn);
        }

        if (cfg.id === 'filtersPanel') {
            var filtersBtn = createHandle({
                mode: 'music',
                extraClass: 'panel-resize-handle--filters-launch',
                ariaLabel: 'Resize and open music menu',
                title: 'Music menu - Drag to resize. Click to open music menu.'
            });
            attachHandleBehavior(filtersBtn);
            var musicBtn = createHandle({
                mode: 'filters',
                extraClass: 'panel-resize-handle--music-launch',
                ariaLabel: 'Resize filters panel'
            });
            attachHandleBehavior(musicBtn);
        } else {
            attachHandleBehavior(createHandle({}));
        }
    }

    function tryAttachAll() {
        if (isMobile()) return;
        PANELS.forEach(function (cfg) {
            var panel = document.getElementById(cfg.id);
            if (panel) {
                ensureWatchPanelClose(panel, cfg);
                ensureHandle(panel, cfg);
            }
        });
        syncFiltersPanelTrapIconFromWindow();
    }

    /** Body subtree mutations can fire in huge bursts; coalesce to one rAF. */
    var tryAttachScheduled = false;
    function scheduleTryAttachAll() {
        if (tryAttachScheduled) return;
        tryAttachScheduled = true;
        requestAnimationFrame(function () {
            tryAttachScheduled = false;
            tryAttachAll();
        });
    }

    function onResize() {
        if (isMobile()) return;
        PANELS.forEach(function (cfg) {
            var raw = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
            if (!raw) return;
            var px = parseInt(raw, 10);
            if (!Number.isFinite(px)) return;
            var c = clampWidth(px, cfg);
            if (c !== px) {
                document.documentElement.style.setProperty(cfg.cssVar, c + 'px');
            }
        });
    }

    function removeInlineUserWidthsForMobileCss() {
        PANELS.forEach(clearUserWidth);
    }

    function init() {
        purgeLegacyStorage();
        tryAttachAll();
        if (!isMobile()) {
            var mo = new MutationObserver(function () {
                scheduleTryAttachAll();
            });
            if (document.body) {
                mo.observe(document.body, { childList: true, subtree: true });
            }
        }
        window.addEventListener('resize', onResize);
        window.matchMedia(MOBILE_MQ).addEventListener('change', function () {
            if (isMobile()) {
                removeInlineUserWidthsForMobileCss();
            } else {
                tryAttachAll();
            }
        });
    }

    if (typeof window !== 'undefined') {
        window.PanelResizeGearTick = {
            play: playGearTick,
            syncFromSoundEffectsVolume: syncGearTickPoolVolume
        };
        window.syncFiltersPanelTrapIcon = syncFiltersPanelTrapIconFromWindow;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
