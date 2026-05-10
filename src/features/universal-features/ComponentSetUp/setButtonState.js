/**
 * setButtonState — toggles the `loading` / `loaded` CSS classes (and the
 * `disabled` attribute) on a menu run button. Used by every loader to
 * reflect "spinner spinning" / "ready" / "idle" on its own button.
 *
 * @param {string} buttonId - ID of the button element
 * @param {'loading'|'loaded'|'default'} state
 */
export function setButtonState(buttonId, state) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    btn.classList.remove('loading', 'loaded');
    if (state === 'loading') {
        btn.classList.add('loading');
        btn.disabled = true;
    } else if (state === 'loaded') {
        btn.classList.add('loaded');
        btn.disabled = false;
    } else {
        btn.disabled = false;
    }
}
