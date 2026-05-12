/**
 * Predicates that gate every keyboard shortcut: do not steal a keystroke from a
 * text field, contenteditable, dropdown, or password input. Range / checkbox /
 * radio inputs are NOT considered "typing" so A/D can still page the event
 * slider when its handle has focus.
 *
 * `escapeOkWhileTypingInTarget` is the one exception: Escape should always
 * dismiss our panels even when focus is in a field inside them.
 */

export const SCROLL_STEP = 80;

export function consumeEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
}

export function inputType(el) {
    if (!el || (el.tagName || '').toUpperCase() !== 'INPUT') return '';
    return String(el.type || '').toLowerCase();
}

export function isTypingContext(target) {
    if (!target || !target.closest) return false;
    const el = target;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
        const it = inputType(el);
        /* Range/checkbox/radio/button aren't text entry — let A/D and arrows through. */
        if (it === 'range' || it === 'checkbox' || it === 'radio' || it === 'button' ||
            it === 'submit' || it === 'reset' || it === 'file') return false;
        return true;
    }
    if (el.closest && el.closest('[contenteditable="true"]')) return true;
    return false;
}

export function isEventPageRangeSlider(target) {
    return inputType(target) === 'range' && target && target.id === 'eventPageSlider';
}

/**
 * Escape should still dismiss our panels when focus is in a field inside them.
 * (Plain Q is NOT bypassed — avoids closing while typing "q" in search.)
 */
export function escapeOkWhileTypingInTarget(target) {
    if (!target || !target.closest) return false;
    return !!(
        target.closest('#filtersPanel')
        || target.closest('#musicPanel')
        || target.closest('#eventsManagePanel')
        || target.closest('#paletteMenu')
        || target.closest('#eventSlide')
        || target.closest('#externalLinkConfirmOverlay')
    );
}

export function modifiersActive(e) {
    return e.ctrlKey || e.metaKey || e.altKey;
}
