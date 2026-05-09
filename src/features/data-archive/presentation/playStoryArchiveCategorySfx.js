/**
 * Data Archive category row / hub tile click — same Event Manager SFX key.
 */
export function playStoryArchiveCategorySfx() {
    const sfx = window.SoundEffectsManager;
    if (!sfx) return;
    if (sfx.sounds && sfx.sounds.eventManager) {
        sfx.play('eventManager');
        return;
    }
    if (typeof sfx.loadSound === 'function') {
        sfx.loadSound('eventManager', 'src/assets/audio/sfx/Event Manager.mp3');
        setTimeout(() => {
            if (sfx.sounds && sfx.sounds.eventManager) {
                sfx.play('eventManager');
            }
        }, 60);
    }
}
