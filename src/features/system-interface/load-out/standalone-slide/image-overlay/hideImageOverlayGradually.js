/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's hideImageOverlayGradually method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runHideImageOverlayGradually(slide, durationMs = 600) {
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
                
                // Log progress at 25%, 50%, 75%, 100%
                
                if (progress >= 1) {
                    clearInterval(fadeTimer);
                    overlay.style.opacity = '0';
                    overlay.classList.remove('open', 'slide-open', 'fade-in');
                    overlay.style.display = 'none';
                    if (img) {
                        img.style.opacity = '0';
                        img.style.display = 'none';
                        img.src = '';
                    }
                    if (toggleBtn) toggleBtn.textContent = 'Show Image';
                }
            }, fadeInterval);
}
