/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's showStandaloneEventSlide method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { resolveEventSlideArchiveSource } from '../resolveEventSlideArchiveSource.js';

export function runShowStandaloneEventSlide(slide, eventData, globalIndex, options = {}) {
            if (!eventData) return;
            
            const isMultiEvent = Array.isArray(eventData.variants) && eventData.variants.length > 0;
            const variantIndex = options.variantIndex ?? eventData.variantIndex ?? 0;
            slide.currentVariantIndex = variantIndex;
            const displayEvent = isMultiEvent && eventData.variants[variantIndex] 
                ? { ...eventData, ...eventData.variants[variantIndex] }
                : eventData;
            
            // Get event data for display
            let eventName = displayEvent.name || eventData.name || 'Unnamed Event';
            const description = displayEvent.description || '';

            /*
             * Image folder must follow the slide's presentation archive (heroes peek
             * while EventManager stays on story), not the live EM source. Dock timeline
             * rows always use story event art.
             */
            const useStoryDockImages = !!slide._presentationFromDockTimeline;
            const imageArchive =
                useStoryDockImages ? 'story' : resolveEventSlideArchiveSource(slide);
            let imagePath = null;
            if (window.NavigationImageHelpers?.getEventImagePath) {
                imagePath = window.NavigationImageHelpers.getEventImagePath(
                    displayEvent,
                    eventName,
                    imageArchive
                );
            } else if (window.eventManager?.getEventImagePath) {
                imagePath = window.eventManager.getEventImagePath(
                    displayEvent.name,
                    displayEvent.image,
                    imageArchive
                );
            } else {
                imagePath = displayEvent.image || displayEvent.imagePath || null;
            }
            
            // Apply glitch text if enabled
            if (window.GlitchTextService?.isEnabled?.()) {
                eventName = window.GlitchTextService.getDisplayEventName(eventName);
            }
            
            // Call the full displaySlide method with all features
            slide.displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent);
            
            // Update nav buttons
            slide.updateNavButtons();
}
