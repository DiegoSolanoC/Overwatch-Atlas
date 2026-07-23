#!/usr/bin/env node
/**
 * Season 3 launch pass:
 * - Insert Jetpack Cat meows ASR missed
 * - Move Freja "play my game" line onto Vendetta/Freja
 * - Clean Kiriko "we are a family"
 * - Drop voice-duplicate stubs (Worth Conquering / Beyond Battle)
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
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
);

const ERA = 'Season 3 launch (YouTube placeholder)';

function makeLine(hero, subtitles, voice = '', render = 'Heroic.png') {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render,
    };
}

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findDialogueOgg(heroFolder, needle) {
    const dir = path.join(EXTRACT, heroFolder, 'MatchTalk');
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

async function copyDialogue(hero, needle, heroFolder = hero) {
    const hit = findDialogueOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function copyCatSfx(folderLabel, atlasVariant = 0) {
    const folder = path.join(EXTRACT, 'Jetpack Cat', 'MatchTalk', folderLabel);
    const oggs = fs
        .readdirSync(folder)
        .filter((n) => /\.ogg$/i.test(n) && /\.03F\./i.test(n))
        .sort();
    if (!oggs.length) throw new Error(`No oggs in ${folderLabel}`);
    const safe = folderLabel.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    const atlas =
        atlasVariant <= 0
            ? `Jetpack_Cat_-_${safe}.ogg`
            : `Jetpack_Cat_-_${safe}_(${atlasVariant + 1}).ogg`;
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(path.join(folder, oggs[atlasVariant % oggs.length]), dest);
    }
    return atlas;
}

function findEra(conversations, pred) {
    return conversations.find((c) => String(c?.eraName || '') === ERA && pred(c)) || null;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    let touched = 0;

    // Drop voice-fingerprint duplicates (older stubs)
    const removeIds = new Set([
        '0f512d24-3ea4-46bf-a71a-e36fdc95a8fa', // Worth Conquering (untagged dupe)
        'a908d6d4-9982-4ced-b69c-49c83b972031', // 187 Beyond Battle dupe
    ]);
    const before = conversations.length;
    const kept = conversations.filter((c) => !removeIds.has(c.id));
    raw.conversations = kept;
    console.log(`Removed ${before - kept.length} duplicate conversation(s)`);

    // Protect your kibble
    {
        const c = findEra(
            kept,
            (x) =>
                (x.lines || []).some((l) =>
                    String(l.subtitles || '').includes('fierce protectors'),
                ),
        );
        if (c) {
            c.name = 'Protect your kibble';
            const ana1 = c.lines.find((l) => /fierce protectors/i.test(l.subtitles)) || c.lines[0];
            const ana2 =
                c.lines.find((l) => /protect your kibble/i.test(l.subtitles)) || c.lines[1];
            const meow = makeLine(
                'Jetpack Cat',
                '*(questioning meows)*',
                await copyCatSfx('(questioning meows)'),
            );
            c.lines = [ana1, meow, ana2];
            touched += 1;
            console.log('Fixed Protect your kibble');
        }
    }

    // Keep a secret / Chuño
    {
        const c = findEra(
            kept,
            (x) =>
                (x.lines || []).some((l) =>
                    /keep a secret|rehearse my conversations/i.test(String(l.subtitles || '')),
                ),
        );
        if (c) {
            c.name = 'Keep a secret';
            c.lines = [
                makeLine(
                    'Illari',
                    'Can you keep a secret?',
                    await copyDialogue('Illari', 'Can you keep a secret'),
                ),
                makeLine(
                    'Jetpack Cat',
                    '*(affirmative meow)*',
                    await copyCatSfx('(affirmative meows)'),
                ),
                makeLine(
                    'Illari',
                    'Sometimes I rehearse my conversations with Chuño before I have them for real.',
                    await copyDialogue('Illari', 'rehearse my conversations with'),
                ),
            ];
            touched += 1;
            console.log('Fixed Keep a secret');
        }
    }

    // Want a treat
    {
        const c = findEra(
            kept,
            (x) =>
                (x.lines || []).some((l) =>
                    /want a treat|give us one/i.test(String(l.subtitles || '')),
                ),
        );
        if (c) {
            c.name = 'Want a treat';
            c.lines = [
                makeLine(
                    'Illari',
                    'You want a treat?',
                    await copyDialogue('Illari', 'You want a treat'),
                ),
                makeLine(
                    'Jetpack Cat',
                    '*(enthusiastic meow)*',
                    await copyCatSfx('(enthusiastic meows)'),
                ),
                makeLine(
                    'Illari',
                    'Me too, if only someone would give us one.',
                    await copyDialogue('Illari', 'If only someone would give us one'),
                ),
                makeLine(
                    'Jetpack Cat',
                    '*(agreeing meow)*',
                    await copyCatSfx('(agreeing meows)'),
                ),
            ];
            touched += 1;
            console.log('Fixed Want a treat');
        }
    }

    // Freja / Vendetta — add missing Freja closer
    {
        const c = findEra(
            kept,
            (x) =>
                (x.lines || []).some((l) =>
                    String(l.subtitles || '').includes("Talon's protection long enough"),
                ),
        );
        if (c) {
            c.name = 'Declare your loyalty';
            const hasCloser = (c.lines || []).some((l) =>
                /play my game|hated losing/i.test(String(l.subtitles || '')),
            );
            if (!hasCloser) {
                c.lines.push(
                    makeLine(
                        'Freja',
                        'You want to play my game? I thought you hated losing.',
                        await copyDialogue('Freja', 'play my game'),
                    ),
                );
            } else {
                const line = c.lines.find((l) => /play my game|hated losing/i.test(l.subtitles));
                line.hero = 'Freja';
                line.subtitles = 'You want to play my game? I thought you hated losing.';
                line.voice = await copyDialogue('Freja', 'play my game');
                line.render = 'Heroic.png';
            }
            touched += 1;
            console.log('Fixed Declare your loyalty (+ Freja closer)');
        }
    }

    // Kiriko / Vendetta — family only (strip Freja lines)
    {
        const c = findEra(
            kept,
            (x) =>
                (x.lines || []).some((l) =>
                    /Yokai aren't an army|we're a family/i.test(String(l.subtitles || '')),
                ),
        );
        if (c) {
            c.name = 'We are a family';
            c.lines = (c.lines || []).filter(
                (l) =>
                    /Hashimoto|Yokai|family|informant/i.test(String(l.subtitles || '')) &&
                    !/play my game|hated losing/i.test(String(l.subtitles || '')),
            );
            touched += 1;
            console.log('Cleaned We are a family');
        }
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Touched ${touched} Season 3 conversations`);
    console.log('Saved conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
