#!/usr/bin/env node
/**
 * Post-import cleanup for Sigma wiki interactions:
 * - Expand inquiry (#702) into Junkrat / Mei / Moira / Venture multipath
 * - Rebuild broken Moira "thrills me" multipath (#744)
 * - Friendly names for related Sigma conversations
 */

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
    createDialoguePathId,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

const REMOVE_NAMES = new Set([]);

const RENAME = {
    '702': 'Inquiry',
    '744': 'Brilliant inquiries',
    '973': 'Up top, Doctor',
    '974': 'Where Max lives',
    '975': 'Magnificent electromagnetism',
};

/**
 * @param {string} hero
 * @param {string} subtitles
 * @param {string} [voice]
 * @param {string} [render]
 */
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

/**
 * @param {object} conversations
 */
function fixInquiryMultipath(conversations) {
    const conv = conversations.find(
        (c) =>
            c?.name === '702' ||
            c?.name === 'Inquiry' ||
            (Array.isArray(c?.lines) &&
                String(c.lines[0]?.subtitles || '').includes('inquiry is unnecessary')),
    );
    if (!conv) return false;

    const opening =
        conv.lines.find((l) => String(l.subtitles || '').includes('inquiry is unnecessary')) ||
        conv.lines[0];
    if (!opening || opening.hero !== 'Sigma') return false;

    const meiExisting = conv.lines.find((l) => l.hero === 'Mei');
    const junkrat =
        conv.lines.find((l) => l.hero === 'Junkrat') ||
        makeLine('Junkrat', "Ah, Xeno's Paradox!");
    const mei =
        meiExisting ||
        makeLine(
            'Mei',
            'Well, maybe you know a little bit, and you keep asking questions until you figure it out!',
            'Mei_-_Well,_maybe_you_know_a_little_bit,_and_you_keep_asking_questions_until_you_figure_it_out!.ogg',
        );
    const moira =
        conv.lines.find((l) => l.hero === 'Moira') ||
        makeLine('Moira', 'Ugh. Somehow even more tiresome than the chicken and the egg.');
    const venture =
        conv.lines.find((l) => l.hero === 'Venture') ||
        makeLine(
            'Venture',
            "Maybe inquire why you're not inquiring. I mean, when I'm not inquiring, I know something's wrong.",
        );

    opening.subtitles =
        "If you know what you're looking for, inquiry is unnecessary. But if you don't know... how do you inquire?";
    opening.voice =
        opening.voice ||
        "Sigma_-_If_you_know_what_you're_looking_for,_inquiry_is_unnecessary._But_if_you_don't_know,_how_do_you_inquire.ogg";

    conv.name = 'Inquiry';
    conv.lines = [opening, junkrat, mei, moira, venture];
    conv.paths = [
        {
            id: conv.paths?.[0]?.id || createDialoguePathId(),
            label: "Junkrat — Xeno's Paradox",
            lineIds: [opening.id, junkrat.id],
        },
        {
            id: conv.paths?.[1]?.id || createDialoguePathId(),
            label: 'Mei — Keep asking',
            lineIds: [opening.id, mei.id],
        },
        {
            id: conv.paths?.[2]?.id || createDialoguePathId(),
            label: 'Moira — Chicken and the egg',
            lineIds: [opening.id, moira.id],
        },
        {
            id: conv.paths?.[3]?.id || createDialoguePathId(),
            label: 'Venture — Why not inquiring',
            lineIds: [opening.id, venture.id],
        },
    ];
    conv.selectedPathId = conv.paths[0].id;
    return true;
}

/**
 * @param {object[]} conversations
 */
function fixBrilliantInquiries(conversations) {
    const conv = conversations.find(
        (c) =>
            c?.name === '744' ||
            c?.name === 'Brilliant inquiries' ||
            (Array.isArray(c?.lines) &&
                c.lines.some((l) => String(l.subtitles || '').includes('know that one knows nothing'))),
    );
    if (!conv) return false;

    const openings = [
        {
            hero: 'Sigma',
            subtitles: 'Can one know that one knows nothing?',
            voice: 'Sigma_-_Can_one_know_that_one_knows_nothing.ogg',
            label: 'Knows nothing',
        },
        {
            hero: 'Sigma',
            subtitles: 'Can a single grain of sand differentiate between heap and not-heap?',
            voice: 'Sigma_-_Can_a_single_grain_of_sand_differentiate_between_heap_and_not-heap.ogg',
            label: 'Heap of sand',
        },
        {
            hero: 'Sigma',
            subtitles: "If the universe is a simulation, why aren't there more elephant seals?",
            voice: "Sigma_-_If_the_universe_is_a_simulation,_why_aren't_there_more_elephant_seals.ogg",
            label: 'Elephant seals',
        },
        {
            hero: 'Sigma',
            subtitles: 'Someone must build a particle collider around the sun!',
            voice: 'Sigma_-_Someone_must_build_a_particle_collider_around_the_sun.ogg',
            label: 'Particle collider',
        },
    ];

    const moira = makeLine(
        'Moira',
        'It thrills me to put aside my preparations and humor your brilliant inquiries, Doctor. It thrills me!',
        'Moira_-_It_thrills_me_to_put_aside_my_preparations_and_humor_your_brilliant_inquiries,_Doctor._It_thrills_me.ogg',
    );
    const thankYou = makeLine(
        'Sigma',
        'Kind words. Thank you!',
        'Sigma_-_Kind_words._Thank_you.ogg',
    );

    const openingLines = openings.map((o) => makeLine(o.hero, o.subtitles, o.voice));
    conv.name = 'Brilliant inquiries';
    conv.lines = [...openingLines, moira, thankYou];
    conv.paths = openingLines.map((line, index) => ({
        id: createDialoguePathId(),
        label: openings[index].label,
        lineIds: [line.id, moira.id, thankYou.id],
    }));
    conv.selectedPathId = conv.paths[0].id;
    return true;
}

/**
 * @param {object[]} conversations
 * @param {string[]} voicelines
 */
function resolveEmptyVoices(conversations, voicelines) {
    const names = new Set([
        'Inquiry',
        'Brilliant inquiries',
        'Up top, Doctor',
        'Where Max lives',
        'Magnificent electromagnetism',
        '702',
        '744',
        '975',
        '976',
        '977',
    ]);
    let n = 0;
    for (const conv of conversations) {
        if (!names.has(String(conv?.name || '').trim())) continue;
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
    const filtered = conversations.filter((c) => {
        const name = String(c?.name || '').trim();
        if (REMOVE_NAMES.has(name)) return false;
        if (name.endsWith('(wiki duplicate)')) return false;
        return true;
    });
    const removed = before - filtered.length;

    const inquiryFixed = fixInquiryMultipath(filtered);
    const thrillsFixed = fixBrilliantInquiries(filtered);

    for (const [from, to] of Object.entries(RENAME)) {
        const conv = filtered.find((c) => c?.name === from);
        if (conv) conv.name = to;
    }

    // Second pass: remove wiki duplicates after rename
    const cleaned = filtered.filter((c) => !String(c?.name || '').endsWith('(wiki duplicate)'));

    const ctx = await scanTheaterAssets();
    const voicesResolved = resolveEmptyVoices(cleaned, ctx.voicelines);

    const payload = Array.isArray(data.conversations) ? { ...data, conversations: cleaned } : cleaned;
    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log('Removed duplicates:', removed + (filtered.length - cleaned.length));
    console.log('Inquiry multipath fixed:', inquiryFixed);
    console.log('Brilliant inquiries multipath fixed:', thrillsFixed);
    console.log('Resolved empty voicelines:', voicesResolved);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
