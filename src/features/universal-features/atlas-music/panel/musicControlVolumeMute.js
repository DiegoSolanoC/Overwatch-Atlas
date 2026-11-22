/**
 * musicControlVolumeMute — volume slider + mute button listeners for `MusicControlService`.
 *
 * Mute toggles `HTMLAudioElement.muted` only — it must not zero the slider /
 * target volume. Unmute restores an audible level if the slider was at 0.
 */

function syncVolumeSliderUi(ctrl, volume) {
    const pct = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    if (ctrl.volumeSlider) ctrl.volumeSlider.value = String(pct);
    if (ctrl.volumeValue) {
        ctrl.volumeValue.textContent = `${pct}%`;
    } else {
        const volumeValueEl = document.getElementById('volumeValue');
        if (volumeValueEl) volumeValueEl.textContent = `${pct}%`;
    }
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireVolumeSlider(ctrl) {
    if (!ctrl.volumeSlider) return;

    ctrl.volumeSlider.addEventListener('input', () => {
        const volume = ctrl.volumeSlider.value / 100;
        ctrl.volumeService.setTargetVolume(volume);
        ctrl.volumeService.setVolume(volume);
        syncVolumeSliderUi(ctrl, volume);

        if (ctrl.onStateChange) ctrl.onStateChange();

        if (volume === 0 && ctrl.muteBtn) {
            ctrl.backgroundMusic.muted = true;
            ctrl.muteBtn.classList.add('active');
            ctrl.iconService.updateMuteIcon(true);
        } else if (ctrl.muteBtn) {
            if (ctrl.backgroundMusic.muted) {
                ctrl.backgroundMusic.muted = false;
            }
            ctrl.muteBtn.classList.remove('active');
            ctrl.iconService.updateMuteIcon(false);
            if (!ctrl.volumeService.isFading()) {
                ctrl.backgroundMusic.volume = volume;
            }
        }
    });
}

/** @param {import('../services/MusicControlService.js').MusicControlService} ctrl */
export function wireMuteButton(ctrl) {
    if (!ctrl.muteBtn) return;

    ctrl.muteBtn.addEventListener('click', () => {
        if (ctrl.backgroundMusic.muted) {
            const audible = ctrl.volumeService.getAudibleVolume();
            ctrl.volumeService.setTargetVolume(audible);
            syncVolumeSliderUi(ctrl, audible);
            ctrl.backgroundMusic.muted = false;
            ctrl.muteBtn.classList.remove('active');
            ctrl.iconService.updateMuteIcon(false);
            if (!ctrl.volumeService.isFading()) {
                ctrl.backgroundMusic.volume = audible;
            }
        } else {
            const target = ctrl.volumeService.getTargetVolume();
            if (target > 0) {
                ctrl.volumeService.lastAudibleVolume = target;
            }
            ctrl.backgroundMusic.muted = true;
            ctrl.muteBtn.classList.add('active');
            ctrl.iconService.updateMuteIcon(true);
            // Keep slider + target where they are — mute is independent of level.
        }

        if (ctrl.onStateChange) ctrl.onStateChange();
    });
}
