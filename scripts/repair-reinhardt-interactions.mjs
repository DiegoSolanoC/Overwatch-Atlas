#!/usr/bin/env node
/**
 * Post-import cleanup for Reinhardt wiki interactions:
 * - Fix Jetpack Cat multi-path (#979): Mercy path vs Wuyang+Brigitte path, both end on Reinhardt
 * - Remove duplicate partial conversations (Kitten me, Not a baby)
 * - Remove broken Zenyatta Before the Crisis duplicate (#987)
 * - Apply friendly names to imported Reinhardt rows
 */

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

const REMOVE_NAMES = new Set(['Kitten me', 'Not a baby', '987', 'Grandkids — Artists']);
const RENAME = {
    '973': 'High spirits',
    '974': 'Glorious day',
    '975': 'Grandkids — Artists',
    '976': 'Grandkids — Lucas',
    '977': 'Tripped over your sword',
    '978': 'Every battle is a victory',
    '979': 'Catting me',
    '980': 'Missing an eye',
    '981': 'Perspicacious rapscallion',
    '982': 'The loud one',
    '983': 'Techno-polka',
    '984': 'Märta\'s manuscript',
    '985': 'Medieval times',
    '986': 'Forever changed',
};

/** @param {unknown[]} conversations */
function fixCattingMe(conversations) {
    const conv = conversations.find((c) => c?.name === '979' || c?.name === 'Catting me');
    if (!conv || !Array.isArray(conv.lines) || conv.lines.length < 6) return false;

    const byHero = (hero) => conv.lines.filter((l) => l.hero === hero);
    const reinhardt = byHero('Reinhardt');
    const opening = reinhardt.find((l) => String(l.subtitles || '').includes('catting'));
    const finale = reinhardt.find((l) => String(l.subtitles || '').includes('not a baby'));
    const cat = conv.lines.find((l) => l.hero === 'Jetpack Cat');
    const mercy = conv.lines.find((l) => l.hero === 'Mercy');
    const wuyang = conv.lines.find((l) => l.hero === 'Wuyang');
    const brigitte = conv.lines.find((l) => l.hero === 'Brigitte');

    if (!opening || !finale || !cat || !mercy || !wuyang || !brigitte) return false;

    opening.voice =
        opening.voice ||
        'Reinhardt_-_A_cat__In_a_jetpack_!_(laugh)_You\'ve_got_to_be__catting__me!_(laugh).ogg';
    opening.subtitles =
        'A cat? In a jetpack?! **laugh** You’ve got to be catting me! **laugh**';
    brigitte.subtitles = 'Ugh, trust me. I\'ve already tried.';

    conv.name = 'Catting me';
    conv.paths = [
        {
            id: conv.paths?.[0]?.id || 'rein-cat-mercy-path',
            label: 'Mercy — Kitten me',
            lineIds: [opening.id, cat.id, mercy.id, finale.id],
        },
        {
            id: conv.paths?.[1]?.id || 'rein-cat-wuyang-path',
            label: 'Wuyang — Brigitte — Not a baby',
            lineIds: [opening.id, cat.id, wuyang.id, brigitte.id, finale.id],
        },
    ];
    conv.selectedPathId = conv.paths[0].id;
    return true;
}

/** @param {object[]} conversations @param {string[]} voicelines */
function resolveEmptyVoices(conversations, voicelines) {
    let n = 0;
    for (const conv of conversations) {
        if (!RENAME[conv.name] && conv.name !== 'Catting me') continue;
        for (const line of conv.lines || []) {
            if (line.voice) continue;
            const resolved = resolveLineVoiceFile(line, voicelines);
            if (resolved) {
                line.voice = resolved;
                n += 1;
            }
        }
    }
    return n;
}

async function main() {
    const raw = await fs.readFile(CONVERSATIONS_PATH, 'utf8');
    const data = JSON.parse(raw);
    const conversations = Array.isArray(data.conversations) ? data.conversations : data;

    const before = conversations.length;
    const filtered = conversations.filter((c) => !REMOVE_NAMES.has(String(c?.name || '').trim()));
    const removed = before - filtered.length;

    const catFixed = fixCattingMe(filtered);
    for (const [from, to] of Object.entries(RENAME)) {
        const conv = filtered.find((c) => c?.name === from);
        if (conv) conv.name = to;
    }

    const ctx = await scanTheaterAssets();
    const voicesResolved = resolveEmptyVoices(filtered, ctx.voicelines);

    const payload = Array.isArray(data.conversations) ? { ...data, conversations: filtered } : filtered;
    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log('Removed duplicates:', removed, [...REMOVE_NAMES].join(', '));
    console.log('Catting me multi-path fixed:', catFixed);
    console.log('Renamed Reinhardt imports:', Object.keys(RENAME).length);
    console.log('Resolved empty voicelines:', voicesResolved);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
