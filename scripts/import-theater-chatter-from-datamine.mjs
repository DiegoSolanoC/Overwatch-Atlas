#!/usr/bin/env node
/**
 * Rebuild Dialogue Theater Hero Chatter core categories from HeroVoice extract.
 *
 * Wiki Chatter / Eliminations structure → folder map in
 * scripts/lib/theater-chatter-datamine-map.mjs.
 *
 * Replaces only core disclaimer buckets (Match Start, Respawn, Final Blow, …).
 * Preserves map / skin / hero-specific / scenario / ability-elim lines, and
 * partner-conditioned Set Up lines (empty disclaimer + partners[]).
 *
 * Usage:
 *   node scripts/import-theater-chatter-from-datamine.mjs --dry-run
 *   node scripts/import-theater-chatter-from-datamine.mjs
 *   node scripts/import-theater-chatter-from-datamine.mjs --hero "D.mon"
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import {
    THEATER_CHATTER_CORE_DISCLAIMERS,
    THEATER_CHATTER_DATAMINE_SOURCES,
    THEATER_CHATTER_EXTRACT_ALIASES,
    THEATER_CHATTER_VOICE_PREFIX,
} from './lib/theater-chatter-datamine-map.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

/** Heroes whose extract is unlabeled .03F — keep existing theater chatter. */
const SKIP_UNLABELED_03F = new Set(['Jetpack Cat']);

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

function coreKey(text) {
    const raw = String(text || '');
    const cleaned = cleanLabel(raw);
    // Bastion / similar: entire line is parenthetical — keep interior for identity.
    const onlyParen = /^\([^)]+\)$/.test(cleaned);
    let s = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ');
    if (onlyParen) {
        s = s.replace(/[()]/g, ' ');
    } else {
        s = s
            .replace(
                /\((shona|korean|japanese|french|spanish|chinese|mandarin|arabic|latin|turkish|danish|italian|swedish|portuguese)\)/gi,
                ' $1 ',
            )
            .replace(/\([^)]*\)/g, ' ');
    }
    return s
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function labelToSubtitles(label) {
    let s = cleanLabel(label);
    s = s.replace(
        /^\((Shona|Korean|Japanese|Arabic|Latin|Turkish|Danish|Italian|Swedish|French|Spanish|Portuguese)\)\s*/i,
        (_, lang) => `(${lang}) `,
    );
    s = s.replace(/\s+_([^_]+)_\s*/g, ' "$1" ');
    s = s.replace(/^_([^_]+)_\s*/g, '"$1" ');
    return s.replace(/\s+/g, ' ').trim();
}

function isSfxLabel(label) {
    return /^\((pained breathing|sighs in relief|gasps|exert|grunts?)\)$/i.test(cleanLabel(label));
}

function stripDiacritics(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
}

function extractFolderForHero(heroId) {
    const id = String(heroId || '').trim();
    if (THEATER_CHATTER_EXTRACT_ALIASES[id]) return THEATER_CHATTER_EXTRACT_ALIASES[id];
    for (const name of [id, id.normalize('NFC'), id.normalize('NFD')]) {
        if (fs.existsSync(path.join(EXTRACT_ROOT, name))) return name;
    }
    try {
        const want = stripDiacritics(id);
        for (const name of fs.readdirSync(EXTRACT_ROOT)) {
            if (stripDiacritics(name) === want) return name;
        }
    } catch {
        /* ignore */
    }
    return id;
}

function voicePrefixForHero(heroId) {
    const id = String(heroId || '').trim();
    if (THEATER_CHATTER_VOICE_PREFIX[id]) return THEATER_CHATTER_VOICE_PREFIX[id];
    return id.replace(/ /g, '_');
}

function atlasVoiceName(prefix, label, variantIndex = 0) {
    const body = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    if (variantIndex <= 0) return `${prefix}_-_${body}.ogg`;
    return `${prefix}_-_${body}_(${variantIndex + 1}).ogg`;
}

/**
 * @param {string} absDir
 * @returns {Array<{ label: string, source: string, key: string, variantIndex: number }>}
 */
function listExtract0B2(absDir) {
    if (!fs.existsSync(absDir)) return [];
    /** @type {Array<{ label: string, source: string, key: string, variantIndex: number }>} */
    const out = [];
    /** @type {Map<string, number>} */
    const counts = new Map();

    function walk(abs) {
        let ents;
        try {
            ents = fs.readdirSync(abs, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of ents) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
            const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            const label = m ? m[1] : ent.name.replace(/\.ogg$/i, '');
            if (isSfxLabel(label)) continue;
            const key = coreKey(label);
            if (!key) continue;
            const variantIndex = counts.get(key) || 0;
            counts.set(key, variantIndex + 1);
            out.push({ label, source: full, key, variantIndex });
        }
    }
    walk(absDir);
    out.sort(
        (a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
            || a.variantIndex - b.variantIndex,
    );
    return out;
}

/**
 * Keep non-core lines (map / skin / hero-specific elim / partners…).
 * @param {object[]} lines
 */
function preserveNonCoreLines(lines) {
    return (Array.isArray(lines) ? lines : []).filter((line) => {
        const d = String(line?.disclaimer ?? '').trim();
        if (THEATER_CHATTER_CORE_DISCLAIMERS.has(d)) return false;
        if (!d) {
            return Array.isArray(line.partners) && line.partners.length > 0;
        }
        return true;
    });
}

/**
 * Dedupe key: prefer voice filename so Bastion beep variants stay distinct;
 * fall back to spoken text for wiki-specific overlays of the same line.
 * @param {object} line
 */
function lineMergeKey(line) {
    const voice = String(line?.voice || '')
        .replace(/\.ogg$/i, '')
        .toLowerCase();
    const spoken = coreKey(line?.subtitles || '');
    if (spoken && voice) return `${spoken}::${voice}`;
    return spoken || voice || '';
}

/**
 * Prefer wiki-specific disclaimers over generic core buckets for the same spoken line.
 * @param {object[]} coreLines
 * @param {object[]} preserved
 */
function mergeCoreWithPreserved(coreLines, preserved) {
    /** @type {Map<string, object>} */
    const bySpoken = new Map();

    function specificity(line) {
        const d = String(line?.disclaimer || '').trim();
        let score = d.length;
        if (Array.isArray(line?.partners) && line.partners.length) score += 1000;
        if (/eliminating|after |scenario|skin|map/i.test(d)) score += 200;
        return score;
    }

    // First pass: for matching spoken text, prefer more-specific disclaimer.
    /** @type {Map<string, object>} */
    const bestBySpoken = new Map();
    for (const line of [...coreLines, ...preserved]) {
        const spoken = coreKey(line?.subtitles || '');
        if (!spoken) continue;
        const prev = bestBySpoken.get(spoken);
        if (!prev || specificity(line) > specificity(prev)) {
            bestBySpoken.set(spoken, line);
        }
    }

    /** @type {object[]} */
    const out = [];
    /** @type {Set<string>} */
    const usedMerge = new Set();
    /** @type {Set<string>} */
    const usedSpokenFromPreserved = new Set();

    for (const line of preserved) {
        const spoken = coreKey(line?.subtitles || '');
        if (spoken && bestBySpoken.get(spoken) === line) {
            usedSpokenFromPreserved.add(spoken);
        }
    }

    for (const line of coreLines) {
        const spoken = coreKey(line?.subtitles || '');
        if (spoken && usedSpokenFromPreserved.has(spoken)) {
            // Wiki-specific line wins; skip this generic core take.
            continue;
        }
        const mk = lineMergeKey(line);
        if (!mk || usedMerge.has(mk)) continue;
        usedMerge.add(mk);
        out.push(line);
    }

    for (const line of preserved) {
        const mk = lineMergeKey(line);
        const spoken = coreKey(line?.subtitles || '');
        if (spoken && usedSpokenFromPreserved.has(spoken)) {
            if (bestBySpoken.get(spoken) !== line) continue;
            if (mk && usedMerge.has(mk)) continue;
            if (mk) usedMerge.add(mk);
            out.push(line);
            continue;
        }
        if (!mk || usedMerge.has(mk)) continue;
        usedMerge.add(mk);
        out.push(line);
    }

    return out;
}

async function copyTheaterVoice(atlasName, sourceAbs) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (dryRun) return;
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    await fsp.copyFile(sourceAbs, dest);
}

/**
 * @param {string} heroId
 * @param {object} conversationsData
 */
async function rebuildHeroChatter(heroId, conversationsData) {
    if (SKIP_UNLABELED_03F.has(heroId)) {
        console.log(`\n[${heroId}] SKIP — unlabeled .03F extract (keep existing chatter)`);
        return { ok: false, reason: 'unlabeled-03f' };
    }

    const extractName = extractFolderForHero(heroId);
    const extractRoot = path.join(EXTRACT_ROOT, extractName);
    if (!fs.existsSync(extractRoot)) {
        console.log(`\n[${heroId}] SKIP — no extract (${extractName})`);
        return { ok: false, reason: 'missing-extract' };
    }

    const prefix = voicePrefixForHero(heroId);
    /** @type {object[]} */
    const coreLines = [];
    /** @type {Set<string>} */
    const usedKeys = new Set();
    /** @type {Map<string, number>} */
    const byDisclaimer = new Map();

    for (const src of THEATER_CHATTER_DATAMINE_SOURCES) {
        const abs = path.join(extractRoot, src.folder);
        const clips = listExtract0B2(abs);
        for (const clip of clips) {
            const key = `${src.disclaimer}::${clip.key}::${clip.variantIndex}`;
            if (usedKeys.has(key)) continue;
            usedKeys.add(key);

            const voice = atlasVoiceName(prefix, clip.label, clip.variantIndex);
            await copyTheaterVoice(voice, clip.source);

            /** @type {Record<string, unknown>} */
            const line = {
                id: randomUUID(),
                hero: heroId,
                voice,
                voicePrefix: '',
                subtitles: labelToSubtitles(clip.label),
                render: 'Heroic.png',
                era: 'Overwatch',
                status: 'active',
            };
            if (src.disclaimer) line.disclaimer = src.disclaimer;
            coreLines.push(line);
            const bucket = src.disclaimer || '(Set Up)';
            byDisclaimer.set(bucket, (byDisclaimer.get(bucket) || 0) + 1);
        }
    }

    const chatterId = chatterIdForHero(heroId);
    let row = (conversationsData.conversations || []).find((c) => c.id === chatterId);
    if (!row) {
        row = {
            id: chatterId,
            entryType: 'chatter',
            name: heroId,
            status: 'active',
            eraName: '',
            tags: [],
            scene: DEFAULT_DIALOGUE_SCENE,
            lines: [],
        };
        conversationsData.conversations.push(row);
    }

    const preserved = preserveNonCoreLines(row.lines);
    const before = Array.isArray(row.lines) ? row.lines.length : 0;
    const nextLines = mergeCoreWithPreserved(coreLines, preserved);

    console.log(
        `\n[${heroId}] extract=${extractName} core=${coreLines.length} preserved=${preserved.length} (${before} → ${nextLines.length})`,
    );
    const top = [...byDisclaimer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [k, v] of top) console.log(`  ${v}\t${k}`);

    if (!dryRun) {
        row.entryType = 'chatter';
        row.name = heroId;
        row.status = 'active';
        row.scene = row.scene || DEFAULT_DIALOGUE_SCENE;
        row.tags = Array.isArray(row.tags) ? row.tags : [];
        row.lines = nextLines;
        delete row.paths;
        delete row.selectedPathId;
    }

    return {
        ok: true,
        core: coreLines.length,
        preserved: preserved.length,
        total: nextLines.length,
    };
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

    console.log(
        `Theater chatter from datamine (${dryRun ? 'DRY RUN' : 'WRITE'}) — ${targets.length} heroes`,
    );
    console.log(`Core categories: ${THEATER_CHATTER_DATAMINE_SOURCES.length}`);

    const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    if (!Array.isArray(conversationsData.conversations)) {
        conversationsData.conversations = [];
    }

    let ok = 0;
    let missing = 0;
    let skipped = 0;
    let coreTotal = 0;

    for (const heroId of targets) {
        const result = await rebuildHeroChatter(heroId, conversationsData);
        if (result.ok) {
            ok += 1;
            coreTotal += result.core || 0;
        } else if (result.reason === 'missing-extract') {
            missing += 1;
        } else if (result.reason === 'unlabeled-03f') {
            skipped += 1;
        }
    }

    if (!dryRun) {
        conversationsData._meta = conversationsData._meta || {};
        conversationsData._meta.theaterChatterDatamineAt = new Date().toISOString();
        await fsp.writeFile(
            CONVERSATIONS_PATH,
            `${JSON.stringify(conversationsData, null, 2)}\n`,
            'utf8',
        );
        const assets = await scanTheaterAssets();
        await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
        console.log(`\nWrote ${CONVERSATIONS_PATH}`);
        console.log(`Theater voicelines indexed: ${assets.voicelines?.length ?? 0}`);
    }

    console.log('\nDone.');
    console.log(`  heroes rebuilt: ${ok}/${targets.length}`);
    console.log(`  missing extract: ${missing}`);
    console.log(`  skipped (03F): ${skipped}`);
    console.log(`  core lines seeded: ${coreTotal}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
