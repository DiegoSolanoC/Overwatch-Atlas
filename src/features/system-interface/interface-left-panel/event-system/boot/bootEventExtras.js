/**
 * bootEventExtras — boot-time wiring that doesn't belong on `EventManager` itself.
 *
 * Three steps called once from `EventsLoaders.loadEvents` after the manager is constructed:
 *   - `loadEventSoundEffects`      — ensure the shared SFX bank is ready (do not re-register).
 *   - `initializeFilterPanel`      — kicks `FilterService.init()` once the panel DOM exists.
 *   - `setupEventListenersDelayed` — deferred panel/button listener wiring, post-mount.
 */

/**
 * Filter / event SFX already live in `SOUND_EFFECTS_BANK`. Re-calling
 * `loadSound` used to replace in-flight `Audio` elements and log false
 * "Error loading sound filterPick…" after Event System mounted.
 */
export function loadEventSoundEffects() {
  if (window.SoundEffectsManager && typeof window.SoundEffectsManager.init === 'function') {
    window.SoundEffectsManager.init();
  }
}

/**
 * @param {(message: string, level?: string) => void} updateStatus
 */
export function initializeFilterPanel(updateStatus) {
  updateStatus("Initializing filter panel...", "info");
  if (window.FilterService && typeof window.FilterService.init === "function") {
    window.FilterService.init();
    updateStatus("✓ Filter panel initialized", "success");
  } else {
    updateStatus(
      "⚠ FilterService not found - filter panel may not work",
      "error",
    );
  }
}

/**
 * @param {Object} eventManager EventManager instance
 * @param {(em: Object) => void} setupEventManagerListeners
 */
export function setupEventListenersDelayed(
  eventManager,
  setupEventManagerListeners,
) {
  if (eventManager) {
    setTimeout(() => {
      setupEventManagerListeners(eventManager);
    }, 50);
  }
}
