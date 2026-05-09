/**
 * ImageLoadingHelpers - Utilities for loading event images
 * Extracted from EventSlideManager to reduce duplication
 */

/**
 * Normalizes image path (removes leading slash, adds cache busting)
 * @param {string} imagePath - Raw image path
 * @returns {string} - Normalized path with cache busting
 */
export function normalizeImagePath(imagePath) {
    if (!imagePath) return null;
    
    // Ensure path is relative (no leading slash)
    const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // Add cache busting
    const cacheBuster = `?v=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return `${normalizedPath}${cacheBuster}`;
}

/**
 * Sets up image error and load handlers
 * @param {HTMLImageElement} imageElement - Image element
 * @param {HTMLElement} overlayElement - Overlay element
 * @param {string} imagePath - Full image path (with cache busting)
 */
export function setupImageHandlers(imageElement, overlayElement, imagePath) {
    // Clear any previous handlers first
    imageElement.onerror = null;
    imageElement.onload = null;
    
    imageElement.onerror = () => {
        console.error(`Failed to load event image: ${imagePath}`);
        imageElement.style.display = 'none';
        overlayElement.style.background = 'rgba(0, 0, 0, 0.85)';
    };
    
    imageElement.onload = () => {
        imageElement.style.display = 'block';
        overlayElement.style.background = 'rgba(0, 0, 0, 0)';
        // Overlay CSS sets base opacity:0; ensure a loaded image becomes visible.
        // Using rAF ensures the browser has applied `display:block` first.
        try {
            imageElement.classList.remove('fade-out');
            requestAnimationFrame(() => {
                imageElement.classList.add('fade-in');
            });
        } catch (_) {
            // no-op
        }
    };
}

/**
 * Loads event image with proper error handling
 * @param {HTMLImageElement} imageElement - Image element
 * @param {HTMLElement} overlayElement - Overlay element
 * @param {string} imagePath - Image path (will be normalized)
 */
export function loadEventImage(imageElement, overlayElement, imagePath) {
    if (!imageElement || !overlayElement) return;
    
    // Reset states
    overlayElement.classList.remove('fade-in', 'fade-out');
    imageElement.classList.remove('fade-in', 'fade-out');
    
    if (imagePath) {
        const fullPath = normalizeImagePath(imagePath);
        setupImageHandlers(imageElement, overlayElement, fullPath);
        imageElement.style.display = 'none'; // Hide while loading
        imageElement.src = fullPath;
    } else {
        console.log('No image path provided for event');
        imageElement.src = '';
        imageElement.style.display = 'none';
        overlayElement.style.background = 'rgba(0, 0, 0, 0.85)';
    }
}

/**
 * Sets up image fade-in animation
 * @param {HTMLImageElement} imageElement - Image element
 * @param {HTMLElement} overlayElement - Overlay element
 * @param {string} imagePath - Image path (null if no image)
 * @param {Function} onFadeComplete - Callback when fade completes
 * @param {number} delay - Delay before starting fade (default 600ms)
 */
export function setupImageFadeIn(imageElement, overlayElement, imagePath, onFadeComplete = null, delay = 600) {
    setTimeout(() => {
        if (imagePath) {
            // If there's an image, fade in the image directly
            imageElement.classList.add('fade-in');
            if (onFadeComplete) {
                setTimeout(onFadeComplete, 600); // Wait for fade-in to complete
            }
        } else {
            // If no image, fade in black overlay
            overlayElement.classList.add('fade-in');
            if (onFadeComplete) {
                setTimeout(onFadeComplete, 600);
            }
        }
    }, delay);
}
