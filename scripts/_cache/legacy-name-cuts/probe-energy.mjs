#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FFMPEG = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
);
const V = path.join('src/assets/audio/Theater/Voicelines');
const WORK = path.join('scripts/_cache/legacy-name-cuts');

const files = [
    "Ashe_-_Aw,_you_know_that's_not_the_way_it_works,_Jesse.ogg",
    'Ashe_-_Brave_of_you_to_show_your_face_around_here,_Jesse.ogg',
    'Moira_-_Our_courageous_cowboy._The_years_havent_changed_you_much,_have_they,_Jesse.ogg',
    'Pharah_-_McCree,_where_did_you_learn_to_shoot_like_that__Was_it_Jack,_Gabriel.ogg',
    'Moira_-_Why_am_I_not_surprised_to_learn_that_you_grew_up_in_a_place_like_this,_McCree.ogg',
    'Mei_-_Hey,_McCree,_do_you_know_what_time_it_is.ogg',
    'Genji_-_Why_have_you_come_back_to_this_place,_McCree.ogg',
];

function pcm(file) {
    fs.mkdirSync(WORK, { recursive: true });
    const raw = path.join(WORK, `env_${Date.now()}_${Math.random().toString(16).slice(2)}.raw`);
    const r = spawnSync(
        FFMPEG,
        ['-y', '-i', path.join(V, file), '-ac', '1', '-ar', '16000', '-f', 's16le', raw],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(r.stderr?.slice(-300));
    const buf = fs.readFileSync(raw);
    fs.unlinkSync(raw);
    const samples = [];
    for (let i = 0; i + 1 < buf.length; i += 2) samples.push(buf.readInt16LE(i));
    return samples;
}

function envelope(samples, frame = 320) {
    const out = [];
    for (let i = 0; i < samples.length; i += frame) {
        let s = 0;
        let n = 0;
        for (let j = i; j < Math.min(i + frame, samples.length); j += 1) {
            s += samples[j] * samples[j];
            n += 1;
        }
        out.push({ t: i / 16000, e: Math.sqrt(s / Math.max(1, n)) });
    }
    return out;
}

for (const f of files) {
    const env = envelope(pcm(f));
    const max = Math.max(...env.map((x) => x.e));
    const thr = max * 0.12;
    const regions = [];
    let start = null;
    for (const x of env) {
        if (x.e >= thr && start == null) start = x.t;
        if (x.e < thr && start != null) {
            regions.push([start, x.t]);
            start = null;
        }
    }
    if (start != null) regions.push([start, env[env.length - 1].t]);
    console.log(`\n${f}`);
    console.log(
        'regions',
        regions.map((r) => `${r[0].toFixed(2)}-${r[1].toFixed(2)}`).join(' | '),
    );
    const last = regions[regions.length - 1];
    if (last) console.log('last region', last[0].toFixed(2), '->', last[1].toFixed(2));
    if (regions.length >= 2) {
        const prev = regions[regions.length - 2];
        console.log('prev region', prev[0].toFixed(2), '->', prev[1].toFixed(2));
    }
}
