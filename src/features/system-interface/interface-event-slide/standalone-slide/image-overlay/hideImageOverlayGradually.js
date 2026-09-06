/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's hideImageOverlayGradually method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import {
    hideDialogueTheaterImageOverlayGradually,
    isDialogueTheaterEventSlideMarked,
    isDialogueTheaterImageOverlayContext,
} from '../../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import {
    isStoryCommentaryDirectPlayActive,
    stopStoryCommentaryDirectPlay,
} from '../../../interface-shared/openDialogueTheaterFromStoryCommentary.js';
import { syncMobileEventSlideLayoutForImageHidden } from './mobileEventSlideImageLayout.js';
import { clearEventSourceMediaEmbed } from './eventSourceMediaOverlay.js';

export function runHideImageOverlayGradually(slide, durationMs = 600) {
            if (
                isDialogueTheaterImageOverlayContext()
                || isDialogueTheaterEventSlideMarked()
            ) {
                hideDialogueTheaterImageOverlayGradually(slide, durationMs);
                return;
            }

            // Direct Play stage must be torn down before fading the story image,
            // otherwise leftover stage DOM + theater overlay CSS fight #eventImage.
            if (isStoryCommentaryDirectPlayActive()) {
                stopStoryCommentaryDirectPlay({ restoreEventImage: true });
            }

            const overlay = document.getElementById('eventImageOverlay');
            const img = document.getElementById('eventImage');
            const toggleBtn = document.getElementById('eventImageToggle');
            
            if (!overlay) return;
            
            // Disable pointer events immediately
            overlay.style.setProperty('pointer-events', 'none');
            
            // Gradual fade-out
            const startTime = Date.now();
            const fadeInterval = 50; // Update every 50ms
            
            
            const fadeTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                // Ease-out curve for smooth disappearance
                const eased = 1 - (1 - progress) * (1 - progress); // Quadratic ease-out
                const opacity = 1 - eased;
                
                overlay.style.opacity = String(opacity);
                if (img) {
                    img.style.opacity = String(opacity);
                }
                
                if (progress >= 1) {
                    clearInterval(fadeTimer);
                    clearEventSourceMediaEmbed();
                    if (slide && typeof slide === 'object') {
                        slide.activeYouTubeVideoId = '';
                        slide.activePdfSourceUrl = '';
                    }
                    overlay.style.opacity = '0';
                    overlay.classList.remove('open', 'slide-open', 'fade-in', 'dialogue-theater-stage-overlay');
                    delete overlay.dataset.storyCommentaryDirectPlay;
                    overlay.style.display = 'none';
                    overlay.style.removeProperty('pointer-events');
                    document.getElementById('dialogueTheaterStage')?.remove();
                    if (img) {
                        img.style.opacity = '0';
                        img.style.display = 'none';
                        img.src = '';
                    }
                    if (toggleBtn) toggleBtn.textContent = 'Show Image';
                    syncMobileEventSlideLayoutForImageHidden();
                }
            }, fadeInterval);
}
