/**
 * Shared MatchTalk / theater voiceline helpers for chatter repair scripts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreKey } from './wiki-markup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.join(__dirname, '..', '..');
export const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');

export const DEFAULT_EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

/** Atlas hero → MatchTalk extract folder */
export const HERO_EXTRACT_FOLDER = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Jetpack Cat': 'Jetpack Cat',
    'Junker Queen': 'Junker Queen',
    'Soldier 76': 'Soldier_ 76',
    'Wrecking Ball': 'Wrecking Ball',
    Lúcio: 'Lúcio',
    Torbjörn: 'Torbjörn',
};

/**
 * @param {string} hero
 * @returns {string}
 */
export function extractFolderForHero(hero) {
    return HERO_EXTRACT_FOLDER[hero] || hero;
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function voicelineFilenameToSubtitles(filename) {
    const basename = String(filename || '').replace(/\.ogg$/i, '');
    const sep = basename.indexOf('_-_');
    const dialogue = sep >= 0 ? basename.slice(sep + 3) : basename;
    return dialogue.replace(/_/g, ' ').trim();
}

/**
 * @param {string} hero
 * @param {string} label
 * @returns {string}
 */
export function atlasFilenameFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

/**
 * @param {string} hero
 * @param {string} needle
 * @param {string} [extractRoot]
 * @returns {{ source: string, label: string, score: number } | null}
 */
export function findMatchTalkOgg(hero, needle, extractRoot = DEFAULT_EXTRACT_ROOT) {
    const dir = path.join(extractRoot, extractFolderForHero(hero), 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const nKey = coreKey(needle);
    if (!nKey) return null;

    /** @type {{ source: string, label: string, score: number } | null} */
    let best = null;
    const walk = (abs) => {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            const labeled = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            if (!labeled) continue;
            const label = labeled[1];
            const k = coreKey(label);
            if (!k) continue;
            let score = 0;
            if (k === nKey) score = 100;
            else if (k.startsWith(nKey) || nKey.startsWith(k)) score = 80;
            else if (k.includes(nKey) || nKey.includes(k)) score = 50;
            if (!score) continue;
            if (!best || score > best.score) best = { source: full, label, score };
        }
    };
    walk(dir);
    return best;
}

/**
 * Theater filename guessed from wiki Audio template / File title.
 * @param {string} voice
 * @returns {string}
 */
export function wikiTitleFromTheaterVoice(voice) {
    const m = String(voice || '').match(/^(.+?)_-_(.+)\.ogg$/i);
    if (!m) return '';
    return `${m[1].replace(/_/g, ' ')} - ${m[2].replace(/_/g, ' ')}.ogg`;
}
