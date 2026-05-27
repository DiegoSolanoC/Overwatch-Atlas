/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's collapseMultiToSingleRoot method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { copyFilterPlaceArraysFromSource } from '../../../interface-shared/storyEventFilterPlaces.js';

export function runCollapseMultiToSingleRoot(slide, eventData, keepVariant) {
            // Move variant data back to root
            eventData.name = keepVariant.name || '';
            eventData.description = keepVariant.description || '';
            eventData.cityDisplayName = keepVariant.cityDisplayName || '';
            eventData.yearStart = keepVariant.yearStart;
            eventData.yearEnd = keepVariant.yearEnd;
            eventData.eraName = keepVariant.eraName || '';
            eventData.headlines = [...(keepVariant.headlines || [])];
            eventData.sources = keepVariant.sources ? [...keepVariant.sources] : undefined;
            eventData.lat = keepVariant.lat;
            eventData.lon = keepVariant.lon;
            eventData.x = keepVariant.x;
            eventData.y = keepVariant.y;
            eventData.locationType = keepVariant.locationType;
            eventData.secondaryCountryPlaces = Array.isArray(keepVariant.secondaryCountryPlaces)
                ? keepVariant.secondaryCountryPlaces.map((p) => ({
                      locationName: p.locationName,
                      country: p.country,
                      reasoning: p.reasoning
                  }))
                : [];
            const fp = copyFilterPlaceArraysFromSource(keepVariant);
            if (fp.heroFilterPlaces.length) eventData.heroFilterPlaces = fp.heroFilterPlaces;
            else delete eventData.heroFilterPlaces;
            if (fp.factionFilterPlaces.length) eventData.factionFilterPlaces = fp.factionFilterPlaces;
            else delete eventData.factionFilterPlaces;
            if (fp.npcFilterPlaces.length) eventData.npcFilterPlaces = fp.npcFilterPlaces;
            else delete eventData.npcFilterPlaces;
            delete eventData.secondaryCountryFlags;
            delete eventData.variants;
}
