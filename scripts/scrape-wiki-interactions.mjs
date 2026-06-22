#!/usr/bin/env node
/**
 * Scrape Overwatch Fandom wiki "Interactions" tables from a hero Quotes page.
 *
 * Uses the MediaWiki API (avoids Cloudflare on direct page fetch).
 * Downloads .ogg files into per-interaction folders for manual review.
 *
 * Usage:
 *   node scripts/scrape-wiki-interactions.mjs "https://overwatch.fandom.com/wiki/Anran/Quotes"
 *   node scripts/scrape-wiki-interactions.mjs "Anran/Quotes" --out "C:\Users\...\interactions"
 *   node scripts/scrape-wiki-interactions.mjs --html saved-page.html --out ./interactions
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
    extractInteractionsSection,
    fetchWikiPageHtml,
    filenameFromAudioUrl,
    parseInteractionRows,
    USER_AGENT,
    WIKI_ORIGIN,
} from './lib/wiki-interactions-table.mjs';

const DEFAULT_OUT_DIR = 'C:\\Users\\diego\\OneDrive\\Escritorio\\interactions';

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ url: string, htmlPath: string, outDir: string, dryRun: boolean }} */
    const opts = {
        url: '',
        htmlPath: '',
        outDir: DEFAULT_OUT_DIR,
        dryRun: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--out' && argv[i + 1]) {
            opts.outDir = argv[++i];
        } else if (arg === '--html' && argv[i + 1]) {
            opts.htmlPath = argv[++i];
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (!arg.startsWith('-')) {
            opts.url = arg;
        }
    }

    if (!opts.url && !opts.htmlPath) {
        throw new Error(
            'Provide a wiki URL (or page title) or --html <saved-page.html>\n\n' +
                'Example:\n' +
                '  node scripts/scrape-wiki-interactions.mjs "https://overwatch.fandom.com/wiki/Anran/Quotes"',
        );
    }

    return opts;
}

/**
 * @param {string} input
 * @returns {string}
 */
function wikiPageTitleFromInput(input) {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Empty wiki URL or page title.');

    try {
        const asUrl = new URL(trimmed);
        const wikiPath = decodeURIComponent(asUrl.pathname.replace(/^\/wiki\//, ''));
        if (!wikiPath) throw new Error('Could not parse wiki page from URL.');
        return wikiPath;
    } catch {
        return trimmed.replace(/^\/wiki\//, '');
    }
}

/**
 * @param {string} value
 * @param {number} maxLen
 * @returns {string}
 */
function slugify(value, maxLen = 48) {
    const slug = String(value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return (slug || 'interaction').slice(0, maxLen).replace(/-+$/g, '');
}

/**
 * @param {string} pageTitle
 * @returns {string}
 */
function pageHeroName(pageTitle) {
    const base = pageTitle.split('/')[0] || pageTitle;
    return base.trim() || 'Hero';
}

/**
 * @param {number} index
 * @param {string} partnerHero
 * @param {ReturnType<typeof parseInteractionRows>[number]['lines']} lines
 * @returns {string}
 */
function buildInteractionFolderName(index, partnerHero, lines) {
    const firstLine = lines.find((line) => line.subtitles)?.subtitles || '';
    const snippet = slugify(firstLine, 40);
    const partner = slugify(partnerHero, 24);
    return `${String(index).padStart(3, '0')}-${partner}-${snippet}`;
}

/**
 * @param {string} url
 * @param {string} destPath
 */
async function downloadFile(url, destPath) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Download failed HTTP ${res.status}: ${url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destPath, buffer);
}

/**
 * @param {string} dir
 */
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function main() {
    const opts = parseArgs(process.argv);
    const pageTitle = opts.url ? wikiPageTitleFromInput(opts.url) : '';
    const heroName = pageTitle ? pageHeroName(pageTitle) : 'Imported';

    let html;
    if (opts.htmlPath) {
        html = await fs.readFile(opts.htmlPath, 'utf8');
    } else {
        console.log(`Fetching wiki page: ${pageTitle}`);
        html = await fetchWikiPageHtml(pageTitle);
    }

    let sectionHtml;
    try {
        sectionHtml = extractInteractionsSection(html);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(message);
        process.exitCode = 0;
        return;
    }
    const interactions = parseInteractionRows(sectionHtml);

    if (interactions.length === 0) {
        console.warn('No interaction rows found in the Interactions section.');
        process.exitCode = 0;
        return;
    }

    const heroOutDir = path.join(opts.outDir, slugify(heroName, 32));
    await ensureDir(heroOutDir);

    console.log(`Hero: ${heroName}`);
    console.log(`Output: ${heroOutDir}`);
    console.log(`Found ${interactions.length} interaction(s)\n`);

    /** @type {Array<Record<string, unknown>>} */
    const summary = [];

    for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i];
        const folderName = buildInteractionFolderName(
            i + 1,
            interaction.partnerHero,
            interaction.lines,
        );
        const interactionDir = path.join(heroOutDir, folderName);
        await ensureDir(interactionDir);

        const missingCount = interaction.lines.filter((line) => line.audioMissing).length;
        const downloadCount = interaction.lines.filter((line) => line.audioUrl).length;

        console.log(`[${i + 1}/${interactions.length}] ${folderName}`);
        console.log(`  Partner: ${interaction.partnerHero}`);
        console.log(`  Lines: ${interaction.lines.length}, downloads: ${downloadCount}, missing audio: ${missingCount}`);

        /** @type {Array<Record<string, unknown>>} */
        const lineRecords = [];

        for (const line of interaction.lines) {
            const record = {
                hero: line.hero,
                subtitles: line.subtitles,
                voiceFile: line.voiceFile,
                audioUrl: line.audioUrl,
                audioMissing: line.audioMissing,
                downloaded: false,
            };

            if (line.audioUrl && line.voiceFile) {
                const dest = path.join(interactionDir, line.voiceFile);
                if (opts.dryRun) {
                    console.log(`  (dry-run) would download ${line.voiceFile}`);
                } else {
                    try {
                        await downloadFile(line.audioUrl, dest);
                        record.downloaded = true;
                        console.log(`  ✓ ${line.voiceFile}`);
                    } catch (err) {
                        record.downloadError = err instanceof Error ? err.message : String(err);
                        console.log(`  ✗ ${line.voiceFile} — ${record.downloadError}`);
                    }
                }
            } else if (line.audioMissing) {
                console.log(`  — missing audio for ${line.hero}: ${line.subtitles.slice(0, 60)}`);
            }

            lineRecords.push(record);
        }

        const manifest = {
            sourcePage: pageTitle ? `${WIKI_ORIGIN}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}` : opts.htmlPath,
            pageHero: heroName,
            partnerHero: interaction.partnerHero,
            folder: folderName,
            scrapedAt: new Date().toISOString(),
            lineCount: interaction.lines.length,
            missingAudioCount: missingCount,
            paths: Array.isArray(interaction.paths) && interaction.paths.length > 0 ? interaction.paths : undefined,
            lines: lineRecords,
        };

        if (!opts.dryRun) {
            await fs.writeFile(
                path.join(interactionDir, 'interaction.json'),
                `${JSON.stringify(manifest, null, 2)}\n`,
                'utf8',
            );
        }

        summary.push({
            folder: folderName,
            partnerHero: interaction.partnerHero,
            lineCount: interaction.lines.length,
            missingAudioCount: missingCount,
        });
    }

    const summaryPath = path.join(heroOutDir, '_summary.json');
    if (!opts.dryRun) {
        await fs.writeFile(
            summaryPath,
            `${JSON.stringify(
                {
                    sourcePage: pageTitle
                        ? `${WIKI_ORIGIN}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`
                        : opts.htmlPath,
                    pageHero: heroName,
                    scrapedAt: new Date().toISOString(),
                    interactionCount: interactions.length,
                    interactions: summary,
                },
                null,
                2,
            )}\n`,
            'utf8',
        );
    }

    console.log(`\nDone. Review files in:\n  ${heroOutDir}`);
    if (!opts.dryRun) {
        console.log(`Summary: ${summaryPath}`);
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
