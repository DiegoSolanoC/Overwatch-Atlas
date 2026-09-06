#!/usr/bin/env node
/**
 * Repair chatter subtitles that used wiki hyperlink *page titles* instead of spoken text.
 *
 * Strategy (per chatter line):
 *  1. Strip wiki residue (piped links → display text, wikipedia:Foo → Foo, [url label] → label).
 *  2. If a theater voice file exists and its spoken basename still diverges from the subtitle,
 *     prefer the filename text (MatchTalk/wiki files are named after what is spoken).
 *
 * Usage:
 *   node scripts/fix-chatter-wiki-subtitles.mjs
 *   node scripts/fix-chatter-wiki-subtitles.mjs --apply
 *   node scripts/fix-chatter-wiki-subtitles.mjs --apply --hero Ana
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { hasWikiResidue, stripWikiMarkup, coreKey } from './lib/wiki-markup.mjs';
import {
    VOICELINES_DIR,
    voicelineFilenameToSubtitles,
} from './lib/chatter-audio.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const apply = process.argv.includes('--apply');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function keysDiverge(a, b) {
    const ka = coreKey(a);
    const kb = coreKey(b);
    if (!ka || !kb) return false;
    if (ka === kb) return false;
    if (ka.includes(kb) || kb.includes(ka)) {
        // Minor punctuation / trailing ellipsis — still rewrite if wiki residue
        return Math.abs(ka.length - kb.length) > 8;
    }
    return true;
}

function main() {
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    const onDisk = new Set(
        fs.existsSync(VOICELINES_DIR) ? fs.readdirSync(VOICELINES_DIR) : [],
    );

    /** @type {object[]} */
    const changes = [];
    let scanned = 0;

    for (const row of data.conversations || []) {
        if (row.entryType !== 'chatter') continue;
        const hero = String(row.name || '').trim();
        if (onlyHero && hero.toLowerCase() !== onlyHero.toLowerCase()) continue;

        for (const line of row.lines || []) {
            scanned += 1;
            const before = String(line.subtitles || '');
            let next = stripWikiMarkup(before);
            const voice = String(line.voice || '').trim();
            const voiceExists = Boolean(voice && onDisk.has(voice));
            let reason = '';

            if (hasWikiResidue(before) || before !== next) {
                reason = hasWikiResidue(before) ? 'strip-wiki' : 'normalize';
            }

            if (voiceExists) {
                const fromVoice = voicelineFilenameToSubtitles(voice);
                if (fromVoice && keysDiverge(next, fromVoice)) {
                    next = fromVoice;
                    reason = reason ? `${reason}+from-voice` : 'from-voice';
                } else if (fromVoice && hasWikiResidue(before) && coreKey(next) !== coreKey(fromVoice)) {
                    next = fromVoice;
                    reason = 'strip-wiki+from-voice';
                }
            }

            if (!next || next === before) continue;
            changes.push({
                hero,
                lineId: line.id || null,
                reason,
                before,
                after: next,
                voice: voice || null,
            });
            if (apply) line.subtitles = next;
        }
    }

    const cacheOut = path.join(
        __dirname,
        '_cache',
        apply ? 'fix-chatter-wiki-subtitles-applied.json' : 'fix-chatter-wiki-subtitles-dryrun.json',
    );

    const report = {
        apply,
        scanned,
        changed: changes.length,
        heroes: [...new Set(changes.map((c) => c.hero))].sort(),
        changes,
    };

    fs.mkdirSync(path.dirname(cacheOut), { recursive: true });
    fs.writeFileSync(cacheOut, JSON.stringify(report, null, 2));
    console.log('Wrote', cacheOut);

    if (apply && changes.length) {
        fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(data, null, 2)}\n`);
        console.log('Updated', CONVERSATIONS_PATH);
    }

    console.log({ apply, scanned, changed: changes.length, sample: changes.slice(0, 8) });
}

main();
