#!/usr/bin/env node
import {
    downloadWikiVoicelineFile,
    resolveWikiFileDownloadUrl,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const UA = 'OverwatchAtlas/1.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

async function searchFiles(term) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', term);
    url.searchParams.set('srnamespace', '6');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    return ((await res.json()).query?.search || []).map((s) => s.title);
}

async function main() {
    const terms = [
        'Freja joined Talon',
        'Freja causing problems',
        'Freja surprised Talon',
        'Freja always good at causing',
    ];
    /** @type {string[]} */
    let hits = [];
    for (const term of terms) {
        const found = await searchFiles(term);
        console.log(`\n=== ${term} ===`);
        for (const h of found.slice(0, 8)) console.log(' ', h);
        hits.push(...found);
    }

    const candidates = [
        ...new Set(hits.filter((t) => /Freja/i.test(t) && /Talon|causing|surprised/i.test(t))),
        "File:Freja - I shouldn't be surprised you joined Talon. You were always good at causing problems.ogg",
        "File:Freja - I shouldn't be surprised you joined Talon. You were always good at causing problems!.ogg",
    ];

    let wikiFile = null;
    for (const title of candidates) {
        const resolved = await resolveWikiFileDownloadUrl(title);
        console.log(resolved ? `OK  ${title}` : `MISS ${title}`);
        if (resolved && !wikiFile) wikiFile = title;
    }

    if (!wikiFile) {
        // Fallback: parse Freja Quotes interactions table for audio link
        const pageUrl = new URL('https://overwatch.fandom.com/api.php');
        pageUrl.searchParams.set('action', 'parse');
        pageUrl.searchParams.set('page', 'Freja/Quotes');
        pageUrl.searchParams.set('prop', 'text');
        pageUrl.searchParams.set('format', 'json');
        const res = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
        const html = String((await res.json()).parse?.text?.['*'] || '');
        const idx = html.toLowerCase().indexOf('causing problems');
        if (idx >= 0) {
            const window = html.slice(Math.max(0, idx - 500), idx + 200);
            console.log('\nHTML window around causing problems:\n', window.replace(/\s+/g, ' ').slice(0, 800));
            const fileMatch = window.match(/File:([^"<>]+\.ogg)/i) || window.match(/data-image-name="([^"]+\.ogg)"/i);
            if (fileMatch) {
                wikiFile = fileMatch[1].startsWith('File:') ? fileMatch[1] : `File:${fileMatch[1]}`;
                console.log('Parsed wiki file:', wikiFile);
            }
        } else {
            console.log('Phrase not found on Freja/Quotes');
        }
    }

    if (!wikiFile) throw new Error('Could not resolve Freja wiki voiceline');

    const atlasName = wikiFileTitleToTheaterFilename(wikiFile);
    const dest = path.join(VOICELINES_DIR, atlasName);
    await downloadWikiVoicelineFile(wikiFile, dest);
    console.log('Downloaded', atlasName);

    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const line = raw.conversations
        .flatMap((c) => c.lines || [])
        .find((l) => String(l.subtitles || '').includes('causing problems'));
    if (!line) throw new Error('Conversation line not found');
    line.voice = atlasName;
    line.render = line.render || 'Heroic.png';

    // Friendly name while we're here
    const conv = raw.conversations.find((c) =>
        (c.lines || []).some((l) => l.id === line.id),
    );
    if (conv && /^\d+$/.test(String(conv.name || '').trim())) {
        conv.name = 'Joined Talon';
    }

    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
    const assets = await scanTheaterAssets();
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`);
    console.log('Wired Freja opening line + updated manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
