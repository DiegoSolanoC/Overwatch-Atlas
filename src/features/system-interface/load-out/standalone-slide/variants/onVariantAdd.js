/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's onVariantAdd method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runOnVariantAdd(slide) {
            slide.saveCurrentVariantData();
            
            const { eventData } = slide.editTarget;
            if (!eventData) return;
            
            if (!eventData.variants || eventData.variants.length === 0) {
                slide.convertRootEventToMulti(eventData);
                const newIdx = eventData.variants.length - 1;
                slide.currentVariantIndex = newIdx;
            } else {
                const last = eventData.variants[eventData.variants.length - 1];
                const lt = last?.locationType || eventData.locationType || 'earth';
                const nv = {
                    name: '',
                    description: '',
                    sources: undefined,
                    headlines: undefined,
                    locationType: lt,
                    secondaryCountryPlaces: [],
                    heroFilterPlaces: [],
                    factionFilterPlaces: [],
                    npcFilterPlaces: []
                };
                if (lt === 'earth') {
                    nv.lat = last?.lat;
                    nv.lon = last?.lon;
                } else {
                    nv.x = last?.x;
                    nv.y = last?.y;
                }
                if (last?.cityDisplayName) nv.cityDisplayName = last.cityDisplayName;
                eventData.variants.push(nv);
                const newIdx = eventData.variants.length - 1;
                slide.currentVariantIndex = newIdx;
            }
            
            const target = eventData.variants[slide.currentVariantIndex];
            slide.populateInlineEditor(eventData, target);
            slide.renderVariantBar(eventData);
}
