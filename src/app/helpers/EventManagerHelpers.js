/**
 * EventManagerHelpers - Utilities for EventManager initialization
 * Extracted from component-loader.js
 */

import { updateStatus } from '../../managers/StatusManager.js';

/**
 * Initializes EventManager, handling both script tag loading and ES6 module scenarios
 * @returns {Promise<EventManager>} - The initialized EventManager instance
 */
export async function initializeEventManager() {
    // Clean up any existing EventManager instance first
    if (window.eventManager) {
        updateStatus('Cleaning up existing EventManager instance...', 'info');
        if (window.eventManager.listenersSetup) {
            window.eventManager.listenersSetup = false;
        }
        // Clear all state
        if (window.eventManager.events) {
            window.eventManager.events = [];
        }
        if (window.eventManager.cities) {
            window.eventManager.cities = [];
        }
        if (window.eventManager.airports) {
            window.eventManager.airports = [];
        }
        if (window.eventManager.seaports) {
            window.eventManager.seaports = [];
        }
        window.eventManager = null;
    }
    
    updateStatus('Loading EventManager...', 'info');
    
    // Check if EventManager is already available (loaded via script tag)
    const existingScript = document.querySelector('script[src*="EventManager.js"]');
    if (typeof EventManager === 'undefined' && !existingScript) {
        // Load EventManager script dynamically
        return await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'src/managers/EventManager.js?' + Date.now(); // Cache busting
            script.onload = async () => {
                try {
                    await new Promise(r => setTimeout(r, 50));
                    
                    if (typeof EventManager === 'undefined') {
                        throw new Error('EventManager class not found after loading script');
                    }
                    
                    const eventManager = await createEventManagerInstance();
                    resolve(eventManager);
                } catch (error) {
                    console.error('EventManager initialization error:', error);
                    updateStatus(`✗ EventManager initialization failed: ${error.message}`, 'error');
                    reject(error);
                }
            };
            script.onerror = () => {
                const error = new Error('Failed to load EventManager.js');
                updateStatus(`✗ ${error.message}`, 'error');
                reject(error);
            };
            document.head.appendChild(script);
        });
    } else {
        // EventManager already loaded - create fresh instance
        if (typeof EventManager === 'undefined') {
            updateStatus('Waiting for EventManager class to be available...', 'info');
            let attempts = 0;
            while (typeof EventManager === 'undefined' && attempts < 10) {
                await new Promise(r => setTimeout(r, 50));
                attempts++;
            }
            if (typeof EventManager === 'undefined') {
                throw new Error('EventManager class not available after waiting');
            }
        }
        return await createEventManagerInstance();
    }
}

/**
 * Creates and initializes a new EventManager instance
 * @returns {Promise<EventManager>}
 */
async function createEventManagerInstance() {
    updateStatus('Creating new EventManager instance...', 'info');
    const eventManager = new EventManager();
    updateStatus('Initializing EventManager...', 'info');
    try {
        await eventManager.init();
        updateStatus('✓ EventManager initialized', 'success');
        return eventManager;
    } catch (error) {
        console.error('EventManager initialization error:', error);
        updateStatus(`✗ EventManager initialization failed: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Sets up event listeners for EventManager with retry logic
 * @param {EventManager} eventManager - The EventManager instance
 */
export function setupEventManagerListeners(eventManager) {
    updateStatus('Setting up event listeners for add/edit functionality...', 'info');
    
    const trySetup = () => {
        const panel = document.getElementById('eventsManagePanel');
        const addBtn = document.getElementById('addEventBtn');
        
        if (panel && addBtn) {
            eventManager.setupEventListeners();
            updateStatus('✓ Event listeners set up - add/edit functionality ready', 'success');
            return true;
        }
        return false;
    };
    
    // Try immediately
    if (trySetup()) {
        return;
    }
    
    // Retry after short delay
    updateStatus(`⚠ Some elements not found, retrying...`, 'error');
    setTimeout(() => {
        if (trySetup()) {
            updateStatus('✓ Event listeners set up (retry successful)', 'success');
        } else {
            updateStatus(`✗ Failed to set up event listeners - elements still missing`, 'error');
        }
    }, 200);
}

/**
 * Syncs events with globe and adds markers
 * @param {Object} globeController - The globe controller instance
 * @param {EventManager} eventManager - The EventManager instance
 */
export function syncEventsWithGlobe(globeController, eventManager) {
    if (!globeController || !eventManager) {
        return;
    }
    
    updateStatus('Syncing events with globe...', 'info');
    globeController.dataModel.events = [...eventManager.events];
    
    if (globeController.globeView) {
        globeController.globeView.addEventMarkers();
        globeController.globeView.refreshEventMarkers();
    }
    
    if (globeController.uiView) {
        globeController.uiView.setupEventPagination(() => {
            if (globeController.globeView) {
                globeController.globeView.refreshEventMarkers(true, {
                    preservePaginationThumbEntrance: true
                });
            }
        });
        globeController.uiView.setupEventNumberButtons(() => {
            if (globeController.globeView) {
                globeController.globeView.refreshEventMarkers();
            }
        });
    }
    
    updateStatus('✓ Events synced with globe and markers added', 'success');
}

/**
 * Verifies that required event panels exist in the DOM
 */
export function verifyEventPanels() {
    const panels = [
        { id: 'eventSlide', name: 'Event slide panel' },
        { id: 'eventImageOverlay', name: 'Event image overlay' },
        { id: 'eventsManagePanel', name: 'Event manager panel' }
    ];
    
    panels.forEach(({ id, name }) => {
        if (!document.getElementById(id)) {
            updateStatus(`⚠ ${name} not found in HTML`, 'error');
        } else {
            updateStatus(`✓ ${name} found`, 'success');
        }
    });
}
