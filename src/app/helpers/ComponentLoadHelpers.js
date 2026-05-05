/**
 * ComponentLoadHelpers - Common utilities for component loading
 * Extracted from component-loader.js to reduce duplication
 */

import { showLoadingOverlay, hideLoadingOverlay } from '../../managers/LoadingOverlayManager.js';
import { updateStatus } from '../../managers/StatusManager.js';
import { setButtonState } from '../../managers/ButtonStateManager.js';

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
 * Wraps a component load function with standard error handling and overlay management
 * @param {Function} loadFn - The async load function to wrap
 * @param {string} componentName - Name of the component (for status messages)
 * @param {string} buttonId - ID of the button to update state
 * @param {boolean} isRunOperation - Whether this is part of a run operation
 * @returns {Promise<void>}
 */
export async function withLoadWrapper(loadFn, componentName, buttonId, isRunOperation = false) {
    // Only show overlay if not in a run operation
    if (!isRunOperation) {
        showLoadingOverlay();
    }
    setButtonState(buttonId, 'loading');
    updateStatus(`Starting ${componentName} load...`, 'info');
    
    try {
        await loadFn();
        setButtonState(buttonId, 'loaded');
        updateStatus(`✓ ${componentName} components fully loaded!`, 'success');
    } catch (error) {
        console.error(`Error loading ${componentName}:`, error);
        updateStatus(`✗ Error loading ${componentName}: ${error.message}`, 'error');
        setButtonState(buttonId, 'error');
        throw error;
    } finally {
        if (!isRunOperation) {
            hideLoadingOverlay();
        }
    }
}

/**
 * Wraps a component unload function with standard error handling
 * @param {Function} unloadFn - The async unload function to wrap
 * @param {string} componentName - Name of the component (for status messages)
 * @param {string} buttonId - ID of the button to update state
 * @returns {Promise<void>}
 */
export async function withUnloadWrapper(unloadFn, componentName, buttonId) {
    updateStatus(`Unloading ${componentName}...`, 'info');
    
    try {
        await unloadFn();
        setButtonState(buttonId, 'default');
        updateStatus(`✓ ${componentName} components unloaded!`, 'success');
    } catch (error) {
        console.error(`Error unloading ${componentName}:`, error);
        updateStatus(`✗ Error unloading ${componentName}: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Checks if a component is already loaded
 * @param {boolean} isLoaded - Whether the component is currently loaded
 * @param {string} componentName - Name of the component
 * @returns {boolean} - True if already loaded
 */
export function checkAlreadyLoaded(isLoaded, componentName) {
    if (isLoaded) {
        updateStatus(`→ ${componentName} already loaded!`, 'info');
        return true;
    }
    return false;
}

/**
 * Loads a sound effect if SoundEffectsManager is available
 * @param {string} soundName - Name of the sound
 * @param {string} soundPath - Path to the sound file
 * @param {string} statusMessage - Optional status message
 */
export function loadSoundEffect(soundName, soundPath, statusMessage = null) {
    if (window.SoundEffectsManager) {
        if (statusMessage) {
            updateStatus(statusMessage, 'info');
        }
        window.SoundEffectsManager.loadSound(soundName, soundPath);
        if (statusMessage) {
            updateStatus(`✓ ${soundName} sound effect loaded`, 'success');
        }
    }
}

/**
 * Loads multiple sound effects in batch
 * @param {Array<{name: string, path: string}>} sounds - Array of sound definitions
 * @param {string} statusMessage - Status message to show
 */
export function loadSoundEffects(sounds, statusMessage = 'Loading sound effects...') {
    if (!window.SoundEffectsManager) {
        return;
    }
    
    updateStatus(statusMessage, 'info');
    sounds.forEach(({ name, path }) => {
        window.SoundEffectsManager.loadSound(name, path);
    });
    updateStatus(`✓ ${sounds.length} sound effects loaded`, 'success');
}

/**
 * Creates a standard globe control button
 * @param {Object} config - Button configuration
 * @param {string} config.id - Button ID
 * @param {string} config.className - Additional CSS classes
 * @param {string} config.title - Button title/tooltip
 * @param {string} config.iconPath - Path to icon image
 * @param {string} config.iconAlt - Alt text for icon
 * @param {string} config.parentId - ID of parent element to append to
 * @param {string} config.baseClass - Base CSS class(es) for the button (default: globe-control-btn)
 * @param {string} config.iconSpanId - Optional explicit ID for the icon span
 * @param {string} config.label - Optional visible label text (used in header hub)
 * @param {number} config.headerOrder - Optional ordering for header hub placement
 * @param {string} config.mobileParentId - Optional parentId override for mobile
 * @param {string} config.mobileBaseClass - Optional baseClass override for mobile
 * @param {string} config.mobileClassName - Optional className override for mobile
 * @param {string} config.mode - Optional data-mode attribute for header hub mode switching
 * @returns {HTMLElement} - The created button element
 */
export function createGlobeControlButton({
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
        // Use different class for dock buttons vs header hub buttons
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

        // If the caller provided a mobile/desktop layout split, store it and mount responsively.
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

        // If these buttons are being added into the header hub, keep their order stable
        // (regardless of which component loads first) and keep Exit last.
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

/**
 * Sorts buttons in the left globe rail by headerOrder dataset
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
