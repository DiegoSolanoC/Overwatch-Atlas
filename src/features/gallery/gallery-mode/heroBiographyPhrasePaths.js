/**
 * Hero biography voiceline assets under src/assets/audio/Phrases/<heroId>/.
 * Ultimate clips may live in .../Ultimate/ (manifest paths like `Ultimate/foo.ogg`).
 */

export const HERO_BIOGRAPHY_PHRASES_ROOT = 'src/assets/audio/Phrases';

export const HERO_BIOGRAPHY_PHRASE_ICON_PATH =
    'src/assets/images/Icons/Utility%20Icons/Voicline%20Icon.png';

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|webm)$/i;

/**
 * @param {string} heroFilterKey
 * @param {string} fileName — basename or `Ultimate/basename`
 * @returns {string}
 */
export function buildHeroBiographyPhrasePath(heroFilterKey, fileName) {
    const heroId = String(heroFilterKey || '').trim();
    const file = String(fileName || '').trim().replace(/\\/g, '/');
    if (!heroId || !file || !AUDIO_EXT.test(file)) return '';
    const parts = file.split('/').filter(Boolean).map((p) => encodeURIComponent(p));
    if (!parts.length) return '';
    return `${HERO_BIOGRAPHY_PHRASES_ROOT}/${encodeURIComponent(heroId)}/${parts.join('/')}`;
}

/** Ultimate clips are twice as likely in the gallery phrase randomizer. */
export function getHeroBiographyPhraseWeight(fileName) {
    const file = String(fileName || '').replace(/\\/g, '/');
    return /(^|\/)Ultimate\//i.test(file) ? 2 : 1;
}
