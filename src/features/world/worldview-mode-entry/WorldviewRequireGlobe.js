/**
 * requireGlobeBase — runtime precondition check used by Worldview-accessory
 * loaders (controls, events, transport toggles) before they attach UI or
 * behavior to the globe.
 *
 * Returns `true` only when both the orchestrator's `loadedComponents.globeBase`
 * flag and the live `window.globeController` are present. When either is
 * missing, surfaces a status-line warning, optionally flips the supplied
 * button id to the error state, and returns `false` so the caller can bail
 * out cleanly instead of crashing inside globe code.
 *
 * Lives in `world/worldview-mode-entry/` next to `GlobeBaseHelpers.js`
 * because this guard is the negative-side counterpart to that loader: one
 * sets the globe base up, the other refuses to proceed without it. No other
 * mode (Codex, Data Archive, Music, Palette) consumes this — it is
 * Worldview-specific and intentionally lives in the Worldview feature.
 */

import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { setButtonState } from '../../universal-features/atlas-shared-ui/dom/setButtonState.js';

/**
 * @param {string|null} buttonId - Optional dev/test button id to flip to error state.
 * @param {{ globeBase: boolean }} loadedComponents - Orchestrator loaded-state map.
 * @returns {boolean} `true` when globe base is mounted and ready; `false` otherwise.
 */
export function requireGlobeBase(buttonId, loadedComponents) {
    if (!loadedComponents?.globeBase || !window.globeController) {
        updateStatus('⚠ Globe base must be loaded first!', 'error');
        if (buttonId) {
            setButtonState(buttonId, 'error');
        }
        return false;
    }
    return true;
}
