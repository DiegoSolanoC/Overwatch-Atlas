/**
 * universalFeaturesLifecycle — load/unload of the always-on cross-mode
 * services: Music, Palette, and the header-nav button rail.
 *
 * "Universal Features" sit above any mode and stay loaded across mode
 * switches. The orchestrator owns the mode lifecycle but doesn't need to
 * own this — the run/kill pair has no mode-specific branching, just a
 * fixed sequence over the universal loader/unloader pairs. Extracted
 * out so the orchestrator can stay focused on cross-mode coordination.
 *
 * Music loads first because the saved track needs time to buffer before
 * heavier UI work; Palette loads next so theme variables are in place
 * before any chrome paints; the header nav rail is mounted last (it's
 * synchronous) so the four mode-entry buttons (Worldview, Codex, Data
 * Archive, Home) appear once everything they depend on is ready.
 */

import { showLoadingOverlay, hideLoadingOverlay, setRunOperation, getRunOperation } from './loadingOverlayState.js';
import { updateStatus } from './statusFeed.js';

const MUSIC_SETTLE_MS = 120;
const PALETTE_SETTLE_MS = 300;

/**
 * @typedef {object} UniversalFeaturesContext
 * @property {Record<string, boolean>} loadedComponents - Orchestrator's loaded-state flag bag.
 * @property {{ music: () => Promise<void>, palette: () => Promise<void>, headerNav?: () => void }} loaders
 * @property {{ music: () => Promise<void>, palette: () => Promise<void> }} unloaders
 */

/**
 * Run the load chain. Idempotent on already-loaded features.
 *
 * @param {UniversalFeaturesContext} ctx
 * @param {object} [options]
 * @param {boolean} [options.keepOverlay=false] - If `true`, leave the loading
 *   overlay up for the next stage (e.g. `AppInitializer` chains
 *   Universal → Globe and doesn't want a menu flash between them).
 */
export async function runUniversalFeatures(ctx, options = {}) {
    const { loadedComponents, loaders } = ctx;
    const runBtn = document.getElementById('runUniversalBtn');
    if (runBtn) {
        runBtn.disabled = true;
    }

    const keepOverlay = !!options.keepOverlay;

    // The button click handler usually owns the run-operation flag + overlay.
    // If this was called directly (programmatic boot path), set them here.
    if (!getRunOperation()) {
        setRunOperation(true);
        showLoadingOverlay();
    }
    updateStatus('🚀 Starting Universal Features auto-load...', 'info');

    try {
        if (!loadedComponents.music) {
            updateStatus('→ Loading Music...', 'info');
            await loaders.music();
            await new Promise(r => setTimeout(r, MUSIC_SETTLE_MS));
        } else {
            updateStatus('→ Music already loaded, skipping...', 'info');
        }

        if (!loadedComponents.palette) {
            updateStatus('⬛ Loading Palette...', 'info');
            await loaders.palette();
            await new Promise(r => setTimeout(r, PALETTE_SETTLE_MS));
        } else {
            updateStatus('⬛ Palette already loaded, skipping...', 'info');
        }

        // Header nav rail: Worldview / Codex / Data Archive / Home.
        // (Events + Filters buttons come from Event System Load Out.)
        if (loaders.headerNav) {
            loaders.headerNav();
        }

        updateStatus('✓ Universal Features auto-load complete!', 'success');
    } catch (error) {
        console.error('Error in Universal Features auto-load:', error);
        updateStatus(`✗ Error in Universal Features auto-load: ${error.message}`, 'error');
    } finally {
        if (!keepOverlay) {
            setRunOperation(false);
            hideLoadingOverlay();
        }
        if (runBtn) {
            runBtn.disabled = false;
        }
    }
}

/**
 * Tear down universal features (palette before music: paint depends on
 * music's audio context only at boot, not at unload).
 *
 * @param {UniversalFeaturesContext} ctx
 */
export async function killUniversalFeatures(ctx) {
    const { loadedComponents, unloaders } = ctx;

    updateStatus('Killing all Universal Features...', 'info');

    if (loadedComponents.palette) {
        await unloaders.palette();
    }
    if (loadedComponents.music) {
        await unloaders.music();
    }

    updateStatus('✓ All Universal Features killed!', 'success');
}
