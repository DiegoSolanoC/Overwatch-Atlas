#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Download missing setup-chatter audio using wiki {{Audio}} titles from cache.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE_DIR = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

// Reuse parser pieces by importing fill script helpers via dynamic eval of the fill file exports — duplicate minimal coreKey + parse.

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*([^*]+)\*/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

async function main() {
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Map<string, string>} spokenKey -> wiki audio title */
    const audioByKey = new Map();

    for (const file of fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.wikitext'))) {
        const text = fs.readFileSync(path.join(CACHE_DIR, file), 'utf8');
        const section = text.match(/==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i);
        if (!section) continue;
        const rows = section[1].split(/\n\|-/);
        let setup = false;
        for (const row of rows) {
            if (/'''Set-Up Chatter'''|'''During Set-Up'''|'''During Set Up'''/i.test(row)) setup = true;
            else if (/'''Match Start'''|'''Hero Selected'''|'''Respawn'''|'''Pick Up Health|'''Fully Healed'''|'''On Fire'''|'''Nano|'''Perk|'''Voted|'''Reinforcement|'''Negative|'''Discord|'''Hacked|'''Resurrect|'''Ally Ultimate|'''Damage Boost/i.test(row)) {
                setup = false;
            }
            if (!setup) continue;
            const audio = row.match(/\{\{Audio\|([^}]+)\}\}/i)?.[1]?.trim();
            if (!audio) continue;
            // quote cell
            for (const line of row.split(/\n/).map((l) => l.trim())) {
                if (!line.startsWith('|')) continue;
                if (/\{\{Audio/i.test(line)) continue;
                if (/rowspan|colspan|<center|<big|'''/i.test(line)) continue;
                let cell = line.replace(/^\|\s*/, '').trim();
                if (!cell) continue;
                cell = cell.replace(/<small>[\s\S]*?<\/small>/gi, ' ')
                    .replace(/\{\{[^}]+\}\}/g, ' ')
                    .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
                    .replace(/\[\[([^\]]+)\]\]/g, '$1')
                    .replace(/'''?/g, '')
                    .replace(/<\/?[^>]+>/g, ' ')
                    .replace(/\*([^*]+)\*/g, '($1)')
                    .replace(/\s+/g, ' ')
                    .trim();
                const key = coreKey(cell);
                if (key) audioByKey.set(key, audio);
            }
        }
    }

    let downloaded = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of data.conversations) {
        if (row.entryType !== 'chatter') continue;
        for (const line of row.lines || []) {
            const voice = String(line.voice || '').trim();
            if (!voice) {
                skipped += 1;
                continue;
            }
            const dest = path.join(VOICELINES_DIR, voice);
            if (fs.existsSync(dest)) continue;

            const key = coreKey(line.subtitles);
            let wikiAudio = audioByKey.get(key);
            if (!wikiAudio) {
                // try filename-derived title
                const m = voice.match(/^(.+?)_-_(.+)\.ogg$/i);
                if (m) wikiAudio = `${m[1].replace(/_/g, ' ')} - ${m[2].replace(/_/g, ' ')}.ogg`;
            }
            if (!wikiAudio) {
                failed += 1;
                console.warn('No wiki audio for', row.name, line.subtitles.slice(0, 60));
                continue;
            }
            const title = wikiAudio.startsWith('File:') ? wikiAudio : `File:${wikiAudio}`;
            try {
                await downloadWikiVoicelineFile(title, dest);
                if (!fs.existsSync(dest)) {
                    const alt = wikiFileTitleToTheaterFilename(title);
                    if (alt !== voice && fs.existsSync(path.join(VOICELINES_DIR, alt))) {
                        await fsp.copyFile(path.join(VOICELINES_DIR, alt), dest);
                    }
                }
                if (fs.existsSync(dest)) {
                    downloaded += 1;
                    console.log('OK', voice);
                } else {
                    failed += 1;
                    console.warn('Missing after DL', voice);
                }
            } catch (err) {
                failed += 1;
                console.warn('FAIL', title, err.message || err);
            }
        }
    }

    console.log({ downloaded, failed, skippedEmpty: skipped });
    if (downloaded > 0) await scanTheaterAssets();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
