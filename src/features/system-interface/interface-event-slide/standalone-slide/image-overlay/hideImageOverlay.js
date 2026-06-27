/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's hideImageOverlay method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import {
    hideDialogueTheaterImageOverlay,
    isDialogueTheaterEventSlideMarked,
    isDialogueTheaterImageOverlayContext,
} from '../../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import { syncMobileEventSlideLayoutForImageHidden } from './mobileEventSlideImageLayout.js';

export function runHideImageOverlay(slide) {
            if (
                isDialogueTheaterImageOverlayContext()
                || isDialogueTheaterEventSlideMarked()
            ) {
                hideDialogueTheaterImageOverlay();
                return;
            }

            const overlay = document.getElementById('eventImageOverlay');
            const eventSlide = document.getElementById('eventSlide');
            const toggleBtn = document.getElementById('eventImageToggle');
            if (overlay) {
                overlay.classList.remove('open');
                // Only remove slide-open if event slide is closed
                if (!eventSlide?.classList.contains('open')) {
                    overlay.classList.remove('slide-open');
                }
                overlay.style.display = 'none';
                overlay.style.opacity = '0';
            }
            
            const img = document.getElementById('eventImage');
            if (img) {
                img.classList.remove('fade-in', 'fade-out');
                img.style.display = 'none';
                img.style.opacity = '0';
            }
            
            // Update button text
            if (toggleBtn) toggleBtn.textContent = 'Show Image';

            syncMobileEventSlideLayoutForImageHidden();
}
