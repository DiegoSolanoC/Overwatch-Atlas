#!/usr/bin/env node
/**
 * Import Wrecking Ball gallery phrase hamster (.03F) companions from the
 * HeroVoice extract and write `hamster-prefixes.json` for gallery playback.
 *
 * Minefield deployed has no dedicated hamster folder; it reuses the shared
 * Ultimate squeak also used by Area denied / Behold / Collect.
 *
 * Usage:
 *   node scripts/import-wrecking-ball-phrase-hamsters.mjs
 *   node scripts/import-wrecking-ball-phrase-hamsters.mjs --dry-run
 *   node scripts/import-wrecking-ball-phrase-hamsters.mjs --extract "C:/path/to/Wrecking Ball"
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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

const PHRASES_DIR = path.join(REPO, 'src/assets/audio/Phrases/Wrecking Ball');
const HAMSTER_DIR = path.join(PHRASES_DIR, 'Hamster');
const MAP_PATH = path.join(PHRASES_DIR, 'hamster-prefixes.json');

const PHRASE_CATS = new Set([
    'Hello',
    'Thanks',
    'HeroSelect',
    'Voicelines',
    'Ultimate',
    'Laugh',
    'Sorry',
    'Yes',
    'No',
    'YoureWelcome',
    'VotedEpic',
    'VotedLegendary',
    'Unknown',
]);

/** Ultimate lines that share one squeak take when no dedicated folder exists. */
const ULTIMATE_SHARED_HAMSTER_FALLBACK = '(hamster noises) Area denied!';

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    let extractRoot = DEFAULT_EXTRACT;
    const dryRun = argv.includes('--dry-run');
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--extract' && argv[i + 1]) {
            extractRoot = argv[i + 1];
            i += 1;
        }
    }
    return { extractRoot, dryRun };
}

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[''`´]/g, '')
        .replace(/_/g, ' ')
        .replace(/[!.?,:;]+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripSfx(name) {
    let s = String(name || '');
    const sung = s.match(/^\((?:hammond sings|squeaking)\s*_?([^)_]+)_?\s*\)$/i);
    if (sung) return sung[1].replace(/_/g, ' ').trim();

    return s
        .replace(/^\(angry hamster noises\)\s*/i, '')
        .replace(/^\(hamster noises\)\s*/i, '')
        .replace(/^\(angry squeaks\)\s*/i, '')
        .replace(/^\(laughs\)\s*/i, '')
        .replace(/_/g, ' ')
        .replace(/!+$/g, '')
        .trim();
}

function md5(filePath) {
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function fuzzy(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aw = a.split(' ').filter((w) => w.length > 2);
    const bw = b.split(' ').filter((w) => w.length > 2);
    if (!aw.length || !bw.length) return false;
    const overlap = aw.filter((w) => bw.includes(w)).length;
    return overlap >= Math.min(aw.length, bw.length) * 0.7;
}

/**
 * @param {string} spoken
 */
function spokenLookup(spoken) {
    let s = String(spoken || '');
    if (/hammond sings/i.test(s) || /^Deck the halls with me$/i.test(s)) s = 'Deck the Halls';
    if (/music played after Engaging/i.test(s)) s = 'Engaging festive mode';
    if (/^Selection$/i.test(s)) s = 'Weapons operational Grapple primed Hamster pumped';
    if (/^The hamster is impressed$/i.test(s)) s = 'He compliments your tenacity';
    if (/^Minefield deployed$/i.test(s)) s = 'Area denied';
    return s;
}

/**
 * SFX / music-only phrase clips already are the hamster track — no prefix.
 * @param {string} rel
 */
function isHamsterOnlyPhraseRel(rel) {
    const base = path.basename(String(rel || ''));
    return /^\(/i.test(base);
}

/**
 * @typedef {{ folderLabel: string, norm: string, hasSfxPrefix: boolean, path: string, category: string, files: Array<{ name: string, size: number, path: string }> }} HamsterFolder
 */

/**
 * @param {string} extractRoot
 * @returns {HamsterFolder[]}
 */
function collectHamsterFolders(extractRoot) {
    /** @type {HamsterFolder[]} */
    const out = [];

    function walk(dir) {
        let ents;
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        const oggs = ents.filter((e) => e.isFile() && /\.ogg$/i.test(e.name));
        const dirs = ents.filter((e) => e.isDirectory());

        const ham = oggs.filter((f) => /\.03F\./i.test(f.name));
        if (ham.length) {
            const folderLabel = path.basename(dir);
            const rel = path.relative(extractRoot, path.dirname(dir));
            const category = rel ? rel.split(path.sep)[0] : path.basename(path.dirname(dir));
            out.push({
                folderLabel,
                norm: norm(stripSfx(folderLabel)),
                hasSfxPrefix: /^\(/i.test(folderLabel),
                path: dir,
                category,
                files: ham
                    .map((f) => {
                        const full = path.join(dir, f.name);
                        return { name: f.name, size: fs.statSync(full).size, path: full };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            });
        }

        for (const d of dirs) walk(path.join(dir, d.name));
    }

    walk(extractRoot);
    return out;
}

/**
 * @param {string} dir
 * @param {string} [base]
 */
function collectPhraseFiles(dir, base = '') {
    /** @type {Array<{ rel: string, path: string, spoken: string }>} */
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'Hamster' || e.name === 'hamster-prefixes.json') continue;
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
            if (e.name === 'Ultimate' || !base) out.push(...collectPhraseFiles(path.join(dir, e.name), rel));
            continue;
        }
        if (/\.ogg$/i.test(e.name)) {
            out.push({
                rel: rel.replace(/\\/g, '/'),
                path: path.join(dir, e.name),
                spoken: e.name.replace(/\.ogg$/i, ''),
            });
        }
    }
    return out;
}

/**
 * @param {HamsterFolder[]} folders
 * @param {string} phraseNorm
 */
function findHamsterFolder(folders, phraseNorm) {
    const pool = folders.filter((h) => PHRASE_CATS.has(h.category));
    let hit = pool.find((h) => h.norm === phraseNorm);
    if (hit) return { hit, how: 'exact-cat' };
    hit = pool.find((h) => fuzzy(h.norm, phraseNorm));
    if (hit) return { hit, how: 'fuzzy-cat' };
    hit = folders.find((h) => h.norm === phraseNorm);
    if (hit) return { hit, how: 'exact-any' };
    hit = folders.find((h) => fuzzy(h.norm, phraseNorm));
    if (hit) return { hit, how: 'fuzzy-any' };
    return null;
}

/**
 * @param {string} phraseRel
 * @param {number} index
 */
function hamsterDestRel(phraseRel, index) {
    const cleaned = String(phraseRel || '').replace(/\\/g, '/');
    if (index <= 0) return `Hamster/${cleaned}`;
    const m = cleaned.match(/^(.*)(\.ogg)$/i);
    if (!m) return `Hamster/${cleaned}_(${index + 1})`;
    return `Hamster/${m[1]}_(${index + 1})${m[2]}`;
}

async function main() {
    const { extractRoot, dryRun } = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(extractRoot)) {
        console.error(`Extract not found: ${extractRoot}`);
        process.exit(1);
    }
    if (!fs.existsSync(PHRASES_DIR)) {
        console.error(`Phrases not found: ${PHRASES_DIR}`);
        process.exit(1);
    }

    const folders = collectHamsterFolders(extractRoot);
    const phrases = collectPhraseFiles(PHRASES_DIR);
    const ultimateFallback =
        folders.find(
            (h) =>
                h.category === 'Ultimate' &&
                norm(stripSfx(h.folderLabel)) === norm(stripSfx(ULTIMATE_SHARED_HAMSTER_FALLBACK)),
        ) || null;

    /** @type {Record<string, string[]>} */
    const map = {};
    let copied = 0;
    let skippedHamsterOnly = 0;
    let skippedIdentical = 0;
    let missing = 0;

    if (!dryRun) {
        await fsp.rm(HAMSTER_DIR, { recursive: true, force: true });
        await fsp.mkdir(HAMSTER_DIR, { recursive: true });
    }

    console.log(`Folders=${folders.length} phrases=${phrases.length} dryRun=${dryRun}\n`);

    for (const phrase of phrases) {
        if (isHamsterOnlyPhraseRel(phrase.rel)) {
            skippedHamsterOnly += 1;
            console.log(`SKIP (already hamster/SFX): ${phrase.rel}`);
            continue;
        }

        const pn = norm(spokenLookup(phrase.spoken));
        let matched = findHamsterFolder(folders, pn);
        let how = matched?.how || '';

        if (!matched && /^Minefield deployed$/i.test(phrase.spoken) && ultimateFallback) {
            matched = { hit: ultimateFallback, how: 'ultimate-shared-fallback' };
            how = matched.how;
        }

        if (!matched) {
            missing += 1;
            console.log(`MISS: ${phrase.rel}`);
            continue;
        }

        const phraseHash = md5(phrase.path);
        const sources = matched.hit.files.filter((f) => md5(f.path) !== phraseHash);
        if (!sources.length) {
            skippedIdentical += 1;
            console.log(`SKIP (phrase is hamster take): ${phrase.rel}`);
            continue;
        }

        /** @type {string[]} */
        const destRels = [];
        for (let i = 0; i < sources.length; i += 1) {
            const destRel = hamsterDestRel(phrase.rel, i);
            destRels.push(destRel);
            if (!dryRun) {
                const destAbs = path.join(PHRASES_DIR, ...destRel.split('/'));
                await fsp.mkdir(path.dirname(destAbs), { recursive: true });
                await fsp.copyFile(sources[i].path, destAbs);
                copied += 1;
            }
        }
        map[phrase.rel] = destRels;
        console.log(
            `OK  ${phrase.rel}\n    <- [${matched.hit.category}] ${matched.hit.folderLabel} (${sources.length} takes, ${how})`,
        );
    }

    if (!dryRun) {
        await fsp.writeFile(
            MAP_PATH,
            `${JSON.stringify(
                {
                    hero: 'Wrecking Ball',
                    note: 'Gallery playback: random Hamster take, then translator phrase. Minefield uses shared Ultimate squeak.',
                    prefixes: map,
                },
                null,
                2,
            )}\n`,
            'utf8',
        );
    }

    console.log('\nDone.');
    console.log(`  mapped phrases: ${Object.keys(map).length}`);
    console.log(`  hamster files copied: ${copied}`);
    console.log(`  skipped hamster-only phrases: ${skippedHamsterOnly}`);
    console.log(`  skipped identical-to-hamster: ${skippedIdentical}`);
    console.log(`  missing: ${missing}`);
    if (!dryRun) console.log(`  map: ${MAP_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
