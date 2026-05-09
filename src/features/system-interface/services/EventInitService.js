/**
 * EventInitService - Handles EventManager initialization
 * Separates initialization logic from event management
 */

class EventInitService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Initialize the event manager
     */
    async init() {
        if (!this.eventManager) {
            return Promise.reject(new Error('EventManager not set'));
        }
        
        const initStartTime = performance.now();
        console.log('EventInitService: Starting initialization...');
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus('EventInitService: Starting initialization...', 'info');
        }
        
        // Reset state to ensure clean initialization
        this.eventManager.listenersSetup = false;
        if (this.eventManager.locationService) {
            this.eventManager.locationService.clearCache();
        }
        this.eventManager.variantData = [];
        this.eventManager.activeVariantIndex = 0;
        this.eventManager.eventItemVariantIndices.clear();
        this.eventManager.unsavedEventIndices.clear();
        
        // Reset data service state if available
        if (this.eventManager.dataService) {
            this.eventManager.dataService.events = [];
            this.eventManager.dataService.cities = [];
            this.eventManager.dataService.fictionalCities = [];
            this.eventManager.dataService.airports = [];
            this.eventManager.dataService.seaports = [];
            this.eventManager.dataService.heroes = [];
            this.eventManager.dataService.factions = [];
            this.eventManager.dataService.displayNames = {};
        }
        
        // Note: localStorage clearing is now handled in loadEvents() after we verify events.json loads successfully
        
        // Initialize data service if available
        if (!this.eventManager.dataService && window.EventDataService) {
            this.eventManager.dataService = window.EventDataService;
        }
        
        if (!this.eventManager.dataService) {
            console.error('EventInitService: EventDataService not available!');
            if (this.eventManager.updateStatus) {
                this.eventManager.updateStatus('EventInitService: ERROR - EventDataService not found', 'error');
            }
            return Promise.reject(new Error('EventDataService not available'));
        }
        
        const loadDataStartTime = performance.now();
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus('EventInitService: Loading locations data (cities, airports, seaports)...', 'info');
        }
        await this.eventManager.dataService.loadLocationsData();
        console.log(`EventInitService: loadLocationsData took ${(performance.now() - loadDataStartTime).toFixed(2)}ms`);
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus(`EventInitService: Locations data loaded (${(performance.now() - loadDataStartTime).toFixed(0)}ms)`, 'success');
        }
        
        // Don't call setupEventListeners here - it will be called after buttons are created
        // this.setupEventListeners();
        
        const loadEventsStartTime = performance.now();
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus('EventInitService: Loading events from storage...', 'info');
        }
        const loadResult = await this.eventManager.dataService.loadEvents();
        console.log(`EventInitService: loadEvents took ${(performance.now() - loadEventsStartTime).toFixed(2)}ms`);
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus(`EventInitService: Loaded ${this.eventManager.events.length} events (${(performance.now() - loadEventsStartTime).toFixed(0)}ms)`, 'success');
        }
        
        // Sync with globe if needed
        if (loadResult && loadResult.shouldSync && this.eventManager.syncEventsToGlobe) {
            this.eventManager.syncEventsToGlobe();
        }
        
        // Ensure DOM is ready before rendering
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus('EventInitService: Checking DOM readiness...', 'info');
            this.eventManager.updateStatus(`EventInitService: document.readyState = ${document.readyState}`, 'info');
        }
        
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus('EventInitService: Preparing to render events to DOM...', 'info');
        }
        if (document.readyState === 'loading') {
            if (this.eventManager.updateStatus) {
                this.eventManager.updateStatus('EventInitService: DOM still loading, waiting for DOMContentLoaded...', 'info');
            }
            document.addEventListener('DOMContentLoaded', () => {
                if (this.eventManager.updateStatus) {
                    this.eventManager.updateStatus('EventInitService: DOMContentLoaded fired, rendering events...', 'info');
                }
                if (this.eventManager.renderEvents) {
                    this.eventManager.renderEvents();
                }
            });
        } else {
            if (this.eventManager.updateStatus) {
                this.eventManager.updateStatus('EventInitService: DOM already ready, rendering immediately...', 'info');
            }
            if (this.eventManager.renderEvents) {
                this.eventManager.renderEvents();
            }
        }
        
        // Also try rendering after a short delay to ensure DOM is fully ready
        setTimeout(() => {
            const eventsList = document.getElementById('eventsList');
            if (eventsList && this.eventManager.events.length > 0 && eventsList.children.length === 0) {
                console.log('EventInitService: Retrying render after delay (DOM might not have been ready)');
                if (this.eventManager.updateStatus) {
                    this.eventManager.updateStatus('EventInitService: Retrying render (DOM might not have been ready)', 'info');
                }
                if (this.eventManager.renderEvents) {
                    this.eventManager.renderEvents();
                }
            } else {
                if (this.eventManager.updateStatus) {
                    this.eventManager.updateStatus('EventInitService: Render check passed (events already rendered or no events)', 'info');
                }
            }
        }, 100);

        const initTime = performance.now() - initStartTime;
        console.log(`EventInitService: Initialized with ${this.eventManager.events.length} events in ${initTime.toFixed(2)}ms`);
        if (this.eventManager.updateStatus) {
            this.eventManager.updateStatus(`EventInitService: Initialization complete! (${this.eventManager.events.length} events, ${initTime.toFixed(0)}ms total)`, 'success');
        }
        return Promise.resolve(); // Return promise for chaining
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventInitService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.EventInitService = new EventInitService();
}
