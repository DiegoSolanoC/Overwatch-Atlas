/**
 * Build and wire the drag-to-resize trapezium handle that lives on the inner
 * edge of each side panel.
 *
 * Each handle handles three distinct gestures:
 *   - `click` while panel is closed: open the panel (event slide / filters / music)
 *   - `dblclick` at any time: reset the panel width to its default
 *   - `pointerdown` + drag: change the panel's `--user-panel-*` CSS variable in
 *     real time, with audible gear ticks and a rim flash when the pointer pushes
 *     past the min/max width clamp.
 *
 * The filters panel is special: it owns two handles back-to-back (filters-mode
 * + music-mode launcher) because the same DOM panel serves both modes.
 */

import {
    clampWidth,
    clearUserWidth,
    currentWidthPx,
    getDefaultPx,
    isMobile,
    maxWidthForPanel
} from './panelResizeConfig.js';
import {
    GEAR_TICK_EVERY_PX,
    playGearTick,
    stopGearTicks
} from './panelResizeGearTicks.js';
import {
    EVENT_TRAP_PAGE_ICON,
    FILTERS_TRAP_ICONS,
    MUSIC_TRAP_ICON,
    syncFiltersPanelTrapIcon
} from './filtersPanelTrapIcon.js';

/** Cumulative px pulled past clamp before rim appears; then ramp to 1 over RIM_PULL_RAMP_PX more. */
const RIM_PULL_DEAD_PX = 28;
const RIM_PULL_RAMP_PX = 90;

function openEventSlideFromHandle(panel) {
    if (!document.body.classList.contains('event-system-loaded')) {
        if (window.updateStatus) {
            window.updateStatus('Event System still loading…', 'warning');
        }
        return;
    }

    try {
        const lastEventStr = localStorage.getItem('lastOpenedEvent');
        let eventToOpen = null;
        if (lastEventStr) eventToOpen = JSON.parse(lastEventStr);

        const eventManager = window.eventManager;
        if (!eventManager || !eventManager.openEventFromList) {
            panel.classList.add('open');
            return;
        }

        const events = eventManager.events || [];
        let eventData = null;
        let eventIndex = -1;

        if (eventToOpen) {
            eventIndex = events.findIndex(function (ev) { return ev.name === eventToOpen.name; });
            if (eventIndex >= 0) eventData = events[eventIndex];
        }
        if (!eventData && events.length > 0) {
            eventData = events[0];
            eventIndex = 0;
        }

        if (eventData && eventIndex >= 0) {
            eventManager.openEventFromList(eventData, eventIndex);
        } else {
            panel.classList.add('open');
        }
    } catch (err) {
        /* Fallback: just open the panel. */
        panel.classList.add('open');
    }

    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('eventClick');
    }
}

function openFiltersPanelFromHandle(panel, btn) {
    const mode = btn.dataset.panelMode === 'music' ? 'music' : 'filters';
    if (window.FilterService && typeof window.FilterService.openPanelWithMode === 'function') {
        window.FilterService.openPanelWithMode(mode);
    } else {
        panel.classList.add('open');
    }
    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play(mode === 'music' ? 'music' : 'filterButton');
    }
}

function maybeSwitchFiltersMode(panel, btn, ev) {
    /* Shared panel is already open: clicking the other trapezium should switch modes. */
    const targetMode = btn.dataset.panelMode === 'music' ? 'music' : 'filters';
    const currentMode = panel.dataset.panelMode === 'music' ? 'music' : 'filters';
    if (targetMode === currentMode) return;
    ev.preventDefault();
    if (window.FilterService && typeof window.FilterService.openPanelWithMode === 'function') {
        window.FilterService.openPanelWithMode(targetMode);
    }
    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play(targetMode === 'music' ? 'music' : 'filterButton');
    }
}

function createHandle(cfg, options) {
    const opts = options || {};
    const mode = opts.mode || 'filters';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-resize-handle panel-resize-handle--' + cfg.edge + (opts.extraClass ? (' ' + opts.extraClass) : '');
    btn.setAttribute('aria-orientation', 'vertical');
    btn.setAttribute('aria-label', opts.ariaLabel || ('Resize ' + cfg.name + ' panel'));
    btn.title = opts.title || (cfg.name + ' panel - Drag to resize. Width resets when you close the panel. Double-click to reset now.');
    if (cfg.id === 'filtersPanel') btn.dataset.panelMode = mode;

    const pill = document.createElement('span');
    pill.className = 'panel-resize-handle__pill';
    pill.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.className = 'ui-pagination-arrow panel-resize-handle__arrow';
    icon.src = 'src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png';
    icon.alt = '';
    icon.decoding = 'async';
    icon.width = 22;
    icon.height = 22;
    icon.setAttribute('aria-hidden', 'true');
    /* inner-right: point right; inner-left: point left (default asset). */
    if (cfg.edge === 'inner-right') icon.classList.add('ui-pagination-arrow--flip-h');
    pill.appendChild(icon);

    if (cfg.id === 'eventSlide' || cfg.id === 'filtersPanel') {
        const trapLabel = document.createElement('span');
        trapLabel.className = 'panel-resize-handle__trap-label';
        trapLabel.setAttribute('aria-hidden', 'true');
        const trapImg = document.createElement('img');
        trapImg.className = 'panel-resize-handle__trap-icon';
        trapImg.alt = '';
        trapImg.decoding = 'async';
        trapImg.setAttribute('aria-hidden', 'true');
        if (cfg.id === 'eventSlide') {
            trapImg.src = EVENT_TRAP_PAGE_ICON;
        } else if (mode === 'music') {
            trapImg.src = MUSIC_TRAP_ICON;
        } else {
            trapImg.src = FILTERS_TRAP_ICONS.empty;
            syncFiltersPanelTrapIcon(trapImg);
        }
        trapLabel.appendChild(trapImg);
        btn.appendChild(trapLabel);
    }
    btn.appendChild(pill);
    return btn;
}

function attachHandleBehavior(panel, cfg, btn) {
    let dragState = null;

    btn.addEventListener('dblclick', function (e) {
        e.preventDefault();
        clearUserWidth(cfg);
    });

    btn.addEventListener('click', function (e) {
        if (!panel.classList.contains('open')) {
            e.preventDefault();
            if (cfg.id === 'eventSlide') {
                openEventSlideFromHandle(panel);
            } else if (cfg.id === 'filtersPanel') {
                openFiltersPanelFromHandle(panel, btn);
            }
            return;
        }
        if (cfg.id === 'filtersPanel') {
            maybeSwitchFiltersMode(panel, btn, e);
        }
    });

    function onPointerMove(ev) {
        if (!dragState || isMobile()) return;
        const pxMove = Math.abs(ev.clientX - dragState.lastPointerX);
        const dx = ev.clientX - dragState.startX;
        const raw = cfg.edge === 'inner-right'
            ? dragState.startWidth + dx
            : dragState.startWidth - dx;
        const minW = getDefaultPx(cfg.defaultVar);
        const maxW = maxWidthForPanel(cfg);
        const next = clampWidth(raw, cfg);
        document.documentElement.style.setProperty(cfg.cssVar, next + 'px');

        const atLimit = raw < minW || raw > maxW;
        dragState.lastPointerX = ev.clientX;
        dragState.lastRawWidth = raw;
        dragState.totalAbsDx = (dragState.totalAbsDx || 0) + pxMove;

        if (atLimit) {
            stopGearTicks();
            dragState.gearAccum = 0;
            dragState.limitPullAccum = (dragState.limitPullAccum || 0) + pxMove;
            const over = dragState.limitPullAccum - RIM_PULL_DEAD_PX;
            let t = over <= 0 ? 0 : Math.min(1, over / RIM_PULL_RAMP_PX);
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
            if (!playGearTick()) break;
            dragState.gearAccum -= GEAR_TICK_EVERY_PX;
        }
    }

    function endDrag() {
        if (!dragState) return;
        const ds = dragState;
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
        const cur = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
        const n = parseInt(cur, 10);
        if (Number.isFinite(n)) {
            const def = getDefaultPx(cfg.defaultVar);
            if (n <= def) clearUserWidth(cfg);
        }
    }

    btn.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || isMobile()) return;
        ev.preventDefault();
        const w = currentWidthPx(cfg);
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

/**
 * Watch the panel's `class` attribute and, the moment the `.open` class drops,
 * clear the user-set width override + any "at limit" rim styling so the panel
 * returns to its default width when reopened.
 */
export function ensureWatchPanelClose(panel, cfg) {
    if (!panel || panel.dataset.panelResizeCloseWatch === '1') return;
    panel.dataset.panelResizeCloseWatch = '1';
    let closeCleanupRaf = null;
    const obs = new MutationObserver(function () {
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
    if (!panel.classList.contains('open')) clearUserWidth(cfg);
}

/** Create the trapezium handle(s) for a panel and wire pointer behavior. */
export function ensureHandle(panel, cfg) {
    if (!panel || panel.querySelector('.panel-resize-handle')) return;

    if (cfg.id === 'filtersPanel') {
        const filtersBtn = createHandle(cfg, {
            mode: 'music',
            extraClass: 'panel-resize-handle--filters-launch',
            ariaLabel: 'Resize and open music menu',
            title: 'Music menu - Drag to resize. Click to open music menu.'
        });
        attachHandleBehavior(panel, cfg, filtersBtn);
        const musicBtn = createHandle(cfg, {
            mode: 'filters',
            extraClass: 'panel-resize-handle--music-launch',
            ariaLabel: 'Resize filters panel'
        });
        attachHandleBehavior(panel, cfg, musicBtn);
    } else {
        attachHandleBehavior(panel, cfg, createHandle(cfg, {}));
    }
}
