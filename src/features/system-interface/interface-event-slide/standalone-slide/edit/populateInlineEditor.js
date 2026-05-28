/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's populateInlineEditor method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { syncFactionTypeBioPanelVisibility } from '../../../interface-shared/bio-archive/FactionTypeBioInput.js';
import { syncNpcCategoryBioPanelVisibility } from '../../../interface-shared/bio-archive/NpcCategoryBioInput.js';
import { syncHeroBirthdayBioPanelVisibility } from '../../../interface-shared/bio-archive/HeroBirthdayBioInput.js';
import { syncHeroBioRolePanelsVisibility } from '../../../interface-shared/bio-archive/HeroRoleBioInputs.js';
import {
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS,
    heroPlacesForEditor,
    factionPlacesForEditor,
    npcPlacesForEditor,
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens
} from '../../../interface-shared/storyEventFilterPlaces.js';

export function runPopulateInlineEditor(slide, eventData, displayEvent) {
            const target = displayEvent || eventData;
            const archPop = slide._presentationFromDockTimeline
                ? 'story'
                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
            const isBioPop =
                archPop === 'heroes' || archPop === 'factions' || archPop === 'npcs';

            // Set field values
            const cityInput = document.getElementById('eventSlideEditCityDisplayName');
            const cityLookupInput = document.getElementById('eventSlideEditCityLookup');
            const yearStartInput = document.getElementById('eventSlideEditYearStart');
            const yearEndInput = document.getElementById('eventSlideEditYearEnd');
            const eraInput = document.getElementById('eventSlideEditEraName');
            const filtersInput = document.getElementById('eventSlideEditFilters');
            const factionsInput = document.getElementById('eventSlideEditFactions');
            const npcsInput = document.getElementById('eventSlideEditNpcs');
            const headlinesInput = document.getElementById('eventSlideEditHeadlines');
            const locationTypeInput = document.getElementById('eventSlideEditLocationType');
            const latInput = document.getElementById('eventSlideEditLat');
            const lonInput = document.getElementById('eventSlideEditLon');
            const xInput = document.getElementById('eventSlideEditX');
            const yInput = document.getElementById('eventSlideEditY');
            
            if (cityInput) cityInput.value = target.cityDisplayName || '';
            if (cityLookupInput) cityLookupInput.value = (target.cityDisplayName || eventData.cityDisplayName || '').trim();
            if (yearStartInput) yearStartInput.value = target.yearStart || target.year || '';
            if (yearEndInput) yearEndInput.value = target.yearEnd || '';
            if (eraInput) eraInput.value = target.eraName || '';
            syncFactionTypeBioPanelVisibility(
                archPop,
                archPop === 'factions' ? target.factionType : undefined
            );
            syncNpcCategoryBioPanelVisibility(
                archPop,
                archPop === 'npcs' ? target.npcCategory : undefined
            );
            syncHeroBioRolePanelsVisibility(
                archPop,
                archPop === 'heroes' ? target.heroRole : undefined,
                archPop === 'heroes' ? target.heroSubRole : undefined
            );
            syncHeroBirthdayBioPanelVisibility(
                archPop,
                archPop === 'heroes' ? target.birthday : undefined
            );
            if (filtersInput) filtersInput.value = getStoryEventHeroTokens(target).join(', ');
            if (factionsInput) {
                const formSvc = window.eventManager?.formService;
                const manifest = window.eventManager?.factions?.length
                    ? window.eventManager.factions
                    : window.globeController?.dataModel?.factions || [];
                const facTok = getStoryEventFactionTokens(target);
                factionsInput.value =
                    formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                        ? formSvc.factionsArrayToFormDisplayString(facTok, manifest)
                        : facTok.map((f) => String(f).replace(/^\d+/, '').trim()).join(', ');
            }
            if (npcsInput) npcsInput.value = getStoryEventNpcTokens(target).join(', ');
            
            const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
            if (secPlacesEl && window.HeroRelevantLocationsEditor?.render) {
                const places = isBioPop
                    ? (Array.isArray(target.relevantLocations) ? target.relevantLocations : [])
                    : (Array.isArray(target.secondaryCountryPlaces) ? target.secondaryCountryPlaces : []);
                const opts = isBioPop
                    ? {
                          placeholders: {
                              locationName: 'Location / group label',
                              country: 'Countries (comma-separated for multiple flags)',
                              reasoning: 'Relevance (e.g. headquarters, place of origin)'
                          },
                          autocompleteType: 'countries'
                      }
                    : STORY_SECONDARY_PLACES_EDITOR_OPTS;
                window.HeroRelevantLocationsEditor.render(secPlacesEl, places, opts);
            }

            const heroFpEl = document.getElementById('eventSlideEditHeroFilterPlaces');
            const factionFpEl = document.getElementById('eventSlideEditFactionFilterPlaces');
            const npcFpEl = document.getElementById('eventSlideEditNpcFilterPlaces');
            if (
                heroFpEl &&
                factionFpEl &&
                npcFpEl &&
                window.HeroRelevantLocationsEditor?.render
            ) {
                if (!isBioPop) {
                    window.HeroRelevantLocationsEditor.render(
                        heroFpEl,
                        heroPlacesForEditor(target),
                        STORY_HERO_FILTER_PLACES_OPTS
                    );
                    window.HeroRelevantLocationsEditor.render(
                        factionFpEl,
                        factionPlacesForEditor(target),
                        STORY_FACTION_FILTER_PLACES_OPTS
                    );
                    window.HeroRelevantLocationsEditor.render(
                        npcFpEl,
                        npcPlacesForEditor(target),
                        STORY_NPC_FILTER_PLACES_OPTS
                    );
                } else {
                    heroFpEl.innerHTML = '';
                    factionFpEl.innerHTML = '';
                    npcFpEl.innerHTML = '';
                }
            }

            if (headlinesInput) headlinesInput.value = (target.headlines || []).join('\n');

            const emList = window.eventManager;
            const numEl = document.getElementById('eventSlideEditEventNumber');
            const listIdx = emList?.events ? emList.events.indexOf(eventData) : -1;
            if (numEl && emList?.events?.length && listIdx >= 0) {
                numEl.min = '1';
                numEl.max = String(emList.events.length);
                numEl.value = String(listIdx + 1);
            }

            // Set location type and coordinates
            const locType = target.locationType || eventData.locationType || 'earth';
            if (locationTypeInput) locationTypeInput.value = locType;
            
            if (latInput) latInput.value = '';
            if (lonInput) lonInput.value = '';
            if (xInput) xInput.value = '';
            if (yInput) yInput.value = '';
            
            if (locType === 'earth') {
                if (latInput && target.lat != null) latInput.value = String(target.lat);
                if (lonInput && target.lon != null) lonInput.value = String(target.lon);
            } else {
                if (xInput && target.x != null) xInput.value = String(target.x);
                if (yInput && target.y != null) yInput.value = String(target.y);
                if ((locType === 'station' || locType === 'marsShip') && xInput && yInput) {
                    if (!String(xInput.value).trim()) xInput.value = '50';
                    if (!String(yInput.value).trim()) yInput.value = '50';
                }
            }
            
            // Sync location type UI
            slide.syncLocationTypeUI();
            
            // Render sources
            slide.renderSourcesEditor(target.sources || []);
            
            // Render variant bar
            slide.renderVariantBar(eventData);
}
