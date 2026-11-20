/**
 * loadingOverlayState — show/hide of the full-screen `#loadingOverlay`
 * plus the run-operation flag that gates re-entrant hides.
 *
 * Why the flag exists: a long mode-entry walks through several stages,
 * each of which may call `hideLoadingOverlay()` after it finishes its own
 * little ceremony. We want the overlay to stay up for the *whole* entry,
 * not flicker between stages — so callers `setRunOperation(true)` at the
 * start, and `hideLoadingOverlay()` becomes a no-op (unless `force: true`)
 * until the outer caller flips the flag back off in its `finally`.
 */

let isRunOperation = false; // Flag to track if we're in a run operation

/**
 * Set the run operation flag
 * @param {boolean} value - True if in a run operation
 */
export function setRunOperation(value) {
  isRunOperation = value;
}

/**
 * Get the run operation flag
 * @returns {boolean} - True if in a run operation
 */
export function getRunOperation() {
  return isRunOperation;
}

/**
 * Two animation frames so the overlay is painted opaque before teardown work.
 * @returns {Promise<void>}
 */
export function yieldForLoadingOverlayPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

/**
 * Show loading overlay
 * Works for both test.html and the timeline app (index.html)
 */
export function showLoadingOverlay() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) {
    /* Snap opaque — CSS transition would race chrome teardown. */
    loadingOverlay.style.transition = "none";
    loadingOverlay.style.opacity = "1";
    loadingOverlay.style.visibility = "visible";
    loadingOverlay.classList.add("active");
    /* Sync layout so the overlay is committed before the next long task. */
    void loadingOverlay.getBoundingClientRect();
  } else {
    console.warn("[Loading Overlay] Overlay element not found!");
  }
}

/**
 * Show overlay and wait until it has painted (call before killOtherModes).
 * @returns {Promise<void>}
 */
export async function showLoadingOverlayAndWait() {
  showLoadingOverlay();
  await yieldForLoadingOverlayPaint();
}

/**
 * Hide loading overlay
 * Don't hide overlay if we're in a run operation (let the run function handle it)
 * @param {{ force?: boolean }} [opts] — `force: true` always hides (e.g. Codex mode transition)
 */
export function hideLoadingOverlay(opts = {}) {
  if (!opts.force && isRunOperation) {
    return;
  }

  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) {
    /* Restore transition so fade-out still eases. */
    loadingOverlay.style.transition = "";
    loadingOverlay.classList.remove("active");
    loadingOverlay.style.opacity = "";
    loadingOverlay.style.visibility = "";
  }
}

/**
 * Resolves once the global loading overlay is down (mode-entry `finally` has run).
 * Used by Codex to defer edge redraw / filter passes that would freeze the loader.
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<void>}
 */
export function waitForLoadingOverlayInactive(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const isInactive = () => {
      if (isRunOperation) return false;
      const overlay = document.getElementById('loadingOverlay');
      return !overlay || !overlay.classList.contains('active');
    };
    if (isInactive()) {
      resolve();
      return;
    }
    const started = Date.now();
    const tick = () => {
      if (isInactive() || Date.now() - started > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
