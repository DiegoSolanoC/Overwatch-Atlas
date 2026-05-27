/**
 * FlashButtonHelper - Global flash feedback utility for Event System
 * Works in all modes (standalone, globe, codex)
 */

/**
 * Flash a button with a temporary color feedback
 * @param {HTMLElement} element - The button element to flash
 * @param {string} flashClass - 'flash-green', 'flash-red', or 'flash-orange'
 */
export function flashButton(element, flashClass) {
    if (!element) return;
    
    // Remove existing flash classes to restart animation if clicked rapidly
    element.classList.remove('flash-green', 'flash-red', 'flash-orange');
    
    // Use a tiny delay to ensure DOM recognizes the class removal
    requestAnimationFrame(() => {
        element.classList.add(flashClass);
        setTimeout(() => {
            element.classList.remove(flashClass);
        }, 600);
    });
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    window.flashButton = flashButton;
}
