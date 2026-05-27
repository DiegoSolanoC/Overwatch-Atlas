/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's renderVariantBar method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runRenderVariantBar(slide, eventData) {
            const bar = document.getElementById('eventSlideInlineVariantBar');
            if (!bar || !slide.isEditing) return;
            
            const variants = eventData.variants && eventData.variants.length > 0
                ? eventData.variants
                : null;
            const n = variants ? variants.length : 1;
            let cur = slide.currentVariantIndex ?? 0;
            if (cur >= n) cur = n - 1;
            if (cur < 0) cur = 0;
            
            bar.innerHTML = '';
            for (let i = 0; i < n; i++) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'event-slide-inline-variant-tab';
                if (i === cur) b.classList.add('active');
                b.textContent = String(i + 1);
                b.dataset.variantIndex = String(i);
                b.dataset.role = 'variant-tab';
                b.title = i === 0 ? 'Primary variant' : `Variant ${i + 1}`;
                bar.appendChild(b);
            }
            const addB = document.createElement('button');
            addB.type = 'button';
            addB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action';
            addB.textContent = '+';
            addB.title = 'Add variant';
            addB.dataset.role = 'add-variant';
            bar.appendChild(addB);
            if (variants && variants.length > 1) {
                const remB = document.createElement('button');
                remB.type = 'button';
                remB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action event-slide-inline-variant-action--remove';
                remB.textContent = '-';
                remB.title = 'Remove current variant';
                remB.dataset.role = 'remove-variant';
                bar.appendChild(remB);
                
                // Add "Make Primary" button if not on primary
                if (cur > 0) {
                    const makePrimaryB = document.createElement('button');
                    makePrimaryB.type = 'button';
                    makePrimaryB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action';
                    makePrimaryB.textContent = '?';
                    makePrimaryB.title = 'Make this variant primary';
                    makePrimaryB.dataset.role = 'make-primary';
                    bar.appendChild(makePrimaryB);
                }
            }
}
