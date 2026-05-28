/**
 * WorldviewGlobeSync - Handles synchronization between EventManager and Globe
 * Separates globe synchronization logic from event management
 */

class WorldviewGlobeSync {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Markers live on {@link window.globeEventMarkerManager} ({@link EventMarkerManager}).
     * @param {boolean} [animate]
     * @param {object} [options]
     * @returns {unknown}
     */
    _refreshEventMarkers(animate = true, options) {
        const T = window.TimelineMarkerSync;
        if (T && typeof T.refreshTimelineEventMarkers === 'function') {
            return T.refreshTimelineEventMarkers(animate, options || {});
        }
        const mm = window.globeEventMarkerManager;
        if (mm && typeof mm.refreshEventMarkers === 'function') {
            return mm.refreshEventMarkers(animate, options || {});
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
            console.log('WorldviewGlobeSync: Synced', this.eventManager.events.length, 'events with WorldviewLocationCatalog');
            
            if (window.globeController?.globeView || window.globeEventMarkerManager) {
                this._refreshEventMarkers();
                console.log('WorldviewGlobeSync: Refreshed event markers on globe');
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

        // Update WorldviewLocationCatalog if available
        if (window.globeController && window.globeController.dataModel) {
            // Update events in WorldviewLocationCatalog
            window.globeController.dataModel.events = [...this.eventManager.events];

            let markerPromise = Promise.resolve();
            const r0 = this._refreshEventMarkers();
            markerPromise = r0 && typeof r0.then === 'function' ? r0 : Promise.resolve();

            // Refresh pagination UI (optional — WorldviewHudView in current app often has no setupEventPagination; standalone dock wires its own.)
            const ui = window.globeController.uiView;
            const dm = window.globeController.dataModel;
            if (ui && typeof ui.setupEventPagination === 'function' && dm) {
                const currentPage = dm.getCurrentEventPage();
                dm.setCurrentEventPage(currentPage);
                ui.setupEventPagination(() => {
                    this._refreshEventMarkers(true, {
                        preservePaginationThumbEntrance: true
                    });
                });
            } else if (dm && typeof dm.getCurrentEventPage === 'function' && typeof dm.setCurrentEventPage === 'function') {
                const currentPage = dm.getCurrentEventPage();
                dm.setCurrentEventPage(currentPage);
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
    module.exports = WorldviewGlobeSync;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.GlobeSyncService = new WorldviewGlobeSync();
}
