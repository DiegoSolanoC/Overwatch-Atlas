/**
 * MusicHelpers - Utilities for music component initialization
 * Extracted from component-loader.js to reduce duplication
 */

import { updateStatus } from '../../managers/StatusManager.js';

/**
 * Initializes MusicManager with proper error handling
 * @param {boolean} immediate - If true, initialize immediately; if false, use setTimeout
 * @param {number} delay - Delay in milliseconds (default 50ms)
 */
export function initializeMusicManager(immediate = false, delay = 50) {
    const initFunction = () => {
        if (window.MusicManager && typeof window.MusicManager.init === 'function') {
            updateStatus('Initializing MusicManager...', 'info');
            window.MusicManager.init();
            updateStatus('✓ MusicManager initialized', 'success');
        } else {
            const errorDetails = {
                MusicManager: !!window.MusicManager,
                hasInit: window.MusicManager && typeof window.MusicManager.init === 'function',
                services: {
                    MusicStateService: !!window.MusicStateService,
                    MusicPanelService: !!window.MusicPanelService,
                    MusicControlService: !!window.MusicControlService
                }
            };
            
            if (immediate) {
                console.warn('MusicManager not available after loading music components');
            } else {
                console.error('MusicManager not available:', errorDetails);
                updateStatus('⚠ MusicManager not found - music panel may not work', 'error');
            }
        }
    };
    
    if (immediate) {
        initFunction();
    } else {
        updateStatus('Initializing music panel...', 'info');
        setTimeout(initFunction, delay);
    }
}

/**
 * Creates audio element for background music
 * @returns {HTMLAudioElement} - The created audio element
 */
export function createBackgroundMusicElement() {
    const audio = document.createElement('audio');
    audio.id = 'backgroundMusic';
    audio.preload = 'auto';
    audio.loop = true;
    document.body.appendChild(audio);
    return audio;
}
