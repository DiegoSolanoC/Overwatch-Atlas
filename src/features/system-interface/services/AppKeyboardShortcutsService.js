/**
 * Global keyboard shortcuts (timeline mode, panels, pagination).
 * Z: pagination dock collapse/expand (desktop dock). Loaded as a classic script; capture phase.
 */
(function initAppKeyboardShortcuts() {
    if (window.__appKeyboardShortcutsInstalled) return;
    window.__appKeyboardShortcutsInstalled = true;

    var SCROLL_STEP = 80;

    function consumeEvent(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }

    function inputType(el) {
        if (!el || (el.tagName || '').toUpperCase() !== 'INPUT') return '';
        return String(el.type || '').toLowerCase();
    }

    function isTypingContext(target) {
        if (!target || !target.closest) return false;
        var el = target;
        if (el.isContentEditable) return true;
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (tag === 'INPUT') {
            var it = inputType(el);
            /* Range is not text entry — allow A/D and arrows to change pages + sync slider */
            if (it === 'range' || it === 'checkbox' || it === 'radio' || it === 'button' || it === 'submit' || it === 'reset' || it === 'file') return false;
            return true;
        }
        if (el.closest && el.closest('[contenteditable="true"]')) return true;
        return false;
    }

    function isEventPageRangeSlider(target) {
        return inputType(target) === 'range' && target && target.id === 'eventPageSlider';
    }

    /**
     * Escape should still dismiss our panels when focus is in a field inside them.
     * (Plain Q is not bypassed — avoids closing while typing "q" in search.)
     */
    function escapeOkWhileTypingInTarget(target) {
        if (!target || !target.closest) return false;
        return !!(
            target.closest('#filtersPanel')
            || target.closest('#musicPanel')
            || target.closest('#eventsManagePanel')
            || target.closest('#paletteMenu')
            || target.closest('#eventSlide')
            || target.closest('#externalLinkConfirmOverlay')
        );
    }

    function modifiersActive(e) {
        return e.ctrlKey || e.metaKey || e.altKey;
    }

    function isGlobeTimelineMode() {
        var mode = (typeof localStorage !== 'undefined' && localStorage.getItem('currentMode')) || '';
        return mode.toString().toLowerCase() === 'globe' && !!window.globeController;
    }

    function isCodexModeActive() {
        return typeof document !== 'undefined' && document.body && document.body.classList.contains('codex-mode-active');
    }

    /** Globe timeline or Codex: same events UI / dataModel (bridge), but no WebGL globe. */
    function canUseTimelinePaginationShortcuts() {
        if (isGlobeTimelineMode()) return true;
        // Standalone TEST mode: pagination dock is present and standaloneEventSlide is active
        const hasPaginationDock = !!document.getElementById('paginationDock');
        const hasStandaloneSlide = !!window.standaloneEventSlide;
        if (hasPaginationDock && hasStandaloneSlide) return true;
        // Codex mode check
        if (!isCodexModeActive()) return false;
        return !!(codexOrGlobeDataModel() && codexOrGlobeUiView());
    }

    function codexOrGlobeDataModel() {
        var gc = window.globeController;
        if (gc && gc.dataModel) return gc.dataModel;
        var br = window.__codexEventSlideBridge;
        if (br && br.dataModel) return br.dataModel;
        // Support standalone event system
        if (window.eventManager?.events) return window.eventManager;
        return null;
    }

    function codexOrGlobeUiView() {
        var gc = window.globeController;
        if (gc && gc.uiView) return gc.uiView;
        var br = window.__codexEventSlideBridge;
        if (br && br.uiView) return br.uiView;
        // Support standalone event system
        if (window.standaloneEventSlide) return window.standaloneEventSlide;
        return null;
    }

    function canNavigateGlobePages() {
        var dm = codexOrGlobeDataModel();
        return dm && typeof dm.getTotalEventPages === 'function' && dm.getTotalEventPages() > 1;
    }

    function getScrollContainer() {
        var slide = document.getElementById('eventSlide');
        if (slide && slide.classList.contains('open')) {
            return document.getElementById('eventSlideScrollable');
        }
        var manage = document.getElementById('eventsManagePanel');
        if (manage && manage.classList.contains('open')) {
            return document.getElementById('eventsList');
        }
        var filters = document.getElementById('filtersPanel');
        if (filters && filters.classList.contains('open')) {
            return filters.querySelector('.filters-panel-content');
        }
        var music = document.getElementById('musicPanel');
        if (music && music.classList.contains('open')) {
            return music.querySelector('.music-panel-content');
        }
        return null;
    }

    function getPaginationOnChange() {
        var ui = codexOrGlobeUiView();
        if (ui && typeof ui._paginationOnPageChange === 'function') return ui._paginationOnPageChange;
        var T = window.TimelineMarkerSync;
        if (T && typeof T.refreshTimelineEventMarkers === 'function') {
            return function () {
                T.refreshTimelineEventMarkers();
            };
        }
        return null;
    }

    function runGlobePagePrev() {
        if (!canNavigateGlobePages()) return false;
        var dm = codexOrGlobeDataModel();
        var ui = codexOrGlobeUiView();
        var h = window.NavigationPaginationHelpers;
        if (!dm || !ui || typeof ui.updatePaginationUI !== 'function' || !h) return false;
        h.handlePrevPageClick(dm, ui.updatePaginationUI, getPaginationOnChange());
        return true;
    }

    function runGlobePageNext() {
        if (!canNavigateGlobePages()) return false;
        var dm = codexOrGlobeDataModel();
        var ui = codexOrGlobeUiView();
        var h = window.NavigationPaginationHelpers;
        if (!dm || !ui || typeof ui.updatePaginationUI !== 'function' || !h) return false;
        h.handleNextPageClick(dm, ui.updatePaginationUI, getPaginationOnChange());
        return true;
    }

    function triggerPrevPageButtonOrHelpers() {
        var btn = document.getElementById('prevPageBtn');
        if (btn && !btn.disabled) {
            btn.click();
            return true;
        }
        return runGlobePagePrev();
    }

    function triggerNextPageButtonOrHelpers() {
        var btn = document.getElementById('nextPageBtn');
        if (btn && !btn.disabled) {
            btn.click();
            return true;
        }
        return runGlobePageNext();
    }

    function isEventSlideOpen() {
        var s = document.getElementById('eventSlide');
        return !!(s && s.classList.contains('open'));
    }

    function isEventsManageOpen() {
        var p = document.getElementById('eventsManagePanel');
        return !!(p && p.classList.contains('open'));
    }

    function isPaletteMenuOpen() {
        var m = document.getElementById('paletteMenu');
        return !!(m && m.classList.contains('open'));
    }

    function clickIfEnabled(id) {
        var b = document.getElementById(id);
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    /** Arrow Up/Down and W/S: scroll in panel, else zoom, else page scroll */
    function applyVerticalNavigation(scrollEl, e, isUp) {
        if (scrollEl) {
            scrollEl.scrollTop += isUp ? -SCROLL_STEP : SCROLL_STEP;
            consumeEvent(e);
        } else if (clickIfEnabled(isUp ? 'zoomInBtn' : 'zoomOutBtn')) {
            consumeEvent(e);
        } else {
            var root = document.scrollingElement || document.documentElement;
            if (root && root.scrollHeight > root.clientHeight) {
                root.scrollTop += isUp ? -SCROLL_STEP : SCROLL_STEP;
                consumeEvent(e);
            }
        }
    }

    function getEventVariantToggleButtons() {
        if (!isEventSlideOpen()) return null;
        var c = document.getElementById('eventVariantToggles');
        if (!c) return null;
        try {
            if (window.getComputedStyle(c).display === 'none') return null;
        } catch (_) {
            return null;
        }
        var btns = c.querySelectorAll('.variant-toggle-btn');
        if (!btns || !btns.length) return null;
        return btns;
    }

    /** @returns {'ok'|'invalid'|null} */
    function tryVariantDigitKey(digit) {
        var btns = getEventVariantToggleButtons();
        if (!btns) return null;
        var idx = digit === '10' ? 9 : parseInt(digit, 10) - 1;
        if (idx < 0 || idx >= btns.length) return 'invalid';
        var btn = btns[idx];
        if (btn.disabled) return 'invalid';
        btn.click();
        return 'ok';
    }

    /** Cycles through variant buttons using Tab key */
    function cycleVariantButton(forward) {
        var btns = getEventVariantToggleButtons();
        if (!btns || btns.length === 0) return false;

        // Find currently active variant button
        var currentIndex = -1;
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].classList.contains('active')) {
                currentIndex = i;
                break;
            }
        }

        // Calculate next index (with wraparound)
        var nextIndex;
        if (forward) {
            nextIndex = currentIndex >= 0 ? (currentIndex + 1) % btns.length : 0;
        } else {
            nextIndex = currentIndex >= 0 ? (currentIndex - 1 + btns.length) % btns.length : btns.length - 1;
        }

        // Click the next button
        var nextBtn = btns[nextIndex];
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
            // Play sound effect for variant toggle (switchEvent)
            if (window.SoundEffectsManager && typeof window.SoundEffectsManager.play === 'function') {
                window.SoundEffectsManager.play('switchEvent');
            }
            return true;
        }

        return false;
    }

    var PALETTE_ORDER = ['blue', 'gray', 'crimson', 'nulled'];

    function normalizeStoredPalette() {
        try {
            var s = localStorage.getItem('colorPalette');
            if (s === 'gray') return 'gray';
            if (s === 'crimson') return 'crimson';
            if (s === 'nulled') return 'nulled';
            return 'blue';
        } catch (_) {
            return 'blue';
        }
    }

    function applyPaletteByName(name) {
        var btn = document.querySelector('#paletteMenu .palette-option-btn[data-palette="' + name + '"]');
        if (btn) btn.click();
    }

    function triggerEventSlidePrev() {
        /* Dock rail (standalone / timeline): wired in MenuHelpers with page sync + filtered nav */
        var dock = document.getElementById('prevEventBtn');
        if (dock && !dock.disabled) {
            dock.click();
            return true;
        }
        var b = document.getElementById('eventPrevBtn');
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    function triggerEventSlideNext() {
        var dock = document.getElementById('nextEventBtn');
        if (dock && !dock.disabled) {
            dock.click();
            return true;
        }
        var b = document.getElementById('eventNextBtn');
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    function triggerEventsManagePrev() {
        var b = document.getElementById('eventsPrevPage');
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    function triggerEventsManageNext() {
        var b = document.getElementById('eventsNextPage');
        if (!b || b.disabled) return false;
        b.click();
        return true;
    }

    function triggerNumberButton(positionStr) {
        var btn = document.querySelector(
            '#eventNumberButtons .event-number-btn[data-position="' + positionStr + '"]'
        );
        if (!btn) {
            console.log('AppKeyboardShortcuts: No button found for position', positionStr);
            return false;
        }
        if (!btn.disabled) {
            btn.click();
            return true;
        }
        return false;
    }

    function clearHackedOverlays() {
        document.querySelectorAll('.hacked-overlay').forEach(function (el) {
            el.remove();
        });
    }

    function hideEventSlideIfOpen() {
        var slide = document.getElementById('eventSlide');
        var overlay = document.getElementById('eventImageOverlay');

        // Check if slide is actually open before trying to close
        var slideOpen = slide && slide.classList.contains('open');
        var overlayOpen = overlay && overlay.classList.contains('open');

        if (!slideOpen && !overlayOpen) return false;

        var closed = false;

        try {
            var uiHide = codexOrGlobeUiView();
            if (uiHide && typeof uiHide.hideEventSlide === 'function') {
                clearHackedOverlays();
                uiHide.hideEventSlide();
                // Also hide image overlay to match X button behavior
                if (uiHide.hideImageOverlay) {
                    uiHide.hideImageOverlay();
                }
                closed = true;
            }
        } catch (_) {}

        if (!closed && slideOpen) {
            slide.classList.remove('open');
            if (overlay) overlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
            closed = true;
        }
        if (!closed && overlayOpen) {
            overlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
            closed = true;
        }

        // CRITICAL: Reset camera when closing event slide via keyboard shortcut
        // This matches the X button behavior and prevents station/ship follow from continuing
        if (closed) {
            console.log('[AppKeyboardShortcuts] Event slide closed via keyboard, resetting camera');
            if (window.globeController?.interactionController) {
                window.globeController.interactionController.stopFollowingStation();
                window.globeController.interactionController.restorePlanesVisibility?.();
            }
            if (window.globeController?.cameraControlService) {
                window.globeController.cameraControlService.resetCameraToDefault();
            }
        }

        return closed;
    }

    /** @returns {boolean} whether something was closed */
    function closeTopOverlay() {
        console.log('[DEBUG Keyboard] closeTopOverlay called');
        
        var ext = document.getElementById('externalLinkConfirmOverlay');
        if (ext && ext.classList.contains('is-open')) {
            console.log('[DEBUG Keyboard] Closing external link confirm');
            var cancel = document.getElementById('externalLinkConfirmCancel');
            if (cancel) cancel.click();
            else ext.classList.remove('is-open');
            return true;
        }

        if (hideEventSlideIfOpen()) {
            console.log('[DEBUG Keyboard] Closed event slide');
            return true;
        }

        var palette = document.getElementById('paletteMenu');
        if (palette && palette.classList.contains('open')) {
            console.log('[DEBUG Keyboard] Closing palette');
            if (typeof window._closePaletteMenu === 'function') {
                window._closePaletteMenu();
            } else {
                palette.classList.remove('open');
                var paletteToggle = document.getElementById('colorPaletteToggle');
                if (paletteToggle) paletteToggle.classList.remove('active');
            }
            return true;
        }

        var filters = document.getElementById('filtersPanel');
        console.log('[DEBUG Keyboard] filtersPanel:', !!filters, 'open:', filters?.classList.contains('open'));
        if (filters && filters.classList.contains('open')) {
            console.log('[DEBUG Keyboard] Closing filters panel');
            var fc = document.getElementById('filtersPanelClose');
            if (fc) fc.click();
            else filters.classList.remove('open');
            return true;
        }

        var music = document.getElementById('musicPanel');
        console.log('[DEBUG Keyboard] musicPanel:', !!music, 'open:', music?.classList.contains('open'));
        if (music && music.classList.contains('open')) {
            console.log('[DEBUG Keyboard] Closing music panel');
            var mc = document.getElementById('musicPanelClose');
            if (mc) mc.click();
            else music.classList.remove('open');
            return true;
        }

        var manage = document.getElementById('eventsManagePanel');
        console.log('[DEBUG Keyboard] eventsManagePanel:', !!manage, 'open:', manage?.classList.contains('open'));
        if (manage && manage.classList.contains('open')) {
            console.log('[DEBUG Keyboard] Closing events manage panel');
            var mClose = document.getElementById('eventsManageClose');
            if (mClose) mClose.click();
            else manage.classList.remove('open');
            return true;
        }

        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('visible')) {
            console.log('[DEBUG Keyboard] Closing sidebar');
            sidebar.classList.remove('visible');
            try {
                localStorage.setItem('sidebarOpen', 'false');
            } catch (_) {}
            return true;
        }

        console.log('[DEBUG Keyboard] Nothing to close');
        return false;
    }

    /** Repeatedly peel {@link closeTopOverlay} so one keypress clears event slide + image + palette + filters + music + manage, etc. */
    function closeAllOverlayLayers() {
        var any = false;
        var guard = 24;
        while (guard-- > 0 && closeTopOverlay()) {
            any = true;
        }
        return any;
    }

    function onKeyDown(e) {
        if (modifiersActive(e)) return;

        var target = e.target;
        var key = e.key;
        var lower = typeof key === 'string' ? key.toLowerCase() : '';

        if (key === 'Escape' || lower === 'q') {
            console.log('[DEBUG Keyboard] Escape/Q pressed, target:', target?.id || target?.tagName);
            if (isTypingContext(target)) {
                console.log('[DEBUG Keyboard] In typing context');
                if (key !== 'Escape' || !escapeOkWhileTypingInTarget(target)) return;
            }
            if (closeAllOverlayLayers()) consumeEvent(e);
            return;
        }

        if (isTypingContext(target)) return;

        if (lower === 'e') {
            // Skip if Story Viewer is active (uses same panel)
            if (document.getElementById('storyViewerContainer')) {
                return;
            }
            if (isEventSlideOpen()) {
                if (window.SoundEffectsManager?.play) {
                    window.SoundEffectsManager.play('eventClick');
                }
                hideEventSlideIfOpen();
                var orchE = window.componentOrchestrator;
                if (orchE && typeof orchE.openDataArchiveEventsView === 'function') {
                    void orchE.openDataArchiveEventsView('story');
                } else {
                    window.eventManager?.openEventsManagePanel?.();
                }
                consumeEvent(e);
            }
            return;
        }
        if (lower === 'h') {
            if (isEventSlideOpen() && clickIfEnabled('eventImageToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'i') {
            if (isEventSlideOpen() && clickIfEnabled('eventImageToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'x') {
            var glitchBtn = document.getElementById('eventGlitchToggle');
            if (
                isEventSlideOpen() &&
                glitchBtn &&
                !glitchBtn.disabled &&
                window.getComputedStyle(glitchBtn).display !== 'none'
            ) {
                glitchBtn.click();
                consumeEvent(e);
            }
            return;
        }
        if (lower === 'f') {
            if (clickIfEnabled('filtersToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'g') {
            if (clickIfEnabled('mapViewToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'v') {
            if (clickIfEnabled('hyperloopToggle')) consumeEvent(e);
            return;
        }
        if (lower === 't') {
            if (clickIfEnabled('weatherEffectsToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'c') {
            if (clickIfEnabled('colorPaletteToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'm') {
            if (clickIfEnabled('musicToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'r') {
            if (clickIfEnabled('autoRotateToggle')) consumeEvent(e);
            return;
        }
        if (lower === 'z') {
            var pdc = window.PaginationDockCollapse;
            if (pdc && typeof pdc.toggle === 'function' && pdc.toggle()) {
                consumeEvent(e);
            }
            return;
        }
        if (lower === 'o') {
            var body = document.body;
            var next = !(body && body.classList.contains('debug-border-image-overlay'));
            var setter = window.setBorderImageDebugOverlay;
            if (typeof setter === 'function') {
                setter(next);
            } else if (body) {
                body.classList.toggle('debug-border-image-overlay', next);
            }
            consumeEvent(e);
            return;
        }
        if (key === 'Enter') {
            if (isTypingContext(target)) return;
            if (target && target.closest && target.closest('button, a[href], [role="button"], [role="menuitem"]')) {
                return;
            }
            if (clickIfEnabled('zoomResetBtn')) consumeEvent(e);
            return;
        }
        if (key === 'Tab') {
            if (isEventSlideOpen()) {
                if (cycleVariantButton(!e.shiftKey)) {
                    consumeEvent(e);
                }
            }
            return;
        }

        var scrollEl = getScrollContainer();

        if (key === 'ArrowUp' || lower === 'w') {
            if (isEventPageRangeSlider(target)) return;
            applyVerticalNavigation(scrollEl, e, true);
            return;
        }
        if (key === 'ArrowDown' || lower === 's') {
            if (isEventPageRangeSlider(target)) return;
            applyVerticalNavigation(scrollEl, e, false);
            return;
        }

        if (key === 'ArrowLeft' || lower === 'a') {
            if (isEventSlideOpen()) {
                if (triggerEventSlidePrev()) consumeEvent(e);
            } else if (isEventsManageOpen()) {
                if (triggerEventsManagePrev()) consumeEvent(e);
            } else if (canUseTimelinePaginationShortcuts()) {
                if (triggerPrevPageButtonOrHelpers()) consumeEvent(e);
            }
            return;
        }
        if (key === 'ArrowRight' || lower === 'd') {
            if (isEventSlideOpen()) {
                if (triggerEventSlideNext()) consumeEvent(e);
            } else if (isEventsManageOpen()) {
                if (triggerEventsManageNext()) consumeEvent(e);
            } else if (canUseTimelinePaginationShortcuts()) {
                if (triggerNextPageButtonOrHelpers()) consumeEvent(e);
            }
            return;
        }

        var digit = null;
        if (key >= '1' && key <= '9') digit = key;
        else if (key === '0') digit = '10';
        else if (e.code && e.code.indexOf('Numpad') === 0) {
            if (e.code === 'Numpad1') digit = '1';
            else if (e.code === 'Numpad2') digit = '2';
            else if (e.code === 'Numpad3') digit = '3';
            else if (e.code === 'Numpad4') digit = '4';
            else if (e.code === 'Numpad5') digit = '5';
            else if (e.code === 'Numpad6') digit = '6';
            else if (e.code === 'Numpad7') digit = '7';
            else if (e.code === 'Numpad8') digit = '8';
            else if (e.code === 'Numpad9') digit = '9';
            else if (e.code === 'Numpad0') digit = '10';
        }

        if (digit && isPaletteMenuOpen()) {
            var idx = digit === '10' ? 0 : parseInt(digit, 10);
            if (idx >= 1 && idx <= 4) {
                applyPaletteByName(PALETTE_ORDER[idx - 1]);
                consumeEvent(e);
            } else {
                consumeEvent(e);
            }
            return;
        }

        if (digit && isEventSlideOpen()) {
            var vr = tryVariantDigitKey(digit);
            if (vr === 'ok' || vr === 'invalid') {
                consumeEvent(e);
                return;
            }
        }

        if (digit && canUseTimelinePaginationShortcuts() && !isEventsManageOpen()) {
            if (triggerNumberButton(digit)) consumeEvent(e);
        }
    }

    function onWheel(e) {
        if (modifiersActive(e)) return;
        if (isTypingContext(e.target)) return;
        if (!isPaletteMenuOpen()) return;
        var t = e.target;
        if (!t || !t.closest || !t.closest('#paletteMenu')) return;

        var cur = normalizeStoredPalette();
        var i = PALETTE_ORDER.indexOf(cur);
        if (i < 0) i = 0;
        if (e.deltaY > 0) {
            i = (i + 1) % PALETTE_ORDER.length;
        } else {
            i = (i - 1 + PALETTE_ORDER.length) % PALETTE_ORDER.length;
        }
        applyPaletteByName(PALETTE_ORDER[i]);
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Double-click outside panels to close them
     * Closes music, filters, and event manager panels when double-clicking on background
     */
    function onDoubleClick(e) {
        var t = e.target;
        if (!t || !t.closest) return;

        // Check if click is inside any of the panels
        var inFilters = t.closest('#filtersPanel');
        var inMusic = t.closest('#musicPanel');
        var inEventsManage = t.closest('#eventsManagePanel');
        var inEventSlide = t.closest('#eventSlide');
        var inPalette = t.closest('#paletteMenu');

        // If clicked inside any panel, don't close
        if (inFilters || inMusic || inEventsManage || inEventSlide || inPalette) return;

        // Check if any panel is open and close it
        var filters = document.getElementById('filtersPanel');
        var music = document.getElementById('musicPanel');
        var manage = document.getElementById('eventsManagePanel');

        var closed = false;

        if (filters && filters.classList.contains('open')) {
            var fc = document.getElementById('filtersPanelClose');
            if (fc) fc.click();
            else filters.classList.remove('open');
            closed = true;
        }

        if (music && music.classList.contains('open')) {
            var mc = document.getElementById('musicPanelClose');
            if (mc) mc.click();
            else music.classList.remove('open');
            closed = true;
        }

        if (manage && manage.classList.contains('open')) {
            var mClose = document.getElementById('eventsManageClose');
            if (mClose) mClose.click();
            else manage.classList.remove('open');
            closed = true;
        }

        if (closed) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    document.addEventListener('dblclick', onDoubleClick, true);

    /** Full stack dismiss (Escape/Q): modals, event slide, palette, filters, music, event manager, sidebar */
    window.closeAllDismissiblePanels = closeAllOverlayLayers;
})();
