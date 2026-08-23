#!/usr/bin/env node
/**
 * Import Jetpack Cat gallery Phrases from HeroVoice sound-folder packs
 * (paren labels like "(cat sounds)", "(questioning meows)", etc.).
 *
 * Wiki Quotes only cover Swedish lines + Meoweoweew, so the Phrase button
 * stays nearly empty without this pass. Mirrors Bastion's flat SFX phrase pool.
 *
 * Usage:
 *   node scripts/import-jetpack-cat-gallery-phrases.mjs --dry-run
 *   node scripts/import-jetpack-cat-gallery-phrases.mjs
 *   node scripts/import-jetpack-cat-gallery-phrases.mjs --extract "C:/path/to/Jetpack Cat"
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const DEFAULT_EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Jetpack Cat',
);

const PHRASES_DIR = path.join(REPO, 'src/assets/audio/Phrases/Jetpack Cat');
const ULTIMATE_DIR = path.join(PHRASES_DIR, 'Ultimate');

/** Communication / voice categories → numbered "(cat sounds) N" pool. */
const CAT_SOUND_CATEGORIES = [
    'Voicelines',
    'Hello',
    'Thanks',
    'Yes',
    'No',
    'Bye',
    'Sorry',
    'YoureWelcome',
    'VotedEpic',
    'VotedLegendary',
];

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

function md5(filePath) {
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function list03F(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((n) => /\.03F\./i.test(n) && /\.ogg$/i.test(n))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((n) => path.join(dir, n));
}

/**
 * Safe phrase basename from a paren folder label.
 * @param {string} folderLabel
 * @param {number} [n]
 */
function phraseName(folderLabel, n = 1) {
    const base = String(folderLabel || '').trim() || '(cat sounds)';
    if (n <= 1) return `${base}.ogg`;
    return `${base} ${n}.ogg`;
}

/**
 * @param {string} destAbs
 * @param {string} sourceAbs
 * @param {boolean} dryRun
 */
async function copyIfMissing(destAbs, sourceAbs, dryRun) {
    if (fs.existsSync(destAbs)) return 'skip';
    if (dryRun) return 'dry';
    await fsp.mkdir(path.dirname(destAbs), { recursive: true });
    await fsp.copyFile(sourceAbs, destAbs);
    return 'copy';
}

async function main() {
    const { extractRoot, dryRun } = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(extractRoot)) {
        console.error(`Extract missing: ${extractRoot}`);
        process.exit(1);
    }

    /** @type {Set<string>} */
    const seenHashes = new Set();
    /** Seed with existing phrase files so we don't duplicate Swedish / Selection. */
    for (const root of [PHRASES_DIR, ULTIMATE_DIR]) {
        if (!fs.existsSync(root)) continue;
        for (const name of fs.readdirSync(root)) {
            const full = path.join(root, name);
            if (!fs.statSync(full).isFile() || !/\.ogg$/i.test(name)) continue;
            seenHashes.add(md5(full));
        }
    }

    let copied = 0;
    let skipped = 0;
    let dryListed = 0;
    /** Shared numbering for flat `(cat sounds) N.ogg` across MatchTalk + voice cats. */
    let catSoundN = 0;
    for (const name of fs.existsSync(PHRASES_DIR) ? fs.readdirSync(PHRASES_DIR) : []) {
        const m = name.match(/^\(cat sounds\)(?: (\d+))?\.ogg$/i);
        if (!m) continue;
        catSoundN = Math.max(catSoundN, m[1] ? Number(m[1]) : 1);
    }

    /**
     * @param {string} destRel relative under Phrases/Jetpack Cat
     * @param {string} sourceAbs
     */
    async function place(destRel, sourceAbs) {
        const hash = md5(sourceAbs);
        if (seenHashes.has(hash)) {
            skipped += 1;
            return false;
        }
        seenHashes.add(hash);
        const destAbs = path.join(PHRASES_DIR, destRel);
        const status = await copyIfMissing(destAbs, sourceAbs, dryRun);
        if (status === 'copy') copied += 1;
        else if (status === 'dry') {
            dryListed += 1;
            console.log(`  [dry] ${destRel}`);
        } else {
            skipped += 1;
            return false;
        }
        return true;
    }

    // --- MatchTalk emotion / SFX folders (Bastion-style: one take per label) ---
    const matchTalk = path.join(extractRoot, 'MatchTalk');
    if (fs.existsSync(matchTalk)) {
        const folders = fs
            .readdirSync(matchTalk, { withFileTypes: true })
            .filter((e) => e.isDirectory() && /^\(/i.test(e.name))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        console.log(`MatchTalk paren folders: ${folders.length}`);
        for (const label of folders) {
            const takes = list03F(path.join(matchTalk, label));
            if (!takes.length) continue;
            // Generic "(cat sounds)" — import every unique take (numbered).
            if (/^\(cat sounds\)$/i.test(label)) {
                for (const src of takes) {
                    const next = catSoundN + 1;
                    if (await place(phraseName(label, next), src)) catSoundN = next;
                }
                continue;
            }
            await place(phraseName(label, 1), takes[0]);
        }
    }

    // --- Hello / Thanks / Voicelines / … shared (cat sounds) packs ---
    for (const category of CAT_SOUND_CATEGORIES) {
        const dir = path.join(extractRoot, category, '(cat sounds)');
        const takes = list03F(dir);
        if (!takes.length) continue;
        console.log(`${category}/(cat sounds): ${takes.length} takes`);
        for (const src of takes) {
            const next = catSoundN + 1;
            if (await place(phraseName('(cat sounds)', next), src)) catSoundN = next;
        }
    }

    // --- Ultimate sound folders ---
    const ultRoot = path.join(extractRoot, 'Ultimate');
    if (fs.existsSync(ultRoot)) {
        const ultFolders = fs
            .readdirSync(ultRoot, { withFileTypes: true })
            .filter((e) => e.isDirectory() && /^\(/i.test(e.name))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        console.log(`Ultimate paren folders: ${ultFolders.length}`);
        for (const label of ultFolders) {
            const takes = list03F(path.join(ultRoot, label));
            let n = 0;
            for (const src of takes) {
                n += 1;
                await place(path.join('Ultimate', phraseName(label, n)).replace(/\\/g, '/'), src);
            }
        }
    }

    console.log(
        `\nDone${dryRun ? ' (dry-run)' : ''}: copied=${copied}, dry=${dryListed}, skipped=${skipped}`,
    );

    if (!dryRun) {
        const gen = spawnSync(process.execPath, [path.join(__dirname, 'generate-manifest.js')], {
            cwd: REPO,
            stdio: 'inherit',
        });
        if (gen.status !== 0) process.exit(gen.status || 1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
