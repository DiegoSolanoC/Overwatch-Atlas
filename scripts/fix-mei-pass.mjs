#!/usr/bin/env node
/**
 * Mei pass:
 * - Rebuild cryogenic Moira multipath (#697)
 * - Add Opara / leftovers / Torbjörn interactions
 * - Fix Wuyang steam Mei voice (MatchTalk, not wiki Na!)
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

const HERO_FOLDER = {
    'Soldier 76': 'Soldier_ 76',
};

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
    const folder = HERO_FOLDER[hero] || heroFolder || hero;
    const hit = findOgg(folder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function copyWiki(titles) {
    const list = Array.isArray(titles) ? titles : [titles];
    for (const title of list) {
        const resolved = await resolveWikiFileDownloadUrl(title);
        if (!resolved) continue;
        const atlas = wikiFileTitleToTheaterFilename(title);
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!fs.existsSync(dest)) await downloadWikiVoicelineFile(title, dest);
        return atlas;
    }
    throw new Error(`Wiki missing: ${list.join(' | ')}`);
}

async function copyVoiceOrWiki(hero, needle, wikiTitles) {
    try {
        return await copyVoice(hero, needle);
    } catch {
        return copyWiki(wikiTitles);
    }
}

function makeLine(hero, subtitles, voice, id = createDialogueLineId()) {
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

async function addConv(conversations, done, dedupeNeedle, name, specs) {
    if (hasSubtitle(conversations, dedupeNeedle)) {
        console.log(`skip (exists): ${name}`);
        return;
    }
    const conv = buildBlankConversationRecord();
    conv.name = name;
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = [];
    for (const [hero, subtitles, needle, wiki] of specs) {
        const voice = wiki
            ? await copyVoiceOrWiki(hero, needle, wiki)
            : await copyVoice(hero, needle);
        conv.lines.push(makeLine(hero, subtitles, voice));
    }
    conversations.push(conv);
    done.push(name);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // 1) Cryogenic Moira multipath — rebuild #697
    {
        const c =
            conversations.find((x) => x.id === '027f0a55-69df-47af-b602-4cc687952f6c') ||
            conversations.find((x) =>
                (x.lines || []).some(
                    (l) =>
                        /cryogenically/i.test(String(l.voice || '')) ||
                        /cryogenically/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Cryogenic Moira conversation not found');

        const opener = makeLine(
            'Moira',
            "I've read your report on cryogenically preserving severed appendages. I would be happy to assist in your research.",
            await copyVoice('Moira', 'cryogenically'),
            keepId(c.lines, (l) => /cryogenically|assist in your research/i.test(`${l.voice} ${l.subtitles}`)),
        );
        const mei = makeLine(
            'Mei',
            "No thank you. I don't think our methodologies are very aligned.",
            await copyVoice('Mei', 'methodologies'),
            keepId(c.lines, (l) => /methodologies/i.test(`${l.voice} ${l.subtitles}`)),
        );
        const alone = makeLine(
            'Moira',
            "Of course. I've heard you prefer working alone.",
            await copyVoice('Moira', 'prefer working alone'),
            keepId(c.lines, (l) => /prefer working alone/i.test(`${l.voice} ${l.subtitles}`)),
        );
        const hand = makeLine(
            'Moira',
            'Come now, doctor. I was only hoping to lend a hand.',
            await copyVoice('Moira', 'lend a hand'),
            keepId(c.lines, (l) => /lend a hand/i.test(`${l.voice} ${l.subtitles}`)),
        );

        c.name = 'Cryogenic research';
        c.lines = [opener, mei, alone, hand];
        c.paths = [
            {
                id: createDialoguePathId(),
                label: 'Working alone',
                lineIds: [opener.id, mei.id, alone.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Lend a hand',
                lineIds: [opener.id, mei.id, hand.id],
            },
        ];
        c.selectedPathId = c.paths[0].id;
        done.push('Cryogenic research → Moira multipath');
    }

    // 2) Captain Opara
    await addConv(conversations, done, 'Captain Opara', 'Captain Opara', [
        [
            'Soldier 76',
            'Dr. Zhou. Did Captain Opara make it back as well?',
            'Captain Opara',
        ],
        ['Mei', "I'm afraid not.", "I'm afraid not"],
        [
            'Soldier 76',
            '*(sigh)* He was a good man.',
            'He was a good man',
            ['File:Soldier 76 - He was a good man.ogg'],
        ],
        [
            'Mei',
            'He thought the same about you.',
            'thought the same about you',
        ],
    ]);

    // 3) Leftovers
    await addConv(conversations, done, 'steal your leftovers', 'Leftovers', [
        [
            'Soldier 76',
            'I was just in the kitchen. Anyone have something they wanna confess?',
            'kitchen',
            [
                'File:Soldier 76 - I was just in the kitchen. Anyone have something they want to confess.ogg',
            ],
        ],
        [
            'Mei',
            "I saw someone steal your leftovers, but I'm afraid to say who.",
            'leftovers',
            [
                "File:Mei - I saw someone steal your leftovers. But I'm afraid to say who.ogg",
            ],
        ],
        [
            'Soldier 76',
            '*(tired sigh)*',
            'tired sigh',
            ['File:Soldier 76 - (tired sigh).ogg'],
        ],
    ]);

    // 4) Torbjörn proud
    await addConv(conversations, done, 'quite the name for yourself', 'Quite the name', [
        [
            'Torbjörn',
            "Dr. Zhou! You've made quite the name for yourself.",
            'quite the name',
        ],
        [
            'Mei',
            "Oh, thank you! I think there's always more to learn.",
            'always more to learn',
        ],
        [
            'Torbjörn',
            'Quit being so humble. Nothing wrong with being proud of your work!',
            'proud of your work',
        ],
    ]);

    // 5) Fix Wuyang steam — Mei wrong Na! audio
    {
        const c =
            conversations.find((x) => x.id === '6493a612-5a2c-4c3d-b7ce-a27d03e671e1') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /fights with steam/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Steam / Wuyang conversation not found');

        const mei = c.lines.find((l) => l.hero === 'Mei');
        if (!mei) throw new Error('Mei steam line missing');

        mei.voice = await copyVoice('Mei', 'little heat could get us there');
        mei.subtitles =
            '*(sigh)* A little heat could get us there. Ooh! What about your sister?';
        mei.render = 'Heroic.png';

        // Also tidy Wuyang voices from MatchTalk if present
        const wuOpen = c.lines.find((l) => /fights with steam/i.test(String(l.subtitles || '')));
        if (wuOpen) {
            wuOpen.voice = await copyVoice('Wuyang', 'fights with steam');
            wuOpen.subtitles =
                "Too bad nobody here fights with steam. We'd have a whole cycle water locked down!";
        }
        const wuClose = c.lines.find((l) => /blood boiling/i.test(String(l.subtitles || '')));
        if (wuClose) {
            wuClose.voice = await copyVoice('Wuyang', 'blood boiling');
            wuClose.subtitles =
                '*(sigh)* She does get my blood boiling. So, I guess she fits the bill.';
        }

        if (!String(c.name || '').trim() || /^\d+$/.test(c.name)) {
            c.name = 'Fights with steam';
        }
        done.push(`fixed: ${c.name} (Mei MatchTalk heat/sister)`);
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Done:\n- ${done.join('\n- ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
