/**
 * Mutable session for Data Archive embedded mode (close button, Escape handler,
 * overlap MutationObserver, orchestrator cancel callback).
 *
 * Original DOM parent/class for `#eventsManagePanel` are tracked in
 * `event-manager-adapter/adapter-state.js` to avoid duplicating that state.
 */

export const archiveModeSession = {
    /** @type {HTMLElement|null} */
    storyArchiveDetachedClose: null,
    /** @type {((e: KeyboardEvent) => void)|null} */
    storyArchiveHubKeyHandler: null,
    /** @type {MutationObserver|null} */
    storyArchiveObserver: null,
    /** @type {((restoreMenu?: boolean) => void | Promise<void>)|null} */
    onExitMode: null
};

export function disconnectStoryArchiveOverlapObserver() {
    if (archiveModeSession.storyArchiveObserver) {
        try {
            archiveModeSession.storyArchiveObserver.disconnect();
        } catch (_) { /* ignore */ }
        archiveModeSession.storyArchiveObserver = null;
    }
}

export function clearArchiveModeCallbacks() {
    archiveModeSession.onExitMode = null;
}
