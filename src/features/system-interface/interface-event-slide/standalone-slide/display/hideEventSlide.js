/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's hideEventSlide method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { showMenuContainer } from '../../../../universal-features/atlas-main-menu/MenuContainer.js';
import { getCurrentModeOrMenu } from '../../../../universal-features/atlas-mode-runtime/mode-lifecycle/CurrentModeStatus.js';

function restoreHubMenuIfHidden() {
    if (!document.body.classList.contains('app-timeline-default')) return;
    if (getCurrentModeOrMenu() !== 'menu') return;
    const testContainer = document.querySelector('.test-container');
    if (!testContainer || testContainer.style.display !== 'none') return;
    showMenuContainer();
    const menuButtons = testContainer.querySelector('.main-menu-buttons');
    if (menuButtons) {
        menuButtons.style.display = 'flex';
        menuButtons.style.visibility = 'visible';
        menuButtons.style.opacity = '1';
    }
}

export function runHideEventSlide(slide) {
            const eventSlide = document.getElementById('eventSlide');
            const eventImageOverlay = document.getElementById('eventImageOverlay');
            const eventImage = document.getElementById('eventImage');
            
            // Only play sound if panel was actually open
            const wasOpen = eventSlide?.classList.contains('open');
            if (wasOpen) {
                slide.clearSlideHistory();
            }
            
            if (eventSlide) {
                eventSlide.classList.remove('open');
            }
            
            // Hide image overlay completely
            if (eventImageOverlay) {
                eventImageOverlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
                eventImageOverlay.style.display = 'none';
                eventImageOverlay.style.opacity = '0';
            }
            
            if (eventImage) {
                eventImage.classList.remove('fade-in', 'fade-out');
                eventImage.style.display = 'none';
                eventImage.style.opacity = '0';
            }
            
            slide.cancelEdit();
            
            // Only play sound if panel was actually closed
            if (wasOpen && window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('eventClick');
            }

            if (wasOpen) {
                restoreHubMenuIfHidden();
            }
}
