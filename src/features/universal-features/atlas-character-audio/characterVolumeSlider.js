/**
 * Wires `#characterVolumeSlider` in the music panel volume section.
 * Document-level delegation so remounts into `#filtersPanel` stay live.
 */

/** @type {{ getVolume: () => number, setVolume: (v: number) => void } | null} */
let activeHooks = null;

function syncCharacterVolumeLabel() {
    const slider = document.getElementById('characterVolumeSlider');
    const valueLabel = document.getElementById('characterVolumeValue');
    if (!slider || !valueLabel || !activeHooks) return;
    const valuePct = Math.round(activeHooks.getVolume() * 100);
    slider.value = String(valuePct);
    valueLabel.textContent = `${valuePct}%`;
}

/**
 * @param {{ getVolume: () => number, setVolume: (v: number) => void }} hooks
 */
export function wireCharacterVolumeSlider(hooks) {
    activeHooks = hooks;
    syncCharacterVolumeLabel();

    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.characterVolumeDelegated === 'true') return;
    document.documentElement.dataset.characterVolumeDelegated = 'true';

    document.addEventListener('input', (event) => {
        const t = event.target;
        if (!(t instanceof HTMLInputElement) || t.id !== 'characterVolumeSlider') return;
        if (!activeHooks) return;
        const v = Number(t.value) / 100;
        activeHooks.setVolume(v);
        const valueLabel = document.getElementById('characterVolumeValue');
        if (valueLabel) valueLabel.textContent = `${t.value}%`;
    });
}
