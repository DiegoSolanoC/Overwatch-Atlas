#!/usr/bin/env node
/**
 * Vendetta pass:
 * - Rebuild Prize Hunter as Emre / Freja multipath
 * - Fix Absolute Victory Hanzo voice + subtitle (unchanged → unchallenged)
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
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // --- Prize Hunter multipath ---
    {
        const c =
            conversations.find((x) => x.id === '3c892232-3b34-45dc-858b-2c262445756e') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /prized hunter is still watching/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Prize Hunter conversation not found');

        const opener = makeLine(
            keepId(c.lines, (l) => /prized hunter/i.test(l.subtitles || '')),
            'Vendetta',
            "I see Maximilien's prized hunter is still watching over her quarry.",
            await copyVoice('Vendetta', 'prized hunter'),
        );
        const looks = makeLine(
            keepId(c.lines, (l) => /looks that way/i.test(l.subtitles || '')),
            'Freja',
            'It looks that way.',
            await copyVoice('Freja', 'looks that way'),
        );
        const allegiance = makeLine(
            keepId(c.lines, (l) => /sign of allegiance/i.test(l.subtitles || '')),
            'Vendetta',
            "Then I'll take your continued presence here as a sign of allegiance.",
            await copyVoice('Vendetta', 'sign of allegiance'),
        );
        const emre = makeLine(
            keepId(c.lines, (l) => /package deal/i.test(l.subtitles || '')),
            'Emre',
            "We're a package deal, V. If you want me, you put your trust in her.",
            await copyVoice('Emre', 'package deal'),
        );
        const frejaClose = makeLine(
            keepId(
                c.lines,
                (l) =>
                    l.hero === 'Freja' && /paying my price|whatever you'd like/i.test(l.subtitles || ''),
            ),
            'Freja',
            "Keep paying my price, and it's a sign of whatever you'd like.",
            await copyVoice('Freja', 'paying my price'),
        );

        c.name = 'Prize Hunter';
        c.lines = [opener, looks, allegiance, emre, frejaClose];
        c.paths = [
            {
                id: createDialoguePathId(),
                label: 'Emre',
                lineIds: [opener.id, looks.id, allegiance.id, emre.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Freja',
                lineIds: [opener.id, looks.id, allegiance.id, frejaClose.id],
            },
        ];
        c.selectedPathId = c.paths[0].id;
        done.push('Prize Hunter → Emre/Freja multipath');
    }

    // --- Absolute Victory Hanzo fix ---
    {
        const c =
            conversations.find((x) => x.id === 'aaa15cc8-af81-4cb3-b4dc-b5fa35b3618a') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /last son of Shimada/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Absolute Victory conversation not found');

        const opener = makeLine(
            keepId(c.lines, (l) => /last son of Shimada/i.test(l.subtitles || '')),
            'Vendetta',
            'So this is how the last son of Shimada wields his legacy? Skulking about like a fannullone.',
            await copyVoice('Vendetta', 'fannullone'),
        );
        const hanzo = makeLine(
            keepId(c.lines, (l) => l.hero === 'Hanzo'),
            'Hanzo',
            'The Hashimoto cannot go unchallenged. It is my duty to protect my home from tyrants like you.',
            await copyVoice('Hanzo', 'Hashimoto cannot go unchallenged'),
        );
        const closer = makeLine(
            keepId(c.lines, (l) => /victory is absolute/i.test(l.subtitles || '')),
            'Vendetta',
            '*(laughs)* Call it tyranny if you like. At least my victory is absolute.',
            await copyVoice('Vendetta', 'victory is absolute'),
        );

        c.name = 'Absolute Victory';
        c.lines = [opener, hanzo, closer];
        delete c.paths;
        delete c.selectedPathId;
        done.push('Absolute Victory — Hanzo unchallenged + correct voice');
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
