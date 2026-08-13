#!/usr/bin/env node
/**
 * Match gallery Phrases/Wrecking Ball clips to datamined hamster (.03F) folders.
 *
 * Usage:
 *   node scripts/audit-wrecking-ball-phrase-hamsters.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Wrecking Ball',
);
const PHRASES = path.join(REPO, 'src/assets/audio/Phrases/Wrecking Ball');

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
]);

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
    /* Keep the sung/squeaked title inside e.g. (hammond sings _Deck the Halls_). */
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

/** @type {Array<{label:string,norm:string,path:string,size:number,category:string,md5:string}>} */
const translators = [];
/** @type {Array<{folderLabel:string,norm:string,hasSfxPrefix:boolean,path:string,category:string,files:Array<{name:string,size:number,path:string}>,uniqueSizes:number[]}>} */
const hamsterFolders = [];

function walk(dir) {
    let ents;
    try {
        ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    const oggs = ents.filter((e) => e.isFile() && /\.ogg$/i.test(e.name));
    const dirs = ents.filter((e) => e.isDirectory());

    for (const f of oggs) {
        const full = path.join(dir, f.name);
        if (/\.0B2[-.]/i.test(f.name)) {
            const m = f.name.match(/^[^-]+-(.+)\.ogg$/i);
            const label = m ? m[1] : f.name;
            translators.push({
                label,
                norm: norm(stripSfx(label)),
                path: full,
                size: fs.statSync(full).size,
                category: path.relative(EXTRACT, dir).split(path.sep)[0] || path.basename(dir),
                md5: md5(full),
            });
        }
    }

    const ham = oggs.filter((f) => /\.03F\./i.test(f.name));
    if (ham.length) {
        const folderLabel = path.basename(dir);
        hamsterFolders.push({
            folderLabel,
            norm: norm(stripSfx(folderLabel)),
            hasSfxPrefix: /^\(/i.test(folderLabel),
            path: dir,
            category:
                path.relative(EXTRACT, path.dirname(dir)).split(path.sep)[0] ||
                path.basename(path.dirname(dir)),
            files: ham.map((f) => ({
                name: f.name,
                size: fs.statSync(path.join(dir, f.name)).size,
                path: path.join(dir, f.name),
            })),
            uniqueSizes: [
                ...new Set(ham.map((f) => fs.statSync(path.join(dir, f.name)).size)),
            ].sort((a, b) => a - b),
        });
    }

    for (const d of dirs) walk(path.join(dir, d.name));
}

function collectPhraseFiles(dir, base = '') {
    /** @type {Array<{rel:string,path:string,spoken:string,size:number}>} */
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...collectPhraseFiles(path.join(dir, e.name), rel));
        else if (/\.ogg$/i.test(e.name)) {
            out.push({
                rel,
                path: path.join(dir, e.name),
                spoken: e.name.replace(/\.ogg$/i, ''),
                size: fs.statSync(path.join(dir, e.name)).size,
            });
        }
    }
    return out;
}

function findHamster(phraseNorm) {
    const pool = hamsterFolders.filter((h) => PHRASE_CATS.has(h.category));
    let hit = pool.find((h) => h.norm === phraseNorm);
    if (hit) return { hit, how: 'exact-cat' };
    hit = pool.find((h) => fuzzy(h.norm, phraseNorm));
    if (hit) return { hit, how: 'fuzzy-cat' };
    hit = hamsterFolders.find((h) => h.norm === phraseNorm);
    if (hit) return { hit, how: 'exact-any' };
    hit = hamsterFolders.find((h) => fuzzy(h.norm, phraseNorm));
    if (hit) return { hit, how: 'fuzzy-any' };
    return null;
}

function findTranslator(phraseNorm) {
    const pool = translators.filter((t) => PHRASE_CATS.has(t.category));
    let hit = pool.find((t) => t.norm === phraseNorm);
    if (hit) return hit;
    hit = pool.find((t) => fuzzy(t.norm, phraseNorm));
    if (hit) return hit;
    hit = translators.find((t) => t.norm === phraseNorm);
    if (hit) return hit;
    return translators.find((t) => fuzzy(t.norm, phraseNorm)) || null;
}

function spokenLookup(spoken) {
    let s = String(spoken || '');
    if (/hammond sings/i.test(s) || /^Deck the halls with me$/i.test(s)) s = 'Deck the Halls';
    if (/music played after Engaging/i.test(s)) s = 'Engaging festive mode';
    if (/^Selection$/i.test(s)) s = 'Weapons operational Grapple primed Hamster pumped';
    if (/^The hamster is impressed$/i.test(s)) s = 'He compliments your tenacity';
    return s;
}

function main() {
    if (!fs.existsSync(EXTRACT)) {
        console.error(`Extract not found: ${EXTRACT}`);
        process.exit(1);
    }
    if (!fs.existsSync(PHRASES)) {
        console.error(`Phrases not found: ${PHRASES}`);
        process.exit(1);
    }

    walk(EXTRACT);
    const phrases = collectPhraseFiles(PHRASES);

    const sizeKey = (h) => h.uniqueSizes.join(',');
    const sizeCounts = new Map();
    for (const h of hamsterFolders) {
        const k = sizeKey(h);
        sizeCounts.set(k, (sizeCounts.get(k) || 0) + 1);
    }

    console.log(
        `translators=${translators.length} hamsterFolders=${hamsterFolders.length} phrases=${phrases.length}\n`,
    );

    /** @type {Array<object>} */
    const rows = [];
    for (const p of phrases) {
        const spoken = spokenLookup(p.spoken);
        const pn = norm(spoken);
        const ham = findHamster(pn);
        const tr = findTranslator(pn);
        /* Prefixed folders are line-specific; unprefixed pools reused across many lines. */
        const shared =
            ham &&
            !ham.hit.hasSfxPrefix &&
            (sizeCounts.get(sizeKey(ham.hit)) || 0) > 5;
        rows.push({
            phrase: p.rel,
            hamFolder: ham?.hit.folderLabel || '',
            hamCat: ham?.hit.category || '',
            hamHow: ham?.how || 'NONE',
            hamCount: ham?.hit.files.length || 0,
            hamSharedGeneric: Boolean(shared),
            phraseIsTranslatorCopy: Boolean(tr && md5(p.path) === tr.md5),
            trLabel: tr?.label || '',
        });
    }

    const matched = rows.filter((r) => r.hamHow !== 'NONE');
    const uniqueHam = matched.filter((r) => !r.hamSharedGeneric);
    const sharedHam = matched.filter((r) => r.hamSharedGeneric);
    const none = rows.filter((r) => r.hamHow === 'NONE');

    console.log('=== MATCHED LINE-SPECIFIC HAMSTER ===');
    for (const r of uniqueHam.sort((a, b) => a.phrase.localeCompare(b.phrase))) {
        console.log(r.phrase);
        console.log(
            `  -> [${r.hamCat}] ${r.hamFolder} (${r.hamCount} takes, ${r.hamHow})${
                r.phraseIsTranslatorCopy ? ' [phrase==0B2]' : ''
            }`,
        );
    }

    console.log('\n=== MATCHED SHARED GENERIC HAMSTER POOL ===');
    for (const r of sharedHam.sort((a, b) => a.phrase.localeCompare(b.phrase))) {
        console.log(r.phrase);
        console.log(
            `  -> [${r.hamCat}] ${r.hamFolder} (${r.hamCount} takes SHARED, ${r.hamHow})`,
        );
    }

    console.log('\n=== NO HAMSTER MATCH ===');
    for (const r of none) console.log(`  ${r.phrase}`);

    console.log(
        `\nSummary: unique=${uniqueHam.length} shared=${sharedHam.length} none=${none.length}`,
    );
}

main();
