/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's onVariantMakePrimary method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runOnVariantMakePrimary(slide) {
            const { eventData } = slide.editTarget;
            if (!eventData?.variants || eventData.variants.length <= 1) return;
            
            const cur = slide.currentVariantIndex ?? 0;
            if (cur === 0) return; // Already primary
            
            if (!confirm(`Make variant ${cur + 1} the primary variant? This will swap it with the current primary and update the root event name/description.`)) {
                return;
            }
            
            slide.saveCurrentVariantData();
            
            // Swap variant at cur with variant at 0
            const vars = eventData.variants;
            const temp = vars[0];
            vars[0] = vars[cur];
            vars[cur] = temp;
            
            // Update root event name and description to match new primary
            const newPrimary = vars[0];
            eventData.name = newPrimary.name || eventData.name;
            eventData.description = newPrimary.description || eventData.description;
            
            // Update current index to 0 (the new primary)
            slide.currentVariantIndex = 0;
            
            // Re-render with new primary
            const target = vars[0];
            slide.populateInlineEditor(eventData, target);
            slide.renderVariantBar(eventData);
            
            // Update the title and description display elements
            const titleEl = document.getElementById('eventSlideTitle');
            const textEl = document.getElementById('eventSlideText');
            if (titleEl) titleEl.textContent = eventData.name;
            if (textEl) textEl.innerHTML = eventData.description;
}
