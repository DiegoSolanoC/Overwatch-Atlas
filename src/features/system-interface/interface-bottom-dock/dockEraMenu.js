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

function getBodyScale() {
    try {
        const t = window.getComputedStyle(document.body).transform;
        if (!t || t === 'none') return 1;
        const m = t.match(/^matrix\(([^)]+)\)$/);
        if (!m) return 1;
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        const a = parts[0];
        return Number.isFinite(a) && a > 0 ? a : 1;
    } catch {
        return 1;
    }
}

/**
 * @returns {HTMLElement | null}
 */
function getTrapeziumAnchorEl() {
    return (
        document.querySelector('.pagination-dock-top-trapezoid')
        || document.getElementById('paginationDock')
        || document.getElementById('dockGlobeRailCenter')
    );
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
    const anchor = getTrapeziumAnchorEl();
    if (!anchor) return;

    const scale = getBodyScale();
    const rect = anchor.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / scale;
    const gapAbove = 36;
    const anchorTop = rect.top / scale;

    const vw = Math.max(1, (window.innerWidth || 1) / scale);
    const margin = 10;

    menu.style.display = 'flex';
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    let left = cx;
    let top = anchorTop - gapAbove - menuHeight;

    if (left - menuWidth / 2 < margin) left = menuWidth / 2 + margin;
    if (left + menuWidth / 2 > vw - margin) left = vw - menuWidth / 2 - margin;
    if (top < margin) top = margin;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
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
    document.body.appendChild(menu);
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

    menu._eraRepositionCleanup = () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
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
