#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VOICELINES = path.join('src/assets/audio/Theater/Voicelines');
const CONV = absFromPublic(FILES.dialogueTheater.conversations);
const ERA = 'Season 5 (YouTube placeholder)';

function atlas(hero, file) {
    const label = file.replace(/^.*?\.0B2-/, '').replace(/\.ogg$/i, '');
    const body = label.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    return `${String(hero).replace(/ /g, '_')}_-_${body}.ogg`;
}

function clean(label) {
    return label.replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/\s+\?/g, '?').trim();
}

async function copy(heroFolder, file, atlasHero) {
    const src = path.join(EXTRACT, heroFolder, 'MatchTalk', file);
    if (!fs.existsSync(src)) throw new Error(`Missing ${src}`);
    const voice = atlas(atlasHero || heroFolder, file);
    const dest = path.join(VOICELINES, voice);
    if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    const label = file.replace(/^.*?\.0B2-/, '').replace(/\.ogg$/i, '');
    return { voice, subtitles: clean(label) };
}

const raw = JSON.parse(fs.readFileSync(CONV, 'utf8'));
const conversations = raw.conversations;
const already = conversations.some((c) => {
    const hs = new Set((c.lines || []).map((l) => l.hero));
    return (
        hs.has('Doctrine') &&
        hs.has('Doomfist') &&
        (c.lines || []).some((l) => /younger years, Akande/i.test(l.subtitles || ''))
    );
});
if (already) {
    console.log('Doctrine↔Doomfist already present');
    process.exit(0);
}

const assets = await scanTheaterAssets();
const pick = (h) => (assets.renders?.[h] || []).find((n) => /heroic/i.test(n)) || 'Heroic.png';

const d = await copy(
    'Doctrine',
    '00000006CF60.0B2-I recall your younger years, Akande. Oh, such rage possessed you after the Crisis.ogg',
    'Doctrine',
);
const dfDir = path.join(EXTRACT, 'Doomfist', 'MatchTalk');
const dfFile = fs.readdirSync(dfDir).find((n) => /deprived of purpose/i.test(n));
if (!dfFile) throw new Error('Doomfist deprived-of-purpose line missing');
const doom = await copy('Doomfist', dfFile, 'Doomfist');

const row = buildBlankConversationRecord();
row.name = String(nextConversationNumber(conversations));
row.eraName = ERA;
row.scene = DEFAULT_DIALOGUE_SCENE;
row.tags = ['Overwatch'];
row.status = 'active';
row.lines = [
    {
        id: createDialogueLineId(),
        hero: 'Doctrine',
        voice: d.voice,
        voicePrefix: '',
        subtitles: d.subtitles,
        render: pick('Doctrine'),
        era: 'Overwatch',
        status: 'active',
    },
    {
        id: createDialogueLineId(),
        hero: 'Doomfist',
        voice: doom.voice,
        voicePrefix: '',
        subtitles: doom.subtitles,
        render: pick('Doomfist'),
        era: 'Overwatch',
        status: 'active',
    },
];
conversations.push(row);
raw.conversations = conversations;
await fsp.writeFile(CONV, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Added #${row.name}`);
