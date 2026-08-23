#!/usr/bin/env node
/**
 * Classic missing-audio YouTube compilation ripper.
 *
 * Usage:
 *   node scripts/rip-classic-from-youtube.mjs --video VIDEO_ID [--video VIDEO_ID ...]
 *   node scripts/rip-classic-from-youtube.mjs --preset mccree
 *   node scripts/rip-classic-from-youtube.mjs --preset retribution
 *   node scripts/rip-classic-from-youtube.mjs --preset wave1
 *
 * Matches leftover Classic lines against auto-subs, cuts clean segments, wires voices.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { getConversationEraTag } from '../src/features/dialogue-theater/dialogue-theater-list/dialogueTheaterEraFilter.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE = path.join(REPO, 'scripts/_cache/classic-yt');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const LEFTOVERS_PATH = path.join(REPO, 'scripts/_cache/classic-missing-leftovers.json');

const YT = path.join(REPO, 'scripts/_cache/yt-dlp.exe');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const dryRun = process.argv.includes('--dry-run');
const minScore = 0.78;
const minCueSpan = 1.35; // seconds — reject tiny auto-sub false hits
const minOutDur = 1.35;

const PRESETS = {
    mccree: ['A2blrgHnrcY', '59r58eqD-ro', 'fxljbgmWOyY'],
    ashe: ['2cb7wlTQ24M', 'fxljbgmWOyY'],
    retribution: ['t08aMMVLzi0', 'ZC8F2aRemC0'],
    torb: ['Vks7WwjHBf8', 'dpP5y9q_beI'],
    moira: ['vTOsZEUeiU8', 'zbiKE2zpJaY'],
    reinhardt: ['2-L3CBs0cXw', '_dNQxqsGAzA'],
    genji: ['LuC9kfFJ8qo', '3eyxZwmuX00'],
    cassidy_full: ['BSVqYqFd2QQ'],
    wave1: ['A2blrgHnrcY', 'fxljbgmWOyY', 't08aMMVLzi0', 'Vks7WwjHBf8', 'vTOsZEUeiU8', '2-L3CBs0cXw', 'LuC9kfFJ8qo'],
};

const ATLAS_HERO = {
    'Soldier 76': 'Soldier_76',
    'D.va': 'D.Va',
    "Lúcio": 'Lúcio',
    Lucio: 'Lúcio',
    'Torbjörn': 'Torbjörn',
    Reyes: 'Reaper',
    McCree: 'Cassidy',
};

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''`´']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function spokenNeedle(sub) {
    return norm(
        String(sub || '')
            .replace(/\*+[^*]*\*+/g, ' ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\[[^\]]*\]/g, ' ')
            .replace(/→.*/g, ' ')
            .replace(/&.+?;/g, ' '),
    );
}

function atlasFrom(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_')
        .slice(0, 140);
    return `${prefix}_-_${body}.ogg`;
}

function parseArgs() {
    /** @type {string[]} */
    const videos = [];
    for (let i = 2; i < process.argv.length; i += 1) {
        const a = process.argv[i];
        if (a === '--video' && process.argv[i + 1]) {
            videos.push(process.argv[++i]);
        } else if (a === '--preset' && process.argv[i + 1]) {
            const p = process.argv[++i];
            if (!PRESETS[p]) throw new Error(`Unknown preset ${p}`);
            videos.push(...PRESETS[p]);
        }
    }
    return [...new Set(videos)];
}

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
    if (r.status !== 0 && !opts.allowFail) {
        const err = (r.stderr || r.stdout || '').slice(-800);
        throw new Error(`${cmd} ${args[0]} failed: ${err}`);
    }
    return r;
}

function ensureTools() {
    if (!fs.existsSync(YT)) throw new Error(`Missing yt-dlp at ${YT}`);
    if (!fs.existsSync(FFMPEG)) throw new Error(`Missing ffmpeg at ${FFMPEG}`);
    fs.mkdirSync(CACHE, { recursive: true });
}

function downloadVideo(id) {
    const audioGlob = path.join(CACHE, `${id}.*`);
    const existing = fs.readdirSync(CACHE).filter((f) => f.startsWith(`${id}.`) && !f.endsWith('.vtt') && !f.endsWith('.json'));
    if (!existing.length) {
        console.log(`Downloading ${id}...`);
        run(YT, ['-f', 'bestaudio/best', '-o', path.join(CACHE, `${id}.%(ext)s`), `https://www.youtube.com/watch?v=${id}`]);
    }
    const vtt = path.join(CACHE, `${id}.en.vtt`);
    if (!fs.existsSync(vtt)) {
        console.log(`Subs ${id}...`);
        run(YT, [
            '--skip-download',
            '--write-auto-sub',
            '--write-subs',
            '--sub-lang',
            'en',
            '--convert-subs',
            'vtt',
            '-o',
            path.join(CACHE, `${id}.%(ext)s`),
            `https://www.youtube.com/watch?v=${id}`,
        ]);
    }
    const media = fs
        .readdirSync(CACHE)
        .filter((f) => f.startsWith(`${id}.`) && /\.(webm|m4a|mp3|opus|ogg)$/i.test(f))[0];
    if (!media) throw new Error(`No media for ${id}`);
    if (!fs.existsSync(vtt)) throw new Error(`No VTT for ${id}`);
    return { media: path.join(CACHE, media), vtt };
}

/**
 * @param {string} vttText
 * @returns {{ start: number, end: number, text: string }[]}
 */
function parseVtt(vttText) {
    const lines = vttText.split(/\r?\n/);
    /** @type {{ start: number, end: number, text: string }[]} */
    const cues = [];
    const ts = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
    function toSec(h, m, s, ms) {
        return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
    }
    for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(ts);
        if (!m) continue;
        const start = toSec(m[1], m[2], m[3], m[4]);
        const end = toSec(m[5], m[6], m[7], m[8]);
        /** @type {string[]} */
        const textParts = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            const row = lines[j].trim();
            if (!row) break;
            if (ts.test(row)) break;
            // strip cue tags / timestamps inside
            const clean = row
                .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
                .replace(/<\/?c>/g, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            if (clean) textParts.push(clean);
        }
        const text = textParts.join(' ');
        if (text) cues.push({ start, end, text });
    }
    // Deduplicate rolling auto-caption duplicates by keeping longest unique windows
    return cues;
}

function tokenSet(s) {
    return new Set(norm(s).split(' ').filter((w) => w.length > 2));
}

function scoreMatch(needle, hay) {
    const n = spokenNeedle(needle);
    const h = norm(hay);
    if (!n || n.length < 10) return 0;
    // Full needle inside caption (or nearly) — strong hit
    if (h.includes(n)) return 1;
    // Avoid `n.includes(h)` — short captions falsely match long needles
    if (n.includes(h) && h.length >= Math.min(24, n.length * 0.7)) return 0.9;
    const nt = [...tokenSet(n)];
    const ht = tokenSet(h);
    if (nt.length < 3) return 0;
    let hit = 0;
    for (const t of nt) if (ht.has(t)) hit += 1;
    const cov = hit / nt.length;
    if (hit < Math.min(4, nt.length)) return 0;
    // require first 3 content tokens appear in order in hay
    const first = nt.slice(0, 3);
    let pos = -1;
    let ordered = true;
    for (const t of first) {
        const idx = h.indexOf(t, pos + 1);
        if (idx < 0) {
            ordered = false;
            break;
        }
        pos = idx;
    }
    if (!ordered) return Math.min(cov, 0.7);
    return cov;
}

/**
 * Find best cue window for a needle by expanding neighboring cues.
 * @param {{ start: number, end: number, text: string }[]} cues
 * @param {string} needle
 */
function findWindow(cues, needle) {
    let best = null;
    for (let i = 0; i < cues.length; i += 1) {
        // merge up to 4 consecutive cues
        let text = '';
        let start = cues[i].start;
        let end = cues[i].end;
        for (let k = 0; k < 5 && i + k < cues.length; k += 1) {
            text = `${text} ${cues[i + k].text}`.trim();
            end = cues[i + k].end;
            const score = scoreMatch(needle, text);
            if (score >= minScore && (!best || score > best.score)) {
                best = { start, end, text, score, i };
            }
            // stop expanding if gap too large
            if (k + 1 < 5 && i + k + 1 < cues.length) {
                const gap = cues[i + k + 1].start - cues[i + k].end;
                if (gap > 1.2) break;
            }
        }
    }
    return best;
}

function detectSplitBounds(media, start, end) {
    // Expand a bit, then snap to silence edges
    const padStart = Math.max(0, start - 0.35);
    const padEnd = end + 0.55;
    const r = run(
        FFMPEG,
        [
            '-hide_banner',
            '-ss',
            String(padStart),
            '-to',
            String(padEnd),
            '-i',
            media,
            '-af',
            'silencedetect=noise=-35dB:d=0.08',
            '-f',
            'null',
            '-',
        ],
        { allowFail: true },
    );
    const err = r.stderr || '';
    /** @type {{ start: number, end: number }[]} */
    const silences = [];
    const reStart = /silence_start:\s*([\d.]+)/g;
    const reEnd = /silence_end:\s*([\d.]+)/g;
    const starts = [...err.matchAll(reStart)].map((m) => Number(m[1]));
    const ends = [...err.matchAll(reEnd)].map((m) => Number(m[1]));
    for (let i = 0; i < Math.min(starts.length, ends.length); i += 1) {
        silences.push({ start: starts[i], end: ends[i] });
    }
    // relative to padStart
    const relStart = start - padStart;
    const relEnd = end - padStart;
    let cutStart = padStart;
    let cutEnd = padEnd;
    // last silence ending before speech start -> cutStart
    for (const s of silences) {
        if (s.end <= relStart + 0.15) cutStart = padStart + s.end;
    }
    // first silence starting after speech end -> cutEnd
    for (const s of silences) {
        if (s.start >= relEnd - 0.1) {
            cutEnd = padStart + s.start;
            break;
        }
    }
    // fallback to cue bounds with small pads
    if (cutEnd - cutStart < 0.6) {
        cutStart = Math.max(0, start - 0.05);
        cutEnd = end + 0.15;
    }
    return { cutStart, cutEnd };
}

function extractClip(media, cutStart, cutEnd, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    run(FFMPEG, [
        '-y',
        '-ss',
        String(cutStart),
        '-to',
        String(cutEnd),
        '-i',
        media,
        '-ac',
        '1',
        '-ar',
        '48000',
        '-af',
        'loudnorm=I=-16:LRA=11:TP=-1.5',
        dest,
    ]);
}

function loadClassicMissing(raw) {
    /** @type {{ convId: string, name: string, lineId: string, hero: string, sub: string }[]} */
    const missing = [];
    for (const c of raw.conversations) {
        if (getConversationEraTag(c) !== 'Classic') continue;
        for (const line of c.lines || []) {
            if (line.voice) continue;
            const sub = String(line.subtitles || '').trim();
            if (!sub) continue;
            if (/^\*?[\[*]/.test(sub) && /beep|squeak|whir/i.test(sub)) continue;
            missing.push({
                convId: c.id,
                name: c.name,
                lineId: line.id,
                hero: line.hero,
                sub,
            });
        }
    }
    return missing;
}

ensureTools();
const videoIds = parseArgs();
if (!videoIds.length) {
    console.error('Pass --preset wave1 or --video ID');
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const missing = loadClassicMissing(raw);
console.log(`Classic missing lines: ${missing.length}`);
console.log(`Videos: ${videoIds.join(', ')}`);

/** @type {Map<string, { media: string, cues: ReturnType<typeof parseVtt> }>} */
const libraries = new Map();
for (const id of videoIds) {
    const { media, vtt } = downloadVideo(id);
    const cues = parseVtt(fs.readFileSync(vtt, 'utf8'));
    libraries.set(id, { media, cues });
    console.log(`  ${id}: ${cues.length} cues`);
}

let wired = 0;
/** @type {string[]} */
const report = [];
/** @type {Map<string, number>} */
const usedStamps = new Map();

for (const item of missing) {
    const needle = spokenNeedle(item.sub);
    if (needle.length < 10) continue;

    let best = null;
    for (const [id, lib] of libraries) {
        const win = findWindow(lib.cues, item.sub);
        if (!win) continue;
        if (!best || win.score > best.score) {
            best = { ...win, id, media: lib.media };
        }
    }
    if (!best || best.score < minScore) continue;
    const cueSpan = best.end - best.start;
    if (cueSpan < minCueSpan) continue;

    const { cutStart, cutEnd } = detectSplitBounds(best.media, best.start, best.end);
    const outDur = cutEnd - cutStart;
    if (outDur < minOutDur || outDur > 25) continue;

    // Reject reused identical tiny windows across many lines
    const stamp = `${best.id}@${cutStart.toFixed(1)}`;
    usedStamps.set(stamp, (usedStamps.get(stamp) || 0) + 1);
    if (usedStamps.get(stamp) > 1 && best.score < 0.97) continue;

    const label = spokenNeedle(item.sub).split(' ').slice(0, 12).join(' ');
    const atlas = atlasFrom(item.hero, label || 'line');
    const dest = path.join(VOICELINES_DIR, atlas);

    if (!dryRun) {
        extractClip(best.media, cutStart, cutEnd, dest);
        const conv = raw.conversations.find((c) => c.id === item.convId);
        const line = conv?.lines?.find((l) => l.id === item.lineId);
        if (line) {
            line.voice = atlas;
            wired += 1;
            const msg = `+ ${item.name} | ${item.hero} | score=${best.score.toFixed(2)} | ${best.id} @ ${cutStart.toFixed(1)}-${cutEnd.toFixed(1)}s (${outDur.toFixed(1)}s)`;
            console.log(msg);
            report.push(msg);
        }
    } else {
        console.log(`DRY ${item.name} | ${item.hero} | ${best.score.toFixed(2)} | ${best.id} ${outDur.toFixed(1)}s`);
        wired += 1;
    }
}

console.log(`\nWired: ${wired}`);

if (!dryRun && wired) {
    fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
    const assets = await scanTheaterAssets();
    fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
    // refresh leftovers snapshot
    const still = loadClassicMissing(raw);
    fs.writeFileSync(
        LEFTOVERS_PATH,
        `${JSON.stringify({ wiredFromYt: wired, leftovers: still.map((x) => ({ name: x.name, hero: x.hero, sub: x.sub.slice(0, 70) })) }, null, 2)}\n`,
    );
    console.log(`Remaining Classic missing: ${still.length}`);
}
