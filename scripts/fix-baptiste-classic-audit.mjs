#!/usr/bin/env node
/**
 * Classic Baptiste audit fixes:
 * - Lending a hand: Mercy line was wired to Baptiste's reply
 * - Wire missing Healing / medical / Sombra secrets from HeroVoice
 * - Add Classic copies of Reinhardt + Torbjörn interactions
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

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

function atlasName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

async function ensureCopy(source, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        await fsp.copyFile(source, dest);
        console.log(`copied ${atlas}`);
    } else {
        console.log(`exists ${atlas}`);
    }
    return atlas;
}

function cloneLine(line) {
    return {
        ...line,
        id: randomUUID(),
    };
}

function classicClone(source, name) {
    return {
        id: randomUUID(),
        entryType: 'dialogue',
        name,
        status: 'removed',
        eraName: '',
        tags: ['Classic'],
        scene: source.scene || 'Default.png',
        lines: (source.lines || []).map(cloneLine),
    };
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

const mercyBackupSrc = path.join(
    EXTRACT_ROOT,
    'Mercy',
    'MatchTalk',
    "000000058666.0B2-Ah, you're here. It's good to have backup.ogg",
);
const medicalSrc = path.join(
    EXTRACT_ROOT,
    'Baptiste',
    'Unknown',
    'F8C.078',
    '00000005841D.0B2-The medical and dental benefits were pretty good. The coworkers, not so much.ogg',
);
const sombraSecretsSrc = path.join(
    EXTRACT_ROOT,
    'Sombra',
    'MatchTalk',
    "00000005BBF9.0B2-Aw, you know I can't share my secrets.ogg",
);

for (const [src, label] of [
    [mercyBackupSrc, 'Mercy'],
    [medicalSrc, 'Baptiste'],
    [sombraSecretsSrc, 'Sombra'],
]) {
    if (!fs.existsSync(src)) {
        console.error('MISSING EXTRACT', src);
        process.exit(1);
    }
}

const mercyVoice = await ensureCopy(
    mercyBackupSrc,
    atlasName('Mercy', "Ah, you're here. It's good to have backup"),
);
const medicalVoice = await ensureCopy(
    medicalSrc,
    atlasName(
        'Baptiste',
        'The medical and dental benefits were pretty good. The coworkers, not so much',
    ),
);
const sombraVoice = await ensureCopy(
    sombraSecretsSrc,
    atlasName('Sombra', "Aw, you know I can't share my secrets"),
);

const lending = byId.get('664bf68c-da33-4731-98fc-29ca89127621');
if (!lending) throw new Error('Lending a hand not found');
const mercyLine = lending.lines[0];
if (mercyLine.hero !== 'Mercy') throw new Error('unexpected Lending a hand line 0');
mercyLine.voice = mercyVoice;
console.log('fixed Lending a hand Mercy voice');

const healing = byId.get('aadf9721-80bf-4da3-9830-c86b5d28848d');
healing.name = 'Healing and Hurting';
healing.lines[0].voice = 'Baptiste_-_Healing_and_hurting..._I_guess_we\'re_not_that_different.ogg';
console.log('wired Healing and Hurting');

const medical = byId.get('7c533b8c-f283-4521-a1d4-87b1550c4ad8');
medical.name = 'Medical Benefits';
medical.lines[1].voice = medicalVoice;
console.log('wired Medical Benefits');

const secrets = byId.get('ede9cfc4-e301-4530-bf6a-f6449431aaeb');
secrets.name = 'Share My Secrets';
secrets.lines[1].voice = sombraVoice;
console.log('wired Share My Secrets');

const owPick = byId.get('0f3a076a-7fc6-47a8-8fa8-7d21229e060e');
const owTech = byId.get('9209e09e-d402-445e-a0a0-8a012432a794');
const owTurret = byId.get('235dd1da-b29c-44c8-85f9-6e0479165bb8');
if (!owPick || !owTech || !owTurret) throw new Error('Overwatch source interactions missing');

const classicHas = (name) =>
    raw.conversations.some(
        (c) =>
            (c.tags || []).includes('Classic') &&
            String(c.name).toLowerCase() === name.toLowerCase(),
    );

const inserts = [];
if (!classicHas('Pick Something Up')) inserts.push(classicClone(owPick, 'Pick Something Up'));
if (!classicHas('Advance Technologies')) inserts.push(classicClone(owTech, 'Advance Technologies'));
if (!classicHas('Immortality Turret')) inserts.push(classicClone(owTurret, 'Immortality Turret'));

const anchorIdx = raw.conversations.findIndex((c) => c.id === lending.id);
if (anchorIdx < 0) throw new Error('anchor missing');
raw.conversations.splice(anchorIdx + 1, 0, ...inserts);
for (const row of inserts) console.log(`added Classic ${row.name}`);

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
