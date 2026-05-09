/**
 * ExitButtonHelpers - Utilities for creating exit button
 * Extracted from ComponentLoaderService to reduce inline logic
 */

/**
 * Creates and sets up the exit button with click handler
 * @param {Object} params - Parameters
 * @param {Object} params.overlayService - Overlay service
 * @param {Object} params.statusService - Status service
 * @returns {HTMLElement|null} - The created exit button or null if already exists
 */
export function createExitButton({ overlayService, statusService }) {
    if (document.getElementById('exitButton')) {
        return document.getElementById('exitButton');
    }
    
    statusService.update('Adding exit button...', 'info');
    const exitBtn = document.createElement('button');
    exitBtn.id = 'exitButton';
    exitBtn.className = 'globe-control-btn exit-btn';
    exitBtn.style.position = 'absolute';
    exitBtn.style.top = '20px';
    exitBtn.style.right = '20px';
    exitBtn.style.bottom = 'auto';
    exitBtn.style.left = 'auto';
    exitBtn.style.zIndex = '100'; // Lower than panels (200) so it stays behind when panels slide in
    exitBtn.title = 'Exit to Main Menu';
    exitBtn.innerHTML = `
        <span id="exitIcon">
            <img src="src/assets/images/Icons/Mode%20Icons/Home%20Button.png" alt="Exit" style="width: 100%; height: 100%; object-fit: contain;">
        </span>
    `;
    document.getElementById('content').appendChild(exitBtn);
    statusService.update('✓ Exit button added', 'success');
    
    // Setup exit button click handler
    exitBtn.addEventListener('click', async () => {
        overlayService.setRunOperation(true);
        overlayService.show();
        
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
        
        localStorage.removeItem('currentMode');
        statusService.update('Exiting to main menu...', 'info');
        
        try {
            if (window.killGlobeComponents) {
                await window.killGlobeComponents();
            }
        } catch (error) {
            console.error('[Exit Button] Error in killGlobeComponents:', error);
        } finally {
            overlayService.setRunOperation(false);
            overlayService.hide();
        }
    });
    
    return exitBtn;
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceExitButtonHelpers) {
        window.ServiceExitButtonHelpers = {};
    }
    window.ServiceExitButtonHelpers.createExitButton = createExitButton;
}
