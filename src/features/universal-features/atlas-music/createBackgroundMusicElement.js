/**
 * createBackgroundMusicElement — mounts the persistent `<audio id="backgroundMusic">`
 * element that drives all music playback. Mounted once at boot by `MusicLoaders.loadMusic`.
 */

/**
 * @returns {HTMLAudioElement}
 */
export function createBackgroundMusicElement() {
    const audio = document.createElement('audio');
    audio.id = 'backgroundMusic';
    audio.preload = 'auto';
    audio.loop = true;
    document.body.appendChild(audio);
    return audio;
}
