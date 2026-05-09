/**
 * StatusManager - Handles status updates and progress tracking
 * Extracted from component-loader.js to improve maintainability
 */

// Progress tracking for Globe Components
let globeComponentsProgress = {
    total: 4, // Globe Base, Transport, Controls, Events
    completed: 0
};

/**
 * Update status message
 * @param {string} message - Status message
 * @param {string} type - Message type ('info', 'success', 'error')
 */
export function updateStatus(message, type = 'info') {
    const inlineStatusHost = document.getElementById('globeInlineOverlayStatusContent');
    if (inlineStatusHost) {
        inlineStatusHost.innerHTML = '';
        const item = document.createElement('div');
        item.className = `test-status-item ${type}`;
        item.textContent = message;
        inlineStatusHost.appendChild(item);
        return;
    }

    // Timeline shell (index.html or legacy /main URLs), not test.html
    const pl = (window.location.pathname || '').toLowerCase();
    const isMainPage =
        !pl.includes('test.html') &&
        (pl.endsWith('index.html') ||
            pl.endsWith('main.html') ||
            pl === '/' ||
            (pl.endsWith('/') && !/\.html$/i.test(pl)));
    const loadingOverlay = document.getElementById('loadingOverlay');
    const overlayActive = loadingOverlay && loadingOverlay.classList.contains('active');
    
    let statusContent;
    if (isMainPage && overlayActive) {
        // Use overlay status on main page when overlay is active
        statusContent = document.getElementById('overlayStatusContent');
        // Replace content with single current message
        if (statusContent) {
            statusContent.innerHTML = ''; // Clear all previous messages
            const item = document.createElement('div');
            item.className = `test-status-item ${type}`;
            item.textContent = message;
            statusContent.appendChild(item);
        }
    } else {
        // Use regular test status (replace for test page)
        const statusDiv = document.getElementById('testStatus');
        statusContent = document.getElementById('statusContent');
        if (statusDiv && statusContent) {
            statusDiv.style.display = 'block';
            statusContent.innerHTML = ''; // Clear all previous messages
            const item = document.createElement('div');
            item.className = `test-status-item ${type}`;
            item.textContent = message;
            statusContent.appendChild(item);
        }
    }
}

/**
 * Update globe components progress
 * @param {number} completed - Number of completed components
 */
function applyGlobeProgressWidth(percentage) {
    const mainBar = document.getElementById('loadingProgressBar');
    if (mainBar) mainBar.style.width = `${percentage}%`;
    const inlineBar = document.getElementById('globeInlineLoadingProgressBar');
    if (inlineBar) inlineBar.style.width = `${percentage}%`;
}

export function updateGlobeComponentsProgress(completed) {
    globeComponentsProgress.completed = completed;
    const percentage = (completed / globeComponentsProgress.total) * 100;
    applyGlobeProgressWidth(percentage);
}

/**
 * Reset globe components progress
 */
export function resetGlobeComponentsProgress() {
    globeComponentsProgress.completed = 0;
    applyGlobeProgressWidth(0);
}

/**
 * Get current globe components progress
 * @returns {Object} - Progress object with total and completed
 */
export function getGlobeComponentsProgress() {
    return { ...globeComponentsProgress };
}
