/**
 * Digit/Tab handling for the event slide:
 *   - Digit 1..9, 0 -> 10: select that variant if the variant toggle bar is
 *     visible, else fall through so the same digit can trigger pagination.
 *   - Tab / Shift+Tab while slide is open: cycle through variant buttons with
 *     wraparound, playing the switch-event SFX.
 *
 * Also exposes the small "is panel open" predicates used by both the key
 * handler and the number-button trigger.
 */

export function isEventSlideOpen() {
    const s = document.getElementById('eventSlide');
    return !!(s && s.classList.contains('open'));
}

export function isEventsManageOpen() {
    const p = document.getElementById('eventsManagePanel');
    return !!(p && p.classList.contains('open'));
}

function getEventVariantToggleButtons() {
    if (!isEventSlideOpen()) return null;
    const c = document.getElementById('eventVariantToggles');
    if (!c) return null;
    try {
        if (window.getComputedStyle(c).display === 'none') return null;
    } catch (_) {
        return null;
    }
    const btns = c.querySelectorAll('.variant-toggle-btn');
    if (!btns || !btns.length) return null;
    return btns;
}

/** @returns {'ok'|'invalid'|null} */
export function tryVariantDigitKey(digit) {
    const btns = getEventVariantToggleButtons();
    if (!btns) return null;
    const idx = digit === '10' ? 9 : parseInt(digit, 10) - 1;
    if (idx < 0 || idx >= btns.length) return 'invalid';
    const btn = btns[idx];
    if (btn.disabled) return 'invalid';
    btn.click();
    return 'ok';
}

/** Tab / Shift+Tab cycle. @returns {boolean} true if a button was clicked. */
export function cycleVariantButton(forward) {
    const btns = getEventVariantToggleButtons();
    if (!btns || btns.length === 0) return false;

    let currentIndex = -1;
    for (let i = 0; i < btns.length; i++) {
        if (btns[i].classList.contains('active')) { currentIndex = i; break; }
    }

    const nextIndex = forward
        ? (currentIndex >= 0 ? (currentIndex + 1) % btns.length : 0)
        : (currentIndex >= 0 ? (currentIndex - 1 + btns.length) % btns.length : btns.length - 1);

    const nextBtn = btns[nextIndex];
    if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
        if (window.SoundEffectsManager && typeof window.SoundEffectsManager.play === 'function') {
            window.SoundEffectsManager.play('switchEvent');
        }
        return true;
    }
    return false;
}

/** Click the number button at `positionStr` in the pagination dock if present + enabled. */
export function triggerNumberButton(positionStr) {
    const btn = document.querySelector(
        '#eventNumberButtons .event-number-btn[data-position="' + positionStr + '"]'
    );
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
}
