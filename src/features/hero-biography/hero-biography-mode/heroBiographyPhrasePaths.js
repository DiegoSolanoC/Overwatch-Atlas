/**
 * Hero biography voiceline assets under src/assets/audio/Phrases/<heroId>/.
 */

export const HERO_BIOGRAPHY_PHRASES_ROOT = 'src/assets/audio/Phrases';

export const HERO_BIOGRAPHY_PHRASE_ICON_PATH =
    'src/assets/images/Icons/Utility%20Icons/Voicline%20Icon.png';

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|webm)$/i;

/**
 * @param {string} heroFilterKey
 * @param {string} fileName
 * @returns {string}
 */
export function buildHeroBiographyPhrasePath(heroFilterKey, fileName) {
    const heroId = String(heroFilterKey || '').trim();
    const file = String(fileName || '').trim();
    if (!heroId || !file || !AUDIO_EXT.test(file)) return '';
    return `${HERO_BIOGRAPHY_PHRASES_ROOT}/${encodeURIComponent(heroId)}/${encodeURIComponent(file)}`;
}
