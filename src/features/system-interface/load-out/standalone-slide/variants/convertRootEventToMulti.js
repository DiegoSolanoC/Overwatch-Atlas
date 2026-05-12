/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's convertRootEventToMulti method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { copyFilterPlaceArraysFromSource } from '../../../utils/storyEventFilterPlaces.js';

export function runConvertRootEventToMulti(slide, eventData) {
            // Move root event data into first variant
            const firstVariant = {
                name: eventData.name || '',
                description: eventData.description || '',
                cityDisplayName: eventData.cityDisplayName || '',
                yearStart: eventData.yearStart || eventData.year,
                yearEnd: eventData.yearEnd || null,
                eraName: eventData.eraName || '',
                headlines: [...(eventData.headlines || [])],
                sources: eventData.sources ? [...eventData.sources] : undefined,
                lat: eventData.lat,
                lon: eventData.lon,
                x: eventData.x,
                y: eventData.y,
                locationType: eventData.locationType,
                secondaryCountryPlaces: Array.isArray(eventData.secondaryCountryPlaces)
                    ? eventData.secondaryCountryPlaces.map((p) => ({
                          locationName: p.locationName,
                          country: p.country,
                          reasoning: p.reasoning
                      }))
                    : [],
                ...copyFilterPlaceArraysFromSource(eventData)
            };
            eventData.variants = [firstVariant];
            delete eventData.heroFilterPlaces;
            delete eventData.factionFilterPlaces;
            delete eventData.npcFilterPlaces;
            delete eventData.secondaryCountryFlags;
}
