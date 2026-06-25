/** @type {Set<() => void>} */
const openAutocompleteDismissers = new Set();

/**
 * @param {() => void} removeList
 */
export function registerAutocompleteDismiss(removeList) {
    openAutocompleteDismissers.add(removeList);
}

/**
 * @param {() => void} removeList
 */
export function unregisterAutocompleteDismiss(removeList) {
    openAutocompleteDismissers.delete(removeList);
}

/**
 * @param {() => void} [keepOpen]
 */
export function dismissOtherDialogueTheaterAutocompletes(keepOpen) {
    for (const dismiss of openAutocompleteDismissers) {
        if (dismiss !== keepOpen) dismiss();
    }
}
