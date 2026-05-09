/**
 * EventSlideImageHelpers - Utilities for image overlay management in event slides
 * Extracted from EventSlideManager to reduce file size
 */

/**
 * Initialize image overlay for event slide
 */
export function initializeImageOverlay(eventImageOverlay, eventImage, imagePath, uiView) {
    if (!eventImageOverlay || !eventImage) {
        if (uiView?.imageOverlayManager) {
            uiView.imageOverlayManager.imageOverlayVisible = false;
            uiView.imageOverlayManager.imageToggleState = false;
        }
        return;
    }
    
    // Dynamic import to avoid circular dependency
    import('../../presentation/slide/helpers/ImageLoadingHelpers.js').then(({ loadEventImage, setupImageFadeIn }) => {
        loadEventImage(eventImage, eventImageOverlay, imagePath);
        
        if (uiView?.imageOverlayManager) {
            uiView.imageOverlayManager.imageOverlayVisible = true;
            uiView.imageOverlayManager.imageToggleState = true;
        }
        eventImageOverlay.classList.add('open');
        
        setupImageFadeIn(eventImage, eventImageOverlay, imagePath, () => {
            uiView.disablePageNavigationButtons(true);
        }, 600);
        
        if (uiView) {
            uiView.pendingImagePath = imagePath || null;
            uiView.setupImageOverlayHandlers(eventImageOverlay);
        }
    }).catch(() => {
        // Fallback if import fails
        if (window.ImageLoadingHelpers) {
            window.ImageLoadingHelpers.loadEventImage(eventImage, eventImageOverlay, imagePath);
            if (uiView?.imageOverlayManager) {
                uiView.imageOverlayManager.imageOverlayVisible = true;
                uiView.imageOverlayManager.imageToggleState = true;
            }
            eventImageOverlay.classList.add('open');
        }
    });
}

/**
 * Setup image toggle button
 */
export function setupImageToggleButton(imageToggleBtn, uiView) {
    if (imageToggleBtn && uiView) {
        imageToggleBtn.textContent = 'Hide Image';
        imageToggleBtn.onclick = () => uiView.toggleEventImage();
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideImageHelpers) {
        window.EventSlideImageHelpers = {};
    }
    window.EventSlideImageHelpers.initializeImageOverlay = initializeImageOverlay;
    window.EventSlideImageHelpers.setupImageToggleButton = setupImageToggleButton;
}
