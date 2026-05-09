/**
 * MusicManagerHelpers - Utilities for MusicManager initialization
 * Extracted from ComponentLoaderService to reduce complexity
 */

/**
 * Initializes MusicManager with retry logic
 * @param {Object} statusService - Status service for updates
 */
export function initializeMusicManager(statusService) {
    if (window.MusicManager && typeof window.MusicManager.init === 'function') {
        if (statusService) {
            statusService.update('Initializing MusicManager...', 'info');
        }
        window.MusicManager.init();
        if (statusService) {
            statusService.update('✓ MusicManager initialized', 'success');
        }
    } else {
        console.warn('MusicManager not available after loading music components');
    }
    
    // Re-initialize MusicManager after delay to ensure all elements are ready
    setTimeout(() => {
        if (window.MusicManager && typeof window.MusicManager.init === 'function') {
            window.MusicManager.init();
            if (statusService) {
                statusService.update('✓ Music panel initialized', 'success');
            }
        } else {
            console.error('MusicManager not available:', {
                MusicManager: !!window.MusicManager,
                hasInit: window.MusicManager && typeof window.MusicManager.init === 'function',
                services: {
                    MusicStateService: !!window.MusicStateService,
                    MusicPanelService: !!window.MusicPanelService,
                    MusicControlService: !!window.MusicControlService
                }
            });
            if (statusService) {
                statusService.update('⚠ MusicManager not found - music panel may not work', 'error');
            }
        }
    }, 50);
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceMusicManagerHelpers) {
        window.ServiceMusicManagerHelpers = {};
    }
    window.ServiceMusicManagerHelpers.initializeMusicManager = initializeMusicManager;
}
