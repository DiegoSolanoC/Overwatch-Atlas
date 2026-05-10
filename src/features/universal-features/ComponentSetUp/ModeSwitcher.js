/**
 * ModeSwitcher — the public mode-switch API exposed on `window`.
 *
 * Exports `appModeSwitch(targetMode)`, the single entry point used by the
 * header hub and any cross-feature code that needs to swap modes. Given a
 * target (`'globe' | 'glossary' | 'biography' | 'menu'`, plus the alias
 * `'timeline'` for `'globe'`), this:
 *   1. Unloads the currently active mode's assets.
 *   2. Loads the target mode's assets.
 *   3. Fires the `appmodechange` event (via `broadcastModeChange`) so the
 *      rest of the app can react.
 *
 * Biography is a "coming soon" placeholder — selecting it reroutes to the
 * menu and surfaces a status-line notice. The persisted-mode value stays
 * `'menu'` in that case.
 *
 * Note on Codex / Glossary: both `'codex'` and `'glossary'` are valid values
 * for the persisted current mode (Codex is set by `CodexModeService`, while
 * Glossary is set when the orchestrator runs the glossary loader). Either
 * value resolves to the same teardown path here.
 *
 * Renamed from `appModeSwitch.js` — the file now matches its conceptual
 * role rather than the exported function it contains. Lives in
 * `ComponentSetUp/` because it's a runtime cross-mode primitive (sibling
 * to `broadcastModeChange.js` and `ModeMutualExclusion.js`), not a
 * boot-time concern. `LoadingOrchestrator` still publishes the bound
 * `appModeSwitch` on `window` so non-module callers can invoke it.
 */

import {
    getCurrentModeOrMenu,
    setCurrentMode
} from './CurrentModeStatus.js';
import { broadcastModeChange } from './broadcastModeChange.js';
import { updateStatus } from '../runtime/statusFeed.js';

const VALID_LOAD_TARGETS = new Set(['globe', 'glossary', 'biography']);

function normalizeTarget(targetMode) {
    const requested = (targetMode || '').toString().toLowerCase();
    const normalized = (requested === 'timeline') ? 'globe' : requested;
    return VALID_LOAD_TARGETS.has(normalized) ? normalized : 'menu';
}

async function unloadCurrentMode(currentMode, effectiveNext) {
    if (currentMode === 'globe') {
        await window.killGlobeComponents?.();
        return;
    }
    if (currentMode === 'codex' || currentMode === 'glossary') {
        // When switching from Codex/Glossary straight into Globe we skip
        // the explicit teardown: the Globe load path calls
        // `clearCodexShellForGlobeInit()` (see GlobeBaseHelpers.js), which
        // wipes the Codex DOM and removes the `codex-mode-active` class.
        // Calling `killGlossaryComponents` here would just duplicate work
        // and add UI flicker.
        if (effectiveNext !== 'globe') {
            await window.killGlossaryComponents?.();
        }
        return;
    }
    if (currentMode === 'biography') {
        await window.killBiographyComponents?.();
        await window.restoreMainMenu?.();
        return;
    }
    // Already in menu (or unknown); ensure menu visible.
    await window.restoreMainMenu?.();
}

async function loadTargetMode(effectiveNext) {
    if (effectiveNext === 'globe') {
        await window.runGlobeComponents?.(false);
        return;
    }
    if (effectiveNext === 'glossary') {
        await window.runGlossaryComponents?.(false);
        return;
    }
    await window.restoreMainMenu?.();
    setCurrentMode('menu');
}

export async function appModeSwitch(targetMode) {
    const next = normalizeTarget(targetMode);
    // Biography is still a placeholder — reroute to menu but remember the
    // original request so we can show the "coming soon" status message.
    const isBiographyPlaceholder = (next === 'biography');
    const effectiveNext = isBiographyPlaceholder ? 'menu' : next;
    const current = getCurrentModeOrMenu();

    try {
        await unloadCurrentMode(current, effectiveNext);
        await loadTargetMode(effectiveNext);
        if (isBiographyPlaceholder) {
            updateStatus('Biography mode is coming soon — returning to main menu.', 'info');
        }
        broadcastModeChange(effectiveNext);
    } catch (e) {
        console.error(`appModeSwitch failed transitioning ${current} -> ${effectiveNext} (requested: ${next}):`, e);
        try {
            await window.restoreMainMenu?.();
        } catch (_) { /* ignore secondary failure */ }
        broadcastModeChange('menu');
    }
}
