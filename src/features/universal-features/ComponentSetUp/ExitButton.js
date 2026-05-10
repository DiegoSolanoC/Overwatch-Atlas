/**
 * ExitButton — creates the absolute-positioned exit button shown inside heavy
 * modes (Globe / Codex / Bios) and wires its click handler.
 *
 * Clicking it: plays the mode-switch SFX, clears the persisted current mode,
 * and awaits the caller-supplied `killGlobeComponents` (or equivalent kill
 * routine) under the run-operation flag so the loading overlay is held for
 * the full teardown.
 *
 * Sole consumer: `BootUp/loaders/ControlsLoaders.js`.
 */

import { updateStatus } from '../managers/StatusManager.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../managers/LoadingOverlayManager.js';
import { clearCurrentMode } from './CurrentModeStatus.js';

/**
 * Creates and sets up the exit button
 * @param {Function} setIsRunOperation - Function to set run operation flag
 * @param {Function} killGlobeComponents - Function to kill globe components
 * @returns {HTMLElement|null} - The created exit button or null if already exists
 */
export function createExitButton(setIsRunOperation, killGlobeComponents) {
    if (document.getElementById('exitButton')) {
        console.log('[Exit Button] Button already exists, skipping creation');
        return document.getElementById('exitButton'); // Return existing button
    }
    
    const contentEl = document.getElementById('content');
    if (!contentEl) {
        console.error('[Exit Button] Content element not found!');
        updateStatus('✗ Error: Content element not found for exit button', 'error');
        return null;
    }
    
    updateStatus('Adding exit button...', 'info');
    const exitBtn = document.createElement('button');
    exitBtn.id = 'exitButton';
    exitBtn.className = 'globe-control-btn exit-btn';
    exitBtn.style.position = 'absolute';
    exitBtn.style.top = '20px';
    exitBtn.style.right = '20px';
    exitBtn.style.bottom = 'auto';
    exitBtn.style.left = 'auto';
    exitBtn.style.zIndex = '100'; // Lower than panels (200) so it stays behind when panels slide in
    exitBtn.style.display = 'block'; // Ensure it's visible
    exitBtn.style.visibility = 'visible'; // Ensure it's visible
    exitBtn.title = 'Exit to Main Menu';
    exitBtn.innerHTML = `
        <span id="exitIcon">
            <img src="src/assets/images/Icons/Mode%20Icons/Home%20Button.png" alt="Exit" style="width: 100%; height: 100%; object-fit: contain;">
        </span>
    `;
    contentEl.appendChild(exitBtn);
    console.log('[Exit Button] Button created and appended to content element');
    updateStatus('✓ Exit button added', 'success');
    
    // Setup exit button click handler
    exitBtn.addEventListener('click', async function() {
        console.log('[Exit Button] Exit clicked, starting exit process...');
        setIsRunOperation(true);
        showLoadingOverlay();
        
        // Play mode switch sound effect
        if (window.SoundEffectsManager) {
            if (window.SoundEffectsManager.sounds && window.SoundEffectsManager.sounds['modeSwitch']) {
                window.SoundEffectsManager.play('modeSwitch');
            } else {
                window.SoundEffectsManager.loadSound('modeSwitch', 'src/assets/audio/sfx/Mode Switch.mp3');
                setTimeout(() => {
                    window.SoundEffectsManager.play('modeSwitch');
                }, 100);
            }
        }
        
        clearCurrentMode();
        updateStatus('Exiting to main menu...', 'info');
        
        try {
            await killGlobeComponents();
        } catch (error) {
            console.error('[Exit Button] Error in killGlobeComponents:', error);
        } finally {
            setIsRunOperation(false);
            hideLoadingOverlay();
        }
    });
    
    return exitBtn;
}
