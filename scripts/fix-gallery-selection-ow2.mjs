#!/usr/bin/env node
/**
 * Repair gallery Selection.ogg so it uses the Overwatch 2 Hero Selected line.
 *
 * For each Phrases/<hero>/ folder:
 *   1) Read Quotes wikitext (cache or fetch)
 *   2) Take Chatter → '''Hero Selected''' (OW2 default on the main Quotes page)
 *   3) Find the matching quote-named .ogg already in the folder
 *   4) Copy it over Selection.ogg when different
 *
 * Usage:
 *   node scripts/fix-gallery-selection-ow2.mjs --dry-run
 *   node scripts/fix-gallery-selection-ow2.mjs
 *   node scripts/fix-gallery-selection-ow2.mjs --hero Tracer
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listWikiQuotesPages } from './lib/wiki-quotes-heroes.mjs';
import { ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
import {
    extractOw2HeroSelected,
    pickOw2SelectionSource,
    selectionPhraseKey,
} from './lib/gallery-selection-ow2.mjs';

ensureAuditWorkspace();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const PHRASES_ROOT = path.join(REPO, 'src', 'assets', 'audio', 'Phrases');
const WIKI_ORIGIN = 'https://overwatch.weirdgloop.org';
const USER_AGENT = 'OverwatchAtlas/1.0 (gallery Selection OW2 fix)';

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

async function fetchQuotesWikitext(pageTitle) {
    fs.mkdirSync(WIKI_QUOTES_CACHE_DIR, { recursive: true });
    const cacheFile = path.join(
        WIKI_QUOTES_CACHE_DIR,
        `${pageTitle.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`,
    );
    if (fs.existsSync(cacheFile)) {
        return { wikitext: fs.readFileSync(cacheFile, 'utf8'), fromCache: true };
    }
    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');
    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.info || json.error.code);
    const wikitext = json.parse?.wikitext?.['*'] || '';
    if (!wikitext) throw new Error('empty wikitext');
    fs.writeFileSync(cacheFile, wikitext, 'utf8');
    return { wikitext, fromCache: false };
}

async function listPhraseOggs(heroDir) {
    /** @type {string[]} */
    const out = [];
    let ents;
    try {
        ents = await fsp.readdir(heroDir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const ent of ents) {
        if (!ent.isFile() || !/\.ogg$/i.test(ent.name)) continue;
        out.push(path.join(heroDir, ent.name));
    }
    return out;
}

async function fileSha(abs) {
    const buf = await fsp.readFile(abs);
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(buf).digest('hex');
}

async function main() {
    const pages = await listWikiQuotesPages();
    const targets = onlyHero
        ? pages.filter((p) => p.heroId.toLowerCase() === onlyHero.toLowerCase())
        : pages;

    if (!targets.length) {
        console.error(onlyHero ? `No hero matched --hero ${onlyHero}` : 'No heroes in manifest');
        process.exit(1);
    }

    console.log(
        `Fix gallery Selection.ogg → OW2 Hero Selected (${dryRun ? 'DRY RUN' : 'WRITE'}) — ${targets.length} heroes`,
    );

    let updated = 0;
    let already = 0;
    let skipped = 0;
    let failed = 0;

    for (const { heroId, pageTitle } of targets) {
        const heroDir = path.join(PHRASES_ROOT, heroId);
        if (!fs.existsSync(heroDir)) {
            console.log(`[${heroId}] skip — no Phrases folder`);
            skipped += 1;
            continue;
        }

        process.stdout.write(`[${heroId}] `);
        let wikitext;
        try {
            const fetched = await fetchQuotesWikitext(pageTitle);
            wikitext = fetched.wikitext;
            process.stdout.write(fetched.fromCache ? 'cache ' : 'fetch ');
        } catch (err) {
            console.log(`FAIL wiki: ${err instanceof Error ? err.message : err}`);
            failed += 1;
            continue;
        }

        const preferred = extractOw2HeroSelected(wikitext);
        if (!preferred.spoken) {
            console.log('no Chatter Hero Selected');
            skipped += 1;
            continue;
        }

        const candidates = await listPhraseOggs(heroDir);
        const source = pickOw2SelectionSource(
            candidates,
            preferred.spoken,
            preferred.wikiAudio,
        );
        if (!source) {
            console.log(`no match for OW2 "${preferred.spoken}"`);
            skipped += 1;
            continue;
        }

        const selectionPath = path.join(heroDir, 'Selection.ogg');
        const sourceName = path.basename(source);
        if (fs.existsSync(selectionPath)) {
            const same =
                path.resolve(source) === path.resolve(selectionPath) ||
                (await fileSha(source)) === (await fileSha(selectionPath));
            if (same) {
                console.log(`ok already ← ${sourceName}`);
                already += 1;
                continue;
            }
        }

        if (dryRun) {
            console.log(`DRY Selection.ogg ← ${sourceName} ("${preferred.spoken}")`);
            updated += 1;
            continue;
        }

        await fsp.copyFile(source, selectionPath);
        console.log(`OK Selection.ogg ← ${sourceName} ("${preferred.spoken}")`);
        updated += 1;
    }

    console.log('\nDone.');
    console.log(`  updated: ${updated}`);
    console.log(`  already OW2: ${already}`);
    console.log(`  skipped: ${skipped}`);
    console.log(`  failed: ${failed}`);
    console.log(`  wantKey sample Tracer: ${selectionPhraseKey("Cheers, love! It's time to save the world.")}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
