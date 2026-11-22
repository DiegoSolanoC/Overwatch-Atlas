#!/usr/bin/env node
/**
 * Download a YouTube music batch into src/assets/audio/music + cover PNGs,
 * then regenerate the platform manifest.
 *
 * Usage:
 *   node scripts/import-music-youtube-batch.mjs
 *   node scripts/import-music-youtube-batch.mjs --dry-run
 *   node scripts/import-music-youtube-batch.mjs --only Dokiwatch
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const BATCH = path.join(__dirname, '_cache', 'music-batch-2026-11.json');
const MUSIC_DIR = path.join(REPO, 'src', 'assets', 'audio', 'music');
const ICON_DIR = path.join(REPO, 'src', 'assets', 'images', 'Music');
const YT_DLP = path.join(__dirname, '_cache', 'yt-dlp.exe');
const FFMPEG = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft',
    'WinGet',
    'Packages',
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'ffmpeg-9.0-full_build',
    'bin',
    'ffmpeg.exe',
);

const dryRun = process.argv.includes('--dry-run');
const onlyIdx = process.argv.indexOf('--only');
const onlyName = onlyIdx >= 0 ? String(process.argv[onlyIdx + 1] || '').toLowerCase() : '';

function run(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, {
        stdio: 'inherit',
        encoding: 'utf8',
        ...opts,
    });
    return res.status === 0;
}

function ensureTools() {
    if (!fs.existsSync(YT_DLP)) throw new Error(`Missing yt-dlp at ${YT_DLP}`);
    if (!fs.existsSync(FFMPEG)) throw new Error(`Missing ffmpeg at ${FFMPEG}`);
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    fs.mkdirSync(ICON_DIR, { recursive: true });
}

function downloadOne(entry) {
    const mp3Path = path.join(MUSIC_DIR, `${entry.name}.mp3`);
    const iconPath = path.join(ICON_DIR, `${entry.name}.png`);
    const tmpBase = path.join(__dirname, '_cache', 'music-dl', entry.name.replace(/[^\w\- ]+/g, '_'));
    fs.mkdirSync(path.dirname(tmpBase), { recursive: true });

    const force = !!entry.force || process.argv.includes('--force');
    if (!force && fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 50_000) {
        console.log(`SKIP audio (exists): ${entry.name}`);
    } else if (dryRun) {
        console.log(`DRY audio: ${entry.name}`);
    } else {
        const outTpl = `${tmpBase}.%(ext)s`;
        const args = [
            '-f', 'bestaudio/best',
            '--no-playlist',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--ffmpeg-location', path.dirname(FFMPEG),
            '-o', outTpl,
        ];
        if (typeof entry.start === 'number' && entry.start > 0) {
            // Download full then trim — section download is flaky across extractors.
            args.push(entry.url);
        } else {
            args.push(entry.url);
        }
        console.log(`\n==> Audio: ${entry.name}`);
        if (!run(YT_DLP, args)) {
            throw new Error(`yt-dlp audio failed: ${entry.name}`);
        }
        const produced = fs.readdirSync(path.dirname(tmpBase))
            .filter((f) => f.startsWith(path.basename(tmpBase)) && f.toLowerCase().endsWith('.mp3'))
            .map((f) => path.join(path.dirname(tmpBase), f))[0];
        if (!produced || !fs.existsSync(produced)) {
            throw new Error(`No mp3 produced for ${entry.name}`);
        }
        if (typeof entry.start === 'number' && entry.start > 0) {
            const trimmed = `${tmpBase}.trim.mp3`;
            if (!run(FFMPEG, ['-y', '-ss', String(entry.start), '-i', produced, '-acodec', 'libmp3lame', '-q:a', '2', trimmed])) {
                throw new Error(`ffmpeg trim failed: ${entry.name}`);
            }
            fs.copyFileSync(trimmed, mp3Path);
        } else {
            fs.copyFileSync(produced, mp3Path);
        }
        console.log(`OK audio → ${mp3Path}`);
    }

    if (!force && fs.existsSync(iconPath) && fs.statSync(iconPath).size > 1000) {
        console.log(`SKIP icon (exists): ${entry.name}`);
        return;
    }
    if (dryRun) {
        console.log(`DRY icon: ${entry.name}`);
        return;
    }

    const thumbOut = `${tmpBase}.thumb.%(ext)s`;
    console.log(`==> Icon: ${entry.name}`);
    if (!run(YT_DLP, [
        '--no-playlist',
        '--skip-download',
        '--write-thumbnail',
        '--convert-thumbnails', 'png',
        '-o', `${tmpBase}.thumb`,
        entry.url,
    ])) {
        console.warn(`WARN: thumbnail download failed for ${entry.name}`);
        return;
    }
    const thumb = fs.readdirSync(path.dirname(tmpBase))
        .filter((f) => f.startsWith(`${path.basename(tmpBase)}.thumb`) && f.toLowerCase().endsWith('.png'))
        .map((f) => path.join(path.dirname(tmpBase), f))[0];
    if (thumb && fs.existsSync(thumb)) {
        // Normalize to square-ish cover via ffmpeg scale+pad
        const sized = `${tmpBase}.icon.png`;
        run(FFMPEG, [
            '-y', '-i', thumb,
            '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512',
            sized,
        ]);
        if (fs.existsSync(sized)) {
            fs.copyFileSync(sized, iconPath);
        } else {
            fs.copyFileSync(thumb, iconPath);
        }
        console.log(`OK icon → ${iconPath}`);
    } else {
        console.warn(`WARN: no thumbnail file for ${entry.name}`);
    }
}

function main() {
    ensureTools();
    const entries = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
    const list = onlyName
        ? entries.filter((e) => String(e.name).toLowerCase().includes(onlyName))
        : entries;
    if (!list.length) {
        console.error('No matching entries');
        process.exit(1);
    }

    const failed = [];
    for (const entry of list) {
        try {
            downloadOne(entry);
        } catch (err) {
            console.error(err);
            failed.push(entry.name);
        }
    }

    if (!dryRun) {
        console.log('\n==> Regenerating manifest');
        run(process.execPath, [path.join(REPO, 'scripts', 'generate-manifest.js')], { cwd: REPO });
    }

    // Write seed assignments for the category service
    const seedPath = path.join(REPO, 'src', 'data', 'platform', 'atlas-music-category-seed.json');
    const byCat = {};
    for (const e of entries) {
        if (!e.category) continue;
        if (!byCat[e.category]) byCat[e.category] = [];
        byCat[e.category].push(`${e.name}.mp3`);
    }
    // Renamed track keeps Seasonal
    if (!byCat.Seasonal) byCat.Seasonal = [];
    if (!byCat.Seasonal.includes('Hearts of Hope.mp3')) {
        byCat.Seasonal.push('Hearts of Hope.mp3');
    }
    const seed = {
        version: 2,
        categories: Object.keys(byCat).sort().map((name) => ({
            id: `mc_seed_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            name,
        })),
        assignments: {},
    };
    for (const [catName, files] of Object.entries(byCat)) {
        const cat = seed.categories.find((c) => c.name === catName);
        for (const file of files) {
            if (!seed.assignments[file]) seed.assignments[file] = [];
            if (!seed.assignments[file].includes(cat.id)) {
                seed.assignments[file].push(cat.id);
            }
        }
    }
    // Migration: old Dokiwatch.mp3 → Hearts of Hope.mp3
    seed.migrations = {
        renameFilenames: {
            'Dokiwatch.mp3': 'Hearts of Hope.mp3',
        },
    };
    fs.writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
    console.log(`Wrote category seed → ${seedPath}`);

    if (failed.length) {
        console.error(`\nFailed (${failed.length}): ${failed.join(', ')}`);
        process.exit(1);
    }
    console.log(`\nDone. ${list.length} tracks processed.`);
}

main();
