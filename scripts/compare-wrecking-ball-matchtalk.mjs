#!/usr/bin/env node
/**
 * Compare Wrecking Ball game extract (MatchTalk) vs dialogue-theater manifest + conversations.
 *
 * Usage:
 *   node scripts/compare-wrecking-ball-matchtalk.mjs
 *   node scripts/compare-wrecking-ball-matchtalk.mjs --extract "C:/path/to/HeroVoice/Wrecking Ball"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const DEFAULT_EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Wrecking Ball',
);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    let extractRoot = DEFAULT_EXTRACT;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--extract' && argv[i + 1]) {
            extractRoot = argv[i + 1];
            i += 1;
        }
    }
    return { extractRoot };
}

/**
 * @param {string} value
 * @returns {string}
 */
function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * @param {string} filename
 * @returns {string}
 */
function dialogueFromManifestFile(filename) {
    const base = String(filename).replace(/\.ogg$/i, '');
    const sep = base.indexOf('_-_');
    if (sep < 0) return base.replace(/_/g, ' ');
    return base.slice(sep + 3).replace(/_/g, ' ');
}

/**
 * @param {string} name
 * @returns {string}
 */
function stripSfxPrefix(name) {
    return String(name || '')
        .replace(/^\(angry squeaks\)\s*/i, '')
        .replace(/^\(hamster noises\)\s*/i, '')
        .replace(/^\(angry squeaks\) \(Chinese\)_\s*/i, '')
        .replace(/^\(apologetic squeaks\)\s*/i, '')
        .replace(/^\(excited hamster squeaks\)\s*/i, '')
        .replace(/^\(hamster squeaks\)\s*/i, '')
        .trim();
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listMatchTalkLines(dir) {
    const matchTalkDir = path.join(dir, 'MatchTalk');
    if (!fs.existsSync(matchTalkDir)) return [];

    return fs
        .readdirSync(matchTalkDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || /\.ogg$/i.test(entry.name))
        .map((entry) => entry.name.replace(/\.ogg$/i, '').trim())
        .filter((name) => name && !/^000000/.test(name));
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function fuzzyMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aw = a.split(' ').filter((w) => w.length > 3);
    const bw = b.split(' ').filter((w) => w.length > 3);
    if (!aw.length || !bw.length) return false;
    const overlap = aw.filter((w) => bw.includes(w)).length;
    return overlap >= Math.min(aw.length, bw.length) * 0.7;
}

function main() {
    const { extractRoot } = parseArgs(process.argv.slice(2));
    const matchTalkDir = path.join(extractRoot, 'MatchTalk');

    if (!fs.existsSync(matchTalkDir)) {
        console.error(`MatchTalk folder not found: ${matchTalkDir}`);
        process.exit(1);
    }

    const manifest = JSON.parse(
        fs.readFileSync(path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json'), 'utf8'),
    );
    const convRaw = JSON.parse(
        fs.readFileSync(path.join(REPO, 'src/data/dialogue-theater/conversations.json'), 'utf8'),
    );

    const manifestWB = (manifest.voicelines || []).filter((f) => /^Wrecking_Ball/i.test(f));
    const manifestByNorm = new Map(
        manifestWB.map((file) => [norm(dialogueFromManifestFile(file)), { file, dialogue: dialogueFromManifestFile(file) }]),
    );

    /** @type {Map<string, string>} */
    const gameByNorm = new Map();
    for (const raw of listMatchTalkLines(extractRoot)) {
        const dialogue = stripSfxPrefix(raw);
        if (!dialogue) continue;
        gameByNorm.set(norm(dialogue), dialogue);
    }

    /** @type {Array<{ name: string, voice: string, subtitles: string, hasAudio: boolean }>} */
    const wbLinesInApp = [];
    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (String(line?.hero || '').trim() !== 'Wrecking Ball') continue;
            wbLinesInApp.push({
                conversation: String(conversation.name || '').trim() || conversation.id,
                voice: String(line.voice || '').trim(),
                subtitles: String(line.subtitles || '').trim(),
                hasAudio: Boolean(String(line.voice || '').trim()),
            });
        }
    }

    const usedVoices = new Set(wbLinesInApp.map((row) => row.voice).filter(Boolean));

    const inGameNotManifest = [];
    for (const [key, dialogue] of gameByNorm) {
        if (!manifestByNorm.has(key) && ! [...manifestByNorm.keys()].some((m) => fuzzyMatch(m, key))) {
            inGameNotManifest.push(dialogue);
        }
    }

    const inManifestNotGame = [];
    for (const [key, row] of manifestByNorm) {
        if (!gameByNorm.has(key) && ![...gameByNorm.keys()].some((g) => fuzzyMatch(g, key))) {
            inManifestNotGame.push(row);
        }
    }

    const manifestUnused = manifestWB.filter((file) => !usedVoices.has(file));
    const appLinesMissingVoice = wbLinesInApp.filter((row) => !row.hasAudio);

    console.log('=== Wrecking Ball voice extract vs Dialogue Theater ===\n');
    console.log(`Extract root: ${extractRoot}`);
    console.log(`Interactions host folder: MatchTalk/ (${gameByNorm.size} dialogue labels)`);
    console.log(`Also: Voicelines/ = gameplay/ult/etc, not hero-to-hero banter`);
    console.log(`Manifest Wrecking_Ball voicelines: ${manifestWB.length}`);
    console.log(`Wrecking Ball lines in conversations.json: ${wbLinesInApp.length}`);
    console.log(`  with audio wired: ${wbLinesInApp.filter((r) => r.hasAudio).length}`);
    console.log(`  missing voice file: ${appLinesMissingVoice.length}`);

    console.log('\n--- MatchTalk lines NOT in manifest (likely wiki-missing) ---');
    inGameNotManifest.sort((a, b) => a.localeCompare(b)).forEach((line) => console.log(`  • ${line}`));
    console.log(`Total: ${inGameNotManifest.length}`);

    console.log('\n--- Manifest lines NOT found in MatchTalk labels ---');
    inManifestNotGame
        .sort((a, b) => a.dialogue.localeCompare(b.dialogue))
        .forEach((row) => console.log(`  • ${row.dialogue}`));
    console.log(`Total: ${inManifestNotGame.length}`);

    console.log('\n--- Manifest files not wired to any WB conversation line ---');
    manifestUnused.sort().forEach((file) => console.log(`  • ${file}`));
    console.log(`Total: ${manifestUnused.length}`);

    if (appLinesMissingVoice.length) {
        console.log('\n--- WB conversation lines missing voice ---');
        appLinesMissingVoice.forEach((row) => {
            console.log(`  • [${row.conversation}] ${row.subtitles}`);
        });
    }

    console.log('\n--- Naming pattern (game → atlas) ---');
    console.log('  Game:  MatchTalk/(hamster noises) He is the pilot/');
    console.log('  Atlas: Wrecking_Ball_-_He_is_the_pilot.ogg');
    console.log('  Game:  MatchTalk/(angry squeaks) Do not call the hamster cute/');
    console.log('  Atlas: Wrecking_Ball_-_Do_not_call_the_hamster_cute.ogg');
}

main();
