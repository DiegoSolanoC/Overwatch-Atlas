/**
 * dockTrapezoidCap — builds (or migrates from a legacy layout) the cap row
 * that sits at the very top of the pagination dock:
 *
 *   [left dock-border image] [trapezoid (fill SVG + border SVG + #dockGlobeRailCenter)] [right dock-border image]
 *
 *   - buildOrMigrateDockTrapezoidCap(dock): idempotent. Creates the cap row if
 *     missing, migrates any pre-existing legacy `.pagination-dock-top-border-wrap`
 *     and orphan trapezoid into the new structure, ensures the SVGs are present
 *     at the latest version (`data-dock-trap-v="10"` for fill, `"2"` for border),
 *     and re-attaches `#dockGlobeRailCenter` inside the trapezoid.
 *
 * Pulls `ensureDockGlobeRailCenterRestored` from dockChromeLifecycle.js so the
 * center-rail factory lives in exactly one place.
 */

import { ensureDockGlobeRailCenterRestored } from './dockChromeLifecycle.js';

const DOCK_BORDER_SRC = 'src/assets/images/Misc/UI/Dock%20Border.png';

/* Fill only (under rail); white outline is a separate sibling SVG above the rail. */
/* Top y=3 matches border path; y=0 caused colored fill above the white outline. */
const TRAPEZOID_FILL_SVG = `<svg class="pagination-dock-top-trapezoid__svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-v="10" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<polygon class="pagination-dock-top-trapezoid__fill" points="2,3 98,3 112,100 -12,100" />
</svg>`;

const TRAPEZOID_BORDER_SVG = `<svg class="pagination-dock-top-trapezoid__border-svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-border-v="2" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<path d="M -12,100 Q -5,52 2,3 L 98,3 Q 105,52 112,100" fill="none" stroke="#ffffff" stroke-width="8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

function buildBorderImg() {
    const img = document.createElement('img');
    img.className = 'pagination-dock-top-border-img';
    img.src = DOCK_BORDER_SRC;
    img.alt = '';
    img.decoding = 'async';
    return img;
}

function buildBorderSide(side) {
    const el = document.createElement('div');
    el.className = `pagination-dock-top-border-side pagination-dock-top-border-side--${side}`;
    el.setAttribute('aria-hidden', 'true');
    el.appendChild(buildBorderImg());
    return el;
}

function buildCapRow() {
    const capRow = document.createElement('div');
    capRow.className = 'pagination-dock-top-cap-row';

    const trapEl = document.createElement('div');
    trapEl.className = 'pagination-dock-top-trapezoid';

    capRow.append(
        buildBorderSide('left'),
        trapEl,
        buildBorderSide('right')
    );
    return capRow;
}

function migrateLegacyBorderWrap(dock, capRow) {
    const legacyWrap = dock.querySelector(':scope > .pagination-dock-top-border-wrap');
    if (!legacyWrap) return;
    const imgs = Array.from(legacyWrap.querySelectorAll('.pagination-dock-top-border-img'));
    const leftSide = capRow.querySelector('.pagination-dock-top-border-side--left');
    const rightSide = capRow.querySelector('.pagination-dock-top-border-side--right');
    if (imgs[0] && leftSide) leftSide.replaceChildren(imgs[0]);
    if (imgs[1] && rightSide) rightSide.replaceChildren(imgs[1]);
    legacyWrap.remove();
}

function migrateOrphanTrapezoid(dock, capRow) {
    const orphanTrap = dock.querySelector(':scope > .pagination-dock-top-trapezoid');
    if (!orphanTrap || orphanTrap.parentElement === capRow) return;
    const mid = capRow.querySelector('.pagination-dock-top-trapezoid');
    if (mid && mid !== orphanTrap) {
        capRow.replaceChild(orphanTrap, mid);
    }
}

function applyTrapezoidSvgsAndCenterRail(capRow) {
    /* Cap row + trapezoid host focusable dock controls; never aria-hide them. */
    capRow.removeAttribute('aria-hidden');
    capRow.querySelector('.pagination-dock-top-border-side--left')?.setAttribute('aria-hidden', 'true');
    capRow.querySelector('.pagination-dock-top-border-side--right')?.setAttribute('aria-hidden', 'true');

    const trap = capRow.querySelector('.pagination-dock-top-trapezoid');
    if (!trap) return;
    trap.removeAttribute('aria-hidden');

    trap.querySelectorAll(
        '.pagination-dock-top-trapezoid__svg[data-dock-trap-v="8"], .pagination-dock-top-trapezoid__svg[data-dock-trap-v="9"]'
    ).forEach((el) => el.remove());
    if (!trap.querySelector('.pagination-dock-top-trapezoid__svg[data-dock-trap-v="10"]')) {
        trap.insertAdjacentHTML('afterbegin', TRAPEZOID_FILL_SVG);
    }

    const centerRail = ensureDockGlobeRailCenterRestored();
    if (centerRail && centerRail.parentNode !== trap) {
        trap.appendChild(centerRail);
    }

    trap.querySelectorAll('.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="1"]')
        .forEach((el) => el.remove());
    if (!trap.querySelector('.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="2"]')) {
        trap.insertAdjacentHTML('beforeend', TRAPEZOID_BORDER_SVG);
    }
}

/**
 * Idempotently install the trapezoid cap row at the top of the dock,
 * migrating any legacy structure and ensuring the cap row is positioned
 * before the supplied `pagination` element.
 *
 * @param {HTMLElement} dock
 * @param {HTMLElement} pagination
 */
export function buildOrMigrateDockTrapezoidCap(dock, pagination) {
    let capRow = dock.querySelector('.pagination-dock-top-cap-row');
    if (!capRow) capRow = buildCapRow();

    if (pagination.parentNode === dock) {
        dock.insertBefore(capRow, pagination);
    } else {
        dock.appendChild(capRow);
    }

    migrateLegacyBorderWrap(dock, capRow);
    migrateOrphanTrapezoid(dock, capRow);
    applyTrapezoidSvgsAndCenterRail(capRow);
}
