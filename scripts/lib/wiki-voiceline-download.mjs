/**
 * Download Overwatch wiki voiceline files (namespace 6) into Dialogue Theater asset names.
 */

import fs from 'node:fs/promises';
import { coreKey } from './wiki-markup.mjs';

export const WIKI_USER_AGENT = 'OverwatchAtlas/1.0 (Dialogue Theater voiceline downloader)';

/**
 * @param {string} wikiFileTitle e.g. `File:Mizuki - Sorry, geez.ogg`
 * @returns {string} e.g. `Mizuki_-_Sorry,_geez.ogg`
 */
export function wikiFileTitleToTheaterFilename(wikiFileTitle) {
    const title = String(wikiFileTitle || '')
        .trim()
        .replace(/^File:/i, '');
    const match = title.match(/^(.+?)\s-\s(.+?)(\.ogg)$/i);
    if (!match) {
        throw new Error(`Could not parse wiki file title: ${wikiFileTitle}`);
    }
    const hero = match[1].trim().replace(/ /g, '_');
    const dialogue = match[2].trim();
    return `${hero}_-_${dialogue.replace(/ /g, '_')}.ogg`;
}

/**
 * @param {string} wikiFileTitle
 * @returns {Promise<{ url: string, wikiTitle: string }|null>}
 */
export async function resolveWikiFileDownloadUrl(wikiFileTitle) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', wikiFileTitle);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Wiki API HTTP ${res.status} for ${wikiFileTitle}`);
    }

    const json = await res.json();
    const page = Object.values(json.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url || page?.missing !== undefined) return null;

    return { url: info.url, wikiTitle: page.title };
}

/**
 * Fuzzy-find a File: page when the exact theater/wiki title is wrong.
 * @param {string} heroDisplay e.g. Ana
 * @param {string} spokenNeedle subtitle or filename dialogue part
 * @returns {Promise<string|null>} File:Title.ogg or null
 */
export async function searchWikiVoicelineTitle(heroDisplay, spokenNeedle) {
    const hero = String(heroDisplay || '').trim();
    const spoken = String(spokenNeedle || '').trim();
    if (!hero || !spoken) return null;

    const needleKey = coreKey(spoken);
    if (!needleKey) return null;

    const short = spoken.replace(/\s+/g, ' ').slice(0, 48).trim();
    const prefix = `${hero} - ${short}`;
    const allUrl = new URL('https://overwatch.fandom.com/api.php');
    allUrl.searchParams.set('action', 'query');
    allUrl.searchParams.set('list', 'allimages');
    allUrl.searchParams.set('aiprefix', prefix);
    allUrl.searchParams.set('ailimit', '20');
    allUrl.searchParams.set('format', 'json');

    try {
        const res = await fetch(allUrl, { headers: { 'User-Agent': WIKI_USER_AGENT } });
        if (res.ok) {
            const json = await res.json();
            const images = json.query?.allimages || [];
            /** @type {{ title: string, score: number } | null} */
            let best = null;
            for (const img of images) {
                const raw = String(img.title || img.name || '');
                const title = raw.startsWith('File:') ? raw : `File:${raw}`;
                const m = title.replace(/^File:/i, '').match(/^(.+?)\s-\s(.+?)(\.ogg)$/i);
                if (!m) continue;
                const k = coreKey(m[2]);
                let score = 0;
                if (k === needleKey) score = 100;
                else if (k.startsWith(needleKey) || needleKey.startsWith(k)) score = 80;
                else if (k.includes(needleKey) || needleKey.includes(k)) score = 50;
                if (!score) continue;
                if (!best || score > best.score) best = { title, score };
            }
            if (best && best.score >= 80) return best.title;
        }
    } catch {
        /* fall through */
    }

    const searchUrl = new URL('https://overwatch.fandom.com/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srnamespace', '6');
    searchUrl.searchParams.set('srlimit', '15');
    searchUrl.searchParams.set('srsearch', `${hero} ${spoken.slice(0, 60)}`);
    searchUrl.searchParams.set('format', 'json');

    const res = await fetch(searchUrl, { headers: { 'User-Agent': WIKI_USER_AGENT } });
    if (!res.ok) return null;
    const json = await res.json();
    /** @type {{ title: string, score: number } | null} */
    let best = null;
    for (const hit of json.query?.search || []) {
        const title = String(hit.title || '');
        const m = title.replace(/^File:/i, '').match(/^(.+?)\s-\s(.+?)(\.ogg)$/i);
        if (!m) continue;
        if (
            coreKey(m[1]) !== coreKey(hero)
            && !m[1].toLowerCase().includes(hero.toLowerCase())
        ) {
            continue;
        }
        const k = coreKey(m[2]);
        let score = 0;
        if (k === needleKey) score = 100;
        else if (k.startsWith(needleKey) || needleKey.startsWith(k)) score = 80;
        else if (k.includes(needleKey) || needleKey.includes(k)) score = 50;
        if (!score) continue;
        if (!best || score > best.score) best = { title, score };
    }
    return best && best.score >= 80
        ? (best.title.startsWith('File:') ? best.title : `File:${best.title}`)
        : null;
}

/**
 * @param {string} wikiFileTitle
 * @param {string} destPath
 */
export async function downloadWikiVoicelineFile(wikiFileTitle, destPath) {
    const resolved = await resolveWikiFileDownloadUrl(wikiFileTitle);
    if (!resolved) {
        throw new Error(`Wiki file not found: ${wikiFileTitle}`);
    }

    const res = await fetch(resolved.url, { headers: { 'User-Agent': WIKI_USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Download HTTP ${res.status}: ${resolved.url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destPath, buffer);
    return { destPath, bytes: buffer.length, url: resolved.url };
}
