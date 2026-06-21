#!/usr/bin/env node
/**
 * Scrape Interactions from every hero Quotes page listed in manifest.json.
 *
 * Usage:
 *   node scripts/scrape-all-wiki-interactions.mjs
 *   node scripts/scrape-all-wiki-interactions.mjs --out "C:\Users\...\interactions"
 *   node scripts/scrape-all-wiki-interactions.mjs --force
 *   node scripts/scrape-all-wiki-interactions.mjs --hero Ana
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listWikiQuotesPages } from './lib/wiki-quotes-heroes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPE_SCRIPT = path.join(__dirname, 'scrape-wiki-interactions.mjs');
const DEFAULT_OUT_DIR = 'C:\\Users\\diego\\OneDrive\\Escritorio\\interactions';
const DELAY_MS = 600;

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ outDir: string, force: boolean, dryRun: boolean, heroFilter: string }} */
    const opts = {
        outDir: DEFAULT_OUT_DIR,
        force: false,
        dryRun: false,
        heroFilter: '',
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--out' && argv[i + 1]) {
            opts.outDir = argv[++i];
        } else if (arg === '--force') {
            opts.force = true;
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--hero' && argv[i + 1]) {
            opts.heroFilter = argv[++i];
        }
    }

    return opts;
}

/**
 * @param {string} value
 * @param {number} [maxLen]
 * @returns {string}
 */
function slugify(value, maxLen = 48) {
    const slug = String(value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return (slug || 'hero').slice(0, maxLen).replace(/-+$/g, '');
}

/**
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} outDir
 * @param {string} pageTitle
 * @returns {Promise<boolean>}
 */
async function heroBatchAlreadyScraped(outDir, pageTitle) {
    const heroName = pageTitle.split('/')[0] || pageTitle;
    const heroOutDir = path.join(outDir, slugify(heroName, 32));
    try {
        await fs.access(path.join(heroOutDir, '_summary.json'));
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} input URL or page title
 * @param {string} outDir
 * @param {boolean} dryRun
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
function runSingleScrape(input, outDir, dryRun) {
    const args = [SCRAPE_SCRIPT, input, '--out', outDir];
    if (dryRun) args.push('--dry-run');

    const result = spawnSync(process.execPath, args, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
    });

    if (result.status === 0) return { ok: true };
    return {
        ok: false,
        error: result.error?.message || `exit code ${result.status ?? 'unknown'}`,
    };
}

async function main() {
    const opts = parseArgs(process.argv);
    await fs.mkdir(opts.outDir, { recursive: true });

    let pages = await listWikiQuotesPages();
    if (opts.heroFilter) {
        const needle = opts.heroFilter.trim().toLowerCase();
        pages = pages.filter(
            (entry) =>
                entry.heroId.toLowerCase() === needle ||
                entry.pageTitle.toLowerCase().startsWith(`${needle}/`) ||
                slugify(entry.heroId) === slugify(needle),
        );
        if (pages.length === 0) {
            throw new Error(`No manifest hero matched --hero "${opts.heroFilter}"`);
        }
    }

    console.log(`Hero Quotes pages: ${pages.length}`);
    console.log(`Output: ${opts.outDir}`);
    console.log(`Force re-scrape: ${opts.force ? 'yes' : 'no'}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

    /** @type {Array<{ heroId: string, pageTitle: string, status: string, detail?: string }>} */
    const report = [];

    for (let i = 0; i < pages.length; i++) {
        const { heroId, pageTitle, url } = pages[i];
        console.log(`\n[${i + 1}/${pages.length}] ${heroId} — ${url}`);

        if (!opts.force && (await heroBatchAlreadyScraped(opts.outDir, pageTitle))) {
            console.log('  (skip) already scraped — use --force to re-download');
            report.push({ heroId, pageTitle, status: 'skipped-existing' });
            continue;
        }

        const result = runSingleScrape(url, opts.outDir, opts.dryRun);
        if (result.ok) {
            report.push({ heroId, pageTitle, status: opts.dryRun ? 'dry-run-ok' : 'scraped' });
        } else {
            const detail = result.error || 'scrape failed';
            console.error(`  ✗ ${detail}`);
            report.push({ heroId, pageTitle, status: 'failed', detail });
        }

        if (i < pages.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    const summaryPath = path.join(opts.outDir, '_scrape-all-summary.json');
    if (!opts.dryRun) {
        await fs.writeFile(
            summaryPath,
            `${JSON.stringify(
                {
                    scrapedAt: new Date().toISOString(),
                    outDir: opts.outDir,
                    heroCount: pages.length,
                    results: report,
                },
                null,
                2,
            )}\n`,
            'utf8',
        );
    }

    const scraped = report.filter((row) => row.status === 'scraped' || row.status === 'dry-run-ok').length;
    const skipped = report.filter((row) => row.status === 'skipped-existing').length;
    const failed = report.filter((row) => row.status === 'failed').length;

    console.log('\n--- Scrape all summary ---');
    console.log(`Scraped: ${scraped}`);
    console.log(`Skipped (existing): ${skipped}`);
    console.log(`Failed: ${failed}`);
    if (!opts.dryRun) {
        console.log(`Report: ${summaryPath}`);
    }

    if (failed > 0) {
        console.log('\nFailed heroes:');
        for (const row of report.filter((entry) => entry.status === 'failed')) {
            console.log(`  ${row.heroId}: ${row.detail || 'unknown error'}`);
        }
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
