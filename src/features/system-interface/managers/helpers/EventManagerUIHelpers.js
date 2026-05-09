/**
 * EventManagerUIHelpers - Utilities for UI feedback in EventManager
 * Extracted from EventManager to reduce duplication
 */

/**
 * Shows save success feedback on the save button
 * @param {string} buttonId - ID of the save button
 */
export function showSaveSuccessFeedback(buttonId = 'saveEventsBtn') {
    const saveBtn = document.getElementById(buttonId);
    if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = 'rgba(76, 175, 80, 0.8)';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
        }, 2000);
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventManagerUIHelpers) {
        window.EventManagerUIHelpers = {};
    }
    window.EventManagerUIHelpers.showSaveSuccessFeedback = showSaveSuccessFeedback;
}
