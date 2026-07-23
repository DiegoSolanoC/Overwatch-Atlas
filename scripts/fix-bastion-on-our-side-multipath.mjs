#!/usr/bin/env node
/**
 * Rebuild Brigitte/Bastion "Trust me everyone" as a 6-path multipath.
 * Remove partial duplicate #780.
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

const PURGE_IDS = ['7db7797f-3895-4646-91b1-17be995f308a']; // partial #780

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

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
}

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

    const c = raw.conversations.find(
        (x) =>
            x.id === '8e4b61d4-6066-4d5c-b6e6-a8bed53bb700' ||
            (Array.isArray(x.lines) &&
                x.lines.some((l) =>
                    String(l.subtitles || '').includes('Bastion on our side'),
                ) &&
                x.lines.some((l) => /sheepish beeps/i.test(String(l.subtitles || '')))),
    );
    if (!c) throw new Error('Bastion trust conversation not found');

    const opener = makeLine(
        keepId(c.lines, (l) => /Bastion on our side/i.test(l.subtitles || '')),
        'Brigitte',
        'Trust me, everyone. With Bastion on our side, this is going to go great!',
        await copyVoice('Brigitte', 'Bastion on our side'),
    );
    const beeps = makeLine(
        keepId(c.lines, (l) => /sheepish beeps/i.test(l.subtitles || '')),
        'Bastion',
        '*(sheepish beeps)*',
        await copyVoice('Bastion', 'sheepish beeps'),
    );

    let hanzoVoice = 'Hanzo_-_Hmph_(2).ogg';
    const hanzoHit = findOgg('Hanzo', 'Hmph');
    // Prefer short Hmph if present in atlas already
    if (fs.existsSync(path.join(VOICELINES_DIR, 'Hanzo_-_Hmph_(2).ogg'))) {
        hanzoVoice = 'Hanzo_-_Hmph_(2).ogg';
    } else if (hanzoHit) {
        hanzoVoice = await copyVoice('Hanzo', 'Hmph. An astute');
        // fallback keep Hmph_(2) if file exists from wiki
    }

    const hanzo = makeLine(
        keepId(c.lines, (l) => l.hero === 'Hanzo'),
        'Hanzo',
        'Hmph.',
        hanzoVoice,
    );
    const junkrat = makeLine(
        keepId(c.lines, (l) => l.hero === 'Junkrat'),
        'Junkrat',
        'Who, the bot? *(chuckles)* I thought he was decorative!',
        await copyVoice('Junkrat', 'decorative'),
    );
    const pharah = makeLine(
        keepId(c.lines, (l) => l.hero === 'Pharah'),
        'Pharah',
        "Just make sure you're shooting them, and not me, please.",
        await copyVoice('Pharah', 'shooting them and not me'),
    );
    const reaper = makeLine(
        keepId(c.lines, (l) => l.hero === 'Reaper'),
        'Reaper',
        'Looks like a pile of outdated junk to me.',
        await copyVoice('Reaper', 'outdated junk'),
    );
    const widow = makeLine(
        keepId(c.lines, (l) => l.hero === 'Widowmaker'),
        'Widowmaker',
        "*(sigh)* We're doomed.",
        await copyVoice('Widowmaker', "We're doomed"),
    );
    const happy = makeLine(
        keepId(
            c.lines,
            (l) => l.hero === 'Brigitte' && /happy to have you/i.test(l.subtitles || ''),
        ),
        'Brigitte',
        "Well, I'm happy to have you.",
        await copyVoice('Brigitte', 'happy to have you'),
    );

    c.name = 'Bastion on our side';
    c.lines = [opener, beeps, hanzo, junkrat, pharah, reaper, widow, happy];
    const reactors = [
        { label: 'Hanzo', line: hanzo },
        { label: 'Junkrat', line: junkrat },
        { label: 'Pharah', line: pharah },
        { label: 'Reaper', line: reaper },
        { label: 'Widowmaker', line: widow },
    ];
    c.paths = reactors.map(({ label, line }) => ({
        id: createDialoguePathId(),
        label,
        lineIds: [opener.id, beeps.id, line.id, happy.id],
    }));
    c.selectedPathId = c.paths[0].id;

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log('Rebuilt Bastion on our side multipath');
    for (const p of c.paths) console.log(`  path: ${p.label}`);
    for (const l of c.lines) console.log(`  ${l.hero}: ${l.subtitles.slice(0, 60)} | ${l.voice}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
