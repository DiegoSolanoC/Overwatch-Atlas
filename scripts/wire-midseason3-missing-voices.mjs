#!/usr/bin/env node
/**
 * Wire remaining Midseason 3 missing voices + fix Reinhardt caps /
 * Motivated Together speaker order.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const ERA = 'Midseason 3 (YouTube placeholder)';

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findOgg(heroFolder, needle) {
    const dir = path.join(EXTRACT, heroFolder, 'MatchTalk');
    const n = needle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm === n || norm.includes(n)) {
            return { source: path.join(dir, name), label };
        }
    }
    return null;
}

async function copyVoice(hero, needle, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    const find = (pred) => conversations.find((c) => c.eraName === ERA && pred(c));

    {
        const c = find((x) => x.name === 'Victory at all costs');
        for (const line of c.lines) {
            if (line.hero !== 'Reinhardt') continue;
            if (/ACHIEVE VICTORY/i.test(line.subtitles) && line.subtitles === line.subtitles.toUpperCase()) {
                line.subtitles = 'All right, warriors. Are we ready to achieve victory at all costs?';
            } else if (/TAKE THAT AS A YES/i.test(line.subtitles) && /HUH/.test(line.subtitles)) {
                line.subtitles = 'Huh. I will take that as a yes.';
            } else if (line.subtitles.includes('ACHIEVE VICTORY')) {
                line.subtitles = 'All right, warriors. Are we ready to achieve victory at all costs?';
            } else if (line.subtitles.includes('TAKE THAT AS A YES') || line.subtitles.includes('I WILL TAKE THAT')) {
                line.subtitles = 'Huh. I will take that as a yes.';
            }
        }
        console.log('Fixed Reinhardt caps');
    }

    {
        const c = find((x) => x.name === 'Let it out');
        const line = c.lines.find((l) => l.hero === 'Mauga' && /Let it out/i.test(l.subtitles));
        line.subtitles = 'Let it out, Shi-Shi. Really stick it to her.';
        line.voice = await copyVoice('Mauga', 'Let it out, Shi-Shi');
        console.log('Wired Let it out:', line.voice);
    }

    {
        const c = find((x) => x.name === 'Two hearts');
        const shion = c.lines.find((l) => l.hero === 'Shion');
        const mauga = c.lines.find((l) => l.hero === 'Mauga');
        shion.voice = await copyVoice('Shion', 'two hearts');
        shion.render = shion.render || 'Heroic.png';
        mauga.voice = await copyVoice('Mauga', 'no heart is just my type');
        mauga.render = mauga.render || 'Heroic.png';
        console.log('Wired Two hearts');
    }

    {
        const c = find((x) => /Motivated/.test(String(x.name || '')));
        c.name = 'Motivated Together';
        const [a, b, d] = c.lines;
        a.hero = 'Zarya';
        a.subtitles =
            "Anran, I hear you don't have a spotter! We should synchronize our gym schedules.";
        a.voice = await copyVoice('Zarya', "don't have a spotter");
        a.render = 'Heroic.png';
        b.hero = 'Anran';
        b.subtitles = "I'd love that! I feel so motivated when I watch you train.";
        b.voice = await copyVoice('Anran', 'feel so motivated');
        b.render = 'Heroic.png';
        d.hero = 'Zarya';
        d.subtitles = 'Well, that makes two of us.';
        d.voice = await copyVoice('Zarya', 'makes two of us');
        d.render = 'Heroic.png';
        console.log('Fixed Motivated Together speakers + voices');
    }

    {
        const c = find((x) => x.name === 'Cat like you');
        const cat = c.lines.find((l) => l.hero === 'Jetpack Cat');
        const folder = path.join(EXTRACT, 'Jetpack Cat', 'MatchTalk', '(eager meowing)');
        const oggs = fs
            .readdirSync(folder)
            .filter((n) => /\.ogg$/i.test(n) && /\.03F\./i.test(n));
        if (!oggs.length) throw new Error('No eager meowing ogg');
        const atlas = 'Jetpack_Cat_-_(eager_meowing).ogg';
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!fs.existsSync(dest)) await fsp.copyFile(path.join(folder, oggs[0]), dest);
        cat.subtitles = '*(eager meowing)*';
        cat.voice = atlas;
        cat.render = 'Heroic.png';
        console.log('Wired Cat like you:', atlas);
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log('Saved conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
