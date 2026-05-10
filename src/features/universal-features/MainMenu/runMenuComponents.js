import {
    showLoadingOverlay,
    hideLoadingOverlay,
    setRunOperation,
    getRunOperation
} from '../managers/LoadingOverlayManager.js';
import { updateStatus } from '../managers/StatusManager.js';
import { runModeChangingProtocol } from '../ComponentSetUp/ModeChangingProtocol.js';

/**
 * Loads (if needed) and shows the main menu — the app's landing state.
 *
 * Called from `BootUp/AppInitializer.js` after universal features finish (via
 * `window.runMenuComponents`, because the boot script runs after `LoadingOrchestrator`
 * has attached globals) and from `ComponentOrchestrator.runMenuComponents()`.
 * Returning to the hub from another mode uses `restoreMainMenu` instead; it
 * does not call this function.
 *
 * @param {Object} ctx
 * @param {{ menu: boolean }} ctx.loadedComponents - Orchestrator loaded-state map.
 * @param {() => Promise<void>} ctx.loadMenu       - Loader for the menu components.
 */
export async function runMenuComponents(ctx) {
    const { loadedComponents, loadMenu } = ctx;

    const isRunOperation = getRunOperation();
    if (!isRunOperation) {
        setRunOperation(true);
        showLoadingOverlay();
    }
    updateStatus('🚀 Running Menu Components...', 'info');

    try {
        if (!loadedComponents.menu) {
            updateStatus('→ Menu not loaded, loading now...', 'info');
            await loadMenu();
        } else {
            updateStatus('→ Menu already loaded', 'info');
        }

        const testContainer = document.querySelector('.test-container');
        const menuButtons = testContainer ? testContainer.querySelector('.main-menu-buttons') : null;

        if (menuButtons) {
            menuButtons.style.display = 'flex';
            updateStatus('✓ Menu Components are running!', 'success');
            runModeChangingProtocol('menu');
        } else {
            updateStatus('⚠ Menu buttons not found', 'error');
        }
    } catch (error) {
        console.error('Error running Menu Components:', error);
        updateStatus(`✗ Error running Menu Components: ${error.message}`, 'error');
    } finally {
        setRunOperation(false);
        hideLoadingOverlay();
    }
}
