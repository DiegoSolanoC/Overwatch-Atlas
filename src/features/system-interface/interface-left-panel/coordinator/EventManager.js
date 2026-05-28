/**
 * EventManager — composes Event* services (classic globals) and owns manager list UI state.
 * Note: Glitch text is handled by GlitchTextService.
 */
import { composeEventServices } from './composeEventServices.js';
import { showSaveSuccessFeedback } from './flashSaveSuccess.js';
import {
    getSearchMatchAxesForItem as filterGetSearchMatchAxesForItem,
    getFilteredEventsFromList as filterGetFilteredEventsFromList
} from './search/filterEvents.js';
import {
    factionFilenameToDisplayToken as tokensFactionFilenameToDisplayToken,
    flagFilenameToCommonCountryName as tokensFlagFilenameToCommonCountryName
} from './search/managerSearchTokenResolvers.js';
import { prependEventManagerSearchTokens as tokensPrependEventManagerSearchTokens } from './search/prependManagerSearchTokens.js';
import { installEventManagerArchiveBindings } from './eventManagerArchiveBindings.js';
import { installEventManagerDataGetters } from './eventManagerDataGetters.js';
import { syncManagerPaginationForDisplay } from './syncManagerPaginationForDisplay.js';
import { runAddBlankEventAndOpen } from './runAddBlankEventAndOpen.js';
import { runDeleteEventAtIndex, runDeleteEventWithConfirm } from './runDeleteEventWithConfirm.js';

class EventManager {
    constructor() {
        Object.assign(this, composeEventServices(this));

        this.draggedElement = null;
        this.dragOverIndex = null;
        this.unsavedEventIndices = new Set();
        this.currentPage = 1;
        this.eventsPerPage = 50;
        this.eventsPerPageSetting = 50;
        this.showAllEventsInManager = false;
        this.searchQuery = '';
        this.searchHeroFilters = [];
        this.searchFactionFilters = [];
        this.searchNpcFilters = [];
        this.searchUnmatchedFilterTokens = [];
        this.searchCountryFilters = [];
        this.variantData = [];
        this.activeVariantIndex = 0;
        this.eventItemVariantIndices = new Map();
        this.listenersSetup = false;
        this.isOpeningEvent = false;
    }

    get events() {
        return this.dataService ? this.dataService.getEvents() : [];
    }

    set events(value) {
        if (this.dataService) {
            this.dataService.setEvents(value);
        }
    }

    getSearchMatchAxesForItem(item) {
        return filterGetSearchMatchAxesForItem(this, item);
    }

    getDockTimelineEvents() {
        return this.dataService?.getStoryTimelineEventsForDock?.() || [];
    }

    getFilteredDockTimelineEvents() {
        return filterGetFilteredEventsFromList(this, this.getDockTimelineEvents());
    }

    getFilteredEvents() {
        return filterGetFilteredEventsFromList(this, this.events);
    }

    getFilteredEventsFromList(all) {
        return filterGetFilteredEventsFromList(this, all);
    }

    updateStatus(message, type = 'info') {
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(message, type);
        }
    }

    async init() {
        if (this.initService) {
            return await this.initService.init();
        }
        console.error('EventManager: EventInitService not available!');
        return Promise.reject(new Error('EventInitService not available'));
    }

    isGitHubPages() {
        return !!this.dataService?.isGitHubPages?.();
    }

    async loadEvents() {
        if (!this.dataService) throw new Error('EventDataService not available');
        const result = await this.dataService.loadEvents();
        const isMainStory =
            typeof this.dataService.getArchiveSource === 'function'
                ? this.dataService.getArchiveSource() === 'story'
                : true;
        if (isMainStory && typeof this.dataService.refreshStoryDockSnapshotFromCurrentEvents === 'function') {
            this.dataService.refreshStoryDockSnapshotFromCurrentEvents();
        }
        if (result?.shouldSync && isMainStory) {
            this.syncEventsToGlobe();
        }
        if (typeof window !== 'undefined' && window.FilterService?.refreshCountryFilterUsage) {
            window.FilterService.refreshCountryFilterUsage();
        }
        return result;
    }

    async switchStoryArchiveSource(archiveId) {
        if (!this.dataService?.setArchiveSource) return;
        this.dataService.setArchiveSource(archiveId);
        this._resetStoryArchiveListState();
        await this.loadEvents();
        if (typeof window !== 'undefined' && window.FilterService?.invalidateBioArchiveFilterLayouts) {
            window.FilterService.invalidateBioArchiveFilterLayouts();
        }
        this.renderEvents();
    }

    _resetSearchInputs() {
        this.searchQuery = '';
        this.searchHeroFilters = [];
        this.searchFactionFilters = [];
        this.searchNpcFilters = [];
        this.searchUnmatchedFilterTokens = [];
        this.searchCountryFilters = [];
    }

    _resetStoryArchiveListState() {
        this._resetSearchInputs();
        this.currentPage = 1;
        this.showAllEventsInManager = false;
        if (this.eventItemVariantIndices?.clear) {
            this.eventItemVariantIndices.clear();
        }
    }

    syncEventsToGlobe() {
        if (this.globeSyncService) {
            this.globeSyncService.syncEventsToGlobe();
        } else if (window.globeController?.dataModel) {
            window.globeController.dataModel.events = [...this.events];
            const T = window.TimelineMarkerSync;
            if (T && typeof T.refreshTimelineEventMarkers === 'function') {
                T.refreshTimelineEventMarkers();
            }
        }
    }

    saveEvents() {
        this.dataService?.saveEvents();
        if (typeof window !== 'undefined' && window.FilterService?.refreshCountryFilterUsage) {
            window.FilterService.refreshCountryFilterUsage();
        }
        this.unsavedEventIndices.clear();
        this.renderEvents();
        showSaveSuccessFeedback('saveEventsBtn');
        this.refreshGlobeEvents();
    }

    /** Refresh globe events (delegates to GlobeSyncService) */
    refreshGlobeEvents() {
        if (this.globeSyncService) {
            return this.globeSyncService.refreshGlobeEvents();
        }
        return Promise.resolve();
    }

    exportEvents() {
        this.dataService?.exportEvents();
    }

    async importEvents(file) {
        if (!this.dataService) {
            alert('Error: EventDataService not available');
            return;
        }
        try {
            const result = await this.dataService.importEvents(file);
            if (result.success) {
                this.saveEvents();
                this.renderEvents();
                this.syncEventsToGlobe();
                alert(`Successfully imported ${result.count} events!`);
            }
        } catch (error) {
            console.error('Error importing events:', error);
            alert('Error importing events: ' + error.message);
        }
    }

    findCityCoordinates(cityName) {
        return this.dataService?.findCityCoordinates(cityName) || null;
    }

    setupEventListeners() {
        if (this.listenerService) {
            this.listenerService.setupEventListeners();
        } else {
            console.error('EventManager: EventListenerService not available!');
        }
    }

    renderEvents() {
        if (this.renderService) {
            const displayed = this.getFilteredEvents();
            syncManagerPaginationForDisplay(this, displayed);
            this.renderService.renderEvents(displayed, this.currentPage, this.eventsPerPage, () => {
                this.setupDragAndDrop();
            });
        } else {
            console.error('EventManager: EventRenderService not available!');
            this.updateStatus('EventManager: ERROR - EventRenderService not found', 'error');
        }
    }

    applySearchAndRender() {
        this.currentPage = 1;
        this.renderEvents();
    }

    renderPaginationControls() {
        this.renderService?.renderPaginationControls(this.getFilteredEvents(), this.currentPage, this.eventsPerPage);
    }

    setupPaginationListeners() {
        this.renderService?.setupPaginationListeners();
    }

    createEventItem(event, index) {
        if (this.renderService) {
            return this.renderService.createEventItem(event, index, this.events);
        }
        console.error('EventManager: EventRenderService not available!');
        return document.createElement('div');
    }

    cycleEventVariant(eventIndex, event, itemElement) {
        this.interactionService?.cycleEventVariant(eventIndex, event, itemElement);
    }

    resetAllEventVariants() {
        this.interactionService?.resetAllEventVariants();
    }

    updateEventItemPreview(eventIndex, event, itemElement, variantIndex) {
        this.interactionService?.updateEventItemPreview(eventIndex, event, itemElement, variantIndex);
    }

    openEventFromList(event, index) {
        this.interactionService?.openEventFromList(event, index);
    }

    getLocationName(lat, lon) {
        return (
            this.locationService?.getLocationName(
                lat,
                lon,
                this.cities,
                this.fictionalCities,
                this.airports,
                this.seaports
            ) ?? null
        );
    }

    setupDragAndDrop() {
        this.dragDropService?.setupDragAndDrop();
    }

    reorderEvents(fromIndex, toIndex, options) {
        this.dragDropService?.reorderEvents(fromIndex, toIndex, options || {});
    }

    /**
     * @param {number} index
     * @param {{ skipConfirm?: boolean }} [options]
     */
    deleteEvent(index, options = {}) {
        if (options.skipConfirm) {
            return runDeleteEventAtIndex(this, index);
        }
        return runDeleteEventWithConfirm(this, index);
    }

    addBlankEventAndOpen() {
        runAddBlankEventAndOpen(this);
    }

    async lookupCitySlide() {
        return await this.cityLookupService?.lookupCity({
            cityId: 'eventSlideEditCityLookup',
            latId: 'eventSlideEditLat',
            lonId: 'eventSlideEditLon',
            displayNameId: 'eventSlideEditCityDisplayName',
            lookupBtnId: 'eventSlideLookupCityBtn',
            useCodeLookupId: 'eventSlideUseCodeLookup'
        });
    }

    getEventImagePath(eventName, providedPath, imageArchiveOverride) {
        return this.imagePathService?.getEventImagePath(eventName, providedPath, imageArchiveOverride) || null;
    }

    getFactionDisplayTokenForSearch(filename) {
        return tokensFactionFilenameToDisplayToken(this, filename);
    }

    flagFilenameToCommonCountryName(flagFile) {
        return tokensFlagFilenameToCommonCountryName(flagFile);
    }

    prependEventManagerSearchTokens(opts = {}) {
        tokensPrependEventManagerSearchTokens(this, opts);
    }

    openEventsManagePanel() {
        const orch = typeof window !== 'undefined' ? window.modeOrchestrator : null;
        if (orch && typeof orch.openDataArchiveEventsView === 'function') {
            void orch.openDataArchiveEventsView('story');
            return;
        }
        this.renderEvents?.();
    }
}

installEventManagerDataGetters(EventManager);
installEventManagerArchiveBindings(EventManager);

if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
}
