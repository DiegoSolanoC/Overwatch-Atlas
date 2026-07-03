/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's showImageOverlay method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import {
    isDialogueTheaterImageOverlayContext,
    showDialogueTheaterImageOverlay,
} from '../../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import {
    isMobileEventSlideViewport,
    syncMobileEventSlideLayoutForImageShown,
} from './mobileEventSlideImageLayout.js';
import {
    clearEventSourceMediaEmbed,
    shouldIgnoreOverlayClickForSourceMedia,
} from './eventSourceMediaOverlay.js';

export function runShowImageOverlay(slide, imagePath) {
            if (isDialogueTheaterImageOverlayContext()) {
                void showDialogueTheaterImageOverlay(slide);
                return;
            }

            const overlay = document.getElementById('eventImageOverlay');
            const img = document.getElementById('eventImage');
            const eventSlide = document.getElementById('eventSlide');
            const toggleBtn = document.getElementById('eventImageToggle');
            
            if (overlay && img && imagePath) {
                clearEventSourceMediaEmbed();
                if (slide && typeof slide === 'object') {
                    slide.activeYouTubeVideoId = '';
                    slide.activePdfSourceUrl = '';
                }

                img.src = imagePath;
                img.style.display = 'block';
                img.style.opacity = '1';
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                overlay.classList.add('open');
                // Add slide-open class if event slide is open (positions image to the right of panel)
                if (eventSlide?.classList.contains('open')) {
                    overlay.classList.add('slide-open');
                }
                
                // Update button text
                if (toggleBtn) toggleBtn.textContent = 'Hide Image';

                syncMobileEventSlideLayoutForImageShown();

                // Setup click-to-hide handler if not already set (desktop only)
                if (!overlay.dataset.clickHandlerSet) {
                    overlay.dataset.clickHandlerSet = 'true';
                    overlay.addEventListener('click', (e) => {
                        if (isMobileEventSlideViewport()) return;
                        if (isDialogueTheaterImageOverlayContext()) return;
                        if (shouldIgnoreOverlayClickForSourceMedia(e)) return;

                        if (e.target === overlay || e.target.tagName === 'IMG') {
                            e.stopPropagation();
                            slide.hideImageOverlayTemporarily(5000);
                        }
                    });
                }
            }
}
