/**
 * GlobeSyncService - Handles synchronization between EventManager and Globe
 * Separates globe synchronization logic from event management
 */

class GlobeSyncService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Markers live on {@link window.globeEventMarkerManager} in current builds; older code called
     * {@link window.globeController.globeView.refreshEventMarkers}.
     * @param {boolean} [animate]
     * @param {object} [options]
     * @returns {unknown}
     */
    _refreshEventMarkers(animate = true, options) {
        const mm = window.globeEventMarkerManager;
        if (mm && typeof mm.refreshEventMarkers === 'function') {
            return mm.refreshEventMarkers(animate, options || {});
        }
        const gv = window.globeController?.globeView;
        if (gv && typeof gv.refreshEventMarkers === 'function') {
            return gv.refreshEventMarkers(animate, options);
        }
        return undefined;
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Sync events to globe data model
     */
    syncEventsToGlobe() {
        if (!this.eventManager) return;
        
        if (window.globeController && window.globeController.dataModel) {
            window.globeController.dataModel.events = [...this.eventManager.events];
            console.log('GlobeSyncService: Synced', this.eventManager.events.length, 'events with DataModel');
            
            if (window.globeController?.globeView || window.globeEventMarkerManager) {
                this._refreshEventMarkers();
                console.log('GlobeSyncService: Refreshed event markers on globe');
            }
            
            // Update news ticker with headlines from current page
            this.updateNewsTicker();
        }
    }
    
    /**
     * Update news ticker with headlines from globe's current page
     */
    updateNewsTicker() {
        if (window.globeController && window.globeController.dataModel && window.newsTickerService) {
            const currentPageEvents = window.globeController.dataModel.getEventsForCurrentPage();
            if (window.newsTickerService.updateTicker) {
                window.newsTickerService.updateTicker(currentPageEvents);
            }
        }
    }

    /**
     * Refresh globe events (update markers and pagination)
     * @returns {Promise<void>} Resolves when the initial marker refresh finishes (if any)
     */
    refreshGlobeEvents() {
        if (!this.eventManager) return Promise.resolve();

        // Update DataModel if available
        if (window.globeController && window.globeController.dataModel) {
            // Update events in DataModel
            window.globeController.dataModel.events = [...this.eventManager.events];

            let markerPromise = Promise.resolve();
            const r0 = this._refreshEventMarkers();
            markerPromise = r0 && typeof r0.then === 'function' ? r0 : Promise.resolve();

            // Refresh pagination UI
            if (window.globeController.uiView && window.globeController.uiView.dataModel) {
                // Trigger pagination update
                const currentPage = window.globeController.dataModel.getCurrentEventPage();
                window.globeController.dataModel.setCurrentEventPage(currentPage);

                // Re-setup pagination to update UI
                window.globeController.uiView.setupEventPagination(() => {
                    this._refreshEventMarkers(true, {
                        preservePaginationThumbEntrance: true
                    });
                });
            }

            // Update news ticker with headlines from current page
            this.updateNewsTicker();
            return markerPromise;
        }
        return Promise.resolve();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobeSyncService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.GlobeSyncService = new GlobeSyncService();
}
