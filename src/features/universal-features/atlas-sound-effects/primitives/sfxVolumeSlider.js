/**
 * sfxVolumeSlider — wires (or refreshes) `#soundEffectsSlider` so the SFX
 * volume slider that lives inside the music panel reflects and edits the
 * service's volume.
 *
 * The DOM may not exist when the service first initializes; callers re-run
 * this each time the music panel mounts. Idempotent via a `data-` flag.
 */

/**
 * @param {{ getVolume: () => number, setVolume: (v: number) => void }} hooks
 */
export function wireSfxVolumeSlider(hooks) {
    const slider = document.getElementById('soundEffectsSlider');
    const valueLabel = document.getElementById('soundEffectsVolumeValue');

    if (!slider || !valueLabel) return;

    const valuePct = Math.round(hooks.getVolume() * 100);
    slider.value = valuePct;
    valueLabel.textContent = valuePct + '%';

    if (slider.dataset.soundEffectsBound === 'true') return;
    slider.dataset.soundEffectsBound = 'true';

    slider.addEventListener('input', () => {
        const v = slider.value / 100;
        hooks.setVolume(v);
        valueLabel.textContent = slider.value + '%';
    });
}
