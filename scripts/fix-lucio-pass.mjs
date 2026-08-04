#!/usr/bin/env node
/**
 * Lúcio pass — missing interactions:
 * - Written Lyrics (Brigitte ↔ Lúcio)
 * - Enough Bass (Kiriko ↔ Lúcio)
 * - Antler Antler (Kiriko ↔ Lúcio)
 * - Relying On Each Other (Mercy ↔ Lúcio)
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import {
    downloadWikiVoicelineFile,
    resolveWikiFileDownloadUrl,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const HERO_FOLDER = {
    Lúcio: 'Lúcio',
};

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findOgg(heroFolder, needle) {
    const dir = path.join(EXTRACT_ROOT, heroFolder, 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const n = needle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    /** @type {{ source: string, label: string, score: number }[]} */
    const hits = [];
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm === n) hits.push({ source: path.join(dir, name), label, score: 0 });
        else if (norm.includes(n)) {
            hits.push({
                source: path.join(dir, name),
                label,
                score: 1 + Math.abs(norm.length - n.length),
            });
        }
    }
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

async function copyVoice(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const hit = findOgg(folder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function ensureWiki(wikiTitle) {
    const resolved = await resolveWikiFileDownloadUrl(wikiTitle);
    if (!resolved) throw new Error(`Wiki file not found: ${wikiTitle}`);
    const atlas = wikiFileTitleToTheaterFilename(wikiTitle);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) {
        await downloadWikiVoicelineFile(wikiTitle, dest);
        console.log(`  downloaded ${atlas}`);
    }
    return atlas;
}

async function copyVoiceOrWiki(hero, needle, wikiTitles) {
    try {
        return await copyVoice(hero, needle);
    } catch {
        const list = Array.isArray(wikiTitles) ? wikiTitles : [wikiTitles];
        for (const title of list) {
            if (!title) continue;
            const resolved = await resolveWikiFileDownloadUrl(title);
            if (!resolved) continue;
            return ensureWiki(title);
        }
        return '';
    }
}

function makeLine(hero, subtitles, voice, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

function hasSubtitle(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.some((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

/**
 * @param {object} conv
 * @param {string} label
 */
function finalizeConv(conv, label, done) {
    for (const line of conv.lines) {
        if (line.voice && !fs.existsSync(path.join(VOICELINES_DIR, line.voice))) {
            line.voice = '';
        }
    }
    done.push(
        `${label} (${conv.id}) — voices: ${conv.lines.map((l) => (l.voice ? 'yes' : 'pending')).join('/')}`,
    );
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // --- Written Lyrics ---
    {
        if (hasSubtitle(conversations, 'written lyrics before')) {
            console.log('skip (exists): Written Lyrics');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Written Lyrics';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Brigitte',
                    'Lúcio, have you ever written lyrics before?',
                    await copyVoiceOrWiki('Brigitte', 'written lyrics before', [
                        'File:Brigitte - Lúcio, have you ever written lyrics before.ogg',
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    "I've dabbled a bit. What's up?",
                    await copyVoiceOrWiki('Lúcio', "I've dabbled a bit", [
                        "File:Lúcio - I've dabbled a bit. What's up.ogg",
                    ]),
                ),
                makeLine(
                    'Brigitte',
                    "I was wondering if you would look at... Actually, I'm going to work on it a bit more.",
                    await copyVoiceOrWiki('Brigitte', 'work on it a bit more', [
                        "File:Brigitte - I was wondering if you would look at... Actually, I'm going to work on it a bit more.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            finalizeConv(conv, 'Written Lyrics', done);
        }
    }

    // --- Enough Bass ---
    {
        if (hasSubtitle(conversations, 'enough bass')) {
            console.log('skip (exists): Enough Bass');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Enough Bass';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    'Listened to your album the other day.',
                    await copyVoiceOrWiki('Kiriko', 'Listened to your album', [
                        'File:Kiriko - Listened to your album the other day.ogg',
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    'Oh, uh... did you like it?',
                    await copyVoiceOrWiki('Lúcio', 'did you like it', [
                        'File:Lúcio - Oh, uh, did you like it.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    'Not sure there was enough bass. I could almost hear the other sounds.',
                    await copyVoiceOrWiki('Kiriko', 'enough bass', [
                        'File:Kiriko - Not sure there was enough bass. I could almost hear the other sounds.ogg',
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    "Ha! I'll crank it up next time.",
                    await copyVoiceOrWiki('Lúcio', 'crank it up next time', [
                        "File:Lúcio - Ha! I'll crank it up next time.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            finalizeConv(conv, 'Enough Bass', done);
        }
    }

    // --- Antler Antler ---
    {
        if (hasSubtitle(conversations, 'Antler Antler')) {
            console.log('skip (exists): Antler Antler');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Antler Antler';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    'You check out the new Antler Antler album?',
                    await copyVoiceOrWiki('Kiriko', 'Antler Antler album', [
                        'File:Kiriko - You check out the new Antler Antler album.ogg',
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    "You've heard of them?",
                    await copyVoiceOrWiki('Lúcio', "You've heard of them", [
                        "File:Lúcio - You've heard of them.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Yeah. So... what'd you think?",
                    await copyVoiceOrWiki('Kiriko', "what'd you think", [
                        "File:Kiriko - Yeah. So... what'd you think.ogg",
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    'Nobody uses fifteen electric guitars like those guys!',
                    await copyVoiceOrWiki('Lúcio', 'fifteen electric guitars', [
                        'File:Lúcio - Nobody uses fifteen electric guitars like those guys.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            finalizeConv(conv, 'Antler Antler', done);
        }
    }

    // --- Relying On Each Other ---
    {
        if (hasSubtitle(conversations, 'relying on each other')) {
            console.log('skip (exists): Relying On Each Other');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Relying On Each Other';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mercy',
                    "You've come a long way since joining Overwatch. I'm thankful to have your support.",
                    await copyVoiceOrWiki('Mercy', 'thankful to have your support', [
                        "File:Mercy - You've come a long way since joining Overwatch. I'm thankful to have your support.ogg",
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    "Aw, back at'cha! It's all about relying on each other.",
                    await copyVoiceOrWiki('Lúcio', "back at'cha", [
                        "File:Lúcio - Aw, back at'cha! It's all about relying on each other.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            finalizeConv(conv, 'Relying On Each Other', done);
        }
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(done.join('\n') || '(nothing new)');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
