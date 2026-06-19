/**
 * Wires `#characterVolumeSlider` in the music panel volume section.
 */

/**
 * @param {{ getVolume: () => number, setVolume: (v: number) => void }} hooks
 */
export function wireCharacterVolumeSlider(hooks) {
    const slider = document.getElementById('characterVolumeSlider');
    const valueLabel = document.getElementById('characterVolumeValue');

    if (!slider || !valueLabel) return;

    const valuePct = Math.round(hooks.getVolume() * 100);
    slider.value = String(valuePct);
    valueLabel.textContent = `${valuePct}%`;

    if (slider.dataset.characterVolumeBound === 'true') return;
    slider.dataset.characterVolumeBound = 'true';

    slider.addEventListener('input', () => {
        const v = Number(slider.value) / 100;
        hooks.setVolume(v);
        valueLabel.textContent = `${slider.value}%`;
    });
}
