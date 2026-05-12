/**
 * DOM manipulation utilities for Data Archive operations.
 */

/**
 * Create a MutationObserver for Data Archive styling.
 * @param {Function} callback - Callback to run on mutations
 * @returns {MutationObserver}
 */
export function createArchiveObserver(callback) {
    const observer = new MutationObserver(callback);
    return observer;
}

/**
 * Safely remove an element from DOM if it exists.
 * @param {string} elementId
 */
export function safeRemoveElement(elementId) {
    const element = document.getElementById(elementId);
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Wait for DOM element to be available.
 * @param {string} elementId
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<HTMLElement|null>}
 */
export function waitForElement(elementId, timeout = 5000) {
    return new Promise((resolve) => {
        const element = document.getElementById(elementId);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const foundElement = document.getElementById(elementId);
            if (foundElement) {
                observer.disconnect();
                resolve(foundElement);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
