#!/usr/bin/env node
/**
 * Tracer pass:
 * - Junkrat / Tracer "Cheers love"
 * - Tracer / Junkrat mayhem
 * - Tracer / Sombra phone unlock
 * - Rebuild Lúcio "fighting spirit" as Bastion / D.Va / Pharah / Tracer multipath
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

/** Partial Bastion-only fighting spirit entry — merge into multipath. */
const PURGE_IDS = ['73f2a750-d648-4c27-8202-94ca5b13779c'];

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
    const hit = findOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
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

function hasSubtitle(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.some((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
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
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    // 1) Junkrat / Tracer — Cheers love
    if (!hasSubtitle(conversations, "Cheers love! It's time to save the world")) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Cheers love';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Junkrat',
                "Cheers love! It's time to save the world!",
                await copyVoice('Junkrat', 'Cheers love'),
            ),
            makeLine(
                'Tracer',
                'Oh, what? Again?',
                await copyVoice('Tracer', 'What, again'),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 2) Tracer / Junkrat — mayhem
    if (!hasSubtitle(conversations, 'perfect day for some mayhem')) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Perfect day for mayhem';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Tracer',
                "It's a perfect day for some mayhem!",
                await copyVoice('Tracer', 'perfect day for some mayhem'),
            ),
            makeLine(
                'Junkrat',
                "That's what I am always sayin'!",
                await copyVoice('Junkrat', "That's what I'm always saying"),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 3) Tracer / Sombra — phone unlock
    if (!hasSubtitle(conversations, 'locked out of my phone')) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Locked out';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Tracer',
                "Ugh. Entered my passcode too quick and now I'm locked out of my phone!",
                await copyVoice('Tracer', 'locked out of my phone'),
            ),
            makeLine(
                'Sombra',
                'I can unlock it for you, cariño.',
                await copyVoice('Sombra', 'unlock it for you'),
            ),
            makeLine(
                'Tracer',
                'Thanks, love! Oh-- wait. You tryna pull a fast one on me?',
                await copyVoice('Tracer', 'pull a fast one'),
            ),
            makeLine(
                'Sombra',
                "Hm. You're smarter than you look.",
                await copyVoice('Sombra', 'smarter than you look'),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 4) Fighting spirit multipath — merge Bastion + Tracer singles
    {
        const existing =
            conversations.find((c) => c.id === '26330091-4369-41ea-8716-f2235e103f0b') ||
            conversations.find(
                (c) =>
                    (c.lines || []).some((l) =>
                        /fighting spirit/i.test(String(l.subtitles || '')),
                    ) &&
                    (c.lines || []).some((l) => l.hero === 'Tracer'),
            );

        const openerVoice = await copyVoice('Lúcio', 'fighting spirit', 'Lúcio');
        const closerVoice = await copyVoice('Lúcio', 'exactly what I', 'Lúcio');
        const bastionVoice = await copyVoice('Bastion', 'spirited beeps');
        const dvaVoice = await copyVoice('D.Va', 'growl');
        const pharahVoice = await copyVoice('Pharah', 'growl');
        const tracerVoice = await copyVoice('Tracer', 'growl');

        const opener = makeLine(
            'Lúcio',
            "All right. Let's hear that fighting spirit!",
            openerVoice,
            keepId(existing?.lines, (l) => /fighting spirit/i.test(l.subtitles || '')),
        );
        const bastion = makeLine(
            'Bastion',
            '*(spirited beeps)*',
            bastionVoice,
            keepId(existing?.lines, (l) => /spirited beeps/i.test(l.subtitles || '')),
        );
        const dva = makeLine('D.Va', 'Grrr!', dvaVoice, keepId(existing?.lines, (l) => l.hero === 'D.Va'));
        const pharah = makeLine(
            'Pharah',
            'Rawrrr!',
            pharahVoice,
            keepId(existing?.lines, (l) => l.hero === 'Pharah'),
        );
        const tracer = makeLine(
            'Tracer',
            'Grarrr!',
            tracerVoice,
            keepId(
                existing?.lines,
                (l) => l.hero === 'Tracer' && /gra|rar|growl/i.test(l.subtitles || ''),
            ),
        );
        const closer = makeLine(
            'Lúcio',
            "That's exactly what I'm talking about! Woo!",
            closerVoice,
            keepId(existing?.lines, (l) => /exactly what I/i.test(l.subtitles || '')),
        );

        const reactors = [
            { label: 'Bastion', line: bastion },
            { label: 'D.Va', line: dva },
            { label: 'Pharah', line: pharah },
            { label: 'Tracer', line: tracer },
        ];

        if (existing) {
            existing.name = 'Fighting Spirit';
            existing.lines = [opener, bastion, dva, pharah, tracer, closer];
            existing.paths = reactors.map(({ label, line }) => ({
                id: createDialoguePathId(),
                label,
                lineIds: [opener.id, line.id, closer.id],
            }));
            existing.selectedPathId = existing.paths[0].id;
            added.push('multipath: Fighting Spirit (4 paths)');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Fighting Spirit';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [opener, bastion, dva, pharah, tracer, closer];
            conv.paths = reactors.map(({ label, line }) => ({
                id: createDialoguePathId(),
                label,
                lineIds: [opener.id, line.id, closer.id],
            }));
            conv.selectedPathId = conv.paths[0].id;
            conversations.push(conv);
            added.push(`new multipath: ${conv.name}`);
        }
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(added.length ? `Done:\n- ${added.join('\n- ')}` : 'Nothing to do');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
