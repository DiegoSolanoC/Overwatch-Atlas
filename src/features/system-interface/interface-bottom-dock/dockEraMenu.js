/**
 * Era picker — horizontal row centered on the dock trapezium (palette-menu pattern).
 */

import {
    DOCK_ERA_MENU_OPTIONS,
    getActiveDockEraFilter,
    setDockEraFilter,
    clearDockEraFilter,
} from './dockEraTimelineFilter.js';
import { refreshDockTimelinePagination } from './refreshDockTimelinePagination.js';
import { closePaletteMenu } from '../../universal-features/atlas-palette/PaletteMenuPositioning.js';
import { playColorChangeSound } from '../../universal-features/atlas-palette/PaletteSwitching.js';
import { getEraDockLabelColorHex } from '../interface-shared/hover-badge/eraHoverPreviewTheme.js';

let clickOutsideHandler = null;
/** @type {string | null} */
let hoveredEraId = null;

/** Host on <html> so `position: fixed` is viewport-relative (body uses transform: scale on mobile). */
function getEraMenuPortal() {
    return document.documentElement;
}

function ensureEraMenuPortal(menu) {
    const portal = getEraMenuPortal();
    if (menu.parentElement !== portal) {
        portal.appendChild(menu);
    }
}

function isMobilePortraitViewport() {
    return window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
}

/**
 * @returns {DOMRect | null}
 */
function getDockCapAnchorRect() {
    const capRow = document.querySelector('.pagination-dock-top-cap-row');
    if (capRow) return capRow.getBoundingClientRect();

    const trap = document.querySelector('.pagination-dock-top-trapezoid');
    if (trap) return trap.getBoundingClientRect();

    const dock = document.getElementById('paginationDock');
    if (dock) return dock.getBoundingClientRect();

    const centerRail = document.getElementById('dockGlobeRailCenter');
    return centerRail ? centerRail.getBoundingClientRect() : null;
}

/**
 * @param {string | null | undefined} eraId
 * @returns {{ id: string, label: string, iconPath: string }}
 */
function getEraOption(eraId) {
    const id = eraId != null ? String(eraId).trim() : '';
    return DOCK_ERA_MENU_OPTIONS.find((o) => o.id === id) || DOCK_ERA_MENU_OPTIONS[0];
}

function getDisplayedEraId() {
    return hoveredEraId || getActiveDockEraFilter() || 'complete';
}

function updateEraMenuTitleDisplay() {
    const titleEl = document.getElementById('dockEraMenuTitle');
    if (!titleEl) return;
    const eraId = getDisplayedEraId();
    const option = getEraOption(eraId);
    titleEl.textContent = option.label;
    titleEl.style.color = getEraDockLabelColorHex(eraId);
}

/**
 * @param {HTMLElement} menu
 */
function positionEraMenuRow(menu) {
    const anchorRect = getDockCapAnchorRect();
    if (!anchorRect) return;

    ensureEraMenuPortal(menu);

    const vv = window.visualViewport;
    const vvLeft = vv?.offsetLeft ?? 0;
    const vvTop = vv?.offsetTop ?? 0;
    const vvWidth = vv?.width ?? window.innerWidth;
    const vvHeight = vv?.height ?? window.innerHeight;
    const margin = 10;
    const gapAbove = isMobilePortraitViewport() ? 14 : 36;
    const portrait = isMobilePortraitViewport();

    menu.style.position = 'fixed';
    menu.style.display = 'flex';
    menu.classList.toggle('dock-era-menu--portrait-sheet', portrait);

    if (portrait) {
        /*
         * Full-width strip: avoid translate(-50%) + max-width shrinking, which with
         * justify-content:center on the button row clips the first and last icons.
         */
        menu.style.transform = 'none';
        menu.style.width = `${Math.max(160, vvWidth - margin * 2)}px`;
        menu.style.maxWidth = 'none';
        menu.style.left = `${vvLeft + margin}px`;
        menu.style.right = 'auto';

        const menuHeight = menu.offsetHeight;
        menu.style.top = `${Math.max(
            vvTop + margin,
            anchorRect.top - gapAbove - menuHeight,
        )}px`;

        const buttonsRow = menu.querySelector('.dock-era-menu__buttons');
        if (buttonsRow) {
            buttonsRow.scrollLeft = 0;
        }
        return;
    }

    menu.style.transform = 'translate(-50%, 0)';
    menu.style.width = 'max-content';
    menu.style.maxWidth = `${Math.max(160, vvWidth - margin * 2)}px`;
    menu.style.right = 'auto';

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const halfW = menuWidth / 2;

    let left = anchorRect.left + anchorRect.width / 2;
    let top = anchorRect.top - gapAbove - menuHeight;

    const minLeft = vvLeft + margin + halfW;
    const maxLeft = vvLeft + vvWidth - margin - halfW;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    const minTop = vvTop + margin;
    const maxTop = vvTop + vvHeight - margin - menuHeight;
    if (top < minTop) top = minTop;
    if (Number.isFinite(maxTop) && top > maxTop) top = Math.max(minTop, maxTop);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    const buttonsRow = menu.querySelector('.dock-era-menu__buttons');
    if (buttonsRow) {
        buttonsRow.scrollLeft = 0;
    }
}

function updateEraMenuActiveState() {
    const menu = document.getElementById('dockEraMenu');
    if (!menu) return;
    const active = getActiveDockEraFilter() || 'complete';
    menu.querySelectorAll('.dock-era-option-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.eraId === active);
    });
    updateErasToggleIcon(active);
    updateEraMenuTitleDisplay();
}

/**
 * @param {string} eraId
 */
export function updateErasToggleIcon(eraId) {
    const toggle = document.getElementById('erasToggle');
    if (!toggle) return;
    const option = getEraOption(eraId);
    const iconSpan = toggle.querySelector('#erasToggleIcon') || toggle.querySelector('[id$="Icon"]');
    if (!iconSpan) return;
    let img = iconSpan.querySelector('img');
    if (img) {
        img.src = option.iconPath;
        img.alt = option.label;
    } else {
        iconSpan.innerHTML = '';
        img = document.createElement('img');
        img.src = option.iconPath;
        img.alt = option.label;
        img.className = 'header-hub-icon';
        iconSpan.appendChild(img);
    }
}

/**
 * @param {HTMLElement} menu
 */
function ensureDockEraMenuStructure(menu) {
    if (menu.querySelector('.dock-era-menu__buttons')) return;

    let titleEl = menu.querySelector('.dock-era-menu__title');
    if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.id = 'dockEraMenuTitle';
        titleEl.className = 'dock-era-menu__title';
        titleEl.setAttribute('aria-live', 'polite');
        menu.insertBefore(titleEl, menu.firstChild);
    }

    const row = document.createElement('div');
    row.className = 'dock-era-menu__buttons';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Timeline era options');

    const looseButtons = menu.querySelectorAll(':scope > .dock-era-option-btn');
    looseButtons.forEach((btn) => row.appendChild(btn));
    menu.appendChild(row);
}

function ensureDockEraMenuDom() {
    let menu = document.getElementById('dockEraMenu');
    if (menu) {
        ensureDockEraMenuStructure(menu);
        ensureEraMenuPortal(menu);
        return menu;
    }

    menu = document.createElement('div');
    menu.id = 'dockEraMenu';
    menu.className = 'dock-era-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Timeline era filter');

    const titleEl = document.createElement('div');
    titleEl.id = 'dockEraMenuTitle';
    titleEl.className = 'dock-era-menu__title';
    titleEl.setAttribute('aria-live', 'polite');

    const row = document.createElement('div');
    row.className = 'dock-era-menu__buttons';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Timeline era options');

    DOCK_ERA_MENU_OPTIONS.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dock-era-option-btn';
        btn.dataset.eraId = option.id;
        btn.title = option.label;
        btn.setAttribute('aria-label', option.label);
        btn.style.setProperty('--era-stagger-index', String(index));
        const img = document.createElement('img');
        img.src = option.iconPath;
        img.alt = '';
        img.draggable = false;
        btn.appendChild(img);
        row.appendChild(btn);
    });

    menu.appendChild(titleEl);
    menu.appendChild(row);
    getEraMenuPortal().appendChild(menu);
    return menu;
}

export function openDockEraMenu() {
    const menu = ensureDockEraMenuDom();
    const toggle = document.getElementById('erasToggle');
    if (!menu || !toggle) return;

    closePaletteMenu();
    hoveredEraId = null;
    updateEraMenuActiveState();

    const reposition = () => positionEraMenuRow(menu);
    menu.classList.remove('dock-era-menu--portrait-sheet');
    reposition();
    menu.classList.add('open');
    reposition();

    try {
        if (menu._eraRepositionCleanup) menu._eraRepositionCleanup();
    } catch (_) {}

    let raf = null;
    const schedule = () => {
        if (raf != null) return;
        raf = requestAnimationFrame(() => {
            raf = null;
            if (!menu.classList.contains('open')) return;
            reposition();
        });
    };

    const onScroll = () => schedule();
    const onResize = () => schedule();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);

    menu._eraRepositionCleanup = () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('scroll', onResize);
        if (raf != null) cancelAnimationFrame(raf);
        menu._eraRepositionCleanup = null;
    };

    toggle.classList.add('active');
    playColorChangeSound();
}

export function closeDockEraMenu() {
    const menu = document.getElementById('dockEraMenu');
    const toggle = document.getElementById('erasToggle');
    const wasOpen = !!menu?.classList.contains('open');
    if (menu) {
        menu.classList.remove('open');
        menu.classList.remove('dock-era-menu--portrait-sheet');
        try {
            if (menu._eraRepositionCleanup) menu._eraRepositionCleanup();
        } catch (_) {}
    }
    hoveredEraId = null;
    toggle?.classList.remove('active');
    if (wasOpen) playColorChangeSound();
}

function handleEraOptionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const eraId = e.currentTarget?.dataset?.eraId;
    if (!eraId) return;
    if (eraId === 'complete') {
        clearDockEraFilter();
    } else {
        setDockEraFilter(eraId);
    }
    hoveredEraId = null;
    updateEraMenuActiveState();
    refreshDockTimelinePagination();
    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('page');
    }
    window.flashButton?.(document.getElementById('erasToggle'), 'flash-orange');
}

function handleEraOptionHover(e) {
    const eraId = e.currentTarget?.dataset?.eraId;
    if (!eraId) return;
    hoveredEraId = eraId;
    updateEraMenuTitleDisplay();
}

function handleEraButtonsRowLeave() {
    hoveredEraId = null;
    updateEraMenuTitleDisplay();
}

function handleErasToggleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleDockEraMenu();
}

export function toggleDockEraMenu() {
    const menu = document.getElementById('dockEraMenu');
    if (menu?.classList.contains('open')) {
        closeDockEraMenu();
    } else {
        openDockEraMenu();
    }
}

export function setupDockEraMenu() {
    const toggle = document.getElementById('erasToggle');
    if (!toggle) return;

    ensureDockEraMenuDom();
    updateEraMenuActiveState();

    const menu = document.getElementById('dockEraMenu');
    if (!menu) return;

    if (!toggle.dataset.eraMenuBound) {
        toggle.dataset.eraMenuBound = '1';
        toggle._eraMenuToggleHandler = handleErasToggleClick;
        toggle.addEventListener('click', handleErasToggleClick, true);
    }

    const buttonsRow = menu.querySelector('.dock-era-menu__buttons');
    if (buttonsRow && !buttonsRow.dataset.eraRowBound) {
        buttonsRow.dataset.eraRowBound = '1';
        buttonsRow._eraRowLeaveHandler = handleEraButtonsRowLeave;
        buttonsRow.addEventListener('mouseleave', handleEraButtonsRowLeave);
    }

    menu.querySelectorAll('.dock-era-option-btn').forEach((btn) => {
        if (btn.dataset.eraOptionBound) return;
        btn.dataset.eraOptionBound = '1';
        btn._eraOptionHandler = handleEraOptionClick;
        btn._eraOptionHoverHandler = handleEraOptionHover;
        btn.addEventListener('click', handleEraOptionClick);
        btn.addEventListener('mouseenter', handleEraOptionHover);
        btn.addEventListener('focus', handleEraOptionHover);
    });

    if (!clickOutsideHandler) {
        clickOutsideHandler = (e) => {
            const eraMenu = document.getElementById('dockEraMenu');
            const eraToggle = document.getElementById('erasToggle');
            if (!eraMenu?.classList.contains('open')) return;
            if (
                !eraMenu.contains(e.target)
                && eraToggle
                && !eraToggle.contains(e.target)
            ) {
                closeDockEraMenu();
            }
        };
        document.addEventListener('click', clickOutsideHandler, true);
    }
}

export function teardownDockEraMenu() {
    closeDockEraMenu();
    if (clickOutsideHandler) {
        document.removeEventListener('click', clickOutsideHandler, true);
        clickOutsideHandler = null;
    }
    document.getElementById('dockEraMenu')?.remove();
    const toggle = document.getElementById('erasToggle');
    if (toggle?._eraMenuToggleHandler) {
        toggle.removeEventListener('click', toggle._eraMenuToggleHandler, true);
        delete toggle._eraMenuToggleHandler;
        delete toggle.dataset.eraMenuBound;
    }
}

if (typeof window !== 'undefined') {
    window._closeDockEraMenu = closeDockEraMenu;
    window._toggleDockEraMenu = toggleDockEraMenu;
}
