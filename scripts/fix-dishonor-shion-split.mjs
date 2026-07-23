#!/usr/bin/env node
/**
 * Split merged Shion opener in "Dishonor" into 3 MatchTalk lines.
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
const EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Shion',
    'MatchTalk',
);

function atlasFromLabel(label) {
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `Shion_-_${body}.ogg`;
}

function findOgg(needle) {
    const n = needle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    for (const name of fs.readdirSync(EXTRACT)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm.includes(n)) return { source: path.join(EXTRACT, name), label };
    }
    return null;
}

async function copy(needle) {
    const hit = findOgg(needle);
    if (!hit) throw new Error(`Missing MatchTalk: ${needle}`);
    const atlas = atlasFromLabel(hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const c = raw.conversations.find((x) => x.name === 'Dishonor');
    if (!c) throw new Error('Dishonor not found');

    const genji = c.lines.find((l) => l.hero === 'Genji');
    const hanzo = c.lines.find((l) => l.hero === 'Hanzo');
    const oldShion = c.lines.find((l) => l.hero === 'Shion');
    if (!genji || !hanzo) throw new Error('Missing Genji/Hanzo response lines');

    const s1 = {
        id: oldShion?.id || createDialogueLineId(),
        hero: 'Shion',
        voice: await copy('Dishonor your bloodline'),
        voicePrefix: '',
        subtitles: 'Dishonor your bloodline recently? Or was that your brother?',
        render: 'Heroic.png',
    };
    const s2 = {
        id: createDialogueLineId(),
        hero: 'Shion',
        voice: await copy('family habit'),
        voicePrefix: '',
        subtitles: "Oh, that's right. It's a family habit. *(giggle)*",
        render: 'Heroic.png',
    };
    const s3 = {
        id: createDialogueLineId(),
        hero: 'Shion',
        voice: await copy('listening to me, Shimada'),
        voicePrefix: '',
        subtitles: 'Are you listening to me, Shimada?!',
        render: 'Heroic.png',
    };

    c.lines = [s1, s2, s3, genji, hanzo];
    c.paths = [
        {
            id: c.paths?.[0]?.id || createDialoguePathId(),
            label: 'Genji',
            lineIds: [s1.id, s2.id, s3.id, genji.id],
        },
        {
            id: c.paths?.[1]?.id || createDialoguePathId(),
            label: 'Hanzo',
            lineIds: [s1.id, s2.id, s3.id, hanzo.id],
        },
    ];
    c.selectedPathId = c.paths[0].id;

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log('Fixed Dishonor');
    for (const line of c.lines) {
        console.log(`  ${line.hero}: ${line.subtitles}`);
        console.log(`    ${line.voice}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
