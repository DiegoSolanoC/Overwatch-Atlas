/**
 * Public facade for the `flags/` slice: re-exports the user-facing surface as
 * `window.LocationFlagHelpers` for legacy classic-script consumers (event
 * slide pipeline, marker filter sync, data service, etc.).
 *
 * Internal slice modules attach their own surfaces to private window
 * namespaces (`window.__FlagFileResolver`, `__FlagLocationContext`,
 * `__SecondaryCountryFlags`, `__SlideBioConnections`,
 * `__SlideRelevantLocations`, `__SlideStoryFilterPlaces`,
 * `__RelevancyRowFilterHighlight`). This file simply stitches them together
 * into the same shape the old `LocationFlagHelpers.js` exposed, so callers
 * can keep doing `window.LocationFlagHelpers.X` without code changes.
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;
    var L = window.__FlagLocationContext;
    var S = window.__SecondaryCountryFlags;
    var B = window.__SlideBioConnections;
    var Rel = window.__SlideRelevantLocations;
    var Sfp = window.__SlideStoryFilterPlaces;
    var H = window.__RelevancyRowFilterHighlight;

    if (!R || !L || !S || !B || !Rel || !Sfp || !H) {
        console.warn('[LocationFlagHelpers] flags slice modules not fully loaded yet');
        return;
    }

    window.LocationFlagHelpers = {
        /* Row markup + base resolvers */
        createLeadingGraphicHtml: L.createLeadingGraphicHtml,
        createLocationRowInnerHtml: L.createLocationRowInnerHtml,
        flagSrc: R.flagSrc,
        getResolvedFlagFilename: R.getResolvedFlagFilename,
        getFlagLocationContext: L.getFlagLocationContext,
        getCountryCommonNamesForAutocomplete: L.getCountryCommonNamesForAutocomplete,
        commonLabelForFlagFile: R.commonLabelForFlagFile,

        /* Relevant locations block (under description) */
        createRelevantLocationsSlideHtml: Rel.createRelevantLocationsSlideHtml,
        getSecondaryCountryPlacesRowsForDisplay: Rel.getSecondaryCountryPlacesRowsForDisplay,
        clearRelevantLocationsSlideDom: Rel.clearRelevantLocationsSlideDom,
        updateRelevantLocationsSlideFromSecondaryPlaces: Rel.updateRelevantLocationsSlideFromSecondaryPlaces,

        /* Bio archive connections block */
        clearBioConnectionsSlideDom: B.clearBioConnectionsSlideDom,
        updateBioConnectionsSlideFromEvent: B.updateBioConnectionsSlideFromEvent,
        clearBioConnectionCodexHighlight: B.clearBioConnectionCodexHighlight,
        applyBioConnectionCodexHighlight: B.applyBioConnectionCodexHighlight,

        /* Story grouped filter places block */
        getHeroFilterPlacesRowsForDisplay: Sfp.getHeroFilterPlacesRowsForDisplay,
        getFactionFilterPlacesRowsForDisplay: Sfp.getFactionFilterPlacesRowsForDisplay,
        getNpcFilterPlacesRowsForDisplay: Sfp.getNpcFilterPlacesRowsForDisplay,
        createStoryFilterPlacesSlideHtml: Sfp.createStoryFilterPlacesSlideHtml,
        clearStoryFilterPlacesSlideDom: Sfp.clearStoryFilterPlacesSlideDom,
        updateStoryFilterPlacesSlideFromEvent: Sfp.updateStoryFilterPlacesSlideFromEvent,

        /* Secondary country flags (filter feed + story-event migrators) */
        parseSecondaryCountryList: S.parseSecondaryCountryList,
        deriveSecondaryCountryFlagFilenamesFromPlaces: S.deriveSecondaryCountryFlagFilenamesFromPlaces,
        syncSecondaryCountryFlagsOnEntity: S.syncSecondaryCountryFlagsOnEntity,
        getSecondaryCountryFlagFilenamesForEntity: S.getSecondaryCountryFlagFilenamesForEntity,
        migrateStoryEventSecondaryPlaces: S.migrateStoryEventSecondaryPlaces,
        migrateAllStoryEventsSecondaryPlaces: S.migrateAllStoryEventsSecondaryPlaces,
        collectCountryFlagFilesForEntity: S.collectCountryFlagFilesForEntity,

        /* Standalone-filter row highlight */
        applyRelevancyRowFilterHighlight: H.applyRelevancyRowFilterHighlight,
        scheduleApplyRelevancyRowFilterHighlight: H.scheduleApplyRelevancyRowFilterHighlight
    };
})();
