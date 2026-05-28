/**
 * WorldviewHackOverlay - Manages hacked overlay positioning and animation over glitchy text
 */

export class WorldviewHackOverlay {
    constructor() {
        // No state needed - method is stateless
    }
    
    /**
     * Show hacked image overlay over glitchy text
     */
    showHackedOverlay() {
        // Clean up any existing hacked overlays first to prevent duplicates
        const existingOverlays = document.querySelectorAll('.hacked-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        // Check if event slide is fully open (not animating)
        const eventSlide = document.getElementById('eventSlide');
        if (eventSlide) {
            const slideRect = eventSlide.getBoundingClientRect();
            // If slide is still off-screen (left < 0), wait for animation to complete
            if (slideRect.left < 0) {
                // Wait for transition to complete (300ms) plus buffer
                setTimeout(() => {
                    this.showHackedOverlay();
                }, 350);
                return;
            }
        }
        
        // Find all glitchy text containers ONLY within the event slide content
        const eventSlideContent = document.getElementById('eventSlideContent');
        if (!eventSlideContent) return;
        
        const glitchyContainers = eventSlideContent.querySelectorAll('.glitchy-text-container');
        
        if (glitchyContainers.length === 0) return;
        
        // Track which containers we've already processed to prevent duplicates
        const processedContainers = new Set();
        
        // Helper function to calculate and position overlay
        const positionOverlay = (container, index) => {
            // Prevent duplicate processing
            if (processedContainers.has(container)) {
                return;
            }
            
            const rect = container.getBoundingClientRect();
            
            // Skip if container is not visible or has zero dimensions
            // On first render, rects might be invalid, so retry if needed
            if (rect.width === 0 || rect.height === 0) {
                // Retry after a short delay if this is likely the first render
                setTimeout(() => {
                    const retryRect = container.getBoundingClientRect();
                    if (retryRect.width > 0 && retryRect.height > 0 && !processedContainers.has(container)) {
                        positionOverlay(container, index);
                    }
                }, 50);
                return;
            }
            
            // Mark as processed
            processedContainers.add(container);
            
            // Find the base text element to measure where the space is
            const baseText = container.querySelector('.glitchy-text-base');
            if (!baseText) return;
            
            // Get the text content
            const textContent = baseText.textContent || '';
            const spaceIndex = textContent.indexOf(' ');
            
            // Calculate target position (where we want the center of the image)
            let targetX, targetY;
            let oliviaRect = null;
            let colomarRect = null;
            
            // Scale image size based on container's font size for consistency
            // Get the computed font size of the container or its parent
            const containerStyle = window.getComputedStyle(container);
            const parentStyle = container.parentElement ? window.getComputedStyle(container.parentElement) : null;
            const fontSize = parseFloat(containerStyle.fontSize) || (parentStyle ? parseFloat(parentStyle.fontSize) : 18);
            
            // Base size for 18px font, scale proportionally
            const baseFontSize = 18;
            const baseImageSize = 50;
            const imageSize = (fontSize / baseFontSize) * baseImageSize;
            
            if (spaceIndex === -1 || spaceIndex === textContent.length - 1) {
                // No space or space at end - center on whole container
                targetX = rect.left + rect.width / 2;
                targetY = rect.top + rect.height / 2;
            } else {
                // Find the position of the space character and center between words
                const range = document.createRange();
                try {
                    // Find the actual text node - might be firstChild or nested
                    let textNode = baseText.firstChild;
                    while (textNode && textNode.nodeType !== Node.TEXT_NODE && textNode.firstChild) {
                        textNode = textNode.firstChild;
                    }
                    
                    // If we still don't have a text node, try nextSibling
                    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
                        textNode = baseText.childNodes[0];
                    }
                    
                    // If we found a text node, use it; otherwise use baseText directly
                    const nodeToUse = (textNode && textNode.nodeType === Node.TEXT_NODE) ? textNode : baseText;
                    
                    // Get range for "Olivia " (up to and including the space)
                    range.setStart(nodeToUse, 0);
                    range.setEnd(nodeToUse, Math.min(spaceIndex + 1, nodeToUse.textContent.length));
                    oliviaRect = range.getBoundingClientRect();
                    
                    // Get range for "Colomar" (after the space)
                    const colomarStart = Math.min(spaceIndex + 1, nodeToUse.textContent.length);
                    const colomarEnd = Math.min(textContent.length, nodeToUse.textContent.length);
                    range.setStart(nodeToUse, colomarStart);
                    range.setEnd(nodeToUse, colomarEnd);
                    colomarRect = range.getBoundingClientRect();
                    
                    // Verify rects are valid (not zero width/height) and positioned correctly
                    // Also check if words are on the same line (vertical overlap)
                    const verticalOverlap = !(oliviaRect.bottom < colomarRect.top || oliviaRect.top > colomarRect.bottom);
                    
                    if (oliviaRect.width > 0 && oliviaRect.height > 0 && 
                        colomarRect.width > 0 && colomarRect.height > 0 &&
                        oliviaRect.right <= colomarRect.right &&
                        verticalOverlap) {
                        // Words are on the same line - use precise positioning
                        // Center horizontally between the end of "Olivia " and start of "Colomar"
                        targetX = (oliviaRect.right + colomarRect.left) / 2;
                        // Use the vertical center of the text line (average of both rects)
                        const textCenterY = (oliviaRect.top + oliviaRect.bottom + colomarRect.top + colomarRect.bottom) / 4;
                        targetY = textCenterY;
                    } else {
                        // Words might be on different lines or rects are invalid
                        // Use container-based calculation for consistency
                        // If rects are invalid or out of order, fall back to container-based calculation
                        // Calculate approximate position based on text content and container width
                        const textWidth = rect.width;
                        const spacePosition = (spaceIndex / textContent.length) * textWidth;
                        targetX = rect.left + spacePosition;
                        targetY = rect.top + rect.height / 2;
                    }
                } catch (e) {
                    console.warn('Range API failed, using fallback positioning:', e);
                    // Fallback: calculate approximate position based on text content
                    const textWidth = rect.width;
                    const spacePosition = (spaceIndex / textContent.length) * textWidth;
                    targetX = rect.left + spacePosition;
                    targetY = rect.top + rect.height / 2;
                }
            }
            
            // Create hacked overlay positioned exactly like the glitch text overlay
            // Append directly to the container (position: absolute relative to container)
            const hackedOverlay = document.createElement('div');
            hackedOverlay.className = 'hacked-overlay';
            hackedOverlay.dataset.index = index;
            
            const hackedImg = document.createElement('img');
            hackedImg.src = 'src/assets/images/Misc/Hacked.png';
            hackedImg.alt = 'Hacked';
            hackedOverlay.appendChild(hackedImg);
            
            // Append directly to the container itself (exactly like glitch overlay)
            // This ensures consistent positioning for all instances
            container.appendChild(hackedOverlay);
            
            // Calculate position relative to container (not viewport)
            // The container is position: relative, so we use position: absolute
            // targetX and targetY are in viewport coordinates, so convert to container-relative
            const containerRect = container.getBoundingClientRect();
            const relativeX = targetX - containerRect.left;
            const relativeY = targetY - containerRect.top;
            
            // Add a small horizontal offset to shift image slightly to the right
            const horizontalOffset = 15; // Pixels to shift right
            const adjustedRelativeX = relativeX + horizontalOffset;
            
            // Position center of image at (adjustedRelativeX, relativeY)
            const leftPos = adjustedRelativeX - imageSize / 2;
            const topPos = relativeY - imageSize / 2;
            
            hackedOverlay.style.position = 'absolute';
            hackedOverlay.style.left = `${leftPos}px`;
            hackedOverlay.style.top = `${topPos}px`;
            hackedOverlay.style.width = `${imageSize}px`;
            hackedOverlay.style.height = `${imageSize}px`;
            hackedOverlay.style.transform = 'none';
            hackedOverlay.style.zIndex = '10000'; // Very high z-index to ensure frontmost layer
            hackedOverlay.style.pointerEvents = 'none';
            hackedOverlay.style.margin = '0';
            hackedOverlay.style.padding = '0';
            hackedOverlay.style.boxSizing = 'border-box';
            
            // Check if container is inside a paragraph with overflow restrictions
            // If the image would be clipped, temporarily adjust parent overflow
            let parent = container.parentElement;
            const adjustedParents = [];
            
            while (parent && parent !== document.body) {
                const computedStyle = window.getComputedStyle(parent);
                if (computedStyle.overflow === 'hidden' || computedStyle.overflowX === 'hidden' || 
                    computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
                    // Check if image would extend beyond parent bounds
                    const parentRect = parent.getBoundingClientRect();
                    const imageTop = targetY - imageSize / 2;
                    const imageBottom = targetY + imageSize / 2;
                    
                    if (imageTop < parentRect.top || imageBottom > parentRect.bottom) {
                        // Temporarily allow overflow to show the image
                        const originalOverflow = parent.style.overflow;
                        const originalOverflowX = parent.style.overflowX;
                        const originalOverflowY = parent.style.overflowY;
                        
                        parent.style.overflow = 'visible';
                        parent.style.overflowX = 'visible';
                        parent.style.overflowY = 'visible';
                        
                        // Store original values to restore after animation
                        adjustedParents.push({
                            element: parent,
                            overflow: originalOverflow,
                            overflowX: originalOverflowX,
                            overflowY: originalOverflowY
                        });
                    }
                }
                parent = parent.parentElement;
            }
            
            // Restore original overflow styles after the image fades out
            if (adjustedParents.length > 0) {
                setTimeout(() => {
                    adjustedParents.forEach(({ element, overflow, overflowX, overflowY }) => {
                        element.style.overflow = overflow || '';
                        element.style.overflowX = overflowX || '';
                        element.style.overflowY = overflowY || '';
                    });
                }, 800); // After fade out completes
            }
            
            // Start with opacity 0 for fade in
            hackedOverlay.style.opacity = '0';
            hackedOverlay.style.display = 'block';
            hackedOverlay.style.transition = 'opacity 0.25s ease'; // Fade in over 0.25s
            
            // Trigger fade in
            requestAnimationFrame(() => {
                hackedOverlay.style.opacity = '1';
            });
            
            // Apply glitch effect at midpoint (filter only, no transform)
            setTimeout(() => {
                // Add glitch effect class or animation
                hackedOverlay.classList.add('hacked-glitch');
            }, 250);
            
            // After 0.5 seconds total, fade out
            setTimeout(() => {
                hackedOverlay.style.transition = 'opacity 0.3s ease';
                hackedOverlay.style.opacity = '0';
                
                // Remove after fade completes
                setTimeout(() => {
                    hackedOverlay.remove();
                }, 300);
            }, 500);
        };
        
        // Call the helper function for each container
        glitchyContainers.forEach((container, index) => {
            // Use requestAnimationFrame to ensure layout is ready, especially on first render
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { // Double RAF to ensure layout is complete
                    positionOverlay(container, index);
                });
            });
        });
    }
}
