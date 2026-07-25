#!/usr/bin/env node
/**
 * Bastion pass:
 * - Junkrat channel nine news
 * - Lúcio "Can I get a beat?" multipath (2 beep-boxing versions)
 * - Wire Orisa E54 / Bastion retorting (wiki + MatchTalk)
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

function findAllOgg(heroFolder, needle) {
    const dir = path.join(EXTRACT_ROOT, heroFolder, 'MatchTalk');
    if (!fs.existsSync(dir)) return [];
    const n = needle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    /** @type {{ source: string, label: string, id: string }[]} */
    const hits = [];
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm === n || norm.includes(n)) {
            const id = name.match(/^(\d+)/)?.[1] || name;
            hits.push({ source: path.join(dir, name), label, id });
        }
    }
    hits.sort((a, b) => a.id.localeCompare(b.id));
    return hits;
}

async function copyVoice(hero, needle, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function copyVoiceAs(hero, needle, atlasName, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlasName;
}

async function copyDistinct(hero, hit, index) {
    const base = atlasFromLabel(hero, hit.label).replace(/\.ogg$/i, '');
    const atlas = index === 0 ? `${base}.ogg` : `${base}_(${index + 1}).ogg`;
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function copyWiki(title) {
    const resolved = await resolveWikiFileDownloadUrl(title);
    if (!resolved) throw new Error(`Wiki missing: ${title}`);
    const atlas = wikiFileTitleToTheaterFilename(title);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await downloadWikiVoicelineFile(title, dest);
    return atlas;
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

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // 1) Junkrat channel nine
    if (!hasSubtitle(conversations, 'channel nine news')) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Channel nine news';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Junkrat',
                "Jamison Fawkes, channel nine news. Mr. Gunbot, sir, how do you think the battle's going to go?",
                await copyVoice('Junkrat', 'channel nine news'),
            ),
            makeLine(
                'Bastion',
                '*(excited, talkative beeps)*',
                await copyVoice('Bastion', 'excited, talkative beeps'),
            ),
            makeLine(
                'Junkrat',
                'Could you repeat that in words? Hold on, breaking news! The moon has fallen into the ocean!',
                await copyVoice('Junkrat', 'moon has fallen'),
            ),
        ];
        conversations.push(conv);
        done.push(conv.name);
    }

    // 2) Lúcio beat multipath — two beep-boxing versions
    if (!hasSubtitle(conversations, 'Can I get a beat')) {
        const beepHits = findAllOgg('Bastion', 'beep boxing');
        if (beepHits.length < 2) {
            throw new Error(`Expected 2 beep boxing files, found ${beepHits.length}`);
        }
        const opener = makeLine(
            'Lúcio',
            'Can I get a beat?',
            await copyVoice('Lúcio', 'Can I get a beat', 'Lúcio'),
        );
        const beep1 = makeLine(
            'Bastion',
            '*(beep-boxes)*',
            await copyDistinct('Bastion', beepHits[0], 0),
        );
        const beep2 = makeLine(
            'Bastion',
            '*(beep-boxes)*',
            await copyDistinct('Bastion', beepHits[1], 1),
        );
        const closer = makeLine(
            'Lúcio',
            "Haha, perfect! You're the best.",
            await copyVoice('Lúcio', "You're the best", 'Lúcio'),
        );
        const conv = buildBlankConversationRecord();
        conv.name = 'Can I get a beat';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [opener, beep1, beep2, closer];
        conv.paths = [
            {
                id: createDialoguePathId(),
                label: 'Beep-box 1',
                lineIds: [opener.id, beep1.id, closer.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Beep-box 2',
                lineIds: [opener.id, beep2.id, closer.id],
            },
        ];
        conv.selectedPathId = conv.paths[0].id;
        conversations.push(conv);
        done.push(`${conv.name} (2 paths)`);
    }

    // 3) Orisa E54 — wire missing audio
    {
        const c =
            conversations.find((x) => x.id === '7c4a9e12-3b5f-4d8a-9f01-2e6b8c3d4a5f') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /barely recognized you/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Is that you / E54 conversation not found');

        const orisa = c.lines.find((l) => /barely recognized/i.test(String(l.subtitles || '')));
        const bastion = c.lines.find((l) => /retorting|refuting/i.test(String(l.subtitles || '')));
        if (!orisa || !bastion) throw new Error('E54 lines incomplete');

        // Prefer wiki titles (MatchTalk lacks Orisa line; Bastion uses "retorting" on wiki)
        orisa.voice = await copyWiki(
            'File:Orisa - Is that you, E-54. I barely recognized you.ogg',
        );
        orisa.subtitles = 'Is that you, E54? I barely recognized you!';
        orisa.render = 'Heroic.png';

        try {
            bastion.voice = await copyWiki('File:Bastion - (retorting beeps).ogg');
        } catch {
            // Fallback: MatchTalk labels this SFX as refuting (do NOT reuse Freja-path file blindly)
            bastion.voice = await copyVoiceAs(
                'Bastion',
                'refuting beeps',
                'Bastion_-_(retorting_beeps).ogg',
            );
        }
        bastion.subtitles = '*(retorting beeps)*';
        bastion.render = 'Heroic.png';

        if (!String(c.name || '').trim() || /^\d+$/.test(c.name)) {
            c.name = 'Is that you, E54';
        } else if (c.name === 'Is that you') {
            c.name = 'Is that you, E54';
        }
        done.push(`wired: ${c.name}`);
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
