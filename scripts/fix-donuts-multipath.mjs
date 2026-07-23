#!/usr/bin/env node
/**
 * Rebuild "Killing for Donuts" as a 4-path Kiriko response multipath.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
    createDialoguePathId,
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
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm === n || norm.includes(n)) {
            return { source: path.join(dir, name), label };
        }
    }
    return null;
}

async function copyVoice(hero, needle, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

function makeLine(hero, subtitles, voice, existingId = '') {
    return {
        id: existingId || createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const c = raw.conversations.find(
        (x) =>
            x.name === 'Killing for Donuts' ||
            (Array.isArray(x.lines) &&
                x.lines.some((l) => String(l.subtitles || '').includes('kill for some donuts'))),
    );
    if (!c) throw new Error('Donuts conversation not found');

    const bySub = (re) => c.lines.find((l) => re.test(String(l.subtitles || '')) || re.test(String(l.voice || '')));

    const opener = makeLine(
        'Kiriko',
        "Ugh, I'd kill for some donuts right about now...",
        await copyVoice('Kiriko', 'kill for some donuts'),
        bySub(/kill for some donuts/i)?.id,
    );
    const ask = makeLine(
        'Genji',
        'How many have you had today?',
        await copyVoice('Genji', 'How many have you had today'),
        c.lines.find((l) => l.hero === 'Genji' && /How many/i.test(l.subtitles || ''))?.id,
    );

    const seven = makeLine(
        'Kiriko',
        'I think, seven. Or, eight...',
        await copyVoice('Kiriko', 'I think seven'),
        bySub(/seven|Or eight/i)?.id,
    );
    const ten = makeLine(
        'Kiriko',
        'Like... ten?',
        await copyVoice('Kiriko', 'Like'),
        bySub(/Like\.\.\. ten|Like\.\.\._ten/i)?.id ||
            c.lines.find((l) => String(l.voice || '').includes('Like..._ten'))?.id,
    );
    // Prefer exact "Like... ten" file over other "Like" matches
    {
        const hit = findOgg('Kiriko', 'Like ten');
        if (hit) {
            const atlas = atlasFromLabel('Kiriko', hit.label);
            const dest = path.join(VOICELINES_DIR, atlas);
            if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
            ten.voice = atlas;
        }
    }

    const twelve = makeLine(
        'Kiriko',
        'Probably twelve?',
        await copyVoice('Kiriko', 'Probably twelve'),
        bySub(/Probably twelve/i)?.id,
    );
    const lost = makeLine(
        'Kiriko',
        'I... totally lost count.',
        await copyVoice('Kiriko', 'totally lost count'),
        bySub(/lost count/i)?.id,
    );
    const closer = makeLine(
        'Genji',
        '*(sigh)* Yare yare.',
        await copyVoice('Genji', 'Good grief'),
        c.lines.find((l) => /Yare|Good grief/i.test(String(l.subtitles || '')) || /Good_grief/i.test(String(l.voice || '')))?.id,
    );

    c.name = 'Killing for Donuts';
    c.lines = [opener, ask, seven, ten, twelve, lost, closer];
    c.paths = [
        {
            id: createDialoguePathId(),
            label: 'Seven or eight',
            lineIds: [opener.id, ask.id, seven.id, closer.id],
        },
        {
            id: createDialoguePathId(),
            label: 'Like... ten',
            lineIds: [opener.id, ask.id, ten.id, closer.id],
        },
        {
            id: createDialoguePathId(),
            label: 'Probably twelve',
            lineIds: [opener.id, ask.id, twelve.id, closer.id],
        },
        {
            id: createDialoguePathId(),
            label: 'Lost count',
            lineIds: [opener.id, ask.id, lost.id, closer.id],
        },
    ];
    c.selectedPathId = c.paths[0].id;

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log('Rebuilt Killing for Donuts multipath');
    for (const line of c.lines) {
        console.log(`  ${line.hero}: ${line.subtitles}`);
        console.log(`    ${line.voice}`);
    }
    for (const p of c.paths) console.log(`  path: ${p.label}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
