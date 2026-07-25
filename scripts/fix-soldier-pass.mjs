#!/usr/bin/env node
/**
 * Soldier: 76 pass:
 * - Merge kitchen confess (#147 Ashe + Leftovers Mei) into a 5-path multipath
 * - Download missing Junkrat / Symmetra / Winston wiki voices
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

const KEEP_ID = 'e365c30a-d927-4cd8-b3db-c96912f342d0'; // #147 Ashe kitchen
const PURGE_IDS = [
    '965ce749-24a2-4360-a09d-aedb3a2bebc9', // Leftovers (Mei-only split)
];

const VOICES = {
    opener:
        'Soldier_76_-_I_was_just_in_the_kitchen._Anyone_have_something_they_want_to_confess.ogg',
    ashe: "Ashe_-_I_ain't_a_snitch,_but_let's_just_say_those_corn_dogs_are_gone_for_good.ogg",
    junkrat: 'Junkrat_-_I_was_just_trying_to_make_a_milkshake.ogg',
    mei: "Mei_-_I_saw_someone_steal_your_leftovers._But_I'm_afraid_to_say_who.ogg",
    symmetra: 'Symmetra_-_It_is_not_my_fault_your_kitchenware_melts_so_easily.ogg',
    winston: 'Winston_-_Those_banana_peels_are_not_mine.ogg',
    sigh: 'Soldier_76_-_(tired_sigh).ogg',
};

const WIKI_TITLES = {
    junkrat: 'File:Junkrat - I was just trying to make a milkshake.ogg',
    symmetra: 'File:Symmetra - It is not my fault your kitchenware melts so easily.ogg',
    winston: 'File:Winston - Those banana peels are not mine.ogg',
};

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

async function ensureVoice(atlasName, wikiTitle) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (fs.existsSync(dest)) return atlasName;
    if (!wikiTitle) throw new Error(`Missing voice on disk: ${atlasName}`);
    const resolved = await resolveWikiFileDownloadUrl(wikiTitle);
    if (!resolved) throw new Error(`Wiki file not found: ${wikiTitle}`);
    const expected = wikiFileTitleToTheaterFilename(wikiTitle);
    if (expected !== atlasName) {
        console.warn(`  note: wiki atlas ${expected} → using ${atlasName}`);
    }
    await downloadWikiVoicelineFile(wikiTitle, dest);
    console.log(`  downloaded ${atlasName}`);
    return atlasName;
}

async function main() {
    for (const [key, atlas] of Object.entries(VOICES)) {
        await ensureVoice(atlas, WIKI_TITLES[key] || null);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const leftovers = raw.conversations.find((c) => c.id === PURGE_IDS[0]);
    const host =
        raw.conversations.find((c) => c.id === KEEP_ID) ||
        raw.conversations.find((c) =>
            (c.lines || []).some((l) => /wanna confess|want to confess/i.test(String(l.subtitles || ''))),
        );
    if (!host) throw new Error('Kitchen confess host conversation not found');

    raw.conversations = raw.conversations.filter((c) => !PURGE_IDS.includes(c.id));
    raw._meta = {
        ...(raw._meta && typeof raw._meta === 'object' ? raw._meta : {}),
        purgedConversationIds: [
            ...new Set([
                ...((raw._meta && raw._meta.purgedConversationIds) || []),
                ...PURGE_IDS,
            ]),
        ],
    };

    const allLines = [...(host.lines || []), ...((leftovers && leftovers.lines) || [])];

    const opener = makeLine(
        keepId(allLines, (l) => /wanna confess|want to confess/i.test(String(l.subtitles || ''))),
        'Soldier 76',
        'I was just in the kitchen. Anyone have something they wanna confess?',
        VOICES.opener,
    );
    const ashe = makeLine(
        keepId(allLines, (l) => /snitch|corn.?dog/i.test(String(l.subtitles || ''))),
        'Ashe',
        "I ain't a snitch, but, let's just say... those corn dogs are gone for good.",
        VOICES.ashe,
    );
    const junkrat = makeLine(
        createDialogueLineId(),
        'Junkrat',
        'Oh, I was just trying to make a milkshake...',
        VOICES.junkrat,
    );
    const mei = makeLine(
        keepId(allLines, (l) => /leftovers|afraid to say/i.test(String(l.subtitles || ''))),
        'Mei',
        "I saw someone steal your leftovers, but I'm afraid to say who.",
        VOICES.mei,
    );
    const symmetra = makeLine(
        createDialogueLineId(),
        'Symmetra',
        'It is not my fault your kitchenware melts so easily.',
        VOICES.symmetra,
    );
    const winston = makeLine(
        createDialogueLineId(),
        'Winston',
        'Those banana peels are not mine.',
        VOICES.winston,
    );
    const sigh = makeLine(
        keepId(allLines, (l) => /sigh/i.test(String(l.subtitles || '')) && l.hero === 'Soldier 76'),
        'Soldier 76',
        '**heavy sigh**',
        VOICES.sigh,
    );

    host.name = 'Kitchen Confess';
    host.eraName = '';
    host.scene = host.scene || 'Default.png';
    host.status = 'active';
    host.lines = [opener, ashe, junkrat, mei, symmetra, winston, sigh];
    host.paths = [
        { id: createDialoguePathId(), label: 'Ashe', lineIds: [opener.id, ashe.id, sigh.id] },
        { id: createDialoguePathId(), label: 'Junkrat', lineIds: [opener.id, junkrat.id, sigh.id] },
        { id: createDialoguePathId(), label: 'Mei', lineIds: [opener.id, mei.id, sigh.id] },
        {
            id: createDialoguePathId(),
            label: 'Symmetra',
            lineIds: [opener.id, symmetra.id, sigh.id],
        },
        { id: createDialoguePathId(), label: 'Winston', lineIds: [opener.id, winston.id, sigh.id] },
    ];
    host.selectedPathId = host.paths[0].id;

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log('Kitchen Confess → Ashe/Junkrat/Mei/Symmetra/Winston multipath');
    console.log(`purged: ${PURGE_IDS.join(', ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
