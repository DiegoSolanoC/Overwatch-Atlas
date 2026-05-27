/**
 * musicControlVolumeMute — volume slider + mute button listeners for `MusicControlService`.
 *
 * Both `wire*` functions assume the slider and button DOM refs are already
 * resolved on the control service (`ctrl.volumeSlider`, `ctrl.muteBtn`).
 */

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireVolumeSlider(ctrl) {
    if (!ctrl.volumeSlider) return;

    ctrl.volumeSlider.addEventListener('input', () => {
        const volume = ctrl.volumeSlider.value / 100;
        ctrl.volumeService.setTargetVolume(volume);
        ctrl.volumeService.setVolume(volume);

        if (ctrl.volumeValue) {
            ctrl.volumeValue.textContent = Math.round(volume * 100) + '%';
        } else {
            const volumeValueEl = document.getElementById('volumeValue');
            if (volumeValueEl) {
                volumeValueEl.textContent = Math.round(volume * 100) + '%';
            }
        }

        if (ctrl.onStateChange) ctrl.onStateChange();

        if (volume === 0 && ctrl.muteBtn) {
            ctrl.muteBtn.classList.add('active');
            ctrl.iconService.updateMuteIcon(true);
        } else if (ctrl.muteBtn) {
            if (!ctrl.backgroundMusic.muted) {
                ctrl.muteBtn.classList.remove('active');
                ctrl.iconService.updateMuteIcon(false);
            }
        }
    });
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireMuteButton(ctrl) {
    if (!ctrl.muteBtn) return;

    ctrl.muteBtn.addEventListener('click', () => {
        if (ctrl.backgroundMusic.muted) {
            ctrl.backgroundMusic.muted = false;
            ctrl.muteBtn.classList.remove('active');
            ctrl.iconService.updateMuteIcon(false);
            if (!ctrl.volumeService.isFading()) {
                ctrl.backgroundMusic.volume = ctrl.volumeService.getTargetVolume();
            }
        } else {
            ctrl.backgroundMusic.muted = true;
            ctrl.muteBtn.classList.add('active');
            ctrl.iconService.updateMuteIcon(true);
        }

        if (ctrl.onStateChange) ctrl.onStateChange();
    });
}
