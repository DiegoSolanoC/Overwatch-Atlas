/**
 * Entry: install the document-level capture listeners for global keyboard
 * shortcuts (keydown, wheel, dblclick). Loaded as a `type="module"` script in
 * `index.html`. Re-entry is blocked via `window.__appKeyboardShortcutsInstalled`
 * so reloading the standalone TEST harness doesn't double-bind.
 *
 * Key dispatch order in `onKeyDown`:
 *   1. Escape / Q -> stacked dismiss (still works while focus is inside our
 *      panels for Escape).
 *   2. If typing in a regular text field, bail out — let the field have the key.
 *   3. Single-letter toggles (E, H hero roster / H·I image, X, F, G, V, T, C, M, R, Z).
 *   4. Enter -> zoom reset (unless a button/link has focus).
 *   5. Tab -> cycle event slide variants.
 *   6. Arrow keys / WASD -> scroll panel, else zoom, else page-scroll.
 *   7. Arrow Left/Right + A/D -> pagination (event slide > manage > timeline).
 *   8. Digit 1..0 -> palette / variant / number button.
 */

import {
    SCROLL_STEP,
    consumeEvent,
    isTypingContext,
    isEventPageRangeSlider,
    escapeOkWhileTypingInTarget,
    modifiersActive
} from './keyboardTypingContext.js';
import {
    clickIfEnabled,
    triggerPrevPageButtonOrHelpers,
    triggerNextPageButtonOrHelpers,
    triggerEventSlidePrev,
    triggerEventSlideNext,
    triggerEventsManagePrev,
    triggerEventsManageNext
} from './keyboardPaginationTriggers.js';
import {
    canUseTimelinePaginationShortcuts
} from './keyboardModeResolution.js';
import {
    isEventSlideOpen,
    isEventsManageOpen,
    tryVariantDigitKey,
    cycleVariantButton,
    triggerNumberButton
} from './keyboardVariantAndNumberKeys.js';
import {
    PALETTE_ORDER,
    isPaletteMenuOpen,
    applyPaletteByName,
    onPaletteWheel
} from './keyboardPaletteCycling.js';
import {
    closeAllOverlayLayers,
    hideEventSlideIfOpen,
    onDoubleClick
} from './keyboardOverlayClosers.js';

if (window.__appKeyboardShortcutsInstalled) {
    /* Another copy already loaded (HMR / TEST harness reload) — no-op. */
} else {
    window.__appKeyboardShortcutsInstalled = true;
    installAppKeyboardShortcuts();
}

function getScrollContainer() {
    const slide = document.getElementById('eventSlide');
    if (slide && slide.classList.contains('open')) {
        return document.getElementById('eventSlideScrollable');
    }
    const manage = document.getElementById('eventsManagePanel');
    if (manage && manage.classList.contains('open')) {
        return document.getElementById('eventsList');
    }
    const filters = document.getElementById('filtersPanel');
    if (filters && filters.classList.contains('open')) {
        return filters.querySelector('.filters-panel-content');
    }
    const music = document.getElementById('musicPanel');
    if (music && music.classList.contains('open')) {
        return music.querySelector('.music-panel-content');
    }
    return null;
}

/** Arrow Up/Down + W/S: scroll in panel first, else zoom buttons, else page scroll. */
function applyVerticalNavigation(scrollEl, e, isUp) {
    if (scrollEl) {
        scrollEl.scrollTop += isUp ? -SCROLL_STEP : SCROLL_STEP;
        consumeEvent(e);
    } else if (clickIfEnabled(isUp ? 'zoomInBtn' : 'zoomOutBtn')) {
        consumeEvent(e);
    } else {
        const root = document.scrollingElement || document.documentElement;
        if (root && root.scrollHeight > root.clientHeight) {
            root.scrollTop += isUp ? -SCROLL_STEP : SCROLL_STEP;
            consumeEvent(e);
        }
    }
}

function digitFromKeyOrCode(key, code) {
    if (key >= '1' && key <= '9') return key;
    if (key === '0') return '10';
    if (code && code.indexOf('Numpad') === 0) {
        if (code === 'Numpad1') return '1';
        if (code === 'Numpad2') return '2';
        if (code === 'Numpad3') return '3';
        if (code === 'Numpad4') return '4';
        if (code === 'Numpad5') return '5';
        if (code === 'Numpad6') return '6';
        if (code === 'Numpad7') return '7';
        if (code === 'Numpad8') return '8';
        if (code === 'Numpad9') return '9';
        if (code === 'Numpad0') return '10';
    }
    return null;
}

function handleLetterToggle(lower, e) {
    if (lower === 'e') {
        /* Skip if Story Viewer is active (uses same panel). */
        if (document.getElementById('storyViewerContainer')) return true;
        if (isEventSlideOpen()) {
            window.SoundEffectsManager?.play?.('eventClick');
            hideEventSlideIfOpen();
            const orchE = window.modeOrchestrator;
            if (orchE && typeof orchE.openDataArchiveEventsView === 'function') {
                void orchE.openDataArchiveEventsView('story');
            } else {
                window.eventManager?.openEventsManagePanel?.();
            }
            consumeEvent(e);
        }
        return true;
    }
    if (lower === 'h') {
        if (
            document.getElementById('atlasHeroBiographyHost') &&
            clickIfEnabled('heroBiographyChipStripToggle')
        ) {
            consumeEvent(e);
            return true;
        }
    }
    if (lower === 'h' || lower === 'i') {
        if (isEventSlideOpen() && clickIfEnabled('eventImageToggle')) consumeEvent(e);
        return true;
    }
    if (lower === 'x') {
        const glitchBtn = document.getElementById('eventGlitchToggle');
        if (
            isEventSlideOpen() && glitchBtn && !glitchBtn.disabled &&
            window.getComputedStyle(glitchBtn).display !== 'none'
        ) {
            glitchBtn.click();
            consumeEvent(e);
        }
        return true;
    }
    if (lower === 'f') { if (clickIfEnabled('filtersToggle')) consumeEvent(e); return true; }
    if (lower === 'g') { if (clickIfEnabled('mapViewToggle')) consumeEvent(e); return true; }
    if (lower === 'v') { if (clickIfEnabled('hyperloopToggle')) consumeEvent(e); return true; }
    if (lower === 't') { if (clickIfEnabled('weatherEffectsToggle')) consumeEvent(e); return true; }
    if (lower === 'c') { if (clickIfEnabled('colorPaletteToggle')) consumeEvent(e); return true; }
    if (lower === 'm') { if (clickIfEnabled('musicToggle')) consumeEvent(e); return true; }
    if (lower === 'r') { if (clickIfEnabled('autoRotateToggle')) consumeEvent(e); return true; }
    if (lower === 'z') {
        const pdc = window.PaginationDockCollapse;
        if (pdc && typeof pdc.toggle === 'function' && pdc.toggle()) consumeEvent(e);
        return true;
    }
    return false;
}

function onKeyDown(e) {
    if (modifiersActive(e)) return;

    const target = e.target;
    const key = e.key;
    const lower = typeof key === 'string' ? key.toLowerCase() : '';

    if (key === 'Escape' || lower === 'q') {
        if (isTypingContext(target)) {
            if (key !== 'Escape' || !escapeOkWhileTypingInTarget(target)) return;
        }
        if (closeAllOverlayLayers()) consumeEvent(e);
        return;
    }

    if (isTypingContext(target)) return;

    if (handleLetterToggle(lower, e)) return;

    if (key === 'Enter') {
        if (target && target.closest && target.closest('button, a[href], [role="button"], [role="menuitem"]')) return;
        if (clickIfEnabled('zoomResetBtn')) consumeEvent(e);
        return;
    }
    if (key === 'Tab') {
        if (isEventSlideOpen()) {
            if (cycleVariantButton(!e.shiftKey)) consumeEvent(e);
        }
        return;
    }

    const scrollEl = getScrollContainer();

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

    const digit = digitFromKeyOrCode(key, e.code);

    if (digit && isPaletteMenuOpen()) {
        const idx = digit === '10' ? 0 : parseInt(digit, 10);
        if (idx >= 1 && idx <= 4) {
            applyPaletteByName(PALETTE_ORDER[idx - 1]);
        }
        consumeEvent(e);
        return;
    }

    if (digit && isEventSlideOpen()) {
        const vr = tryVariantDigitKey(digit);
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
    onPaletteWheel(e, { modifiersActive, isTypingContext });
}

function installAppKeyboardShortcuts() {
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    document.addEventListener('dblclick', onDoubleClick, true);

    /* Full stack dismiss (Escape/Q): modals, event slide, palette, filters, music, manage, sidebar. */
    window.closeAllDismissiblePanels = closeAllOverlayLayers;
}
