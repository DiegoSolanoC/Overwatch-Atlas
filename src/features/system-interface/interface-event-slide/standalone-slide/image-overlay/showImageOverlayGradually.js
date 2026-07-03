/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's showImageOverlayGradually method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import {
    isDialogueTheaterImageOverlayContext,
    showDialogueTheaterImageOverlayGradually,
} from '../../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import {
    isMobileEventSlideViewport,
    syncMobileEventSlideLayoutForImageShown,
} from './mobileEventSlideImageLayout.js';
import {
    clearEventSourceMediaEmbed,
    shouldIgnoreOverlayClickForSourceMedia,
} from './eventSourceMediaOverlay.js';

export function runShowImageOverlayGradually(slide, imagePath, durationMs = 1500) {
            if (isDialogueTheaterImageOverlayContext()) {
                void showDialogueTheaterImageOverlayGradually(slide, durationMs);
                return;
            }

            const overlay = document.getElementById('eventImageOverlay');
            const img = document.getElementById('eventImage');
            const eventSlide = document.getElementById('eventSlide');
            
            if (!overlay || !img || !imagePath) return;

            clearEventSourceMediaEmbed();
            if (slide && typeof slide === 'object') {
                slide.activeYouTubeVideoId = '';
                slide.activePdfSourceUrl = '';
            }

            img.src = imagePath;
            img.style.display = 'block';
            img.style.opacity = '0';
            overlay.style.display = 'flex';
            overlay.classList.add('open');
            // Add slide-open class if event slide is open (positions image to the right of panel)
            if (eventSlide?.classList.contains('open')) {
                overlay.classList.add('slide-open');
            }
            overlay.style.opacity = '0';

            syncMobileEventSlideLayoutForImageShown();

            // Setup click handler for temporary hide if not already set (desktop only)
            if (!overlay.dataset.clickHandlerSetup) {
                overlay.dataset.clickHandlerSetup = 'true';
                overlay.addEventListener('click', (e) => {
                    if (isMobileEventSlideViewport()) return;
                    if (isDialogueTheaterImageOverlayContext()) return;
                    if (shouldIgnoreOverlayClickForSourceMedia(e)) return;
                    // Only hide if clicking the image itself or overlay (not other controls)
                    if (e.target === overlay || e.target.tagName === 'IMG') {
                        e.stopPropagation();
                        slide.hideImageOverlayTemporarily(5000);
                    }
                });
            }
            
            // Gradual fade-in with progress logging
            const startTime = Date.now();
            const fadeInterval = 50; // Update every 50ms
            
            
            const fadeTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                // Ease-in curve for smooth appearance
                const eased = progress * progress; // Quadratic ease-in
                const opacity = eased;
                
                overlay.style.opacity = String(opacity);
                img.style.opacity = String(opacity);
                
                // Log progress at 25%, 50%, 75%, 100%
                
                if (progress >= 1) {
                    clearInterval(fadeTimer);
                    overlay.style.opacity = '1';
                    img.style.opacity = '1';
                }
            }, fadeInterval);
}
