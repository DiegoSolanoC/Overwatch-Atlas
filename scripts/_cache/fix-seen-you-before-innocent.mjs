#!/usr/bin/env node
/**
 * Add follow-up innocent meows to Seen you Before (Juno & Fika),
 * and purge superseded Midseason placeholder IDs so stale localStorage
 * drafts don't resurrect as duplicates on reload.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialogueLineId } from '../../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from '../import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = !process.argv.includes('--write');

/** First Midseason import batch (pre --replace) — orphaned localStorage drafts. */
const SUPERSEDED_MIDSEASON_IDS = [
    '57d3b564-4f2b-44e4-a5d9-2bd668d1149e', // 3
    'e15027e3-29e8-44e2-a7e3-383f3043cd53', // 4
    'ba2262fa-9c8d-4b39-b2b1-9fec3ede78b1', // 5
    '6947fb6a-fb54-431a-84c1-ec16cc6f0685', // 6
    'a6fba2f8-2631-4851-8334-6af0d9189f39', // 7
    'e6169044-8dbb-44ca-b293-75bf9550e6d8', // 8
    'ebee2491-d1f5-4388-9734-dc8aa906b949', // 9
    '9dc5f488-2199-4c5d-a2a1-85ab0e0f7bb4', // 10
    'e9f8aac3-3c97-423f-8307-e20e3ffc2072', // 11
    '839a7835-a7a9-42e6-bfb3-b9c3dab6e035', // 12
    '5de8a55e-b0b0-42b7-9fee-17a6ee0c4efd', // 13
    '90b47a12-5758-44f0-8b4b-2e5336dea666', // 14
    '3262e37e-b8b1-4feb-8f58-e1e2f7631838', // 15
    'eb27451c-f3e2-459d-9894-00eb8c20aaa1', // 16
    '7ea9a0b5-78a7-4374-a735-a6d348f92efb', // 17
    '3edd65bb-f475-4d38-9758-e4f195426b7d', // 18
    'baff14aa-e9e9-43ce-81b8-8111ccd5310f', // 19
    '11e7caed-d397-4fce-9443-0f28d52e3c70', // 21
    'a4684c77-e671-44ab-b964-21ba05e1d9c2', // 22
    '6f10b39e-a719-4c76-aa2e-6a1dd1854f5a', // 23
    '3b62d0bc-718d-4821-a383-62a18fdc8d27', // 24
    '629af46a-46d0-4888-9ca2-11d39a74a6a8', // 25
    '210314ac-56c5-49d0-9226-d6822cf4d7e4', // 26
    'ec5c150e-65d9-4227-91e9-8fa991d9dbd2', // 27
    'b1d0cd80-368a-434c-a6b4-8f7acbdc707f', // 28
    '026472fc-39e7-47b1-a974-640499230d02', // 29
    '8f5f18c6-13d8-48d0-9807-92ae4e97a780', // 30
    'a3d1082e-f052-465b-a808-d9d4af831dd3', // 31
    '148a468e-788b-48c3-ab6a-3a84c86b3fc6', // 32
    '80dd1928-10bc-433f-b8bf-8e8e562535ab', // 33
    '95eb3c9d-c8f5-4737-8d96-201533941fae', // 34
    '40c40b96-0574-4dfd-9aaa-82394a398048', // 35
    '49c429fa-92d8-4332-8595-e0d8e2835492', // 36
    '43d630d2-5492-4dc1-b0fe-5b88f6867019', // 37
    'ac73e0ee-94f4-4ed6-aef0-4fad65b14bfd', // 38
];

function pickHeroic(hero, rendersMap) {
    const list = rendersMap?.[hero] || [];
    return list.find((n) => /heroic/i.test(n)) || list[0] || 'Heroic.png';
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw) ? raw : raw.conversations || [];
    const assets = await scanTheaterAssets();
    const rendersMap = assets.rendersByHero || {};

    const conv = conversations.find(
        (c) =>
            c.name === 'Seen you Before'
            || (c.lines || []).some((l) => /cannot help thinking I have seen you/i.test(l.subtitles || '')),
    );
    if (!conv) throw new Error('Missing Seen you Before / Juno+Fika dialogue');

    const hasInnocent = (conv.lines || []).some(
        (l) => /jetpack/i.test(l.hero) && /innocent meows?/i.test(String(l.subtitles || '')),
    );

    if (!hasInnocent) {
        // Prefer newly added MatchTalk take (same file ids as folder; pick a solid-sized NEW-ish take)
        const src = path.join(
            EXTRACT,
            'Jetpack Cat',
            'MatchTalk',
            '(innocent meows)',
            '00000033DF85.03F.ogg',
        );
        if (!fs.existsSync(src)) throw new Error(`Missing innocent meows source: ${src}`);

        const atlas = 'Jetpack_Cat_-_(innocent_meows)_(Seen_you_Before).ogg';
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!dryRun) {
            await fsp.mkdir(VOICELINES_DIR, { recursive: true });
            if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
        }

        const line = {
            id: createDialogueLineId(),
            hero: 'Jetpack Cat',
            voice: atlas,
            voicePrefix: '',
            subtitles: '**innocent meows**',
            render: pickHeroic('Jetpack Cat', rendersMap),
            era: 'Overwatch',
            status: 'active',
        };

        // Expected order: Juno → evasive → Juno → innocent
        const lines = [...(conv.lines || [])];
        const junoMarsIdx = lines.findIndex((l) => /definitely not on Mars/i.test(l.subtitles || ''));
        if (junoMarsIdx >= 0) lines.splice(junoMarsIdx + 1, 0, line);
        else lines.push(line);
        conv.lines = lines;
        console.log(`+ innocent meows after Mars line → ${conv.name} now ${conv.lines.length} lines`);
    } else {
        console.log('~ innocent meows already present');
    }

    for (const l of conv.lines) {
        console.log(' ', l.hero, JSON.stringify(l.subtitles));
    }

    // Purge superseded first-batch Midseason IDs (prevent restart dupes from localStorage)
    const meta = raw._meta && typeof raw._meta === 'object' ? { ...raw._meta } : {};
    const purged = new Set(
        (Array.isArray(meta.purgedConversationIds) ? meta.purgedConversationIds : []).map(String),
    );
    let addedPurge = 0;
    for (const id of SUPERSEDED_MIDSEASON_IDS) {
        if (!purged.has(id)) {
            purged.add(id);
            addedPurge += 1;
        }
    }
    // Also purge any local-only draft whose lines still use "&" fake hero names from the bad import
    meta.purgedConversationIds = [...purged];
    meta.midseason5AuditFinishAt = new Date().toISOString();
    console.log(`purgedConversationIds += ${addedPurge} (total ${meta.purgedConversationIds.length})`);

    if (!dryRun) {
        const payload = Array.isArray(raw)
            ? conversations
            : { ...raw, conversations, _meta: meta };
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
        const assetsOut = await scanTheaterAssets();
        await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assetsOut, null, 2)}\n`);
    }

    console.log(dryRun ? 'DRY RUN' : 'WRITE done');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
