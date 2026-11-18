/**
 * Dock-chrome layout helpers for the Event System Load Out.
 *
 * The standalone dock has three rails (`dockGlobeRailLeft/Center/Right`) plus
 * a page-controls row fallback when the trapezoid is absent. Where pagination
 * chrome (prev/next page, prev/next event, page input, image toggle, filters)
 * lives depends on whether the trapezoid dock is mounted (controls go to center rail).
 *
 * Two entry points:
 *   - {@link wirePageInputContainerToCenterRail}: lightweight reflow that just
 *     keeps the page-input wrap glued to the center rail on desktop. Used by
 *     resize / orientationchange.
 *   - {@link wireDockChromeRailLayout}: full reorder of all 7 controls. Runs
 *     once after the pagination dock mounts, plus on resize / orientationchange.
 *
 * Both register themselves on `window.__menuHelpersEventSystemLayout` so the
 * unload path (and `teardownMenuHelpersEventSystemLayout`) can detach them.
 */

/**
 * Lightweight reflow: delegate to the full dock mover when available, else snap
 * `.page-input-container` onto `#dockGlobeRailCenter`.
 */
export function wirePageInputContainerToCenterRail() {
    const runDock =
        window.__menuHelpersEventSystemLayout?.moveDock ||
        window.__menuServiceEventSystemLayout?.moveDock;
    if (typeof runDock === 'function') {
        runDock();
        return;
    }

    const pageInputContainer = document.querySelector('.page-input-container');
    const centerRail = document.getElementById('dockGlobeRailCenter');
    if (centerRail && pageInputContainer && pageInputContainer.parentElement !== centerRail) {
        centerRail.appendChild(pageInputContainer);
    }
}

/**
 * Install the lightweight reflow + its resize/orientation listeners. Returns
 * the registry object stored on `window.__menuHelpersEventSystemLayout`.
 */
export function installPageInputContainerReflow() {
    wirePageInputContainerToCenterRail();
    window.__menuHelpersEventSystemLayout = {
        moveChrome: wirePageInputContainerToCenterRail,
        moveDock: null,
    };
    window.addEventListener('resize', wirePageInputContainerToCenterRail);
    window.addEventListener('orientationchange', wirePageInputContainerToCenterRail);
    return window.__menuHelpersEventSystemLayout;
}

function clearDockChromeMoveStyles(el) {
    if (!el) return;
    el.style.position = '';
    el.style.top = '';
    el.style.left = '';
    el.style.right = '';
    el.style.bottom = '';
}

/** Trap page field: kill pill/frost so hex pattern shows through. */
function bareTrapPageField(pageInputContainer) {
    if (!pageInputContainer) return;
    pageInputContainer.classList.add('dock-page-field--bare');
    pageInputContainer.style.setProperty('background', 'transparent', 'important');
    pageInputContainer.style.setProperty('background-color', 'transparent', 'important');
    pageInputContainer.style.setProperty('background-image', 'none', 'important');
    pageInputContainer.style.setProperty('box-shadow', 'none', 'important');
    pageInputContainer.style.setProperty('border', 'none', 'important');
    pageInputContainer.style.setProperty('filter', 'none', 'important');
    pageInputContainer.style.setProperty('backdrop-filter', 'none', 'important');
    pageInputContainer.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
    pageInputContainer.style.setProperty('clip-path', 'none', 'important');

    const input =
        pageInputContainer.querySelector('#pageInput, .page-input') ||
        document.getElementById('pageInput');
    if (!input) return;
    input.classList.add('dock-page-input--bare');
    input.style.setProperty('background', 'transparent', 'important');
    input.style.setProperty('background-color', 'transparent', 'important');
    input.style.setProperty('background-image', 'none', 'important');
    input.style.setProperty('box-shadow', 'none', 'important');
    input.style.setProperty('filter', 'none', 'important');
    input.style.setProperty('backdrop-filter', 'none', 'important');
    input.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
}

/**
 * Full dock chrome reflow. Computes the canonical control order for the
 * current viewport and reparents the 7 controls accordingly.
 *
 * Trapezoid dock (CSS grid): Prev Page, Prev Event, Page, Next Event, Next Page
 * on the top row; Image + Eras on the bottom spanning outer columns; Page spans
 * the center column. Without the trapezoid, Image lives on the right rail.
 */
export function reflowDockChromeRails() {
    const pageInputContainer = document.querySelector('.page-input-container');
    const centerRail = document.getElementById('dockGlobeRailCenter');
    const rightRail = document.getElementById('dockGlobeRailRight');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const prevEventBtn = document.getElementById('prevEventBtn');
    const nextEventBtn = document.getElementById('nextEventBtn');
    const globalImageToggleBtn = document.getElementById('globalImageToggle');
    const erasBtn = document.getElementById('erasToggle');

    /* Trap layout (CSS grid): top nav + bottom image/eras, page spans center column. */
    const centerChromeDockBarOrder = [
        prevPageBtn,
        prevEventBtn,
        pageInputContainer,
        nextEventBtn,
        nextPageBtn,
        globalImageToggleBtn,
        erasBtn,
    ];
    const centerChromePaginationOnly = [
        prevPageBtn,
        prevEventBtn,
        pageInputContainer,
        nextEventBtn,
        nextPageBtn,
    ];

    const trapMount = document.querySelector('.pagination-dock-top-trapezoid');
    if (trapMount && centerRail && centerRail.parentElement !== trapMount) {
        trapMount.appendChild(centerRail);
    }
    const useTrapezoidSideChrome = !!trapMount;
    const centerTargets = useTrapezoidSideChrome
        ? centerChromeDockBarOrder
        : centerChromePaginationOnly;

    centerTargets.forEach((element) => {
        if (!element || !element.isConnected) return;
        if (centerRail && element.parentElement !== centerRail) {
            clearDockChromeMoveStyles(element);
            centerRail.appendChild(element);
        }
    });

    // Keep trapezoid center rail deterministic: exactly 7 controls in order.
    // Use .page-input-container (not #pageInput): moving the input alone leaves
    // "/ 1" orphaned and appendChild puts it after #nextPageBtn.
    if (useTrapezoidSideChrome && centerRail) {
        const pageInputWrap =
            document.querySelector('#eventPagination .page-input-container') ||
            document.querySelector('.page-input-container');
        const orderedChrome = [
            document.getElementById('prevPageBtn'),
            document.getElementById('prevEventBtn'),
            pageInputWrap,
            document.getElementById('nextEventBtn'),
            document.getElementById('nextPageBtn'),
            document.getElementById('globalImageToggle'),
            document.getElementById('erasToggle'),
        ].filter(Boolean);
        orderedChrome.forEach((element) => {
            if (!element.isConnected) return;
            clearDockChromeMoveStyles(element);
            centerRail.appendChild(element);
        });
        bareTrapPageField(pageInputWrap);
    }

    const rightRailTargets = useTrapezoidSideChrome ? [] : [globalImageToggleBtn].filter(Boolean);

    rightRailTargets.forEach((element) => {
        if (!element || !element.isConnected) return;
        if (rightRail && element.parentElement !== rightRail) {
            clearDockChromeMoveStyles(element);
            rightRail.appendChild(element);
        }
    });

    if (!useTrapezoidSideChrome && rightRail && globalImageToggleBtn?.isConnected) {
        if (globalImageToggleBtn.parentElement !== rightRail) {
            clearDockChromeMoveStyles(globalImageToggleBtn);
            rightRail.appendChild(globalImageToggleBtn);
        }
    }
}

/**
 * Install the full dock chrome layout: run once, register on the layout
 * registry, and add resize / orientationchange listeners.
 */
export function installDockChromeRailLayout() {
    reflowDockChromeRails();
    if (!window.__menuHelpersEventSystemLayout) {
        window.__menuHelpersEventSystemLayout = {};
    }
    window.__menuHelpersEventSystemLayout.moveDock = reflowDockChromeRails;
    window.addEventListener('resize', reflowDockChromeRails);
    window.addEventListener('orientationchange', reflowDockChromeRails);
}
