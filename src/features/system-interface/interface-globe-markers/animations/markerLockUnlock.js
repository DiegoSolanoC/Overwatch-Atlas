import { getDefaultMarkerOriginalHex, EVENT_MARKER_LOCKED_HEX } from '../styling/markerColors.js';

/**
 * @param {THREE.Mesh} marker
 */
export function animateMarkerLock(marker) {
    if (!marker || !marker.userData) return;

    marker.userData.isLocked = true;

    if (marker.userData.originalScale === undefined || marker.userData.originalScale === null) {
        marker.userData.originalScale = 1.0;
    }

    if (!marker.userData.originalColor) {
        marker.userData.originalColor = getDefaultMarkerOriginalHex(marker.userData);
    }

    const startScale = marker.scale.x;
    const targetScale = 0.75 * (marker.userData.originalScale || 1.0);
    const startColor = new THREE.Color();
    if (marker.material) {
        startColor.copy(marker.material.color);
    }
    const pinLineStartColor = new THREE.Color();
    if (marker.userData.pinLine && marker.userData.pinLine.material) {
        pinLineStartColor.copy(marker.userData.pinLine.material.color);
    } else {
        pinLineStartColor.copy(startColor);
    }
    const targetColor = new THREE.Color(EVENT_MARKER_LOCKED_HEX);

    marker.userData.isAnimating = true;

    const duration = 300;
    const startTime = performance.now();

    const animate = () => {
        if (!marker.userData || !marker.userData.isAnimating || marker.userData.isLocked === false) {
            return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress * progress;

        const currentScale = startScale + (targetScale - startScale) * easeProgress;
        marker.scale.set(currentScale, currentScale, currentScale);

        if (marker.material) {
            marker.material.color.lerpColors(startColor, targetColor, easeProgress);
            marker.material.needsUpdate = true;
        }

        if (marker.userData.pinLine && marker.userData.pinLine.material) {
            marker.userData.pinLine.material.color.lerpColors(
                pinLineStartColor,
                targetColor,
                easeProgress
            );
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            marker.scale.set(targetScale, targetScale, targetScale);
            if (marker.material) {
                marker.material.color.copy(targetColor);
            }
            if (marker.userData.pinLine && marker.userData.pinLine.material) {
                marker.userData.pinLine.material.color.copy(targetColor);
            }
            marker.userData.isAnimating = false;
        }
    };

    requestAnimationFrame(animate);
}

/**
 * @param {THREE.Mesh} marker
 */
export function animateMarkerUnlock(marker) {
    if (!marker || !marker.userData) return;

    marker.userData.isLocked = false;

    const startScale = marker.scale.x;
    const originalScale = marker.userData.originalScale || 1.0;
    const startColor = new THREE.Color();
    if (marker.material) {
        startColor.copy(marker.material.color);
    }
    const restoreColor = marker.userData.originalColor
        || getDefaultMarkerOriginalHex(marker.userData);
    const targetColor = new THREE.Color(restoreColor);

    marker.userData.isAnimating = true;

    const duration = 300;
    const startTime = performance.now();

    const animate = () => {
        if (!marker.userData || !marker.userData.isAnimating || marker.userData.isLocked === true) {
            return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentScale = startScale + (originalScale - startScale) * easeProgress;
        marker.scale.set(currentScale, currentScale, currentScale);

        if (marker.material) {
            marker.material.color.lerpColors(startColor, targetColor, easeProgress);
            marker.material.needsUpdate = true;
        }

        if (marker.userData.pinLine && marker.userData.pinLine.material) {
            marker.userData.pinLine.material.color.lerpColors(
                startColor,
                targetColor,
                easeProgress
            );
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            marker.scale.set(originalScale, originalScale, originalScale);
            if (marker.material) {
                marker.material.color.copy(targetColor);
            }
            if (marker.userData.pinLine && marker.userData.pinLine.material) {
                marker.userData.pinLine.material.color.setHex(restoreColor);
            }
            marker.userData.isAnimating = false;
        }
    };

    requestAnimationFrame(animate);
}
