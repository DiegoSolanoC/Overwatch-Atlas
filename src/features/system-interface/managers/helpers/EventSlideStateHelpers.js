/**
 * EventSlideStateHelpers - Utilities for state synchronization in EventSlideManager
 * Extracted to reduce repetition and follow DRY principle
 */

/**
 * Sync state with UIView (for backward compatibility)
 */
export function syncStateWithUIView(uiView, state) {
    if (!uiView) return;
    if (state.currentEventMarker !== undefined) {
        uiView.currentEventMarker = state.currentEventMarker;
    }
    if (state.currentEventData !== undefined) {
        uiView.currentEventData = state.currentEventData;
    }
    if (state.currentVariantIndex !== undefined) {
        uiView.currentVariantIndex = state.currentVariantIndex;
    }
    if (state.originalCameraPosition !== undefined) {
        uiView.originalCameraPosition = state.originalCameraPosition;
    }
    if (state.originalGlobeRotation !== undefined) {
        uiView.originalGlobeRotation = state.originalGlobeRotation;
    }
}

/**
 * Reset stillness tracking
 */
export function resetStillnessTracking(uiView) {
    if (!uiView) return;
    uiView.lastCameraPosition = null;
    uiView.lastGlobeRotation = null;
    uiView.stillnessStartTime = null;
    uiView.wasDragging = false;
}

/**
 * Setup auto-rotate for event
 */
export function setupEventAutoRotate(sceneModel, marker) {
    if (!sceneModel) return null;
    const previousState = sceneModel.getAutoRotateEnabled();
    sceneModel.setAutoRotateEnabled(true);
    sceneModel.setAutoRotate(false);
    sceneModel.eventMarker = marker;
    return previousState;
}

/**
 * Restore auto-rotate state
 */
export function restoreAutoRotateState(sceneModel, previousState) {
    if (!sceneModel || previousState === null) return;
    sceneModel.eventMarker = null;
    sceneModel.setAutoRotateEnabled(previousState);
    if (previousState) {
        sceneModel.setAutoRotate(true);
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideStateHelpers) {
        window.EventSlideStateHelpers = {};
    }
    window.EventSlideStateHelpers.syncStateWithUIView = syncStateWithUIView;
    window.EventSlideStateHelpers.resetStillnessTracking = resetStillnessTracking;
    window.EventSlideStateHelpers.setupEventAutoRotate = setupEventAutoRotate;
    window.EventSlideStateHelpers.restoreAutoRotateState = restoreAutoRotateState;
}
