/**
 * dockTrapezoidCap — builds (or migrates from a legacy layout) the cap row
 * that sits at the very top of the pagination dock:
 *
 *   [left dock-border image] [trapezoid (fill SVG + border SVG + #dockGlobeRailCenter)] [right dock-border image]
 *
 *   - buildOrMigrateDockTrapezoidCap(dock): idempotent. Creates the cap row if
 *     missing, migrates any pre-existing legacy `.pagination-dock-top-border-wrap`
 *     and orphan trapezoid into the new structure, ensures the SVGs are present
 *     at the latest version (`data-dock-trap-v="10"` for fill, `"4"` for border),
 *     and re-attaches `#dockGlobeRailCenter` inside the trapezoid.
 *
 * Pulls `ensureDockGlobeRailCenterRestored` from dockChromeLifecycle.js so the
 * center-rail factory lives in exactly one place.
 */

import { ensureDockGlobeRailCenterRestored } from './dockChromeLifecycle.js';
import { refreshDockTrapSvgFromTweaks } from '../../universal-features/atlas-header/SidePanelsTrapChrome.js?v=39';

const DOCK_BORDER_SRC = 'src/assets/images/Misc/UI/Dock%20Border.png';

/* Fill only (under rail); white outline is a separate sibling SVG above the rail. */
/* Top y=3 matches border path; y=0 caused colored fill above the white outline. */
/* Border uses the same straight legs as the fill — curved Q strokes sat inside the chord
 * and left blue fill visible outside the white outline on some browsers/GPUs. */
const TRAPEZOID_FILL_SVG = `<svg class="pagination-dock-top-trapezoid__svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-v="10" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<polygon class="pagination-dock-top-trapezoid__fill" points="2,3 98,3 112,100 -12,100" />
</svg>`;

/* Stroke 2.5 — matches side-panel trap chrome weight (was 8, read as a thick white bar). */
const TRAPEZOID_BORDER_SVG = `<svg class="pagination-dock-top-trapezoid__border-svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-border-v="4" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<path d="M -12,100 L 2,3 L 98,3 L 112,100" fill="none" stroke="#ffffff" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
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

function buildFlank(side) {
    const el = document.createElement('div');
    el.id = side === 'left' ? 'dockTrapFlankLeft' : 'dockTrapFlankRight';
    el.className = `dock-trap-flank dock-trap-flank--${side}`;
    el.setAttribute('aria-label', side === 'left' ? 'World mode controls left' : 'World mode controls right');
    return el;
}

function buildCapRow() {
    const capRow = document.createElement('div');
    capRow.className = 'pagination-dock-top-cap-row';

    const trapEl = document.createElement('div');
    trapEl.className = 'pagination-dock-top-trapezoid';

    capRow.append(
        buildBorderSide('left'),
        buildFlank('left'),
        trapEl,
        buildFlank('right'),
        buildBorderSide('right')
    );
    return capRow;
}

/**
 * Ensure flank hosts exist on an already-migrated cap row (idempotent).
 * @param {HTMLElement} capRow
 */
function ensureDockTrapFlanks(capRow) {
    if (!capRow) return;
    const trap = capRow.querySelector('.pagination-dock-top-trapezoid');
    if (!trap) return;

    let left = document.getElementById('dockTrapFlankLeft');
    let right = document.getElementById('dockTrapFlankRight');
    if (!left) {
        left = buildFlank('left');
        capRow.insertBefore(left, trap);
    } else if (left.parentElement !== capRow) {
        capRow.insertBefore(left, trap);
    }
    if (!right) {
        right = buildFlank('right');
        capRow.insertBefore(right, trap.nextSibling);
    } else if (right.parentElement !== capRow) {
        const afterTrap = trap.nextSibling;
        if (afterTrap) capRow.insertBefore(right, afterTrap);
        else capRow.appendChild(right);
    }
}

/**
 * Mode toggles outside the trapezium.
 * Desktop: all four mode buttons on the left; Reset (+ spacer) on the right.
 * Mobile: four mode buttons in #dockGlobeRailLeft; Reset stays with zoom controls.
 */
const DOCK_TRAP_FLANK_LEFT_IDS = [
    'hyperloopToggle',
    'weatherEffectsToggle',
    'lightingToggle',
    'autoRotateToggle',
];

const RESET_ICON_SRC = 'src/assets/images/Icons/Utility%20Icons/Reset%20Icon.png';

/**
 * Right flank: Reset (trap-adjacent) + shared strip for Zoom | Sun (remaining 3 slots).
 * @param {HTMLElement} right
 */
function ensureRightFlankResetLayout(right) {
    /* Tear down per-slider white bays if present; reunite shells into the panel. */
    const panel = document.getElementById('zoomControlsPanel');
    right.querySelectorAll(':scope > .dock-trap-flank__slider-bay').forEach((bay) => {
        if (panel) {
            while (bay.firstChild) panel.appendChild(bay.firstChild);
        }
        bay.remove();
    });
    right.querySelectorAll(':scope > .dock-trap-flank__spacer').forEach((el) => el.remove());

    let strip = right.querySelector(':scope > .dock-trap-flank__slider-strip');
    if (!strip) {
        strip = document.createElement('div');
        strip.className = 'dock-trap-flank__slider-strip';
        strip.id = 'dockTrapFlankSliderStrip';
        strip.setAttribute('aria-label', 'Zoom and lighting');
    }

    const resetBtn = document.getElementById('zoomResetBtn');
    if (resetBtn) {
        resetBtn.classList.add('globe-control-btn', 'dock-trap-flank__btn', 'zoom-reset-btn');

        let iconWrap = resetBtn.querySelector(':scope > #zoomResetIcon, :scope > .zoom-reset-btn__icon');
        if (!iconWrap) {
            iconWrap = document.createElement('span');
            iconWrap.id = 'zoomResetIcon';
            iconWrap.className = 'zoom-reset-btn__icon';
            iconWrap.setAttribute('aria-hidden', 'true');
            const img = document.createElement('img');
            img.src = RESET_ICON_SRC;
            img.alt = '';
            img.width = 36;
            img.height = 36;
            img.decoding = 'async';
            iconWrap.appendChild(img);
        }

        let label = resetBtn.querySelector(':scope > .globe-control-btn__label, :scope > .zoom-reset-btn__label');
        if (!label) {
            label = document.createElement('span');
            label.className = 'globe-control-btn__label zoom-reset-btn__label';
            label.textContent = 'Reset';
        } else {
            label.textContent = 'Reset';
        }

        resetBtn.replaceChildren(iconWrap, label);
    }

    if (panel) {
        const zoomShell = panel.querySelector('.stage-slider-shell--zoom')
            || document.querySelector('.stage-slider-shell--zoom');
        const sunSlot = panel.querySelector('#zoomSunSlot, .zoom-sun-slot')
            || document.getElementById('zoomSunSlot');
        if (zoomShell && zoomShell.parentElement !== panel) panel.appendChild(zoomShell);
        if (sunSlot && sunSlot.parentElement !== panel) panel.appendChild(sunSlot);
        /* Stack: Sun on top, Zoom below — each can use full strip width. */
        if (sunSlot && zoomShell) {
            panel.insertBefore(sunSlot, zoomShell);
        }
        if (panel.parentElement !== strip) strip.appendChild(panel);
    }

    /* Order: Reset (inner) → slider strip (outer, fills remaining 3 slots). */
    if (resetBtn) {
        if (resetBtn.parentElement !== right || right.firstElementChild !== resetBtn) {
            right.insertBefore(resetBtn, right.firstChild);
        }
    }
    if (strip.parentElement !== right) right.appendChild(strip);
    else if (right.lastElementChild !== strip) right.appendChild(strip);
    if (resetBtn && strip.previousElementSibling !== resetBtn) {
        right.insertBefore(resetBtn, strip);
    }
}

let flankReflowMqBound = false;

function ensureFlankReflowMq() {
    if (flankReflowMqBound || typeof window === 'undefined' || !window.matchMedia) return;
    flankReflowMqBound = true;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => reflowDockTrapFlankButtons();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
}

/**
 * Desktop: Vehicles/Weather/Lighting/Rotation → left flank;
 * Reset (+ spacer) → right flank (same total width as left).
 * Mobile: four mode toggles in #dockGlobeRailLeft.
 * Safe to call repeatedly after toggles/controls load.
 */
export function reflowDockTrapFlankButtons() {
    ensureFlankReflowMq();
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
        const rail = document.getElementById('dockGlobeRailLeft');
        if (!rail) return;
        DOCK_TRAP_FLANK_LEFT_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement !== rail) rail.appendChild(el);
        });
        /* Reset + slider panel return to #zoomControls on mobile. */
        const zoomHost = document.getElementById('zoomControls');
        const panel = document.getElementById('zoomControlsPanel');
        const resetBtn = document.getElementById('zoomResetBtn');
        if (zoomHost && panel && panel.parentElement !== zoomHost) {
            zoomHost.appendChild(panel);
        }
        if (resetBtn && panel && resetBtn.parentElement !== panel) {
            panel.appendChild(resetBtn);
        }
        const rightFlank = document.getElementById('dockTrapFlankRight');
        rightFlank?.querySelectorAll(
            ':scope > .dock-trap-flank__slider-bay, :scope > .dock-trap-flank__slider-strip, :scope > .dock-trap-flank__spacer',
        ).forEach((el) => el.remove());
        return;
    }
    const left = document.getElementById('dockTrapFlankLeft');
    const right = document.getElementById('dockTrapFlankRight');
    if (!left || !right) return;

    DOCK_TRAP_FLANK_LEFT_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.parentElement !== left) left.appendChild(el);
    });
    ensureRightFlankResetLayout(right);
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

    trap.querySelectorAll(
        '.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="1"], .pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="2"], .pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="3"]'
    ).forEach((el) => el.remove());
    if (!trap.querySelector('.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="4"]')) {
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
/**
 * Sit the collapse nub on the cap-row top (same band as the dock trapezium).
 * Not inside the clipped .pagination-dock-top-trapezoid — clip would shear the tab.
 */
function adoptCollapseHandleOntoTrapezoid(capRow) {
    const btn = document.getElementById('paginationDockCollapseBtn');
    if (!capRow || !btn) return;
    const pill = btn.querySelector('.pagination-dock-collapse-pill');
    pill?.classList.add('pagination-dock-collapse-nub');
    if (btn.parentElement !== capRow) {
        capRow.appendChild(btn);
    }
}

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
    ensureDockTrapFlanks(capRow);
    applyTrapezoidSvgsAndCenterRail(capRow);
    adoptCollapseHandleOntoTrapezoid(capRow);
    reflowDockTrapFlankButtons();
    /* Tweaks may have applied before the dock SVG existed — re-sync taper polygon. */
    refreshDockTrapSvgFromTweaks();
}
