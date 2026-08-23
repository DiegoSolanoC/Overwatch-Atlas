#!/usr/bin/env node
/**
 * Classic-era missing-audio pass:
 * 1) Try HeroVoice extract MatchTalk (and nearby)
 * 2) Report leftovers for YouTube compilation rip
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    conversationUnfinishedSummary,
    buildConversationDuplicateLookup,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { getConversationEraTag } from '../src/features/dialogue-theater/dialogue-theater-list/dialogueTheaterEraFilter.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = process.argv.includes('--dry-run');
const limit = (() => {
    const i = process.argv.indexOf('--limit');
    return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

const HERO_FOLDER = {
    'Soldier 76': 'Soldier_ 76',
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    "Lúcio": 'Lucio',
    Lucio: 'Lucio',
    Cassidy: 'Cassidy',
    McCree: 'Cassidy',
    Reyes: 'Reaper',
    'Wrecking Ball': 'Wrecking Ball',
    'Torbjörn': 'Torbjorn',
    Torbjorn: 'Torbjorn',
};
const ATLAS_HERO = {
    'Soldier 76': 'Soldier_76',
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    "Lúcio": 'Lúcio',
    Lucio: 'Lúcio',
    'Torbjörn': 'Torbjörn',
    Torbjorn: 'Torbjörn',
    Reyes: 'Reaper',
};

function atlasFromLabel(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''`´']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function findOgg(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const root = path.join(EXTRACT_ROOT, folder);
    if (!fs.existsSync(root)) return null;
    const n = norm(needle);
    if (n.length < 8) return null;
    /** @type {{ source: string, label: string, score: number }[]} */
    const hits = [];
    function walk(dir) {
        let ents;
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of ents) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(e.name) || !/\.0B2-/i.test(e.name)) continue;
            const label = e.name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
            const ln = norm(label);
            if (ln === n) hits.push({ source: full, label, score: 0 });
            else if (ln.includes(n) || n.includes(ln)) {
                const minLen = Math.min(ln.length, n.length);
                if (minLen >= 12) {
                    hits.push({ source: full, label, score: Math.abs(ln.length - n.length) + 2 });
                }
            }
        }
    }
    walk(root);
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

function subtitleNeedle(sub) {
    return String(sub || '')
        .replace(/\*+[^*]*\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/→.*/g, ' ')
        .trim();
}

async function copyVoice(hero, subtitles) {
    const needle = subtitleNeedle(subtitles);
    const hit = findOgg(hero, needle);
    if (!hit) {
        // try first 40 chars of spoken text
        const short = norm(needle).split(' ').slice(0, 8).join(' ');
        if (short.length >= 12) {
            const hit2 = findOgg(hero, short);
            if (hit2) {
                const atlas = atlasFromLabel(hero, hit2.label);
                const dest = path.join(VOICELINES_DIR, atlas);
                if (!dryRun && !fs.existsSync(dest)) {
                    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
                    await fsp.copyFile(hit2.source, dest);
                }
                return { atlas, source: hit2.source };
            }
        }
        return null;
    }
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun && !fs.existsSync(dest)) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        await fsp.copyFile(hit.source, dest);
    }
    return { atlas, source: hit.source };
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const classic = raw.conversations.filter((c) => getConversationEraTag(c) === 'Classic');

let wired = 0;
let attempted = 0;
/** @type {{ name: string, hero: string, sub: string }[]} */
const leftovers = [];

for (const c of classic) {
    for (const line of c.lines || []) {
        if (line.voice) continue;
        const sub = String(line.subtitles || '').trim();
        if (!sub || /^[*[\s]*$/.test(sub.replace(/\*/g, ''))) {
            leftovers.push({ name: c.name, hero: line.hero, sub: sub.slice(0, 60) || '(empty/beeps)' });
            continue;
        }
        attempted += 1;
        if (limit && wired >= limit) {
            leftovers.push({ name: c.name, hero: line.hero, sub: sub.slice(0, 70) });
            continue;
        }
        const result = await copyVoice(line.hero, sub);
        if (result) {
            line.voice = result.atlas;
            wired += 1;
            if (wired <= 30 || wired % 25 === 0) {
                console.log(`+ ${c.name} | ${line.hero} <- ${path.basename(result.source)}`);
            }
        } else {
            leftovers.push({ name: c.name, hero: line.hero, sub: sub.slice(0, 70) });
        }
    }
}

console.log(`\nClassic conversations: ${classic.length}`);
console.log(`Attempted missing lines: ${attempted}`);
console.log(`Wired from extract: ${wired}`);
console.log(`Still missing: ${leftovers.length}`);

const byHero = new Map();
for (const row of leftovers) {
    byHero.set(row.hero, (byHero.get(row.hero) || 0) + 1);
}
console.log('\nLeftovers by hero:');
[...byHero.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([h, n]) => console.log(`  ${h}: ${n}`));

fs.writeFileSync(
    path.join(REPO, 'scripts/_cache/classic-missing-leftovers.json'),
    `${JSON.stringify({ wired, leftovers }, null, 2)}\n`,
);
console.log('\nWrote scripts/_cache/classic-missing-leftovers.json');

if (dryRun) {
    console.log('Dry run — no write');
    process.exit(0);
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);

const voicelines = fs.readdirSync(VOICELINES_DIR).filter((f) => /\.ogg$/i.test(f));
const dup = buildConversationDuplicateLookup(raw.conversations);
let stillUnfinishedAudio = 0;
for (const c of classic) {
    const s = conversationUnfinishedSummary(c, voicelines, dup) || '';
    if (/missing audio/i.test(s)) stillUnfinishedAudio += 1;
}
console.log(`Classic entries still flagged missing audio: ${stillUnfinishedAudio}`);
