#!/usr/bin/env node
/**
 * Gallery Phrases from HeroVoice datamine folders (wiki category parity).
 *
 * Wiki Quotes category → extract folder:
 *   Hero Selected              → HeroSelect
 *   Voice Lines                → Voicelines
 *   Communication → Hello      → Hello
 *   Communication → Thanks     → Thanks
 *   Communication → Praise     → Unknown/11E1.078  (stable GUID across roster)
 *   Abilities → Ultimate cast  → Ultimate/*.ogg (root only; skip Charging/Ready/…)
 *
 * Usage:
 *   node scripts/import-gallery-phrases-from-datamine.mjs --dry-run
 *   node scripts/import-gallery-phrases-from-datamine.mjs
 *   node scripts/import-gallery-phrases-from-datamine.mjs --hero Doctrine
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const PHRASES_ROOT = path.join(REPO, 'src', 'assets', 'audio', 'Phrases');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** Manifest hero id → HeroVoice folder name. */
const EXTRACT_FOLDER_ALIASES = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
    'Wrecking Ball': 'Wrecking Ball',
    'Junker Queen': 'Junker Queen',
    'Jetpack Cat': 'Jetpack Cat',
};

/**
 * Gallery phrase sources in wiki order.
 * `dest` '' = Phrases/<hero>/ ; 'Ultimate' = Phrases/<hero>/Ultimate/
 *
 * Ultimate: take root cast lines + Ready/ cast lines (Winston/Emre store
 * activation there). Skip AlmostReady / Charging / teammate-ready status.
 */
const PHRASE_SOURCES = [
    { wiki: 'Hero Selected', folder: 'HeroSelect', dest: '', mode: 'all', selection: true },
    { wiki: 'Voice Lines', folder: 'Voicelines', dest: '', mode: 'all' },
    { wiki: 'Hello', folder: 'Hello', dest: '', mode: 'all' },
    { wiki: 'Thanks', folder: 'Thanks', dest: '', mode: 'all' },
    { wiki: 'Praise', folder: path.join('Unknown', '11E1.078'), dest: '', mode: 'all' },
    { wiki: 'Ultimate', folder: 'Ultimate', dest: 'Ultimate', mode: 'ultimate' },
];

function coreKey(text) {
    let s = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        // Keep language tags so "(Arabic) Hello" ≠ "Hello".
        .replace(
            /\((arabic|shona|korean|japanese|latin|french|spanish|german|chinese|mandarin|russian|portuguese|swedish|brazilian portuguese)\)/gi,
            ' $1 ',
        );

    // Bastion / Jetpack Cat labels are often the whole phrase in (...).
    const wholeParen = s.trim().match(/^\((.+)\)$/);
    if (wholeParen) {
        s = wholeParen[1];
    } else {
        s = s.replace(/\([^)]*\)/g, ' ');
    }

    return s
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

/** Skip pure exertion SFX — keep Bastion beeps / Jetpack Cat meows / laughs. */
function isSfxLabel(label) {
    return /^\((pained breathing|sighs in relief|gasps|exert|grunts?)\)$/i.test(cleanLabel(label));
}

/** Ultimate status chatter (not cast lines). */
const ULTIMATE_STATUS_RE =
    /ultimate'?s? (is )?(almost )?ready|ultimate is charging|ultimate still requires|is ready to deploy|ready to give you|pulse bomb ready|pulse bomb'?s almost|pulse bomb is charging|nano boost is ready|^ultimate status/i;

/**
 * Ability outcome / post-cast lines that sit in Ultimate/ on disk but are not
 * the ultimate activation the gallery phrase pool wants (wiki splits these out).
 */
const ULTIMATE_OUTCOME_RE =
    /\bstuck\b|detonat|direct hit|blasted|tickin'|couldn't have been|thought of you|special delivery|letter for|present for|tag,? you'?re it|coal for your stocking|nailed it|knockout|^gotcha|got you something|wait for it|time'?s up|out with a bang|enjoy the|courier'?s here|perfect stick|true strike|that'?s a stick|right on (target|the money)|locked on|target locked|spot-on|hit my mark|winging it|wuh wuh|you need a time out|looks good on you|i am victorious|the bards will|that'?s not how you wanted|^pow!|^boom!$|^catch!$|kaboom|cracking!|smashing|^here you go/i;

function extractFolderForHero(heroId) {
    const id = String(heroId || '').trim();
    if (EXTRACT_FOLDER_ALIASES[id]) return EXTRACT_FOLDER_ALIASES[id];
    // Lucio / Torbjorn NFC folder names on disk
    const candidates = [id, id.normalize('NFC'), id.normalize('NFD')];
    for (const name of candidates) {
        if (fs.existsSync(path.join(EXTRACT_ROOT, name))) return name;
    }
    return id;
}

/**
 * @param {string} absDir
 * @param {'all'|'ultimate'} mode
 * @returns {Array<{ label: string, source: string, key: string }>}
 */
function listExtract0B2(absDir, mode = 'all') {
    if (!fs.existsSync(absDir)) return [];
    /** @type {Array<{ label: string, source: string, key: string }>} */
    const out = [];
    /** @type {Set<string>} */
    const seen = new Set();

    /**
     * @param {string} abs
     * @param {string} relFromUltimate — '' at Ultimate root; subfolder name when nested
     */
    function walk(abs, relFromUltimate) {
        let ents;
        try {
            ents = fs.readdirSync(abs, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of ents) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                if (mode === 'ultimate') {
                    // Root cast files + Ready/ activation; skip status buckets.
                    const sub = ent.name;
                    if (/^(AlmostReady|Charging|UltimateIsReadyTeammate)$/i.test(sub)) continue;
                    if (relFromUltimate === '' && /^(Ready)$/i.test(sub)) {
                        walk(full, sub);
                    }
                    // Ignore deeper / other Ultimate subfolders (skin packs, etc.)
                    continue;
                }
                walk(full, relFromUltimate);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
            const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            const label = m ? m[1] : ent.name.replace(/\.ogg$/i, '');
            if (isSfxLabel(label)) continue;
            if (mode === 'ultimate') {
                const cleaned = cleanLabel(label);
                if (ULTIMATE_STATUS_RE.test(cleaned) || ULTIMATE_OUTCOME_RE.test(cleaned)) continue;
            }
            const key = coreKey(label);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push({ label, source: full, key });
        }
    }

    walk(absDir, '');
    return out;
}

function uniqueDestName(used, baseName) {
    let name = baseName;
    let n = 2;
    while (used.has(name.toLowerCase())) {
        const m = baseName.match(/^(.*)(\.ogg)$/i);
        name = m ? `${m[1]} (${n})${m[2]}` : `${baseName} (${n})`;
        n += 1;
    }
    used.add(name.toLowerCase());
    return name;
}

async function clearHeroPhraseAudio(heroId) {
    const heroDir = path.join(PHRASES_ROOT, heroId);
    if (!fs.existsSync(heroDir)) return;

    async function wipe(dir) {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await wipe(full);
                const left = await fsp.readdir(full);
                if (!left.length) await fsp.rmdir(full).catch(() => {});
            } else if (/\.(ogg|mp3|wav|m4a|webm)$/i.test(entry.name)) {
                await fsp.unlink(full);
            }
            // keep hamster-prefixes.json and other sidecars
        }
    }
    await wipe(heroDir);
}

/**
 * @param {string} heroId
 */
async function importHero(heroId) {
    const extractName = extractFolderForHero(heroId);
    const extractRoot = path.join(EXTRACT_ROOT, extractName);
    if (!fs.existsSync(extractRoot)) {
        console.log(`\n[${heroId}] SKIP — no extract folder (${extractName})`);
        return { ok: false, reason: 'missing-extract' };
    }

    process.stdout.write(`\n[${heroId}] extract=${extractName} … `);
    if (!dryRun) await clearHeroPhraseAudio(heroId);

    const heroDir = path.join(PHRASES_ROOT, heroId);
    if (!dryRun) await fsp.mkdir(heroDir, { recursive: true });

    const used = new Set();
    /** @type {string|null} */
    let firstSelectionSource = null;
    const counts = {};

    for (const src of PHRASE_SOURCES) {
        const abs = path.join(extractRoot, src.folder);
        const rows = listExtract0B2(abs, src.mode || 'all');
        counts[src.wiki] = rows.length;

        for (const row of rows) {
            const leaf = uniqueDestName(
                used,
                `${cleanLabel(row.label).replace(/[\\/:*?"<>|]/g, '')}.ogg`,
            );
            const rel = src.dest ? `${src.dest}/${leaf}` : leaf;
            if (src.selection && !firstSelectionSource) firstSelectionSource = row.source;

            if (dryRun) {
                console.log(`  DRY [${src.wiki}] ${rel}`);
                continue;
            }
            const destPath = path.join(heroDir, ...rel.split('/'));
            await fsp.mkdir(path.dirname(destPath), { recursive: true });
            await fsp.copyFile(row.source, destPath);
        }
    }

    if (firstSelectionSource && !dryRun) {
        const selectionPath = path.join(heroDir, 'Selection.ogg');
        await fsp.copyFile(firstSelectionSource, selectionPath);
    } else if (firstSelectionSource && dryRun) {
        console.log('  DRY Selection.ogg');
    }

    const summary = Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
    console.log(summary);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { ok: total > 0, counts, total };
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`HeroVoice extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const heroes = await loadManifestHeroIds();
    const targets = onlyHero
        ? heroes.filter((h) => h.toLowerCase() === onlyHero.toLowerCase())
        : heroes;

    if (!targets.length) {
        console.error(onlyHero ? `No hero matched --hero ${onlyHero}` : 'No heroes in manifest');
        process.exit(1);
    }

    console.log(
        `Gallery phrases from datamine (${dryRun ? 'DRY RUN' : 'WRITE'}) — ${targets.length} heroes`,
    );
    console.log('Mapping:');
    for (const s of PHRASE_SOURCES) {
        const note =
            s.mode === 'ultimate' ? ' (root + Ready cast; skip status)' : '';
        console.log(`  ${s.wiki.padEnd(16)} ← ${s.folder}${note}`);
    }

    let ok = 0;
    let missing = 0;
    let lines = 0;

    for (const heroId of targets) {
        // Jetpack Cat: unlabeled .03F packs — use import-jetpack-cat-phrases-from-wiki.mjs
        if (/^jetpack\s*cat$/i.test(heroId)) {
            console.log(`\n[${heroId}] SKIP — use scripts/import-jetpack-cat-phrases-from-wiki.mjs`);
            continue;
        }
        const result = await importHero(heroId);
        if (result.ok) {
            ok += 1;
            lines += result.total || 0;
        } else if (result.reason === 'missing-extract') {
            missing += 1;
        }
    }

    console.log('\nDone.');
    console.log(`  heroes with clips: ${ok}/${targets.length}`);
    console.log(`  missing extract: ${missing}`);
    console.log(`  lines copied: ${lines}`);
    if (!dryRun) console.log('\nNext: node scripts/generate-manifest.js');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
