#!/usr/bin/env node
/**
 * Ashe pass:
 * - Wearin' Skates (Ashe ↔ Lúcio, 3 opener multipath)
 * - Best Shot (Ashe ↔ Widowmaker)
 * - Unwiedly (fix #152 Ashe ↔ Widowmaker)
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
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

const FINE_RIFLE_ID = 'b334e838-edcb-4b55-aeef-051ce126e79b';

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

async function copyVoice(hero, needle, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
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
            const resolved = await resolveWikiFileDownloadUrl(title);
            if (!resolved) continue;
            return ensureWiki(title);
        }
        throw new Error(`No MatchTalk/wiki for ${hero}: ${needle}`);
    }
}

function makeLine(id, hero, subtitles, voice) {
    return {
        id,
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
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

    // --- Wearin' Skates multipath ---
    {
        const eyesVoice = await copyVoiceOrWiki(
            'Ashe',
            'eyes deceive me',
            ['File:Ashe - Do my eyes deceive me, or are you wearing skates.ogg'],
        );
        const niceVoice = await copyVoiceOrWiki(
            'Ashe',
            'nice skates',
            [
                'File:Ashe - Nice skates. Very cute. You going to swap those out before we get to the gunfight.ogg',
            ],
        );
        const yallVoice = await copyVoiceOrWiki('Ashe', 'teammate is wearin', [
            "File:Ashe - Y'all, our teammate is wearing skates. To a gunfight.ogg",
        ]);
        const lucioVoice = await copyVoiceOrWiki('Lúcio', "You'll see what these can do", [
            "File:Lúcio - You'll see what these can do.ogg",
        ]);

        let conv = conversations.find((c) =>
            (c.lines || []).some((l) => /wearin'? skates|wearing skates/i.test(l.subtitles || '')),
        );
        if (!conv) {
            conv = buildBlankConversationRecord();
            conversations.push(conv);
        }

        const eyes = makeLine(
            keepId(conv.lines, (l) => /eyes deceive/i.test(l.subtitles || '')),
            'Ashe',
            "Do my eyes deceive me, or are you wearin' skates?",
            eyesVoice,
        );
        const nice = makeLine(
            keepId(conv.lines, (l) => /nice skates|swap those out/i.test(l.subtitles || '')),
            'Ashe',
            "Nice skates. Very cute. You goin' to swap those out before we get to the gunfight?",
            niceVoice,
        );
        const yall = makeLine(
            keepId(conv.lines, (l) => /teammate is wearin|to a gunfight/i.test(l.subtitles || '')),
            'Ashe',
            "Y'all, our teammate is wearin' skates. To a gunfight! Hahaha!",
            yallVoice,
        );
        const lucio = makeLine(
            keepId(conv.lines, (l) => /what these can do/i.test(l.subtitles || '')),
            'Lúcio',
            "You'll see what these can do!",
            lucioVoice,
        );

        conv.name = "Wearin' Skates";
        conv.scene = conv.scene || DEFAULT_DIALOGUE_SCENE;
        conv.status = 'active';
        conv.lines = [eyes, nice, yall, lucio];
        conv.paths = [
            { id: createDialoguePathId(), label: 'Eyes', lineIds: [eyes.id, lucio.id] },
            { id: createDialoguePathId(), label: 'Nice skates', lineIds: [nice.id, lucio.id] },
            { id: createDialoguePathId(), label: "Y'all", lineIds: [yall.id, lucio.id] },
        ];
        conv.selectedPathId = conv.paths[0].id;
        done.push(`Wearin' Skates (${conv.id})`);
    }

    // --- Best Shot ---
    {
        if (hasSubtitle(conversations, 'trained by the West') || hasSubtitle(conversations, "who's the best shot")) {
            console.log('skip (exists): Best Shot');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Best Shot';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    createDialogueLineId(),
                    'Ashe',
                    "Time to settle who's the best shot.",
                    await copyVoice('Ashe', "who's the best shot"),
                ),
                makeLine(
                    createDialogueLineId(),
                    'Widowmaker',
                    'There is no competition. I was trained by the best.',
                    await copyVoice('Widowmaker', 'no competition'),
                ),
                makeLine(
                    createDialogueLineId(),
                    'Ashe',
                    'And I was trained by the West.',
                    await copyVoice('Ashe', 'trained by the West'),
                ),
                makeLine(
                    createDialogueLineId(),
                    'Widowmaker',
                    '**sighs** Americans.',
                    await copyVoice('Widowmaker', 'Americans'),
                ),
            ];
            conversations.push(conv);
            done.push(`Best Shot (${conv.id})`);
        }
    }

    // --- Unwiedly (fix #152) ---
    {
        const conv =
            conversations.find((c) => c.id === FINE_RIFLE_ID) ||
            conversations.find((c) =>
                (c.lines || []).some((l) =>
                    /fine piece of work|hands of an amateur|unwieldy/i.test(
                        `${l.subtitles || ''} ${l.voice || ''}`,
                    ),
                ),
            );
        if (!conv) throw new Error('Unwiedly host (#152) not found');

        const asheVoice = await copyVoice('Ashe', 'fine piece of work');
        const widowVoice = await copyVoice('Widowmaker', 'hands of an amateur');
        const ashe = makeLine(
            keepId(conv.lines, (l) => /Ashe_-_That_rifle|fine_piece_of_work/i.test(String(l.voice || ''))),
            'Ashe',
            'That rifle is a fine piece of work. Looks a little unwieldy, though.',
            asheVoice,
        );
        const widow = makeLine(
            keepId(conv.lines, (l) =>
                /Widowmaker_-_Perhaps|hands_of_an_amateur/i.test(String(l.voice || '')),
            ),
            'Widowmaker',
            'Perhaps, in the hands of an amateur.',
            widowVoice,
        );

        conv.name = 'Unwiedly';
        conv.eraName = '';
        conv.scene = conv.scene || DEFAULT_DIALOGUE_SCENE;
        conv.status = 'active';
        conv.lines = [ashe, widow];
        delete conv.paths;
        delete conv.selectedPathId;
        done.push(`Unwiedly (${conv.id})`);
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(done.join('\n'));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
