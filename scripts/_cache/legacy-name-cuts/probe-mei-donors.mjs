#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FFMPEG = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
);
const EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive/Escritorio/ow models/HeroVoice/Mei/MatchTalk',
);

const files = [
    [
        'juno',
        'src/assets/audio/Theater/Voicelines/Mei_-_Hey!_Be_careful,_Juno._Your_mother_will_be_furious_if_I_let_anything_happen_to_you.ogg',
    ],
    ['time', 'src/assets/audio/Theater/Voicelines/Mei_-_Hey,_McCree,_do_you_know_what_time_it_is.ogg'],
    [
        'bunny',
        [...fs.readdirSync(EXTRACT)].find((n) => n.startsWith('00000002ED51') && n.endsWith('.ogg')),
    ],
];

function regionsOf(file) {
    const raw = path.join('scripts/_cache/legacy-name-cuts', `_t_${Date.now()}.raw`);
    const r = spawnSync(
        FFMPEG,
        ['-y', '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', raw],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(r.stderr?.slice(-200));
    const b = fs.readFileSync(raw);
    fs.unlinkSync(raw);
    const s = [];
    for (let i = 0; i + 1 < b.length; i += 2) s.push(b.readInt16LE(i));
    const frame = 320;
    const out = [];
    for (let i = 0; i < s.length; i += frame) {
        let e = 0;
        let n = 0;
        for (let j = i; j < Math.min(i + frame, s.length); j += 1) {
            e += s[j] * s[j];
            n += 1;
        }
        out.push({ t: i / 16000, e: Math.sqrt(e / Math.max(1, n)) });
    }
    const max = Math.max(...out.map((x) => x.e));
    const thr = max * 0.12;
    const regions = [];
    let st = null;
    for (const x of out) {
        if (x.e >= thr && st == null) st = x.t;
        if (x.e < thr && st != null) {
            regions.push([st, x.t]);
            st = null;
        }
    }
    if (st != null) regions.push([st, out.at(-1).t]);
    return regions;
}

for (const [label, f] of files) {
    const file = label === 'bunny' ? path.join(EXTRACT, f) : f;
    if (!fs.existsSync(file)) {
        console.log(label, 'MISSING', file);
        continue;
    }
    const regs = regionsOf(file);
    console.log(
        label,
        regs
            .slice(0, 10)
            .map((r) => `${r[0].toFixed(2)}-${r[1].toFixed(2)}`)
            .join(' | '),
    );
}
