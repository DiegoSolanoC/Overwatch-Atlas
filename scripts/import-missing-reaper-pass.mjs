#!/usr/bin/env node
/**
 * Add/wire missing Reaper-pass interactions from MatchTalk (+ wiki fallback).
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
    'Soldier 76': 'Soldier_ 76',
};

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findOgg(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const dir = path.join(EXTRACT_ROOT, folder, 'MatchTalk');
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

async function searchWikiFiles(term) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', term);
    url.searchParams.set('srnamespace', '6');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'User-Agent': 'OverwatchAtlas/1.0' } });
    return ((await res.json()).query?.search || []).map((s) => s.title);
}

async function copyVoice(hero, needle, wikiSearchTerms = [], directWikiFiles = []) {
    const hit = findOgg(hero, needle);
    if (hit) {
        const atlas = atlasFromLabel(hero, hit.label);
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
        return atlas;
    }

    for (const title of directWikiFiles) {
        const resolved = await resolveWikiFileDownloadUrl(title);
        if (!resolved) continue;
        const atlas = wikiFileTitleToTheaterFilename(title);
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!fs.existsSync(dest)) await downloadWikiVoicelineFile(title, dest);
        console.log(`  wiki: ${atlas}`);
        return atlas;
    }

    const heroVariants = [hero, hero.replace(':', ''), hero.replace('Soldier 76', 'Soldier: 76')];
    const needleNorm = String(needle)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const needleTokens = needleNorm.split(/\s+/).filter((t) => t.length >= 4);
    const terms = wikiSearchTerms.length ? wikiSearchTerms : [`${hero} ${needle}`];
    for (const term of terms) {
        const titles = await searchWikiFiles(term);
        for (const title of titles) {
            const okHero = heroVariants.some((h) => new RegExp(`^File:${h}\\s-`, 'i').test(title));
            if (!okHero) continue;
            const dialogue = title
                .replace(/^File:[^-]+-\s*/i, '')
                .replace(/\.ogg$/i, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
            // Require the needle (or most significant tokens) to appear in the file dialogue.
            const titleOk =
                dialogue.includes(needleNorm) ||
                (needleTokens.length > 0 &&
                    needleTokens.filter((t) => dialogue.includes(t)).length >=
                        Math.min(2, needleTokens.length));
            if (!titleOk) continue;
            const resolved = await resolveWikiFileDownloadUrl(title);
            if (!resolved) continue;
            const atlas = wikiFileTitleToTheaterFilename(title);
            const dest = path.join(VOICELINES_DIR, atlas);
            if (!fs.existsSync(dest)) await downloadWikiVoicelineFile(title, dest);
            console.log(`  wiki: ${atlas}`);
            return atlas;
        }
    }
    throw new Error(`No MatchTalk/wiki for ${hero}: ${needle}`);
}

function makeLine(hero, subtitles, voice) {
    return {
        id: createDialogueLineId(),
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

function findConv(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.find((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    // 1) Kiriko / Mizuki / Reaper — Ajaraka
    if (!hasSubtitle(conversations, 'Ajaraka mokuren')) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Ajaraka mokuren';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Kiriko',
                'Ajaraka mokuren tekerettsuno pa! (アジャらか木蓮　テケレッツのパ！)',
                await copyVoice('Kiriko', 'Ajaraka mokuren'),
            ),
            makeLine(
                'Mizuki',
                'Um... Gesundheit?',
                await copyVoice('Mizuki', 'Gesundheit'),
            ),
            makeLine(
                'Kiriko',
                "I was trying to get rid of that grim Reaper for you, but... he's still here.",
                await copyVoice('Kiriko', 'grim Reaper'),
            ),
            makeLine(
                'Reaper',
                '*(annoyed grumble)*',
                await copyVoice('Reaper', 'annoyed grumble'),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 2) Mizuki / Reaper — scythe
    if (!hasSubtitle(conversations, 'reap souls without a scythe')) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Without a scythe';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Mizuki',
                'You gonna reap souls without a scythe?',
                await copyVoice('Mizuki', 'without a scythe'),
            ),
            makeLine(
                'Reaper',
                "Guns get the job done. If you'd ever fired one, you'd know.",
                await copyVoice('Reaper', 'Guns get the job done'),
            ),
            makeLine(
                'Mizuki',
                "Okay, hand me yours. Let's see what I can do.",
                await copyVoice('Mizuki', 'hand me yours'),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 3) Reaper / Soldier 76 — Overwatch is back
    if (!hasSubtitle(conversations, "surprised you aren't to blame")) {
        const conv = buildBlankConversationRecord();
        conv.name = 'Finally agree';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Reaper',
                "Overwatch is back. I'm surprised you aren't to blame.",
                await copyVoice('Reaper', "Overwatch is back"),
            ),
            makeLine(
                'Soldier 76',
                'I have plenty of trouble without dredging up old mistakes.',
                await copyVoice('Soldier 76', 'plenty of trouble'),
            ),
            makeLine(
                'Reaper',
                'Hmph. We finally agree on something.',
                await copyVoice('Reaper', 'finally agree'),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 4) Sierra / Reaper — Gabriel Reyes / Soldier 24
    if (!hasSubtitle(conversations, 'Soldier: 24') && !hasSubtitle(conversations, 'Soldier 24, right')) {
        const conv = buildBlankConversationRecord();
        conv.name = "Don't call me anything";
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [
            makeLine(
                'Sierra',
                'Gabriel Reyes... I know that name. Soldier: 24, right?',
                await copyVoice('Sierra', 'Gabriel Reyes'),
            ),
            makeLine(
                'Reaper',
                'Nobody calls me that anymore.',
                await copyVoice('Reaper', 'Nobody calls me that anymore'),
            ),
            makeLine(
                'Sierra',
                'Well, I\'m not about to call you "Reaper".',
                await copyVoice('Sierra', 'not about to call you'),
            ),
            makeLine(
                'Reaper',
                "Then... don't call me anything.",
                await copyVoice('Reaper', "don't call me anything"),
            ),
        ];
        conversations.push(conv);
        added.push(conv.name);
    }

    // 5) Bigger threats — wire missing audio (exists as empty voices)
    // Wiki files are REMOVED / not in MatchTalk; soft-fail so other adds still save.
    {
        const conv = findConv(conversations, "You've been quiet, Jack");
        if (conv) {
            const wire = async (pred, hero, needle, wikiTerms, directFiles = []) => {
                const line = conv.lines.find(pred);
                if (!line) return;
                if (String(line.voice || '').trim()) return;
                try {
                    line.voice = await copyVoice(hero, needle, wikiTerms, directFiles);
                    line.render = line.render || 'Heroic.png';
                    return true;
                } catch (err) {
                    console.warn(`  skip ${hero} "${needle}": ${err.message}`);
                    return false;
                }
            };
            const ok = [];
            ok.push(
                await wire(
                    (l) => /quiet, Jack/i.test(l.subtitles || ''),
                    'Reaper',
                    'quiet, Jack',
                    ['Reaper quiet Jack', 'Reaper Given up'],
                    ["File:Reaper - You've been quiet, Jack. Given up.ogg"],
                ),
            );
            ok.push(
                await wire(
                    (l) => /bigger threats/i.test(l.subtitles || ''),
                    'Soldier 76',
                    'bigger threats',
                    ['Soldier 76 bigger threats', 'Soldier 76 stopped wasting'],
                    [
                        'File:Soldier 76 - I stopped wasting my time. There are bigger threats to this world than Talon.ogg',
                    ],
                ),
            );
            ok.push(
                await wire(
                    (l) => /change that/i.test(l.subtitles || ''),
                    'Reaper',
                    'change that',
                    ['Reaper We will change that', "Reaper Is that so"],
                    ["File:Reaper - Is that so. We'll change that.ogg"],
                ),
            );
            if (!String(conv.name || '').trim() || /^\d+$/.test(conv.name)) {
                conv.name = 'Bigger threats';
            }
            const wired = ok.filter(Boolean).length;
            added.push(
                wired
                    ? `wired: ${conv.name} (${wired}/3)`
                    : `unwired: ${conv.name} (no MatchTalk/wiki audio)`,
            );
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
