/**
 * bootEventExtras — boot-time wiring that doesn't belong on `EventManager` itself.
 *
 * Three steps called once from `EventsLoaders.loadEvents` after the manager is constructed:
 *   - `loadEventSoundEffects`      — registers all SFX the event UI plays.
 *   - `initializeFilterPanel`      — kicks `FilterService.init()` once the panel DOM exists.
 *   - `setupEventListenersDelayed` — deferred panel/button listener wiring, post-mount.
 */

import { loadSoundEffects } from '../../../universal-features/Audio/SoundEffects/loadSoundEffects.js';

export function loadEventSoundEffects() {
    loadSoundEffects([
        { name: 'filterPick', path: 'src/assets/audio/sfx/Filter Pick.mp3' },
        { name: 'filterOff', path: 'src/assets/audio/sfx/Filter Off.mp3' },
        { name: 'filterConfirm', path: 'src/assets/audio/sfx/Filter Confirm.mp3' },
        { name: 'filterClear', path: 'src/assets/audio/sfx/Filter Clear.mp3' },
        { name: 'filterButton', path: 'src/assets/audio/sfx/Filter Button.mp3' },
        { name: 'eventClick', path: 'src/assets/audio/sfx/Event Click.mp3' },
        { name: 'eventManager', path: 'src/assets/audio/sfx/Event Manager.mp3' },
        { name: 'switchEvent', path: 'src/assets/audio/sfx/Switch Event.mp3' },
        { name: 'page', path: 'src/assets/audio/sfx/Page.mp3' }
    ], 'Loading event sound effects...');
}

/**
 * @param {(message: string, level?: string) => void} updateStatus
 */
export function initializeFilterPanel(updateStatus) {
    updateStatus('Initializing filter panel...', 'info');
    if (window.FilterService && typeof window.FilterService.init === 'function') {
        window.FilterService.init();
        updateStatus('✓ Filter panel initialized', 'success');
    } else {
        updateStatus('⚠ FilterService not found - filter panel may not work', 'error');
    }
}

/**
 * @param {Object} eventManager EventManager instance
 * @param {(em: Object) => void} setupEventManagerListeners
 */
export function setupEventListenersDelayed(eventManager, setupEventManagerListeners) {
    if (eventManager) {
        setTimeout(() => {
            setupEventManagerListeners(eventManager);
        }, 50);
    }
}
