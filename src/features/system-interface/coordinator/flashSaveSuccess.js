/**
 * Brief success feedback on the event JSON save button.
 * @param {string} [buttonId='saveEventsBtn']
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
