/**
 * sfxVolumeSlider — wires (or refreshes) `#soundEffectsSlider` so the SFX
 * volume slider that lives inside the music panel reflects and edits the
 * service's volume.
 *
 * Document-level delegation so remounts into `#filtersPanel` stay live.
 */

/** @type {{ getVolume: () => number, setVolume: (v: number) => void } | null} */
let activeHooks = null;

/** @type {number | null} */
let previewTimer = null;

function syncSfxVolumeLabel() {
    const slider = document.getElementById('soundEffectsSlider');
    const valueLabel = document.getElementById('soundEffectsVolumeValue');
    if (!slider || !valueLabel || !activeHooks) return;
    const valuePct = Math.round(activeHooks.getVolume() * 100);
    slider.value = String(valuePct);
    valueLabel.textContent = `${valuePct}%`;
}

/**
 * @param {{ getVolume: () => number, setVolume: (v: number) => void }} hooks
 */
export function wireSfxVolumeSlider(hooks) {
    activeHooks = hooks;
    syncSfxVolumeLabel();

    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.soundEffectsVolumeDelegated === 'true') return;
    document.documentElement.dataset.soundEffectsVolumeDelegated = 'true';

    document.addEventListener('input', (event) => {
        const t = event.target;
        if (!(t instanceof HTMLInputElement) || t.id !== 'soundEffectsSlider') return;
        if (!activeHooks) return;
        const v = Number(t.value) / 100;
        activeHooks.setVolume(v);
        const valueLabel = document.getElementById('soundEffectsVolumeValue');
        if (valueLabel) valueLabel.textContent = `${t.value}%`;
        /*
         * SFX are short one-shots — without a preview, slider moves feel like
         * they "do nothing" until the next UI click. Throttle a soft tick.
         */
        if (previewTimer != null) clearTimeout(previewTimer);
        previewTimer = window.setTimeout(() => {
            previewTimer = null;
            try {
                window.SoundEffectsManager?.play?.('filterPick');
            } catch (_) {
                /* bank may still be loading */
            }
        }, 90);
    });
}
