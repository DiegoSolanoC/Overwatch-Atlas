#!/usr/bin/env node
/**
 * Acquire / reassign chatter audio for all heroes.
 *
 * For each chatter line:
 *  - Empty or missing-on-disk voice → MatchTalk copy (by subtitle), then wiki download.
 *  - Optional --reassign: when subtitle vs voice-filename diverge, prefer MatchTalk that
 *    matches the *subtitle* (wrong file assigned) and rewrite `voice`.
 *
 * Usage:
 *   node scripts/fix-chatter-missing-audio.mjs
 *   node scripts/fix-chatter-missing-audio.mjs --apply
 *   node scripts/fix-chatter-missing-audio.mjs --apply --reassign
 *   node scripts/fix-chatter-missing-audio.mjs --apply --hero Ana
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { coreKey, stripWikiMarkup } from './lib/wiki-markup.mjs';
import {
    DEFAULT_EXTRACT_ROOT,
    VOICELINES_DIR,
    atlasFilenameFromLabel,
    findMatchTalkOgg,
    voicelineFilenameToSubtitles,
    wikiTitleFromTheaterVoice,
} from './lib/chatter-audio.mjs';
import {
    downloadWikiVoicelineFile,
    searchWikiVoicelineTitle,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const apply = process.argv.includes('--apply');
const reassign = process.argv.includes('--reassign');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';
const extractArgIdx = process.argv.indexOf('--extract');
const extractRoot =
    extractArgIdx >= 0
        ? String(process.argv[extractArgIdx + 1] || '').trim()
        : DEFAULT_EXTRACT_ROOT;

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
    if (ka.includes(kb) || kb.includes(ka)) return Math.abs(ka.length - kb.length) > 8;
    return true;
}

/**
 * @param {string} destName
 * @param {string} sourcePath
 */
async function ensureVoiceFile(destName, sourcePath) {
    const dest = path.join(VOICELINES_DIR, destName);
    if (fs.existsSync(dest)) return dest;
    if (!apply) return dest;
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    await fsp.copyFile(sourcePath, dest);
    return dest;
}

/**
 * @param {string} hero
 * @param {string} voice
 * @param {string} subtitle
 * @param {string} destPath
 * @returns {Promise<{ title: string, destName: string }>}
 */
async function downloadWithFallback(hero, voice, subtitle, destPath) {
    const exact = wikiTitleFromTheaterVoice(voice);
    const titles = [];
    if (exact) titles.push(`File:${exact}`);
    const spoken = subtitle || voicelineFilenameToSubtitles(voice);
    const searched = await searchWikiVoicelineTitle(hero, spoken);
    if (searched && !titles.includes(searched)) titles.push(searched);

    let lastErr = null;
    for (const title of titles) {
        try {
            let destName = voice;
            let dest = destPath;
            try {
                const theaterName = wikiFileTitleToTheaterFilename(title);
                if (theaterName && theaterName !== voice) {
                    // Prefer canonical wiki naming when search found a different file
                    destName = theaterName;
                    dest = path.join(VOICELINES_DIR, theaterName);
                }
            } catch {
                /* keep voice name */
            }
            await downloadWikiVoicelineFile(title, dest);
            if (fs.existsSync(dest)) return { title, destName };
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr || new Error('No wiki title candidates');
}

async function main() {
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Set<string>} */
    let onDisk = new Set(
        fs.existsSync(VOICELINES_DIR) ? fs.readdirSync(VOICELINES_DIR) : [],
    );

    const report = {
        apply,
        reassign,
        extractRoot,
        copiedFromMatchTalk: 0,
        downloadedFromWiki: 0,
        reassigned: 0,
        stillMissing: [],
        actions: [],
    };

    for (const row of data.conversations || []) {
        if (row.entryType !== 'chatter') continue;
        const hero = String(row.name || '').trim();
        if (onlyHero && hero.toLowerCase() !== onlyHero.toLowerCase()) continue;

        for (const line of row.lines || []) {
            const subtitle = stripWikiMarkup(line.subtitles || '');
            let voice = String(line.voice || '').trim();
            const voiceSpoken = voice ? voicelineFilenameToSubtitles(voice) : '';
            const missing = !voice || !onDisk.has(voice);
            const mismatched =
                reassign && voice && onDisk.has(voice) && keysDiverge(subtitle, voiceSpoken);

            if (!missing && !mismatched) continue;

            // Prefer MatchTalk by subtitle (spoken intent from wiki text / repaired sub)
            const mt = findMatchTalkOgg(hero, subtitle || voiceSpoken, extractRoot);
            if (mt && mt.score >= 80) {
                const destName = atlasFilenameFromLabel(hero, mt.label);
                const needsCopy = !onDisk.has(destName);
                if (apply && needsCopy) {
                    await ensureVoiceFile(destName, mt.source);
                    onDisk.add(destName);
                }
                const voiceChanged = voice !== destName;
                if (voiceChanged || needsCopy || missing) {
                    const action = {
                        hero,
                        kind: mismatched && voiceChanged ? 'reassign-matchtalk' : 'copy-matchtalk',
                        subtitle: subtitle.slice(0, 100),
                        from: voice || null,
                        to: destName,
                        score: mt.score,
                    };
                    report.actions.push(action);
                    if (mismatched && voiceChanged) report.reassigned += 1;
                    else report.copiedFromMatchTalk += 1;
                    if (apply && voiceChanged) line.voice = destName;
                    voice = destName;
                }
                continue;
            }

            // Wiki download for assigned-but-missing theater filenames
            if (voice && !onDisk.has(voice)) {
                const dest = path.join(VOICELINES_DIR, voice);
                try {
                    if (apply) {
                        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
                        const got = await downloadWithFallback(hero, voice, subtitle, dest);
                        if (got.destName !== voice) {
                            line.voice = got.destName;
                            voice = got.destName;
                        }
                        onDisk.add(got.destName);
                        report.downloadedFromWiki += 1;
                        report.actions.push({
                            hero,
                            kind: 'wiki-download',
                            voice: got.destName,
                            title: got.title,
                        });
                        continue;
                    }
                    // dry-run: probe search only
                    const exact = wikiTitleFromTheaterVoice(voice);
                    const searched = await searchWikiVoicelineTitle(
                        hero,
                        subtitle || voicelineFilenameToSubtitles(voice),
                    );
                    if (exact || searched) {
                        report.downloadedFromWiki += 1;
                        report.actions.push({
                            hero,
                            kind: 'wiki-download',
                            voice,
                            title: searched || `File:${exact}`,
                        });
                        continue;
                    }
                } catch (err) {
                    report.actions.push({
                        hero,
                        kind: 'wiki-fail',
                        voice,
                        error: String(err?.message || err),
                    });
                }
            }

            // Empty voice: try wiki from subtitle
            if (!voice && subtitle) {
                const guess = atlasFilenameFromLabel(hero, subtitle);
                const dest = path.join(VOICELINES_DIR, guess);
                try {
                    if (apply) {
                        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
                        const got = await downloadWithFallback(hero, guess, subtitle, dest);
                        line.voice = got.destName;
                        onDisk.add(got.destName);
                        report.downloadedFromWiki += 1;
                        report.actions.push({
                            hero,
                            kind: 'wiki-download-empty',
                            voice: got.destName,
                            title: got.title,
                        });
                        continue;
                    }
                    const searched = await searchWikiVoicelineTitle(hero, subtitle);
                    if (searched) {
                        report.downloadedFromWiki += 1;
                        report.actions.push({
                            hero,
                            kind: 'wiki-download-empty',
                            voice: guess,
                            title: searched,
                        });
                        continue;
                    }
                } catch (err) {
                    report.actions.push({
                        hero,
                        kind: 'wiki-fail',
                        voice: guess,
                        error: String(err?.message || err),
                    });
                }
            }

            // Existing voice on disk but subtitle diverges and MatchTalk couldn't reassign —
            // leave for subtitle repair / per-hero audit; not a missing-audio case.
            if (voice && onDisk.has(voice)) continue;

            report.stillMissing.push({
                hero,
                subtitle: subtitle.slice(0, 120),
                voice: voice || null,
                mtScore: mt?.score ?? null,
            });
        }
    }

    const cacheOut = path.join(
        __dirname,
        '_cache',
        apply ? 'fix-chatter-missing-audio-applied.json' : 'fix-chatter-missing-audio-dryrun.json',
    );
    fs.mkdirSync(path.dirname(cacheOut), { recursive: true });
    fs.writeFileSync(cacheOut, JSON.stringify(report, null, 2));
    console.log('Wrote', cacheOut);

    if (apply) {
        fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(data, null, 2)}\n`);
        if (report.copiedFromMatchTalk + report.downloadedFromWiki + report.reassigned > 0) {
            await scanTheaterAssets();
        }
        console.log('Updated', CONVERSATIONS_PATH);
    }

    console.log({
        apply,
        reassign,
        copiedFromMatchTalk: report.copiedFromMatchTalk,
        downloadedFromWiki: report.downloadedFromWiki,
        reassigned: report.reassigned,
        stillMissing: report.stillMissing.length,
        sampleActions: report.actions.slice(0, 10),
        sampleMissing: report.stillMissing.slice(0, 8),
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
