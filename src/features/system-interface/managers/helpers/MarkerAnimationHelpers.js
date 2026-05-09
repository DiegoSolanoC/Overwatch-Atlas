/**
 * MarkerAnimationHelpers - Utilities for marker animations
 * Extracted from EventMarkerManager to reduce duplication
 */

import { getDefaultMarkerOriginalHex, EVENT_MARKER_LOCKED_HEX } from './MarkerCreationHelpers.js';

function markerAccentHex(marker) {
    const ud = marker.userData;
    if (ud && Number.isFinite(ud.originalColor)) {
        return ud.originalColor;
    }
    return getDefaultMarkerOriginalHex(ud);
}

/**
 * Animates markers growing from 0 to target scale
 * @param {Array} markers - Array of markers to animate
 * @param {Array} pinLines - Array of pin lines to animate
 * @returns {Promise} - Resolves when animation completes
 */
export function animateMarkersGrow(markers, pinLines) {
    if (markers.length === 0 && pinLines.length === 0) {
        return Promise.resolve();
    }
    
    return new Promise((resolve) => {
        const duration = 300; // 300ms animation
        const startTime = performance.now();
        
        // Mark markers as animating to prevent pulse animation interference
        markers.forEach(marker => {
            if (marker.userData) {
                marker.userData.isAnimating = true;
            }
            marker.scale.set(0, 0, 0);
        });
        
        // Ensure all pin lines start at opacity 0
        pinLines.forEach(line => {
            if (line.material) {
                line.material.transparent = true;
                line.material.opacity = 0;
            }
        });
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Brightness flash - bell curve that peaks in the middle
            const glowProgress = Math.sin(progress * Math.PI);
            
            // Animate markers growing from 0 to target scale (1.0 if unlocked, 0.75 if locked)
            markers.forEach(marker => {
                const baseScale = (marker.userData && marker.userData.isLocked) ? 0.75 : 1.0;
                const originalScale = marker.userData && marker.userData.originalScale ? marker.userData.originalScale : 1.0;
                const targetScale = baseScale * originalScale;
                const currentScale = easeProgress * targetScale;
                marker.scale.set(currentScale, currentScale, currentScale);
                
                // Animate color: if locked, animate to dark color; otherwise flash yellow
                if (marker.material && marker.userData) {
                    if (marker.userData.isLocked) {
                        // Locked: animate to dark color
                        const startColor = new THREE.Color(markerAccentHex(marker));
                        const targetColor = new THREE.Color(EVENT_MARKER_LOCKED_HEX);
                        marker.material.color.lerpColors(startColor, targetColor, easeProgress);
                        marker.material.needsUpdate = true;
                        
                        // Also animate pin line color if it exists
                        if (marker.userData.pinLine && marker.userData.pinLine.material) {
                            marker.userData.pinLine.material.color.lerpColors(startColor, targetColor, easeProgress);
                        }
                    } else {
                        // Unlocked: flash yellow during animation
                        const baseColor = new THREE.Color(markerAccentHex(marker));
                        const flashColor = new THREE.Color(0xffff00); // Yellow
                        marker.material.color.lerpColors(baseColor, flashColor, glowProgress);
                        marker.material.needsUpdate = true;
                    }
                }
            });
            
            // Animate pin lines fading in
            pinLines.forEach(line => {
                if (line.material) {
                    line.material.opacity = easeProgress;
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure final scale is correct (1.0 if unlocked, 0.75 if locked)
                markers.forEach(marker => {
                    const baseScale = (marker.userData && marker.userData.isLocked) ? 0.75 : 1.0;
                    const originalScale = marker.userData && marker.userData.originalScale ? marker.userData.originalScale : 1.0;
                    const targetScale = baseScale * originalScale;
                    marker.scale.set(targetScale, targetScale, targetScale);
                    
                    // Set final color
                    if (marker.material && marker.userData) {
                        if (marker.userData.isLocked) {
                            // Locked: dark color
                            marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
                        } else {
                            marker.material.color.setHex(markerAccentHex(marker));
                        }
                        marker.material.needsUpdate = true;
                    }
                    
                    // Clear animation flag to allow pulse animation to resume
                    if (marker.userData) {
                        marker.userData.isAnimating = false;
                    }
                });
                
                pinLines.forEach(line => {
                    if (line.material) {
                        line.material.opacity = 1;
                        const m = line.userData && line.userData.marker;
                        if (m && m.userData) {
                            if (m.userData.isLocked) {
                                line.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
                            } else {
                                line.material.color.setHex(markerAccentHex(m));
                            }
                        }
                    }
                });
                resolve();
            }
        };
        
        // Start animation immediately (markers are already added to scene)
        requestAnimationFrame(animate);
    });
}

/**
 * Animates markers shrinking to 0
 * @param {Array} markers - Array of markers to animate
 * @param {Array} pinLines - Array of pin lines to animate
 * @returns {Promise} - Resolves when animation completes
 */
export function animateMarkersShrink(markers, pinLines) {
    if (markers.length === 0) {
        return Promise.resolve();
    }
    
    return new Promise((resolve) => {
        const duration = 300; // 300ms animation
        const startTime = performance.now();
        
        // Mark markers as animating to prevent pulse animation interference
        markers.forEach(marker => {
            if (marker.userData) {
                marker.userData.isAnimating = true;
            }
        });
        
        // Store initial scales
        const initialScales = markers.map(marker => marker.scale.x);
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease in)
            const easeProgress = progress * progress;
            
            // Brightness flash - bell curve that peaks in the middle
            const peakIntensity = 2.0; // Yellow glow peak
            const glowProgress = Math.sin(progress * Math.PI);
            const currentIntensity = peakIntensity * glowProgress;
            
            // Animate scale from current to 0
            markers.forEach((marker, index) => {
                const scale = initialScales[index] * (1 - easeProgress);
                marker.scale.set(scale, scale, scale);
                
                // Animate emissive intensity (yellow flash)
                if (marker.material && marker.material.emissiveIntensity !== undefined) {
                    marker.material.emissiveIntensity = currentIntensity;
                    marker.material.needsUpdate = true;
                }
            });
            
            // Also shrink pin lines (opacity fade)
            pinLines.forEach(line => {
                if (line.material) {
                    line.material.opacity = 1 - easeProgress;
                    line.material.transparent = true;
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        };
        
        requestAnimationFrame(animate);
    });
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.MarkerAnimationHelpers) {
        window.MarkerAnimationHelpers = {};
    }
    window.MarkerAnimationHelpers.animateMarkersGrow = animateMarkersGrow;
    window.MarkerAnimationHelpers.animateMarkersShrink = animateMarkersShrink;
}
