/**
 * Parse Overwatch wiki Interactions table rows (shared by scrape + repair scripts).
 */

import { parseQuoteListWithRoutes } from './wiki-quote-list-parser.mjs';

export const WIKI_ORIGIN = 'https://overwatch.fandom.com';
export const USER_AGENT = 'OverwatchAtlasInteractionScraper/1.0 (local dev tool)';

/**
 * @param {string} pageTitle
 * @returns {Promise<string>}
 */
export async function fetchWikiPageHtml(pageTitle) {
    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'text');
    apiUrl.searchParams.set('redirects', '1');

    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Wiki API HTTP ${res.status} for page "${pageTitle}"`);
    }

    const json = await res.json();
    if (json.error) {
        throw new Error(`Wiki API error: ${json.error.info || json.error.code}`);
    }

    const html = json.parse?.text?.['*'];
    if (!html) {
        throw new Error(`Wiki API returned no HTML for page "${pageTitle}"`);
    }

    return html;
}

/**
 * @param {string} html
 * @param {string} sectionId
 * @returns {string}
 */
export function extractSectionByHeadingId(html, sectionId) {
    const startNeedle = `id="${sectionId}"`;
    const start = html.indexOf(startNeedle);
    if (start === -1) {
        throw new Error(`Section "${sectionId}" not found on page.`);
    }

    const afterStart = html.slice(start);
    const nextHeading = afterStart.slice(1).search(/<h2[^>]*id="/);
    if (nextHeading === -1) return afterStart;
    return afterStart.slice(0, nextHeading + 1);
}

/**
 * @param {string} audioCellHtml
 * @returns {(string|null)[]}
 */
export function extractAudioSlots(audioCellHtml) {
    return audioCellHtml
        .split(/<br\s*\/?>/i)
        .map((slot) => slot.trim())
        .filter(Boolean)
        .map((slot) => {
            const match = slot.match(/<source\s+src="([^"]+)"/i);
            return match ? match[1] : null;
        });
}

/**
 * @param {string} partnerCellHtml
 * @returns {string}
 */
export function extractPartnerHero(partnerCellHtml) {
    const linkMatch = partnerCellHtml.match(/<a[^>]+title="([^"]+)"/i);
    if (linkMatch) return linkMatch[1].trim();

    const boldMatch = partnerCellHtml.match(/<b>([^<]+)<\/b>/i);
    if (boldMatch) return boldMatch[1].trim();

    return 'Unknown';
}

/**
 * @param {string} url
 * @returns {string}
 */
export function filenameFromAudioUrl(url) {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/([^/]+)\.ogg(?:\/|$)/i);
    if (match) {
        return `${decodeURIComponent(match[1])}.ogg`;
    }

    const fallback = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'voice.ogg');
    return fallback.endsWith('.ogg') ? fallback : `${fallback}.ogg`;
}

/**
 * @param {string} sectionHtml
 * @returns {Array<{ partnerHero: string, lines: Array<{ hero: string, subtitles: string, audioUrl: string|null, voiceFile: string|null, audioMissing: boolean }>, paths: Array<{ label: string, lineIndexes: number[], variantCondition?: string }> }>}
 */
export function parseInteractionRows(sectionHtml) {
    /** @type {ReturnType<typeof parseInteractionRows>} */
    const interactions = [];
    let currentPartnerHero = 'Unknown';

    const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRe.exec(sectionHtml))) {
        const rowHtml = match[1];
        if (/<th[\s>]/i.test(rowHtml)) continue;

        const cells = [...rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
        if (cells.length < 2) continue;

        let partnerHero = currentPartnerHero;
        let quoteCellHtml;
        let audioCellHtml;

        if (cells.length >= 3) {
            partnerHero = extractPartnerHero(cells[0][2]);
            currentPartnerHero = partnerHero;
            quoteCellHtml = cells[1][2];
            audioCellHtml = cells[2][2];
        } else {
            quoteCellHtml = cells[0][2];
            audioCellHtml = cells[1][2];
        }

        const { lines: quoteLines, paths: quotePaths } = parseQuoteListWithRoutes(quoteCellHtml);
        const audioSlots = extractAudioSlots(audioCellHtml);
        if (quoteLines.length === 0) continue;

        const slotCount = Math.max(quoteLines.length, audioSlots.length);
        /** @type {ReturnType<typeof parseInteractionRows>[number]['lines']} */
        const lines = [];

        for (let i = 0; i < slotCount; i++) {
            const line = quoteLines[i];
            const audioUrl = audioSlots[i] ?? null;

            if (!line && !audioUrl) continue;

            const voiceFile = audioUrl ? filenameFromAudioUrl(audioUrl) : null;
            lines.push({
                hero: line?.hero || 'Unknown',
                subtitles: line?.subtitles || '',
                audioUrl,
                voiceFile,
                audioMissing: Boolean(line) && !audioUrl,
            });
        }

        interactions.push({
            partnerHero,
            lines,
            paths: quotePaths,
        });
    }

    return interactions;
}
