#!/usr/bin/env node
/**
 * Freja pass:
 * - Wire #410 Ashe Grand Mesa opener (reuse theater/MatchTalk file)
 * - Add missing Sierra × Freja interactions
 * - Fix Sombra "secretive types" wrong voice on #429
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

const ASHE_GRAND_MESA_ATLAS =
    "Ashe_-_You'd_better_do_quick_work_in_Grand_Mesa._Your_boss_paid_for_a_distraction,_not_a_rescue.ogg";

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

async function addConv(conversations, added, dedupeNeedle, name, specs) {
    if (hasSubtitle(conversations, dedupeNeedle)) {
        console.log(`skip (exists): ${name}`);
        return;
    }
    const conv = buildBlankConversationRecord();
    conv.name = name;
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = [];
    for (const [hero, subtitles, needle] of specs) {
        conv.lines.push(makeLine(hero, subtitles, await copyVoice(hero, needle)));
    }
    conversations.push(conv);
    added.push(name);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    // 1) #410 Ashe Grand Mesa — reuse existing theater asset (same line as Emre path)
    {
        const c =
            conversations.find((x) => x.id === '9844aacf-6de1-478a-8c5e-fea12ef9c970') ||
            conversations.find(
                (x) =>
                    String(x.name) === '410' ||
                    (x.lines || []).some((l) =>
                        /worry about your people/i.test(String(l.subtitles || '')),
                    ),
            );
        if (!c) throw new Error('Conversation 410 not found');

        const asheDest = path.join(VOICELINES_DIR, ASHE_GRAND_MESA_ATLAS);
        if (!fs.existsSync(asheDest)) {
            // Prefer MatchTalk if present under any wording
            const hit =
                findOgg('Ashe', 'Grand Mesa') ||
                findOgg('Ashe', 'not a rescue') ||
                findOgg('Ashe', 'distraction');
            if (hit) await fsp.copyFile(hit.source, asheDest);
            else throw new Error(`Missing Ashe Grand Mesa audio: ${ASHE_GRAND_MESA_ATLAS}`);
        }

        const asheLine = c.lines.find((l) => l.hero === 'Ashe');
        if (!asheLine) throw new Error('410 missing Ashe line');
        asheLine.voice = ASHE_GRAND_MESA_ATLAS;
        asheLine.subtitles =
            "You better do quick work in Grand Mesa. Your boss paid for a distraction. Not a rescue.";
        asheLine.render = asheLine.render || 'Heroic.png';

        const frejaLine = c.lines.find((l) => l.hero === 'Freja');
        if (frejaLine && !String(frejaLine.voice || '').trim()) {
            frejaLine.voice = await copyVoice('Freja', "I'll worry about mine");
        }

        if (!String(c.name || '').trim() || /^\d+$/.test(c.name)) {
            c.name = 'Distraction not rescue';
        }
        added.push(`wired: ${c.name} (Ashe Grand Mesa)`);
    }

    // 2) Sierra / Freja — behind bars
    await addConv(conversations, added, "won't quit until you're both behind bars", 'Behind bars', [
        [
            'Sierra',
            "You might've gotten away from me once, but I won't quit until you're both behind bars.",
            'behind bars',
        ],
        [
            'Freja',
            "If your tracking skills are like the security at Grand Mesa, I expect I'll be fine.",
            'tracking skills',
        ],
    ]);

    // 3) Sierra / Freja — Naughton Vault
    await addConv(conversations, added, 'Naughton Vault', 'Naughton Vault', [
        [
            'Sierra',
            "The Naughton Vault requires top security clearance. How'd you get your intel?",
            'Naughton Vault',
        ],
        [
            'Freja',
            "Sorry, kid. Confidentiality's just as important in my line of work as it is in yours.",
            'Confidentiality',
        ],
    ]);

    // 4) Sierra / Freja — Let this one go
    await addConv(conversations, added, 'Let this one go. For your own good', 'Let this one go', [
        [
            'Sierra',
            'Then as a professional, you know I have to get answers.',
            'have to get answers',
        ],
        ['Freja', 'Let this one go. For your own good.', 'Let this one go'],
    ]);

    // 5) Sombra #429 — fix wrong opener voice
    {
        const c =
            conversations.find((x) => x.id === 'd08a0681-ad12-41a0-88c8-e888059ca2fc') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /secretive types/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Secretive types conversation not found');

        const opener = c.lines.find((l) => /secretive types/i.test(String(l.subtitles || '')));
        const freja = c.lines.find((l) => /cover my tracks/i.test(String(l.subtitles || '')));
        const closer = c.lines.find((l) => /always a trail/i.test(String(l.subtitles || '')));
        if (!opener || !freja || !closer) throw new Error('Secretive types lines incomplete');

        opener.hero = 'Sombra';
        opener.voice = await copyVoice('Sombra', 'secretive types');
        opener.subtitles = 'You secretive types are so much fun to expose.';
        opener.render = 'Heroic.png';

        freja.hero = 'Freja';
        freja.voice = await copyVoice('Freja', "cover my tracks");
        freja.subtitles = "You think I don't cover my tracks?";
        freja.render = 'Heroic.png';

        closer.hero = 'Sombra';
        closer.voice = await copyVoice('Sombra', 'always a trail');
        closer.subtitles = "Come on, encanto. You know there's always a trail.";
        closer.render = 'Heroic.png';

        if (!String(c.name || '').trim() || /^\d+$/.test(c.name)) {
            c.name = 'Secretive types';
        }
        added.push(`fixed: ${c.name} (Sombra opener)`);
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Done:\n- ${added.join('\n- ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
