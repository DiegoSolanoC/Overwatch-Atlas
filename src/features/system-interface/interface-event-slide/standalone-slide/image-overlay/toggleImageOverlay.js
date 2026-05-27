/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's toggleImageOverlay method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runToggleImageOverlay(slide, imagePath) {
            const overlay = document.getElementById('eventImageOverlay');
            const toggleBtn = document.getElementById('eventImageToggle');
            if (!overlay) {
                return;
            }
            
            // Play sound effect
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('imageDisplay');
            }
            
            if (overlay.classList.contains('open')) {
                slide.hideImageOverlay();
                if (toggleBtn) toggleBtn.textContent = 'Show Image';
                // Sync with global toggle state
                localStorage.setItem('globalImageToggle', 'false');
                if (window.standaloneEventSlide?.updateGlobalToggleButtonLabel) {
                    window.standaloneEventSlide.updateGlobalToggleButtonLabel(false);
                }
            } else if (imagePath) {
                slide.showImageOverlay(imagePath);
                if (toggleBtn) toggleBtn.textContent = 'Hide Image';
                // Sync with global toggle state
                localStorage.setItem('globalImageToggle', 'true');
                if (window.standaloneEventSlide?.updateGlobalToggleButtonLabel) {
                    window.standaloneEventSlide.updateGlobalToggleButtonLabel(true);
                }
            } else {
            }
}
