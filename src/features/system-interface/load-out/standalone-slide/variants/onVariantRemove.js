/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's onVariantRemove method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runOnVariantRemove(slide) {
            const { eventData } = slide.editTarget;
            if (!eventData?.variants || eventData.variants.length <= 1) return;
            if (!confirm('Remove this variant? This cannot be undone except by canceling edit without saving.')) {
                return;
            }
            
            slide.saveCurrentVariantData();
            
            const cur = slide.currentVariantIndex ?? 0;
            const vars = eventData.variants;
            
            if (vars.length === 2) {
                const keep = vars[1 - cur];
                slide.collapseMultiToSingleRoot(eventData, keep);
                slide.currentVariantIndex = 0;
            } else {
                vars.splice(cur, 1);
                const newIdx = Math.min(cur, vars.length - 1);
                slide.currentVariantIndex = newIdx;
            }
            
            const target = eventData.variants && eventData.variants.length > 0
                ? eventData.variants[slide.currentVariantIndex]
                : eventData;
            slide.populateInlineEditor(eventData, target);
            slide.renderVariantBar(eventData);
}
