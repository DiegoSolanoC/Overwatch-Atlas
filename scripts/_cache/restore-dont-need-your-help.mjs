#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from '../import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(
    path.dirname(CONVERSATIONS_PATH),
    'theater-assets-manifest.json',
);
const VOICELINES_DIR = path.join(
    path.dirname(path.dirname(path.dirname(CONVERSATIONS_PATH))),
    'assets',
    'audio',
    'Theater',
    'Voicelines',
);

const LINES = [
    {
        hero: 'Ashe',
        subtitles:
            "Looks like I made the right call cutting ties after Grand Mesa, the way things ended up for you",
        voice:
            'Ashe_-_Looks_like_I_made_the_right_call_cutting_ties_after_Grand_Mesa,_the_way_things_ended_up_for_you.ogg',
    },
    {
        hero: 'Vendetta',
        subtitles:
            "Your pathetic outfit will fall in its own time. You won't need my help for that",
        voice:
            "Vendetta_-_Your_pathetic_outfit_will_fall_in_its_own_time._You_won't_need_my_help_for_that.ogg",
    },
    {
        hero: 'Ashe',
        subtitles: "Aw, sweetheart. I don't think anyone needs your help these days",
        voice: "Ashe_-_Aw,_sweetheart._I_don't_think_anyone_needs_your_help_these_days.ogg",
    },
];

function pickHeroic(hero, rendersMap) {
    const list = rendersMap?.[hero] || [];
    return list.find((n) => /heroic/i.test(n)) || list[0] || 'Heroic.png';
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw) ? raw : raw.conversations || [];

    const existing = conversations.find(
        (c) =>
            c.name === "Don't need your help"
            || (c.lines || []).some((l) => /cutting ties after Grand Mesa/i.test(l.subtitles || '')),
    );
    if (existing) {
        console.log(`Already present: ${existing.name} (${existing.id})`);
        return;
    }

    for (const row of LINES) {
        const full = path.join(VOICELINES_DIR, row.voice);
        if (!fs.existsSync(full)) {
            throw new Error(`Missing voice file: ${row.voice}`);
        }
    }

    const assets = await scanTheaterAssets();
    const rendersMap = assets.rendersByHero || {};

    const conv = buildBlankConversationRecord();
    conv.name = "Don't need your help";
    conv.eraName = '';
    conv.tags = ['Overwatch'];
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = LINES.map((row) => ({
        id: createDialogueLineId(),
        hero: row.hero,
        voice: row.voice,
        voicePrefix: '',
        subtitles: row.subtitles,
        render: pickHeroic(row.hero, rendersMap),
        era: 'Overwatch',
        status: 'active',
    }));

    conversations.push(conv);

    const payload = Array.isArray(raw) ? conversations : { ...raw, conversations };
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    const assetsOut = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assetsOut, null, 2)}\n`);

    console.log(`Restored "${conv.name}" (${conv.id})`);
    for (const l of conv.lines) {
        console.log(`  ${l.hero}: ${l.subtitles}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
