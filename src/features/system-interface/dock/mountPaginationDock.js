/**
 * mountPaginationDock — places the #eventPagination element inside the
 * persistent #paginationDock below the layout container, installs the dock
 * collapse strip + dock pattern overlay, and delegates the trapezoid cap
 * to dockTrapezoidCap.js.
 *
 *   - mountPaginationDock(pagination): idempotent. Creates #paginationDock and
 *     #paginationDockCollapseStrip if missing, parents the pagination element,
 *     resets its inline positioning, ensures the trapezoid cap is current, and
 *     finally calls applyPaginationDockViewportMode + initPaginationDockCollapse.
 *
 * Pure DOM weaving — no listener installation, no event wiring.
 */

import {
    applyPaginationDockViewportMode,
    initPaginationDockCollapse,
} from './paginationDockCollapse.js';
import { dockCollapseStripHtml } from './eventPaginationMarkup.js';
import { buildOrMigrateDockTrapezoidCap } from './dockTrapezoidCap.js';

const POSITION_PROPS_TO_CLEAR = ['position', 'bottom', 'left', 'right', 'transform', 'top'];

function ensurePaginationDock() {
    let dock = document.getElementById('paginationDock');
    if (dock) return dock;

    dock = document.createElement('div');
    dock.id = 'paginationDock';
    dock.className = 'pagination-dock';

    const layoutContainer = document.querySelector('.layout-container');
    const footer = document.querySelector('footer');
    if (layoutContainer && layoutContainer.parentNode) {
        if (footer) {
            layoutContainer.parentNode.insertBefore(dock, footer);
        } else {
            layoutContainer.parentNode.insertBefore(dock, layoutContainer.nextSibling);
        }
    }
    return dock;
}

function ensurePaginationDockCollapseStrip(dock) {
    const layoutContainer = document.querySelector('.layout-container');
    if (!layoutContainer?.parentNode || dock.parentNode !== layoutContainer.parentNode) {
        return;
    }
    let strip = document.getElementById('paginationDockCollapseStrip');
    if (!strip) {
        strip = document.createElement('div');
        strip.id = 'paginationDockCollapseStrip';
        strip.className = 'pagination-dock-collapse-strip';
        strip.innerHTML = dockCollapseStripHtml();
        layoutContainer.parentNode.insertBefore(strip, dock);
    } else if (strip.nextSibling !== dock) {
        layoutContainer.parentNode.insertBefore(strip, dock);
    }
}

function ensureDockPatternOverlay(dock) {
    if (dock.querySelector('.pagination-dock-pattern')) return;
    const patternOverlay = document.createElement('div');
    patternOverlay.className = 'pagination-dock-pattern';
    dock.insertBefore(patternOverlay, dock.firstChild);
}

function clearPaginationInlinePosition(pagination) {
    POSITION_PROPS_TO_CLEAR.forEach((prop) => pagination.style.removeProperty(prop));
}

/**
 * Idempotent: short-circuits when the dock + collapse strip are already in
 * place. Otherwise builds/migrates everything to the latest layout.
 *
 * @param {HTMLElement} pagination - The #eventPagination element to dock.
 */
export function mountPaginationDock(pagination) {
    if (
        document.getElementById('paginationDock')
        && document.getElementById('paginationDockCollapseStrip')
    ) {
        return;
    }

    const dock = ensurePaginationDock();
    ensurePaginationDockCollapseStrip(dock);
    ensureDockPatternOverlay(dock);

    if (pagination.parentNode !== dock) {
        dock.appendChild(pagination);
    }
    clearPaginationInlinePosition(pagination);

    buildOrMigrateDockTrapezoidCap(dock, pagination);

    applyPaginationDockViewportMode();
    initPaginationDockCollapse();
}
