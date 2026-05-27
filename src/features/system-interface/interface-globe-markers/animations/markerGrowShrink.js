import { getDefaultMarkerOriginalHex, EVENT_MARKER_LOCKED_HEX } from '../styling/markerColors.js';

function markerAccentHex(marker) {
    const ud = marker.userData;
    if (ud && Number.isFinite(ud.originalColor)) {
        return ud.originalColor;
    }
    return getDefaultMarkerOriginalHex(ud);
}

/**
 * @param {THREE.Object3D[]} markers
 * @param {THREE.Line[]} pinLines
 * @returns {Promise<void>}
 */
export function animateMarkersGrow(markers, pinLines) {
    if (markers.length === 0 && pinLines.length === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const duration = 300;
        const startTime = performance.now();

        markers.forEach(marker => {
            if (marker.userData) {
                marker.userData.isAnimating = true;
            }
            marker.scale.set(0, 0, 0);
        });

        pinLines.forEach(line => {
            if (line.material) {
                line.material.transparent = true;
                line.material.opacity = 0;
            }
        });

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const glowProgress = Math.sin(progress * Math.PI);

            markers.forEach(marker => {
                const baseScale = (marker.userData && marker.userData.isLocked) ? 0.75 : 1.0;
                const originalScale = marker.userData && marker.userData.originalScale ? marker.userData.originalScale : 1.0;
                const targetScale = baseScale * originalScale;
                const currentScale = easeProgress * targetScale;
                marker.scale.set(currentScale, currentScale, currentScale);

                if (marker.material && marker.userData) {
                    if (marker.userData.isLocked) {
                        const startColor = new THREE.Color(markerAccentHex(marker));
                        const targetColor = new THREE.Color(EVENT_MARKER_LOCKED_HEX);
                        marker.material.color.lerpColors(startColor, targetColor, easeProgress);
                        marker.material.needsUpdate = true;

                        if (marker.userData.pinLine && marker.userData.pinLine.material) {
                            marker.userData.pinLine.material.color.lerpColors(startColor, targetColor, easeProgress);
                        }
                    } else {
                        const baseColor = new THREE.Color(markerAccentHex(marker));
                        const flashColor = new THREE.Color(0xffff00);
                        marker.material.color.lerpColors(baseColor, flashColor, glowProgress);
                        marker.material.needsUpdate = true;
                    }
                }
            });

            pinLines.forEach(line => {
                if (line.material) {
                    line.material.opacity = easeProgress;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                markers.forEach(marker => {
                    const baseScale = (marker.userData && marker.userData.isLocked) ? 0.75 : 1.0;
                    const originalScale = marker.userData && marker.userData.originalScale ? marker.userData.originalScale : 1.0;
                    const targetScale = baseScale * originalScale;
                    marker.scale.set(targetScale, targetScale, targetScale);

                    if (marker.material && marker.userData) {
                        if (marker.userData.isLocked) {
                            marker.material.color.setHex(EVENT_MARKER_LOCKED_HEX);
                        } else {
                            marker.material.color.setHex(markerAccentHex(marker));
                        }
                        marker.material.needsUpdate = true;
                    }

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

        requestAnimationFrame(animate);
    });
}

/**
 * @param {THREE.Object3D[]} markers
 * @param {THREE.Line[]} pinLines
 * @returns {Promise<void>}
 */
export function animateMarkersShrink(markers, pinLines) {
    if (markers.length === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const duration = 300;
        const startTime = performance.now();

        markers.forEach(marker => {
            if (marker.userData) {
                marker.userData.isAnimating = true;
            }
        });

        const initialScales = markers.map(marker => marker.scale.x);

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeProgress = progress * progress;
            const peakIntensity = 2.0;
            const glowProgress = Math.sin(progress * Math.PI);
            const currentIntensity = peakIntensity * glowProgress;

            markers.forEach((marker, index) => {
                const scale = initialScales[index] * (1 - easeProgress);
                marker.scale.set(scale, scale, scale);

                if (marker.material && marker.material.emissiveIntensity !== undefined) {
                    marker.material.emissiveIntensity = currentIntensity;
                    marker.material.needsUpdate = true;
                }
            });

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
