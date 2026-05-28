/**
 * ModeSwitcher — the public mode-switch API exposed on `window`.
 *
 * Exports `appModeSwitch(targetMode)`, the single entry point used by the
 * header hub and any cross-feature code that needs to swap modes.
 */

import { ATLAS_MODE, isAtlasMode, normalizeAtlasMode } from '../atlasModes.js';
import {
    getCurrentModeOrMenu,
    setCurrentMode,
} from './CurrentModeStatus.js';
import { broadcastModeChange } from './broadcastModeChange.js';
import { killPlaceholderModeIfActive } from '../../atlas-header/triggerHomeExit.js';

const VALID_LOAD_TARGETS = new Set([
    ATLAS_MODE.WORLD,
    ATLAS_MODE.CODEX,
    ATLAS_MODE.DATA_WORKSHOP,
]);

function normalizeTarget(targetMode) {
    const requested = normalizeAtlasMode(targetMode);
    return VALID_LOAD_TARGETS.has(requested) ? requested : ATLAS_MODE.MENU;
}

async function unloadCurrentMode(currentMode, effectiveNext) {
    if (await killPlaceholderModeIfActive(currentMode)) {
        return;
    }

    if (isAtlasMode(currentMode, ATLAS_MODE.WORLD)) {
        await window.killWorldComponents?.();
        return;
    }
    if (isAtlasMode(currentMode, ATLAS_MODE.CODEX)) {
        if (effectiveNext !== ATLAS_MODE.WORLD) {
            await window.killCodexComponents?.();
        }
        return;
    }
    if (isAtlasMode(currentMode, ATLAS_MODE.DATA_WORKSHOP)) {
        await window.killDataWorkshopComponents?.();
        await window.restoreMainMenu?.();
        return;
    }
    await window.restoreMainMenu?.();
}

async function loadTargetMode(effectiveNext) {
    if (effectiveNext === ATLAS_MODE.WORLD) {
        await window.runWorldComponents?.(false);
        return;
    }
    if (effectiveNext === ATLAS_MODE.CODEX) {
        await window.runCodexComponents?.(false);
        return;
    }
    await window.restoreMainMenu?.();
    setCurrentMode(ATLAS_MODE.MENU);
}

export async function appModeSwitch(targetMode) {
    const next = normalizeTarget(targetMode);
    const current = getCurrentModeOrMenu();

    try {
        await unloadCurrentMode(current, next);
        await loadTargetMode(next);
        broadcastModeChange(next);
    } catch (e) {
        console.error(`appModeSwitch failed transitioning ${current} -> ${next}:`, e);
        try {
            await window.restoreMainMenu?.();
        } catch (_) { /* ignore secondary failure */ }
        broadcastModeChange(ATLAS_MODE.MENU);
    }
}
