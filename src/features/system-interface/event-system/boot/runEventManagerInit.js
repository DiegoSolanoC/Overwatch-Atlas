/**
 * EventManagerInitRunner — runs the one-shot initialization pipeline for `EventManager`:
 *   1. Reset transient state on the manager + data service (so re-init starts clean).
 *   2. Load static datasets (cities/airports/seaports + manifests) via the data service.
 *   3. Load the events archive (story or satellite) and optionally re-sync globe markers.
 *   4. Render the manager list once the DOM is ready, with a 100ms retry safety net for
 *      the case where `renderEvents` ran before `#eventsList` actually existed.
 *
 * Status feedback is forwarded to the manager's `updateStatus` hook when present so the
 * developer status feed shows progress; otherwise the method is silent.
 *
 * Exposed as `window.EventInitService` (legacy name) to match the global key
 * `composeEventServices` reads from.
 */

class EventManagerInitRunner {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    async init() {
        if (!this.eventManager) {
            return Promise.reject(new Error('EventManager not set'));
        }

        const status = (msg, level) => {
            if (this.eventManager.updateStatus) this.eventManager.updateStatus(msg, level);
        };

        this.eventManager.listenersSetup = false;
        if (this.eventManager.locationService) {
            this.eventManager.locationService.clearCache();
        }
        this.eventManager.variantData = [];
        this.eventManager.activeVariantIndex = 0;
        this.eventManager.eventItemVariantIndices.clear();
        this.eventManager.unsavedEventIndices.clear();

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

        if (!this.eventManager.dataService && window.EventDataService) {
            this.eventManager.dataService = window.EventDataService;
        }

        if (!this.eventManager.dataService) {
            status('EventManagerInitRunner: EventDataService not found', 'error');
            return Promise.reject(new Error('EventDataService not available'));
        }

        status('Loading locations data...', 'info');
        await this.eventManager.dataService.loadLocationsData();

        status('Loading events from storage...', 'info');
        const loadResult = await this.eventManager.dataService.loadEvents();
        status(`Loaded ${this.eventManager.events.length} events`, 'success');

        if (loadResult && loadResult.shouldSync && this.eventManager.syncEventsToGlobe) {
            this.eventManager.syncEventsToGlobe();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (this.eventManager.renderEvents) this.eventManager.renderEvents();
            });
        } else if (this.eventManager.renderEvents) {
            this.eventManager.renderEvents();
        }

        // Retry render once after the DOM has settled — guards against a race where
        // `#eventsList` is rendered into the page after our first render call ran.
        setTimeout(() => {
            const eventsList = document.getElementById('eventsList');
            if (eventsList && this.eventManager.events.length > 0 && eventsList.children.length === 0) {
                if (this.eventManager.renderEvents) this.eventManager.renderEvents();
            }
        }, 100);

        status(`Initialization complete (${this.eventManager.events.length} events)`, 'success');
        return Promise.resolve();
    }
}

if (typeof window !== 'undefined') {
    // Global key kept as `EventInitService` for backward compatibility with the
    // `composeEventServices` lookup and the dynamic-script loader in `bootEventManager`.
    window.EventInitService = new EventManagerInitRunner();
}
