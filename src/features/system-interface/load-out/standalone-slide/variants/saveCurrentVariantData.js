/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's saveCurrentVariantData method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { applyStoryFilterPlacesToTarget } from '../../../utils/storyEventFilterPlaces.js';

export function runSaveCurrentVariantData(slide) {
            if (!slide.editTarget) return;
            const { eventData } = slide.editTarget;
            
            const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
            if (!isMulti) return;
            
            const vIdx = slide.currentVariantIndex ?? 0;
            const target = eventData.variants[vIdx];
            if (!target) return;
            
            // Collect data from form fields
            const cityInput = document.getElementById('eventSlideEditCityDisplayName');
            const yearStartInput = document.getElementById('eventSlideEditYearStart');
            const yearEndInput = document.getElementById('eventSlideEditYearEnd');
            const eraInput = document.getElementById('eventSlideEditEraName');
            const headlinesInput = document.getElementById('eventSlideEditHeadlines');
            const locationTypeInput = document.getElementById('eventSlideEditLocationType');
            const latInput = document.getElementById('eventSlideEditLat');
            const lonInput = document.getElementById('eventSlideEditLon');
            const xInput = document.getElementById('eventSlideEditX');
            const yInput = document.getElementById('eventSlideEditY');
            
            if (cityInput) target.cityDisplayName = cityInput.value;
            if (yearStartInput) target.yearStart = yearStartInput.value;
            if (yearEndInput) target.yearEnd = yearEndInput.value;
            if (eraInput) target.eraName = eraInput.value;
            if (window.HeroRelevantLocationsEditor?.collect) {
                const heroFpElSv = document.getElementById('eventSlideEditHeroFilterPlaces');
                const hr = heroFpElSv ? window.HeroRelevantLocationsEditor.collect(heroFpElSv) : [];
                const fr = window.HeroRelevantLocationsEditor.collect(
                    document.getElementById('eventSlideEditFactionFilterPlaces')
                );
                const nr = window.HeroRelevantLocationsEditor.collect(
                    document.getElementById('eventSlideEditNpcFilterPlaces')
                );
                applyStoryFilterPlacesToTarget(target, hr, fr, nr);
            }
            const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
            const places =
                window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
            target.secondaryCountryPlaces = places;
            if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
            }
            if (headlinesInput) target.headlines = headlinesInput.value.split('\n').map(s => s.trim()).filter(s => s);
            if (locationTypeInput) target.locationType = locationTypeInput.value;
            if (latInput) target.lat = parseFloat(latInput.value) || null;
            if (lonInput) target.lon = parseFloat(lonInput.value) || null;
            if (xInput) target.x = parseFloat(xInput.value) || null;
            if (yInput) target.y = parseFloat(yInput.value) || null;
}
