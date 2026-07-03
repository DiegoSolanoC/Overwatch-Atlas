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

/**
 * Full dock chrome reflow. Computes the canonical control order for the
 * current viewport and reparents the 7 controls accordingly.
 *
 * Dock bar order: Prev Page, Prev Event, Image, Textbox (page input), Eras,
 * Next Event, Next Page. Image/Eras join the center rail when the trapezoid
 * dock is mounted, otherwise they live on the right rail.
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

    const centerChromeDockBarOrder = [
        prevPageBtn,
        prevEventBtn,
        globalImageToggleBtn,
        pageInputContainer,
        erasBtn,
        nextEventBtn,
        nextPageBtn,
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
            document.getElementById('globalImageToggle'),
            pageInputWrap,
            document.getElementById('erasToggle'),
            document.getElementById('nextEventBtn'),
            document.getElementById('nextPageBtn'),
        ].filter(Boolean);
        orderedChrome.forEach((element) => {
            if (!element.isConnected) return;
            clearDockChromeMoveStyles(element);
            centerRail.appendChild(element);
        });
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
