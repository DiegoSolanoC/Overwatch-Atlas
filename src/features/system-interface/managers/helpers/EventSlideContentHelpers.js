/**
 * EventSlideContentHelpers - Utilities for updating event slide content
 * Extracted from EventSlideManager to reduce file size and follow Small Functions principle
 */

/**
 * Get display text with glitch service fallback
 */
export function getDisplayText(text, fallback = '') {
    return window.GlitchTextService?.getDisplayText(text) || text || fallback;
}

/**
 * Get display event name with glitch service fallback
 */
export function getDisplayEventName(name, fallback = '') {
    return window.GlitchTextService?.getDisplayEventName(name) || name || fallback;
}

/**
 * Setup variant toggle buttons
 */
export function setupVariantToggles(variantToggles, variants, initialVariantIndex, switchVariantCallback) {
    if (!variantToggles) return;
    
    if (variants && variants.length > 0) {
        variantToggles.style.display = 'flex';
        variantToggles.innerHTML = '';
        
        variants.forEach((variant, index) => {
            const btn = document.createElement('button');
            btn.className = 'variant-toggle-btn';
            btn.innerHTML = getDisplayEventName(variant.name) || `Variant ${index + 1}`;
            btn.dataset.variantIndex = index;
            if (index === initialVariantIndex) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => switchVariantCallback(index));
            variantToggles.appendChild(btn);
        });
    } else {
        variantToggles.style.display = 'none';
        variantToggles.innerHTML = '';
    }
}

/**
 * Update variant toggle button active states
 */
export function updateVariantToggleButtons(variantToggles, activeIndex) {
    if (!variantToggles) return;
    const buttons = variantToggles.querySelectorAll('.variant-toggle-btn');
    buttons.forEach((btn, index) => {
        if (index === activeIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Setup close button handler
 */
export function setupCloseButton(closeBtn, hideCallback) {
    if (!closeBtn) return;
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideCallback();
    });
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideContentHelpers) {
        window.EventSlideContentHelpers = {};
    }
    window.EventSlideContentHelpers.getDisplayText = getDisplayText;
    window.EventSlideContentHelpers.getDisplayEventName = getDisplayEventName;
    window.EventSlideContentHelpers.setupVariantToggles = setupVariantToggles;
    window.EventSlideContentHelpers.updateVariantToggleButtons = updateVariantToggleButtons;
    window.EventSlideContentHelpers.setupCloseButton = setupCloseButton;
}
