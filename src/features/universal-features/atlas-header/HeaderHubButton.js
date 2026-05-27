/**
 * HeaderHubButton — the all-purpose icon-button factory used to mount mode
 * switches in the header hub *and* dock controls in the globe rail.
 *
 * The exported function `createHeaderHubButton` accepts a config bag
 * describing the parent container, styling base, icon, label, mode tag, and
 * optional desktop/mobile overrides. When mobile/desktop overrides are
 * present it installs a responsive-mount watcher that re-parents and
 * re-classes the button on viewport changes.
 *
 * Header-hub layout invariants enforced here on every mount or reflow:
 *   - Right hub: Exit button stays last; other buttons sort by `headerOrder`.
 *   - Left hub: only direct children sort by `headerOrder`; map/rotate
 *     stack and inner button group keep their internal layout.
 *   - Left dock rail: buttons sort by `headerOrder`.
 *
 * Lives alongside `HeaderModeButtons.js` and `HeaderModeSynchronization.js`
 * in `BootUp/header/`. Renamed from `createGlobeControlButton` so the file
 * name and the exported function finally agree.
 */

import { updateStatus } from '../atlas-mode-runtime/statusFeed.js';

let responsiveMountingInitialized = false;

function _isMobileHeaderMode() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 768px)').matches;
}

function _getHeaderHubRight() {
    return typeof document !== 'undefined' ? document.getElementById('headerHubRight') : null;
}

function _getHeaderHubLeft() {
    return typeof document !== 'undefined' ? document.getElementById('headerHub') : null;
}

function _sortHeaderHubRight(parent) {
    if (!parent) return;
    const exitBtn =
        parent.querySelector(':scope > .header-hub-btn--exit') ||
        parent.querySelector(':scope > [data-action="menu"]');
    const group = parent.querySelector('#headerHubRightButtonGroup');
    const buttons = group
        ? Array.from(group.querySelectorAll(':scope > button')).filter((b) => b !== exitBtn)
        : Array.from(parent.querySelectorAll('button')).filter((b) => b !== exitBtn);

    buttons.sort((a, b) => {
        const ao = a.dataset.headerOrder ? parseFloat(a.dataset.headerOrder) : 9999;
        const bo = b.dataset.headerOrder ? parseFloat(b.dataset.headerOrder) : 9999;
        if (ao !== bo) return ao - bo;
        return (a.id || '').localeCompare(b.id || '');
    });

    buttons.forEach((b) => {
        if (group) {
            group.appendChild(b);
        } else if (exitBtn) {
            parent.insertBefore(b, exitBtn);
        } else {
            parent.appendChild(b);
        }
    });

    try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('owtl-header-hub-mutated', { detail: { hub: 'headerHubRight' } }));
        }
    } catch (_) { /* ignore */ }
}

function _sortHeaderHubLeft(parent) {
    if (!parent) return;
    // Only sort direct children so nested button groups (e.g. Map/Rotate stack)
    // keep their internal layout.
    const children = Array.from(parent.children);
    const sortable = children.filter(
        (el) =>
            el &&
            (el.tagName === 'BUTTON' ||
                el.id === 'headerHubMapStack' ||
                el.id === 'headerHubButtonGroup')
    );

    const getOrder = (el) => {
        if (el?.id === 'headerHubMapStack') return 30;
        if (el?.id === 'headerHubButtonGroup') {
            const n = parseFloat(el.dataset.headerOrder);
            return Number.isFinite(n) ? n : 31;
        }
        if (el?.dataset?.headerOrder) {
            const n = parseFloat(el.dataset.headerOrder);
            if (Number.isFinite(n)) return n;
        }
        return 9999;
    };

    sortable.sort((a, b) => {
        const ao = getOrder(a);
        const bo = getOrder(b);
        if (ao !== bo) return ao - bo;
        return (a.id || '').localeCompare(b.id || '');
    });

    sortable.forEach(el => parent.appendChild(el));

    try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('owtl-header-hub-mutated', { detail: { hub: 'headerHub' } }));
        }
    } catch (_) { /* ignore */ }
}

function _applyResponsiveMount(button) {
    if (!button?.dataset?.responsiveMount) return;

    const isMobile = _isMobileHeaderMode();
    const targetParentId = isMobile ? button.dataset.mobileParentId : button.dataset.desktopParentId;
    const targetBaseClass = isMobile ? button.dataset.mobileBaseClass : button.dataset.desktopBaseClass;
    const targetExtraClass = isMobile ? button.dataset.mobileClassName : button.dataset.desktopClassName;

    const preserve = [];
    if (button.classList.contains('active')) preserve.push('active');

    if (targetBaseClass) {
        button.className = `${targetBaseClass} ${targetExtraClass || ''}`.trim();
        preserve.forEach(c => button.classList.add(c));
    }

    const targetParent = targetParentId ? document.getElementById(targetParentId) : null;
    if (targetParent && button.parentElement !== targetParent) {
        targetParent.appendChild(button);
    }

    // If we moved into the header hub, re-sort so Exit stays last.
    if (!isMobile && (targetParentId === 'headerHubRight' || targetParentId === 'headerHubRightButtonGroup')) {
        _sortHeaderHubRight(_getHeaderHubRight());
    }
    if (
        !isMobile &&
        (targetParentId === 'headerHub' ||
            targetParentId === 'headerHubButtonGroup' ||
            targetParentId === 'headerHubMapStack')
    ) {
        _sortHeaderHubLeft(_getHeaderHubLeft());
    }
}

function _initResponsiveMounting() {
    if (responsiveMountingInitialized) return;
    responsiveMountingInitialized = true;

    if (typeof window === 'undefined') return;
    const mq = (typeof window.matchMedia === 'function') ? window.matchMedia('(max-width: 768px)') : null;

    const reflow = () => {
        const buttons = Array.from(document.querySelectorAll('button[data-responsive-mount="true"]'));
        buttons.forEach(_applyResponsiveMount);
    };

    if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', reflow);
    } else {
        window.addEventListener('resize', reflow);
    }
}

/**
 * Sorts buttons in the left globe rail by `headerOrder` dataset.
 */
function _sortGlobeRail(rail) {
    if (!rail) return;
    const buttons = Array.from(rail.children);
    buttons.sort((a, b) => {
        const orderA = parseInt(a.dataset.headerOrder || '999', 10);
        const orderB = parseInt(b.dataset.headerOrder || '999', 10);
        return orderA - orderB;
    });
    buttons.forEach(btn => rail.appendChild(btn));
}

/**
 * Creates a header-hub or globe-control icon button. Idempotent: returns the
 * existing button when an element with the same `id` is already mounted.
 *
 * @param {Object} config
 * @param {string} config.id
 * @param {string} config.className - Extra CSS classes appended after baseClass.
 * @param {string} config.title - Tooltip + ARIA label.
 * @param {string} config.iconPath
 * @param {string} config.iconAlt
 * @param {string} [config.parentId='content']
 * @param {string} [config.baseClass='globe-control-btn']
 * @param {string|null} [config.iconSpanId] - Defaults to `${id}Icon`.
 * @param {string|null} [config.label] - Visible text label (used by header hub).
 * @param {number|null} [config.headerOrder] - Sort key inside header hub / dock rail.
 * @param {string|null} [config.mobileParentId] - Mobile parent override (triggers responsive mounting).
 * @param {string|null} [config.mobileBaseClass]
 * @param {string|null} [config.mobileClassName]
 * @param {string|null} [config.mode] - `data-mode` for header-hub mode switching.
 * @returns {HTMLElement}
 */
export function createHeaderHubButton({
    id,
    className,
    title,
    iconPath,
    iconAlt,
    parentId = 'content',
    baseClass = 'globe-control-btn',
    iconSpanId = null,
    label = null,
    headerOrder = null,
    mobileParentId = null,
    mobileBaseClass = null,
    mobileClassName = null,
    mode = null
}) {
    if (document.getElementById(id)) {
        return document.getElementById(id);
    }

    const finalIconSpanId = iconSpanId || `${id}Icon`;
    const isMobile = _isMobileHeaderMode();
    const resolvedParentId = isMobile && mobileParentId ? mobileParentId : parentId;
    const resolvedBaseClass = isMobile && mobileBaseClass ? mobileBaseClass : baseClass;
    const resolvedClassName = isMobile && mobileClassName !== null && mobileClassName !== undefined
        ? mobileClassName
        : className;

    const button = document.createElement('button');
    button.id = id;
    button.className = `${resolvedBaseClass} ${resolvedClassName || ''}`.trim();
    button.title = title;
    if (title) {
        button.setAttribute('aria-label', title);
    }
    if (mode) {
        button.dataset.mode = mode;
    }
    const isHeaderHubBtn = (resolvedBaseClass || '').includes('header-hub-btn');

    const iconWrap = document.createElement('span');
    iconWrap.id = finalIconSpanId;
    if (isHeaderHubBtn) iconWrap.className = 'header-hub-icon-wrap';

    const img = document.createElement('img');
    if (isHeaderHubBtn) {
        img.className = 'header-hub-icon';
        img.style.objectFit = 'contain';
    } else {
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
    }
    img.src = iconPath;
    img.alt = iconAlt || '';
    iconWrap.appendChild(img);
    button.appendChild(iconWrap);

    if (label) {
        const labelEl = document.createElement('span');
        // Use different class for dock buttons vs header hub buttons.
        if (isHeaderHubBtn) {
            labelEl.className = 'header-hub-btn-label';
        } else {
            labelEl.className = 'globe-control-btn__label';
        }
        labelEl.textContent = String(label);
        button.appendChild(labelEl);
    }

    const parent = document.getElementById(resolvedParentId);
    if (parent) {
        parent.appendChild(button);

        if (headerOrder !== null && headerOrder !== undefined) {
            button.dataset.headerOrder = String(headerOrder);
        }

        // Caller provided a mobile/desktop split — store and mount responsively.
        if (mobileParentId || mobileBaseClass || mobileClassName) {
            button.dataset.responsiveMount = 'true';
            button.dataset.desktopParentId = parentId;
            button.dataset.desktopBaseClass = baseClass;
            button.dataset.desktopClassName = className || '';
            button.dataset.mobileParentId = mobileParentId || parentId;
            button.dataset.mobileBaseClass = mobileBaseClass || baseClass;
            button.dataset.mobileClassName = (mobileClassName !== null && mobileClassName !== undefined)
                ? mobileClassName
                : (className || '');
            _initResponsiveMounting();
            // Apply immediately in case we created it in the "wrong" parent due to load timing.
            _applyResponsiveMount(button);
        }

        // Keep order stable across loaders, and Exit always last in the right hub.
        if (resolvedParentId === 'headerHubRight' || resolvedParentId === 'headerHubRightButtonGroup') {
            _sortHeaderHubRight(_getHeaderHubRight());
        }
        if (resolvedParentId === 'headerHub' || resolvedParentId === 'headerHubButtonGroup') {
            _sortHeaderHubLeft(_getHeaderHubLeft());
        }
        if (resolvedParentId === 'headerHubMapStack') {
            _sortHeaderHubLeft(_getHeaderHubLeft());
        }
        if (resolvedParentId === 'dockGlobeRailLeft') {
            _sortGlobeRail(parent);
        }

        updateStatus(`✓ ${title} button added`, 'success');
    } else {
        console.warn(`Parent element '${parentId}' not found for button ${id}`);
    }

    return button;
}
