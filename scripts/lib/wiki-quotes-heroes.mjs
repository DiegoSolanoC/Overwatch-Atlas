import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '../../src/data/platform/manifest.json');

/** Manifest id → Fandom wiki page title (before `/Quotes`). */
export const WIKI_TITLE_OVERRIDES = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier: 76',
};

/**
 * @param {string} heroId
 * @returns {string}
 */
export function wikiPageTitleForHero(heroId) {
    const trimmed = String(heroId || '').trim();
    const wikiTitle = WIKI_TITLE_OVERRIDES[trimmed] || trimmed;
    return `${wikiTitle}/Quotes`;
}

/**
 * @param {string} pageTitle e.g. "D.Va/Quotes"
 * @returns {string}
 */
export function wikiQuotesUrl(pageTitle) {
    const encoded = pageTitle.replace(/ /g, '_');
    return `https://overwatch.fandom.com/wiki/${encodeURIComponent(encoded)}`;
}

/**
 * @returns {Promise<string[]>}
 */
export async function loadManifestHeroIds() {
    const raw = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
    const heroes = Array.isArray(raw?.heroes) ? raw.heroes : [];
    return heroes.map((hero) => String(hero || '').trim()).filter(Boolean);
}

/**
 * @returns {Promise<Array<{ heroId: string, pageTitle: string, url: string }>>}
 */
export async function listWikiQuotesPages() {
    const heroIds = await loadManifestHeroIds();
    return heroIds.map((heroId) => {
        const pageTitle = wikiPageTitleForHero(heroId);
        return {
            heroId,
            pageTitle,
            url: wikiQuotesUrl(pageTitle),
        };
    });
}
