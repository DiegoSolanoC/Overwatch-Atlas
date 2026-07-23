#!/usr/bin/env node
/**
 * Add missing Genji interactions:
 * - Mercy letters / still friends
 * - Sierra recruit advice
 * - Venture non-binary ninja joke (3-path)
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
        else if (norm.includes(n)) hits.push({ source: path.join(dir, name), label, score: 1 + Math.abs(norm.length - n.length) });
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

function makeLine(hero, subtitles, voice) {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

function alreadyExists(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.some((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    // Mercy / Genji — stop writing
    if (!alreadyExists(conversations, 'why did we really stop writing')) {
        const lines = [
            makeLine(
                'Mercy',
                "So... why did we really stop writing? I know my sketch wasn't that terrible.",
                await copyVoice('Mercy', 'why did we really stop writing'),
            ),
            makeLine(
                'Genji',
                'Conflict got in the way. It is as you say: "war takes every happiness".',
                await copyVoice('Genji', 'Conflict got in the way'),
            ),
            makeLine(
                'Mercy',
                "An unfortunate truth. But... we're still friends, aren't we?",
                await copyVoice('Mercy', "we're still friends"),
            ),
            makeLine(
                'Genji',
                'Nothing could ever take that from us.',
                await copyVoice('Genji', 'Nothing could ever take that from us'),
            ),
        ];
        const conv = buildBlankConversationRecord();
        conv.name = 'Still friends';
        conv.status = 'active';
        conv.eraName = '';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = lines;
        conversations.push(conv);
        added.push(conv.name);
    }

    // Sierra / Genji — recruit advice
    if (!alreadyExists(conversations, 'advice for a new recruit')) {
        const lines = [
            makeLine(
                'Sierra',
                "You've been with Overwatch a long time. Any advice for a new recruit?",
                await copyVoice('Sierra', 'advice for a new recruit'),
            ),
            makeLine(
                'Genji',
                'Hmm... never lose sight of your teammates.',
                await copyVoice('Genji', 'never lose sight of your teammates'),
            ),
            makeLine(
                'Sierra',
                "Well, you're the last person I'd expect to hear that from!",
                await copyVoice('Sierra', 'last person'),
            ),
            makeLine(
                'Genji',
                'It is important to learn from our mistakes.',
                await copyVoice('Genji', 'learn from our mistakes'),
            ),
        ];
        const conv = buildBlankConversationRecord();
        conv.name = 'Never lose sight';
        conv.status = 'active';
        conv.eraName = '';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = lines;
        conversations.push(conv);
        added.push(conv.name);
    }

    // Venture / Genji / Hanzo / Kiriko — non-binary ninja multipath
    if (!alreadyExists(conversations, 'non-binary ninja')) {
        const opener = makeLine(
            'Venture',
            "You'll like this one: How does a non-binary ninja take out a target?",
            await copyVoice('Venture', 'non-binary ninja'),
        );
        const genjiHow = makeLine(
            'Genji',
            'Uh... how?',
            await copyVoice('Genji', 'Uh'),
        );
        // Prefer exact Uh... how_
        {
            const hit = findOgg('Genji', 'Uh how');
            if (hit && /uh.*how/i.test(hit.label)) {
                const atlas = atlasFromLabel('Genji', hit.label);
                const dest = path.join(VOICELINES_DIR, atlas);
                if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
                genjiHow.voice = atlas;
            }
        }
        const hanzoHow = makeLine(
            'Hanzo',
            'How?',
            await copyVoice('Hanzo', 'How'),
        );
        // Prefer How.... over longer How lines
        {
            const hit = findOgg('Hanzo', 'How');
            const exact = fs
                .readdirSync(path.join(EXTRACT_ROOT, 'Hanzo', 'MatchTalk'))
                .find((name) => /\.0B2-How\.\.\._?\.ogg$/i.test(name) || /\.0B2-How_\.ogg$/i.test(name));
            if (exact) {
                const label = exact.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
                const atlas = atlasFromLabel('Hanzo', label);
                const dest = path.join(VOICELINES_DIR, atlas);
                if (!fs.existsSync(dest)) {
                    await fsp.copyFile(path.join(EXTRACT_ROOT, 'Hanzo', 'MatchTalk', exact), dest);
                }
                hanzoHow.voice = atlas;
            } else if (hit) {
                hanzoHow.voice = atlasFromLabel('Hanzo', hit.label);
            }
        }
        const kirikoHow = makeLine(
            'Kiriko',
            "I'll bite. How?",
            await copyVoice('Kiriko', "I'll bite"),
        );
        const punchline = makeLine(
            'Venture',
            'They slash them!',
            await copyVoice('Venture', 'They slash them'),
        );
        const genjiEnd = makeLine(
            'Genji',
            'Oh. They should try shurikens too.',
            await copyVoice('Genji', 'shurikens too'),
        );
        const hanzoEnd = makeLine(
            'Hanzo',
            "I suppose I've heard worse jokes.",
            await copyVoice('Hanzo', 'heard worse jokes'),
        );
        const kirikoEnd = makeLine(
            'Kiriko',
            "Oh, good one! Bet you a hundred yen Genji doesn't get it.",
            await copyVoice('Kiriko', 'hundred yen'),
        );

        const conv = buildBlankConversationRecord();
        conv.name = 'Non-binary ninja';
        conv.status = 'active';
        conv.eraName = '';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            opener,
            genjiHow,
            hanzoHow,
            kirikoHow,
            punchline,
            genjiEnd,
            hanzoEnd,
            kirikoEnd,
        ];
        conv.paths = [
            {
                id: createDialoguePathId(),
                label: 'Genji',
                lineIds: [opener.id, genjiHow.id, punchline.id, genjiEnd.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Hanzo',
                lineIds: [opener.id, hanzoHow.id, punchline.id, hanzoEnd.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Kiriko',
                lineIds: [opener.id, kirikoHow.id, punchline.id, kirikoEnd.id],
            },
        ];
        conv.selectedPathId = conv.paths[0].id;
        conversations.push(conv);
        added.push(`${conv.name} (3-path)`);
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(added.length ? `Added:\n  - ${added.join('\n  - ')}` : 'Nothing new to add');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
