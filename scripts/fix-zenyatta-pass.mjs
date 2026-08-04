#!/usr/bin/env node
/**
 * Zenyatta pass:
 * - Swatting Orbs (Zenyatta ↔ Jetpack Cat)
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
    const hit = findOgg(hero, needle);
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

async function copyCatSfx(folderLabel, atlasVariant = 0) {
    const folder = path.join(EXTRACT_ROOT, 'Jetpack Cat', 'MatchTalk', folderLabel);
    const oggs = fs
        .readdirSync(folder)
        .filter((n) => /\.ogg$/i.test(n) && /\.03F\./i.test(n))
        .sort();
    if (!oggs.length) throw new Error(`No oggs in ${folderLabel}`);
    const safe = folderLabel.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    const atlas =
        atlasVariant <= 0
            ? `Jetpack_Cat_-_${safe}.ogg`
            : `Jetpack_Cat_-_${safe}_(${atlasVariant + 1}).ogg`;
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(path.join(folder, oggs[atlasVariant % oggs.length]), dest);
    }
    return atlas;
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

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    if (hasSubtitle(conversations, 'swatting the orbs')) {
        console.log('skip (exists): Swatting Orbs');
    } else {
        const questioning = await copyCatSfx('(questioning meows)');
        const pouty = await copyCatSfx('(pouty meows)');
        const zen1 = await copyVoiceOrWiki('Zenyatta', 'give into impulse', [
            'File:Zenyatta - To give into impulse is to give up control.ogg',
        ]);
        const zen2 = await copyVoiceOrWiki('Zenyatta', 'swatting the orbs', [
            'File:Zenyatta - That is to say, please refrain from swatting the orbs.ogg',
        ]);

        const conv = buildBlankConversationRecord();
        conv.name = 'Swatting Orbs';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine('Zenyatta', 'To give into impulse is to give up control.', zen1),
            makeLine('Jetpack Cat', '**questioning meows**', questioning),
            makeLine('Zenyatta', 'That is to say, please refrain from swatting the orbs.', zen2),
            makeLine('Jetpack Cat', '**pouty meows**', pouty),
        ];
        for (const line of conv.lines) {
            if (line.voice && !fs.existsSync(path.join(VOICELINES_DIR, line.voice))) {
                line.voice = '';
            }
        }
        conversations.push(conv);
        done.push(
            `Swatting Orbs (${conv.id}) — voices: ${conv.lines.map((l) => (l.voice ? 'yes' : 'pending')).join('/')}`,
        );
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
