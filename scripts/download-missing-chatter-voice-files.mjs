#!/usr/bin/env node
/**
 * Fast path: download chatter voice files that are named but missing on disk.
 * Uses exact File: titles derived from theater filenames (no fuzzy search).
 *
 *   node scripts/download-missing-chatter-voice-files.mjs
 *   node scripts/download-missing-chatter-voice-files.mjs --hero Freja
 *   node scripts/download-missing-chatter-voice-files.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    downloadWikiVoicelineFile,
    WIKI_USER_AGENT,
} from './lib/wiki-voiceline-download.mjs';
import { wikiTitleFromTheaterVoice } from './lib/chatter-audio.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Set<string>} */
    const onDisk = new Set(
        fs.existsSync(VOICELINES_DIR) ? fs.readdirSync(VOICELINES_DIR) : [],
    );

    /** @type {Map<string, { hero: string, voice: string, title: string }>} */
    const missing = new Map();
    for (const row of data.conversations || []) {
        if (row.entryType !== 'chatter') continue;
        const hero = String(row.name || '').trim();
        if (onlyHero && hero.toLowerCase() !== onlyHero.toLowerCase()) continue;
        for (const line of row.lines || []) {
            const voice = String(line.voice || '').trim();
            if (!voice || onDisk.has(voice) || missing.has(voice)) continue;
            const wikiName = wikiTitleFromTheaterVoice(voice);
            if (!wikiName) continue;
            missing.set(voice, { hero, voice, title: `File:${wikiName}` });
        }
    }

    console.log(`Missing theater voicelines to fetch: ${missing.size}`);
    let ok = 0;
    let fail = 0;
    let i = 0;
    for (const { hero, voice, title } of missing.values()) {
        i += 1;
        const dest = path.join(VOICELINES_DIR, voice);
        if (dryRun) {
            console.log(`[dry] ${i}/${missing.size} ${hero}: ${title}`);
            ok += 1;
            continue;
        }
        try {
            await fsp.mkdir(VOICELINES_DIR, { recursive: true });
            await downloadWikiVoicelineFile(title, dest);
            if (fs.existsSync(dest)) {
                onDisk.add(voice);
                ok += 1;
                if (ok % 25 === 0 || i === missing.size) {
                    console.log(`Downloaded ${ok}/${missing.size} (at ${hero})`);
                }
            } else {
                fail += 1;
                console.warn(`Empty download: ${title}`);
            }
        } catch (err) {
            fail += 1;
            console.warn(`Fail ${hero}: ${title} — ${err.message || err}`);
        }
        // Light pacing to avoid wiki rate limits
        if (i % 10 === 0) await sleep(200);
    }

    if (!dryRun && ok > 0) {
        try {
            const assets = await scanTheaterAssets();
            await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
            console.log('Refreshed theater-assets-manifest.json');
        } catch (err) {
            console.warn('Manifest refresh failed:', err.message || err);
        }
    }

    console.log(`Done. ok=${ok} fail=${fail} UA=${WIKI_USER_AGENT}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
