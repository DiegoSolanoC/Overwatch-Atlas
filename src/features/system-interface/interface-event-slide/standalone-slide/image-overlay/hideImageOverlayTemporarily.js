/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's hideImageOverlayTemporarily method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runHideImageOverlayTemporarily(slide, delayMs = 5000) {
            const overlay = document.getElementById('eventImageOverlay');
            if (!overlay || !overlay.classList.contains('open')) {
                return;
            }
            
            // Save the current image path before hiding
            const img = document.getElementById('eventImage');
            const savedImagePath = img?.src || slide.currentImagePath;
            
            // Hide with gradual fade
            slide.hideImageOverlayGradually(600);
            
            // Setup auto-restore timer
            let restoreTimeoutId = null;
            let activityListenersAttached = false;
            
            const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
            
            const resetTimer = () => {
                if (restoreTimeoutId) {
                    clearTimeout(restoreTimeoutId);
                }
                restoreTimeoutId = setTimeout(() => {
                    const eventSlide = document.getElementById('eventSlide');
                    // Only restore if event slide is still open and we have a saved path
                    if (eventSlide?.classList.contains('open') && savedImagePath) {
                        slide.showImageOverlayGradually(savedImagePath, 600);
                    }
                    detachActivityListeners();
                    restoreTimeoutId = null;
                }, delayMs);
            };
            
            const attachActivityListeners = () => {
                if (activityListenersAttached) return;
                activityListenersAttached = true;
                activityEvents.forEach(event => {
                    document.addEventListener(event, resetTimer, { passive: true, capture: true });
                });
                
                // Listen for marker hover events
                const onMarkerHover = () => resetTimer();
                window.addEventListener('markerhover', onMarkerHover);
                
                // Listen for thumbnail hover
                const onThumbnailHover = () => resetTimer();
                window.addEventListener('thumbnailhover', onThumbnailHover);
                
                // Store cleanup functions
                slide._tempHideCleanup = () => {
                    window.removeEventListener('markerhover', onMarkerHover);
                    window.removeEventListener('thumbnailhover', onThumbnailHover);
                };
            };
            
            const detachActivityListeners = () => {
                if (!activityListenersAttached) return;
                activityListenersAttached = false;
                activityEvents.forEach(event => {
                    document.removeEventListener(event, resetTimer, { capture: true });
                });
                if (slide._tempHideCleanup) {
                    slide._tempHideCleanup();
                    slide._tempHideCleanup = null;
                }
            };
            
            // Start listening for activity
            attachActivityListeners();
            
            // Watch for event slide closing - cancel restore
            let slideObserver = null;
            const eventSlide = document.getElementById('eventSlide');
            if (eventSlide) {
                slideObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            if (!eventSlide.classList.contains('open')) {
                                if (restoreTimeoutId) {
                                    clearTimeout(restoreTimeoutId);
                                    restoreTimeoutId = null;
                                }
                                detachActivityListeners();
                                if (slideObserver) {
                                    slideObserver.disconnect();
                                    slideObserver = null;
                                }
                            }
                        }
                    });
                });
                slideObserver.observe(eventSlide, { attributes: true, attributeFilter: ['class'] });
            }
            
            // Start initial timer
            restoreTimeoutId = setTimeout(() => {
                const eventSlide = document.getElementById('eventSlide');
                if (eventSlide?.classList.contains('open') && savedImagePath) {
                    slide.showImageOverlayGradually(savedImagePath, 600);
                }
                detachActivityListeners();
                if (slideObserver) {
                    slideObserver.disconnect();
                    slideObserver = null;
                }
                restoreTimeoutId = null;
            }, delayMs);
}
