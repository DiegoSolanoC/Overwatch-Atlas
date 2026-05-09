/**
 * EventSlideUtilityHelpers - Utility functions for EventSlideManager
 * Extracted to reduce file size
 */

/**
 * Process and normalize image path
 */
export function processImagePath(imagePath) {
    if (!imagePath || !imagePath.trim()) return null;
    imagePath = imagePath.trim();
    
    // Handle legacy "Event Images/" format
    if (imagePath.includes('Event Images/') && !imagePath.includes('Event%20Images/')) {
        const folderPattern = /Event Images\//;
        if (folderPattern.test(imagePath)) {
            const parts = imagePath.split(/Event Images\//);
            if (parts.length === 2) {
                let filename = parts[1];
                // Decode multiple times in case it's double/triple encoded
                let previousFilename = '';
                while (filename !== previousFilename) {
                    previousFilename = filename;
                    try {
                        const decoded = decodeURIComponent(filename);
                        if (decoded !== filename) {
                            filename = decoded;
                        } else {
                            break;
                        }
                    } catch (e) {
                        break;
                    }
                }
                imagePath = `src/assets/images/Archive/Events/${encodeURIComponent(filename)}`;
            }
        }
    }
    return imagePath;
}

/**
 * Update content with fade transition
 */
export function updateContentWithFade(element, newContent, isAlreadyOpen) {
    if (!element) return;
    
    if (isAlreadyOpen) {
        element.style.transition = 'opacity 0.2s ease';
        element.style.opacity = '0';
        setTimeout(() => {
            element.innerHTML = newContent;
            setTimeout(() => {
                element.style.opacity = '1';
            }, 10);
        }, 200);
    } else {
        element.innerHTML = newContent;
        element.style.opacity = '1';
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideUtilityHelpers) {
        window.EventSlideUtilityHelpers = {};
    }
    window.EventSlideUtilityHelpers.processImagePath = processImagePath;
    window.EventSlideUtilityHelpers.updateContentWithFade = updateContentWithFade;
}
