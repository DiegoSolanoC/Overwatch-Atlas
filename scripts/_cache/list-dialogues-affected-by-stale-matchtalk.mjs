/**
 * List dialogue theater entries whose lines match stale MatchTalk extract files.
 *
 * Usage:
 *   node scripts/_cache/list-dialogues-affected-by-stale-matchtalk.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';
import {
    normalizeHeroKey,
    normalizeSubtitlesForMatch,
    voicelineFilenameToSubtitles,
} from '../../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { stripDialogueSubtitleMarkup } from '../../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

/** Extract folder hero → theater line hero aliases. */
const EXTRACT_HERO_TO_LINE = {
    'D.Va': 'D.va',
    'D.Mon': 'D.mon',
    'Soldier_ 76': 'Soldier 76',
    'Wrecking Ball': 'Wrecking Ball',
    'Junker Queen': 'Junker Queen',
    'Jetpack Cat': 'Jetpack Cat',
};

function loadJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split(/\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function spokenFromMatchTalkRel(rel) {
    const norm = String(rel || '').replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    const hero = parts[0] || '';
    const file = parts[parts.length - 1] || '';
    const parent = parts.length >= 2 ? parts[parts.length - 2] : '';

    // Labeled .0B2: GUID.0B2-Spoken text.ogg
    const m0b2 = file.match(/\.0B2-(.+)\.ogg$/i);
    if (m0b2) {
        return { hero, spoken: m0b2[1].replace(/_/g, ' ').trim(), kind: '0B2' };
    }

    // Hamster / Jetpack style: folder is the label, file is unlabeled .03F
    if (/\.03F\.ogg$/i.test(file) && parent && parent !== 'MatchTalk') {
        return { hero, spoken: parent.replace(/_/g, ' ').trim(), kind: '03F-folder' };
    }

    return { hero, spoken: '', kind: 'unknown' };
}

function compactNorm(text) {
    return normalizeSubtitlesForMatch(String(text || ''))
        .replace(/_/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
}

function lineLookupKeys(line) {
    const keys = new Set();
    const cleanSub = stripDialogueSubtitleMarkup(String(line?.subtitles || '')).trim();
    if (cleanSub) {
        keys.add(compactNorm(cleanSub));
        keys.add(compactNorm(normalizeSubtitlesForMatch(cleanSub).replace(/_/g, ' ')));
    }
    const voice = String(line?.voice || '').trim();
    if (voice) {
        keys.add(compactNorm(voicelineFilenameToSubtitles(voice)));
    }
    return [...keys].filter((k) => k.length >= 8);
}

async function main() {
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');
    const baseline = String(
        await fsp.readFile(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8'),
    ).trim();
    const post = String(await fsp.readFile(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8')).trim();
    const diffRoot = path.join(snapRoot, `diff_${baseline}_vs_${post}`);

    const staleRows = loadJsonl(path.join(diffRoot, 'stale.jsonl')).filter((row) => {
        const rel = String(row.rel || '').replace(/\\/g, '/');
        return /\/MatchTalk\//i.test(rel);
    });

    /** @type {Map<string, Map<string, string[]>>} heroKey → spokenNorm → rels */
    const staleByHero = new Map();
    for (const row of staleRows) {
        const { hero, spoken } = spokenFromMatchTalkRel(row.rel);
        const key = compactNorm(spoken);
        if (!key || key.length < 8) continue;
        const lineHero = EXTRACT_HERO_TO_LINE[hero] || hero;
        const heroKey = normalizeHeroKey(lineHero);
        if (!staleByHero.has(heroKey)) staleByHero.set(heroKey, new Map());
        const bySpoken = staleByHero.get(heroKey);
        if (!bySpoken.has(key)) bySpoken.set(key, []);
        bySpoken.get(key).push(String(row.rel).replace(/\\/g, '/'));
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.conversations || [];
    const dialogues = list.filter((c) => c?.entryType === 'dialogue' || (!c?.entryType && Array.isArray(c?.lines)));

    /** @type {Map<string, { name: string, id: string, matchedLines: number, samples: string[] }>} */
    const hitById = new Map();

    for (const conv of dialogues) {
        const lines = Array.isArray(conv.lines) ? conv.lines : [];
        let matchedLines = 0;
        /** @type {string[]} */
        const samples = [];
        for (const line of lines) {
            const heroKey = normalizeHeroKey(line?.hero || '');
            const bySpoken = staleByHero.get(heroKey);
            if (!bySpoken) continue;
            const keys = lineLookupKeys(line);
            let hit = false;
            for (const key of keys) {
                if (bySpoken.has(key)) {
                    hit = true;
                    break;
                }
                // Prefix / contains for truncated extract labels
                for (const staleKey of bySpoken.keys()) {
                    if (
                        (key.length >= 16 && staleKey.includes(key))
                        || (staleKey.length >= 16 && key.includes(staleKey))
                    ) {
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }
            if (hit) {
                matchedLines += 1;
                if (samples.length < 3) {
                    samples.push(
                        `${line.hero}: ${stripDialogueSubtitleMarkup(String(line.subtitles || '')).slice(0, 90)}`,
                    );
                }
            }
        }
        if (matchedLines > 0) {
            hitById.set(String(conv.id || conv.name), {
                name: String(conv.name || conv.id || '(unnamed)'),
                id: String(conv.id || ''),
                matchedLines,
                lineCount: lines.length,
                samples,
            });
        }
    }

    const affected = [...hitById.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );

    const names = affected.map((a) => a.name);
    const outJson = path.join(diffRoot, 'stale-affected-dialogues.json');
    const outNames = path.join(diffRoot, 'stale-affected-dialogue-names.txt');
    await fsp.writeFile(
        outJson,
        `${JSON.stringify(
            {
                staleMatchTalkFiles: staleRows.length,
                staleSpokenKeys: [...staleByHero.values()].reduce((n, m) => n + m.size, 0),
                dialogueTotal: dialogues.length,
                dialoguesAffected: affected.length,
                entries: affected,
            },
            null,
            2,
        )}\n`,
    );
    await fsp.writeFile(outNames, `${names.join('\n')}${names.length ? '\n' : ''}`);

    console.log(`Stale MatchTalk files: ${staleRows.length}`);
    console.log(`Dialogue entries total: ${dialogues.length}`);
    console.log(`Dialogue entries affected (by name): ${affected.length}`);
    console.log('');
    for (const name of names) console.log(name);
    console.log(`\nWrote:\n  ${outNames}\n  ${outJson}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
