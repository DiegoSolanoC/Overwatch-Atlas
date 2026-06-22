/**
 * Download Overwatch wiki voiceline files (namespace 6) into Dialogue Theater asset names.
 */

import fs from 'node:fs/promises';

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
