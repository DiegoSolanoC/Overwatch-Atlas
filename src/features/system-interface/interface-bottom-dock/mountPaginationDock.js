/**
 * mountPaginationDock — places the #eventPagination element inside the
 * persistent #paginationDock (absolute overlay above the footer; not a flex
 * sibling that resizes the stage), installs the dock collapse strip + dock
 * pattern overlay, and delegates the trapezoid cap to dockTrapezoidCap.js.
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
} from './paginationDockCollapse.js?v=5';
import { dockCollapseStripHtml } from './eventPaginationMarkup.js';
import { buildOrMigrateDockTrapezoidCap } from './dockTrapezoidCap.js';

const POSITION_PROPS_TO_CLEAR = ['position', 'bottom', 'left', 'right', 'transform', 'top'];

function placeDockAfterFooter(dock) {
    const footer = document.querySelector('footer');
    const host = footer?.parentNode || document.body;
    if (footer) {
        if (dock.previousSibling !== footer) {
            host.insertBefore(dock, footer.nextSibling);
        }
    } else if (dock.parentNode !== document.body) {
        document.body.appendChild(dock);
    }
}

function ensurePaginationDock() {
    let dock = document.getElementById('paginationDock');
    if (dock) {
        /* Late sibling of footer → fixed stacking beats layout-container panels. */
        placeDockAfterFooter(dock);
        return dock;
    }

    dock = document.createElement('div');
    dock.id = 'paginationDock';
    dock.className = 'pagination-dock';
    placeDockAfterFooter(dock);
    return dock;
}

function ensurePaginationDockCollapseStrip(dock) {
    if (!dock?.parentNode) return;
    let strip = document.getElementById('paginationDockCollapseStrip');
    if (!strip) {
        strip = document.createElement('div');
        strip.id = 'paginationDockCollapseStrip';
        strip.className = 'pagination-dock-collapse-strip';
        strip.innerHTML = dockCollapseStripHtml();
        dock.parentNode.insertBefore(strip, dock);
    } else if (strip.nextSibling !== dock) {
        dock.parentNode.insertBefore(strip, dock);
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
