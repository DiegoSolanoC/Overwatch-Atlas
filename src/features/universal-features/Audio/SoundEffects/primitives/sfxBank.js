/**
 * sfxBank — pre-baked SFX manifest plus the per-clip volume / playback-rate
 * rules used by `SoundEffectsService`.
 *
 * Each entry maps a stable key (read from 50+ call sites via
 * `window.SoundEffectsManager.play('<key>')`) to its file under
 * `src/assets/audio/sfx/`. Optional `volumeMultiplier` and `playbackRate`
 * are applied at LOAD time (so the slider keeps the right ratio).
 *
 * `PLAY_VOLUME_MULTIPLIER` is a separate map of attenuations applied at
 * PLAY time (master volume × this multiplier). A few clips are listed in
 * both because they ship pre-attenuated AND want extra pull-down on play
 * (`filterConfirm` is the historical example).
 */

export const SFX_ROOT = 'src/assets/audio/sfx/';

/**
 * @typedef {{ name: string, file: string, volumeMultiplier?: number, playbackRate?: number }} SfxBankEntry
 */

/** @type {SfxBankEntry[]} */
export const SOUND_EFFECTS_BANK = [
    { name: 'filterPick', file: 'Filter Pick.mp3' },
    { name: 'filterOff', file: 'Filter Off.mp3' },
    { name: 'filterConfirm', file: 'Filter Confirm.mp3', volumeMultiplier: 0.5 },
    { name: 'filterClear', file: 'Filter Clear.mp3' },
    { name: 'radiate', file: 'Radiate.mp3' },
    { name: 'page', file: 'Page.mp3' },
    { name: 'eventClick', file: 'Event Click.mp3' },
    { name: 'music', file: 'Music.mp3' },
    { name: 'hackOn', file: 'Hack On.mp3' },
    { name: 'hackOff', file: 'Hack Off.mp3' },
    { name: 'transportToggle', file: 'Transport Toggle.mp3' },
    { name: 'weather', file: 'Weather.mp3' },
    { name: 'rotationToggle', file: 'Rotation Toggle.mp3' },
    { name: 'eventManager', file: 'Event Manager.mp3' },
    { name: 'switchEvent', file: 'Switch Event.mp3' },
    { name: 'filterButton', file: 'Filter Button.mp3' },
    { name: 'colorChange', file: 'Color Change.mp3' },
    { name: 'modeSwitch', file: 'Mode Switch.mp3' },
    { name: 'switchMap', file: 'Switch Map.mp3' },
    { name: 'imageDisplay', file: 'Image Display.mp3' },
    { name: 'spacePanelOn', file: 'Space Panel On.mp3' },
    { name: 'spacePanelOff', file: 'Space Panel Off.mp3' },
    { name: 'nodeSelect', file: 'Node Select.mp3', volumeMultiplier: 0.1, playbackRate: 1.7 }
];

/** Extra attenuation applied at `play()` time (master volume is still `service.volume`). */
const PLAY_VOLUME_MULTIPLIER = {
    filterConfirm: 0.5,
    hackOn: 0.85,
    hackOff: 0.85,
    page: 0.4,
    spacePanelOn: 0.1,
    spacePanelOff: 0.1
};

/** @param {string} name */
export function getPlayVolumeMultiplier(name) {
    return PLAY_VOLUME_MULTIPLIER[name] ?? 1;
}
