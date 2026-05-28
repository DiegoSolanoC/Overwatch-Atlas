/**
 * Session callbacks for Story mode (orchestrator exit, Escape).
 */

export const storyModeSession = {
    /** @type {((restoreMenu?: boolean) => void | Promise<void>)|null} */
    onExitMode: null,
};

/** @deprecated Use {@link storyModeSession} */
export const storyTimelineModeSession = storyModeSession;

export function clearStoryModeCallbacks() {
    storyModeSession.onExitMode = null;
}

/** @deprecated Use {@link clearStoryModeCallbacks} */
export const clearStoryTimelineModeCallbacks = clearStoryModeCallbacks;
