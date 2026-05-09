/**
 * StatusService - Manages status updates for test page
 */
class StatusService {
    update(message, type = 'info') {
        console.log('[StatusService] update called:', message, type);
        const pl = (window.location.pathname || '').toLowerCase();
        const isMainPage =
            !pl.includes('test.html') &&
            (pl.endsWith('index.html') ||
                pl.endsWith('main.html') ||
                pl === '/' ||
                (pl.endsWith('/') && !/\.html$/i.test(pl)));
        const loadingOverlay = document.getElementById('loadingOverlay');
        const overlayActive = loadingOverlay && loadingOverlay.classList.contains('active');

        console.log('[StatusService] isMainPage:', isMainPage, 'overlayActive:', overlayActive);

        let statusContent;
        if (isMainPage && overlayActive) {
            statusContent = document.getElementById('overlayStatusContent');
            console.log('[StatusService] overlayStatusContent found:', !!statusContent);
            if (statusContent) {
                statusContent.innerHTML = '';
                const item = document.createElement('div');
                item.className = `test-status-item ${type}`;
                item.textContent = message;
                statusContent.appendChild(item);
                console.log('[StatusService] Status updated in overlay:', message);
            }
        } else {
            const statusDiv = document.getElementById('testStatus');
            statusContent = document.getElementById('statusContent');
            console.log('[StatusService] testStatus found:', !!statusDiv, 'statusContent found:', !!statusContent);
            if (statusDiv && statusContent) {
                statusDiv.style.display = 'block';
                statusContent.innerHTML = '';
                const item = document.createElement('div');
                item.className = `test-status-item ${type}`;
                item.textContent = message;
                statusContent.appendChild(item);
                console.log('[StatusService] Status updated in test page:', message);
            }
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.StatusService = StatusService;
}
