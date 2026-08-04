#!/usr/bin/env node
/**
 * Sojourn pass:
 * - Follow Orders (Sojourn ↔ D.va) — wiki-removed; placeholder entry, voices if found
 * - Love Life (Mercy ↔ Sojourn)
 * - At Gibraltar (fix incomplete #8bdfb4c4 Sojourn ↔ Orisa)
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
    'D.va': 'D.Va',
};
const ATLAS_HERO = {
    'D.va': 'D.Va',
};

function atlasFromLabel(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function expectedAtlas(hero, dialogueLabel) {
    return atlasFromLabel(hero, dialogueLabel);
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

    // --- Follow Orders (wiki-removed; keep slot even without audio) ---
    {
        if (hasSubtitle(conversations, 'follow my orders today')) {
            console.log('skip (exists): Follow Orders');
        } else {
            const sojourn1 = await copyVoiceOrWiki('Sojourn', 'follow my orders today', [
                'File:Sojourn - In the mood to follow my orders today, Song.ogg',
                'File:Sojourn - In the mood to follow my orders today, Song?.ogg',
            ]);
            const dva = await copyVoiceOrWiki('D.va', 'wrecking the bad guys', [
                "File:D.Va - If those orders involve me wrecking the bad guys, you bet!.ogg",
                "File:D.Va - If those orders involve me wrecking the bad guys, you bet.ogg",
            ]);
            const sojourn2 = await copyVoiceOrWiki('Sojourn', "I'll see what I can do", [
                "File:Sojourn - (chuckles) I'll see what I can do.ogg",
                "File:Sojourn - I'll see what I can do.ogg",
            ]);

            const conv = buildBlankConversationRecord();
            conv.name = 'Follow Orders';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Sojourn',
                    'In the mood to follow my orders today, Song?',
                    sojourn1 ||
                        expectedAtlas('Sojourn', 'In the mood to follow my orders today, Song'),
                ),
                makeLine(
                    'D.va',
                    'If those orders involve me wrecking the bad guys, you bet!',
                    dva ||
                        expectedAtlas(
                            'D.va',
                            'If those orders involve me wrecking the bad guys, you bet!',
                        ),
                ),
                makeLine(
                    'Sojourn',
                    "**chuckles** I'll see what I can do.",
                    sojourn2 || expectedAtlas('Sojourn', "I'll see what I can do"),
                ),
            ];
            // If files don't exist yet, clear voice so unfinished UI shows missing audio clearly
            for (const line of conv.lines) {
                if (line.voice && !fs.existsSync(path.join(VOICELINES_DIR, line.voice))) {
                    line.voice = '';
                }
            }
            conversations.push(conv);
            done.push(
                `Follow Orders (${conv.id}) — voices: ${conv.lines.map((l) => (l.voice ? 'yes' : 'pending')).join('/')}`,
            );
        }
    }

    // --- Love Life ---
    {
        if (hasSubtitle(conversations, 'love life on a mission')) {
            console.log('skip (exists): Love Life');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Love Life';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mercy',
                    'So... how is that man you were telling me about?',
                    await copyVoiceOrWiki('Mercy', 'man you were telling me about', [
                        'File:Mercy - So, how is that man you were telling me about.ogg',
                    ]),
                ),
                makeLine(
                    'Sojourn',
                    "Angela, I'm not discussing my love life on a mission.",
                    await copyVoiceOrWiki('Sojourn', 'love life on a mission', [
                        "File:Sojourn - Angela, I'm not discussing my love life on a mission.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            done.push(`Love Life (${conv.id})`);
        }
    }

    // --- At Gibraltar (repair incomplete entry) ---
    {
        const conv =
            conversations.find((c) => /stationed at Gibraltar/i.test(JSON.stringify(c.lines || []))) ||
            conversations.find((c) => c.name === 'At Gibraltar');
        if (!conv) throw new Error('At Gibraltar conversation not found');

        const openerVoice =
            (await copyVoiceOrWiki('Sojourn', 'stationed at Gibraltar', [
                "File:Sojourn - How's it feel to be stationed at Gibraltar.ogg",
            ])) ||
            String(
                (conv.lines || []).find((l) => /stationed at Gibraltar/i.test(l.subtitles || ''))
                    ?.voice || '',
            );

        const orisa1 = await copyVoiceOrWiki('Orisa', 'Efi has always dreamed', [
            'File:Orisa - It is incredible! Efi has always dreamed of this.ogg',
            'File:Orisa - It is incredible. Efi has always dreamed of this.ogg',
        ]);
        const sojourn2 = await copyVoiceOrWiki('Sojourn', 'all the better now that you two', [
            "File:Sojourn - Yeah, well... Overwatch is all the better now that you two are part of it.ogg",
        ]);
        const orisa2 = await copyVoiceOrWiki('Orisa', 'Part of Overwatch', [
            'File:Orisa - "Part of Overwatch"...how amazing.ogg',
            'File:Orisa - Part of Overwatch...how amazing.ogg',
            'File:Orisa - Part of Overwatch... how amazing.ogg',
        ]);

        const opener = makeLine(
            'Sojourn',
            "How's it feel to be stationed at Gibraltar?",
            openerVoice,
            keepId(conv.lines, (l) => /stationed at Gibraltar/i.test(l.subtitles || '')),
        );
        const efi = makeLine(
            'Orisa',
            'It is incredible! Efi has always dreamed of this.',
            orisa1,
            keepId(conv.lines, (l) => /Efi has always dreamed/i.test(l.subtitles || '')),
        );
        const better = makeLine(
            'Sojourn',
            'Yeah, well... Overwatch is all the better now that you two are part of it.',
            sojourn2,
            keepId(conv.lines, (l) => /all the better/i.test(l.subtitles || '')),
        );
        const amazing = makeLine(
            'Orisa',
            '"Part of Overwatch"...how amazing.',
            orisa2,
            keepId(conv.lines, (l) => /how amazing/i.test(l.subtitles || '')),
        );

        conv.name = 'At Gibraltar';
        conv.scene = conv.scene || DEFAULT_DIALOGUE_SCENE;
        conv.status = 'active';
        conv.lines = [opener, efi, better, amazing];
        delete conv.paths;
        delete conv.selectedPathId;
        done.push(
            `At Gibraltar (${conv.id}) — voices: ${conv.lines.map((l) => (l.voice ? 'yes' : 'pending')).join('/')}`,
        );
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
