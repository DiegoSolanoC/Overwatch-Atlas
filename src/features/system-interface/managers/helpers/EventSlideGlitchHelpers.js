/**
 * EventSlideGlitchHelpers - Utilities for glitch effect management in event slides
 * Extracted from EventSlideManager to reduce file size
 */

/** Same asset as {@link HackedOverlayManager} stamp — unified “glitch” branding. */
export const GLITCH_TOGGLE_ICON_HTML = `<img class="event-glitch-toggle-img" src="src/assets/images/Misc/Hacked.png" alt="" width="48" height="48" decoding="async" draggable="false" />`;

/**
 * Icon-only glitch control: no label; aria/title reflect state.
 * @param {HTMLElement|null} btn
 * @param {boolean} glitchEnabled
 */
export function applyGlitchToggleButtonState(btn, glitchEnabled) {
    if (!btn) return;
    let wrap = btn.querySelector('.event-glitch-toggle-btn__icon');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.className = 'event-glitch-toggle-btn__icon';
        wrap.setAttribute('aria-hidden', 'true');
        btn.appendChild(wrap);
    }
    wrap.innerHTML = GLITCH_TOGGLE_ICON_HTML;
    btn.classList.toggle('event-glitch-toggle-btn--on', !!glitchEnabled);
    const label = glitchEnabled ? 'Disable glitch effect' : 'Enable glitch effect';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', glitchEnabled ? 'true' : 'false');
}

/**
 * Check if event contains "Olivia Colomar"
 */
export function hasOliviaColomar(eventName, description, eventData) {
    if (eventName && /Olivia Colomar/gi.test(eventName)) return true;
    if (description && /Olivia Colomar/gi.test(description)) return true;
    if (eventData?.variants?.some(v =>
        (v.name && /Olivia Colomar/gi.test(v.name)) ||
        (v.description && /Olivia Colomar/gi.test(v.description))
    )) return true;
    return false;
}

/**
 * Setup glitch toggle button
 */
export function setupGlitchToggleButton(glitchToggleBtn, hasOlivia, uiView) {
    if (!glitchToggleBtn) {
        console.error('Glitch toggle button not found!');
        return;
    }
    
    if (hasOlivia) {
        glitchToggleBtn.style.display = 'inline-flex';
        glitchToggleBtn.style.visibility = 'visible';
        if (window.GlitchTextService) {
            window.GlitchTextService.setEnabled(true);
        }
        applyGlitchToggleButtonState(glitchToggleBtn, true);
        glitchToggleBtn.onclick = () => uiView.toggleGlitchEffect();
        
        setTimeout(() => {
            if (window.GlitchTextService?.isEnabled() && window.SoundEffectsManager?.play) {
                try {
                    window.SoundEffectsManager.play('hackOn', {
                        playbackRate: 1.2,
                        fadeOut: true,
                        fadeOutDuration: 500
                    });
                } catch (e) {
                    console.error('Error playing hackOn sound:', e);
                }
            }
        }, 50);
    } else {
        glitchToggleBtn.style.display = 'none';
    }
}

/**
 * Click / keyboard on glitch spans in the title or description toggles the same as the button.
 * Bound once per #eventSlide.
 * @param {HTMLElement} eventSlideEl
 * @param {{ toggleGlitchEffect: Function }} uiView
 */
export function bindGlitchTextClickDelegation(eventSlideEl, uiView) {
    if (!eventSlideEl || !uiView || typeof uiView.toggleGlitchEffect !== 'function') return;
    if (eventSlideEl.dataset.glitchTextClickBound === 'true') return;
    eventSlideEl.dataset.glitchTextClickBound = 'true';

    eventSlideEl.addEventListener('click', (e) => {
        if (eventSlideEl.classList.contains('event-slide--inline-editing')) return;
        const t = e.target;
        if (t.closest('#eventSlideEditBtn, #eventSlideSaveBtn, .event-slide-action-btn')) return;
        const inTitle = t.closest('#eventSlideTitle');
        const inText = t.closest('#eventSlideText');
        if (!inTitle && !inText) return;
        if (t.closest('a[href], button, input, textarea, select')) return;
        const glitchBox = t.closest('.glitchy-text-container');
        const toggleTarget = t.closest('.glitchy-text-toggle-target');
        if (!glitchBox && !toggleTarget) return;
        e.preventDefault();
        e.stopPropagation();
        uiView.toggleGlitchEffect();
    });

    eventSlideEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (eventSlideEl.classList.contains('event-slide--inline-editing')) return;
        const el = document.activeElement;
        if (!el || !eventSlideEl.contains(el)) return;
        if (!el.classList.contains('glitchy-text-toggle-target') && !el.classList.contains('glitchy-text-container')) return;
        e.preventDefault();
        uiView.toggleGlitchEffect();
    });
}

/**
 * Same glitch toggle behavior as the event slide, for Olivia/Colomar spans in globe pagination thumbnails (#eventPagination).
 * @param {{ toggleGlitchEffect: Function }} uiView
 */
export function bindGlitchTextClickDelegationGlobePagination(uiView) {
    const root = document.getElementById('eventPagination');
    if (!root || !uiView || typeof uiView.toggleGlitchEffect !== 'function') return;
    if (root.dataset.globePaginationGlitchBound === 'true') return;
    root.dataset.globePaginationGlitchBound = 'true';

    root.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('button.page-btn, #prevPageBtn, #nextPageBtn, input.page-input, #pageInput, #eventPageSlider')) return;
        const inThumbName = t.closest('.event-number-btn__name');
        if (!inThumbName) return;
        if (t.closest('a[href], button, input, textarea, select')) return;
        const glitchBox = t.closest('.glitchy-text-container');
        const toggleTarget = t.closest('.glitchy-text-toggle-target');
        if (!glitchBox && !toggleTarget) return;
        e.preventDefault();
        e.stopPropagation();
        uiView.toggleGlitchEffect();
    });

    root.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = document.activeElement;
        if (!el || !root.contains(el)) return;
        if (!el.classList.contains('glitchy-text-toggle-target') && !el.classList.contains('glitchy-text-container')) return;
        e.preventDefault();
        uiView.toggleGlitchEffect();
    });
}

/**
 * Start or stop glitch animation based on enabled state
 */
export function manageGlitchAnimation(shouldStart, uiView) {
    if (window.GlitchTextService) {
        if (shouldStart && window.GlitchTextService.isEnabled()) {
            window.GlitchTextService.startAnimation();
            setTimeout(() => {
                uiView.showHackedOverlay();
            }, 400);
        } else {
            window.GlitchTextService.stopAnimation();
        }
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideGlitchHelpers) {
        window.EventSlideGlitchHelpers = {};
    }
    window.EventSlideGlitchHelpers.hasOliviaColomar = hasOliviaColomar;
    window.EventSlideGlitchHelpers.setupGlitchToggleButton = setupGlitchToggleButton;
    window.EventSlideGlitchHelpers.manageGlitchAnimation = manageGlitchAnimation;
    window.EventSlideGlitchHelpers.bindGlitchTextClickDelegation = bindGlitchTextClickDelegation;
    window.EventSlideGlitchHelpers.bindGlitchTextClickDelegationGlobePagination =
        bindGlitchTextClickDelegationGlobePagination;
    window.EventSlideGlitchHelpers.applyGlitchToggleButtonState = applyGlitchToggleButtonState;
    window.EventSlideGlitchHelpers.GLITCH_TOGGLE_ICON_HTML = GLITCH_TOGGLE_ICON_HTML;
}
