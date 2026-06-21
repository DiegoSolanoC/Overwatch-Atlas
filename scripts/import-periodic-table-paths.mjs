#!/usr/bin/env node
/**
 * Import Winston's periodic-table Failure + Success multi-response interactions from the wiki.
 *
 * Usage:
 *   node scripts/import-periodic-table-paths.mjs
 *   node scripts/import-periodic-table-paths.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialoguePathId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import {
    extractAudioSlots,
    extractInteractionsSection,
    fetchWikiPageHtml,
} from './lib/wiki-interactions-table.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const RENDERS_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Renders');
const SCENES_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Scene');

const CONVERSATION_ID = 'c0a0de2e-e5fb-4e7b-aa23-5afa500bcc0d';
const FAILURE_OPENING_LINE_ID = '9bb006fc-073e-49b3-8e34-cb2e4ac984d6';
const SUCCESS_OPENING_LINE_ID = 'f1a2b3c4-d005-4000-8000-c0a0de2e0001';
const SUCCESS_CLOSING_LINE_ID = 'f1a2b3c4-d005-4000-8000-c0a0de2e0002';
const ANA_LINE_ID = '13462f07-9bd3-465b-9e0a-e4c993d3099a';
const BRIGITTE_SUCCESS_LINE_ID = 'b8c4e1a2-d005-4000-8000-c0a0de2e0003';
const DUPLICATE_CONVERSATION_IDS = ['3e5eb96e-c996-407c-a1dd-91c96f048e55'];

const USER_AGENT = 'OverwatchAtlas/1.0 (periodic table importer)';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    return { dryRun: argv.includes('--dry-run') };
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripHtmlToText(html) {
    return String(html || '')
        .replace(/<div[\s\S]*?<\/div>/gi, ' ')
        .replace(/<audio[\s\S]*?<\/audio>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
        .replace(/<small>([\s\S]*?)<\/small>/gi, ' $1 ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {string} url
 * @returns {string}
 */
function filenameFromAudioUrl(url) {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/([^/]+)\.ogg(?:\/|$)/i);
    if (match) return `${decodeURIComponent(match[1])}.ogg`;

    const fallback = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'voice.ogg');
    return fallback.endsWith('.ogg') ? fallback : `${fallback}.ogg`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeHeroKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} hero
 * @returns {string}
 */
function normalizeImportedHero(hero) {
    const trimmed = String(hero || '').trim();
    if (normalizeHeroKey(trimmed) === 'soldier76') return 'Soldier: 76';
    if (normalizeHeroKey(trimmed) === 'dva') return 'D.Va';
    return trimmed;
}

/**
 * @param {string} hero
 * @returns {string}
 */
function heroSegmentKey(hero) {
    return normalizeHeroKey(normalizeImportedHero(hero));
}

/**
 * @param {string} subtitles
 * @returns {string}
 */
function variantSegmentKey(subtitles) {
    const text = stripHtmlToText(subtitles).toLowerCase();
    if (text === 'no!') return 'no';
    if (text === 'nope.' || text === 'nope') return 'nope';
    return '';
}

/**
 * @param {string} dirPath
 * @param {Set<string>} allowedExt
 * @returns {Promise<string[]>}
 */
async function listFilesInDir(dirPath, allowedExt) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => allowedExt.has(path.extname(name).toLowerCase()))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } catch {
        return [];
    }
}

/**
 * @returns {Promise<{ scenes: string[], voicelines: string[], renders: Record<string, string[]> }>}
 */
async function scanTheaterAssets() {
    const scenes = await listFilesInDir(SCENES_DIR, IMAGE_EXT);
    /** @type {Record<string, string[]>} */
    const renders = {};

    try {
        const heroDirs = await fs.readdir(RENDERS_DIR, { withFileTypes: true });
        for (const entry of heroDirs) {
            if (!entry.isDirectory()) continue;
            const files = await listFilesInDir(path.join(RENDERS_DIR, entry.name), IMAGE_EXT);
            if (files.length > 0) renders[entry.name] = files;
        }
    } catch {
        /* no renders root */
    }

    /** @type {string[]} */
    const voicelines = [];
    async function walkVoicelines(dir, prefix) {
        let entries = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkVoicelines(full, rel);
            } else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
                voicelines.push(rel.replace(/\\/g, '/'));
            }
        }
    }
    await walkVoicelines(VOICELINES_DIR, '');

    return {
        scenes,
        voicelines: voicelines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        renders,
    };
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
function pickHeroicRenderForHero(heroName, rendersMap) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed || !rendersMap || typeof rendersMap !== 'object') return '';

    let folder = trimmed;
    if (!Array.isArray(rendersMap[folder]) || rendersMap[folder].length === 0) {
        const target = normalizeHeroKey(trimmed);
        folder =
            Object.keys(rendersMap).find(
                (key) =>
                    Array.isArray(rendersMap[key]) &&
                    rendersMap[key].length > 0 &&
                    normalizeHeroKey(key) === target,
            ) || '';
    }

    if (!folder) return '';
    const files = rendersMap[folder] || [];
    return files.find((file) => file.toLowerCase() === 'heroic.png') || '';
}

/**
 * @param {string} html
 * @param {number} liStart
 * @returns {number}
 */
function findMatchingLiClose(html, liStart) {
    let depth = 0;
    let i = liStart;

    while (i < html.length) {
        if (html.startsWith('<li', i)) {
            depth += 1;
            i = html.indexOf('>', i) + 1;
            continue;
        }

        if (html.startsWith('</li>', i)) {
            depth -= 1;
            if (depth === 0) return i + 5;
            i += 5;
            continue;
        }

        i += 1;
    }

    return -1;
}

/**
 * @param {string} variantsSection
 * @returns {string[]}
 */
function extractTopLevelVariantBlocks(variantsSection) {
    const ulStart = variantsSection.indexOf('<ul>');
    if (ulStart < 0) return [];

    /** @type {string[]} */
    const blocks = [];
    let pos = variantsSection.indexOf('<li>', ulStart);

    while (pos >= 0 && pos < variantsSection.length) {
        if (!variantsSection.slice(pos).startsWith('<li><b>')) {
            pos = variantsSection.indexOf('<li>', pos + 4);
            continue;
        }

        const end = findMatchingLiClose(variantsSection, pos);
        if (end < 0) break;

        blocks.push(variantsSection.slice(pos, end));
        pos = variantsSection.indexOf('<li>', end);
    }

    return blocks;
}

/**
 * @param {string} text
 * @param {number} [maxLen=48]
 * @returns {string}
 */
function summarizePathLabel(text, maxLen = 48) {
    const collapsed = String(text || '')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!collapsed) return '';
    if (collapsed.length <= maxLen) return collapsed;
    return `${collapsed.slice(0, maxLen - 1)}…`;
}

/**
 * @param {string} hero
 * @param {string} bodyHtml
 * @returns {Array<{ hero: string, label: string, subtitles: string, variant?: string }>}
 */
function expandHeroVariantResponses(hero, bodyHtml) {
    const innerUl = bodyHtml.match(/<ul>([\s\S]*?)<\/ul>/i);
    if (!innerUl) {
        const subtitles = stripHtmlToText(bodyHtml);
        return [
            {
                hero,
                label: hero,
                subtitles,
                variant: variantSegmentKey(subtitles),
            },
        ];
    }

    /** @type {Array<{ hero: string, label: string, subtitles: string, variant?: string }>} */
    const responses = [];
    const innerLiRe = /<li>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = innerLiRe.exec(innerUl[1]))) {
        if (/<b>[^<]+:<\/b>/i.test(match[1])) continue;

        const subtitles = stripHtmlToText(match[1]);
        if (!subtitles) continue;

        const variant = variantSegmentKey(subtitles);
        const suffix = summarizePathLabel(subtitles, 40);
        responses.push({
            hero,
            label: suffix ? `${hero} — ${suffix}` : hero,
            subtitles,
            variant,
        });
    }

    if (responses.length > 0) return responses;

    const subtitles = stripHtmlToText(bodyHtml);
    return [
        {
            hero,
            label: hero,
            subtitles,
            variant: variantSegmentKey(subtitles),
        },
    ];
}

/**
 * @param {string} sectionHtml
 * @param {string} marker
 * @param {string} variantsMarker
 * @returns {{ opening: { subtitles: string }, variants: Array<{ hero: string, label: string, subtitles: string, variant?: string }>, closing: { subtitles: string }|null, audioUrls: (string|null)[] }}
 */
function parsePeriodicTableRow(sectionHtml, marker, variantsMarker) {
    const idx = sectionHtml.indexOf(marker);
    if (idx < 0) throw new Error(`Could not find periodic table "${marker}" row on wiki page`);

    const rowStart = sectionHtml.lastIndexOf('<tr>', idx);
    const rowEnd = sectionHtml.indexOf('</tr>', idx);
    const row = sectionHtml.slice(rowStart, rowEnd);

    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) throw new Error(`Could not parse periodic table row for ${marker}`);

    const quoteCell = cells[1][2];
    const audioCell = cells[2][2];
    const audioUrls = extractAudioSlots(audioCell);

    const openMatch = quoteCell.match(/<li><b>Winston:<\/b>\s*([\s\S]*?)<\/li>/i);
    if (!openMatch) throw new Error(`Could not parse Winston opening line for ${marker}`);

    const variantsStart = quoteCell.indexOf(variantsMarker);
    if (variantsStart < 0) throw new Error(`Could not find "${variantsMarker}" marker for ${marker}`);

    const variantsSection = quoteCell.slice(variantsStart);
    const closeMatch = quoteCell.match(/<\/ul><\/li>\s*<li><b>Winston:<\/b>\s*([\s\S]*?)<\/li>/i);

    /** @type {Array<{ hero: string, label: string, subtitles: string, variant?: string }>} */
    const variants = [];

    for (const block of extractTopLevelVariantBlocks(variantsSection)) {
        const heroMatch = block.match(/^<li><b>([^<]+):<\/b>\s*/i);
        if (!heroMatch) continue;

        const hero = normalizeImportedHero(heroMatch[1].trim());
        if (closeMatch && heroSegmentKey(hero) === 'winston') continue;

        const bodyHtml = block.slice(heroMatch[0].length);
        variants.push(...expandHeroVariantResponses(hero, bodyHtml));
    }

    if (variants.length === 0) throw new Error(`No response variants parsed for ${marker}`);

    return {
        opening: { subtitles: stripHtmlToText(openMatch[1]) },
        variants,
        closing: closeMatch ? { subtitles: stripHtmlToText(closeMatch[1]) } : null,
        audioUrls,
    };
}

/**
 * @param {string} url
 * @param {string} destPath
 */
async function downloadFile(url, destPath) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Download failed HTTP ${res.status}: ${url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, buffer);
}

/**
 * @param {string} url
 * @param {string} dest
 * @param {boolean} dryRun
 */
async function downloadVoicelineIfNeeded(url, dest, dryRun) {
    try {
        await fs.access(dest);
        return 'skipped-existing';
    } catch {
        /* download */
    }

    if (dryRun) return 'would-download';

    await downloadFile(url, dest);
    return 'downloaded';
}

/**
 * @param {string} subtitles
 * @returns {string}
 */
function cleanPeriodicTableOpeningSubtitle(subtitles) {
    return stripHtmlToText(subtitles)
        .replace(/\*?\(\s*fails\s*\)\*?/gi, '')
        .replace(/\*?\(\s*succeeds\s*\)\*?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {string|null} audioUrl
 * @param {string} voiceFile
 * @param {boolean} dryRun
 */
async function maybeDownload(audioUrl, voiceFile, dryRun) {
    if (!audioUrl || !voiceFile) return 'skipped';
    const dest = path.join(VOICELINES_DIR, voiceFile);
    return downloadVoicelineIfNeeded(audioUrl, dest, dryRun);
}

async function main() {
    const opts = parseArgs(process.argv);

    const pageHtml = await fetchWikiPageHtml('Winston/Quotes');
    const sectionHtml = extractInteractionsSection(pageHtml);
    const failure = parsePeriodicTableRow(sectionHtml, '(fails)', 'One of 13');
    const success = parsePeriodicTableRow(sectionHtml, '(succeeds)', 'One of 7');
    const rendersMap = (await scanTheaterAssets()).renders;

    const conversationsPayload = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(conversationsPayload?.conversations)
        ? conversationsPayload.conversations
        : [];
    const convIndex = conversations.findIndex((row) => row.id === CONVERSATION_ID);
    if (convIndex < 0) {
        throw new Error(`Conversation not found: ${CONVERSATION_ID}`);
    }

    let downloaded = 0;
    let skipped = 0;

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine[]} */
    const lines = [];
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];

    /**
     * @param {'failure'|'success'} outcome
     * @param {ReturnType<typeof parsePeriodicTableRow>} parsed
     */
    async function importOutcome(outcome, parsed) {
        const openingLineId =
            outcome === 'failure' ? FAILURE_OPENING_LINE_ID : SUCCESS_OPENING_LINE_ID;
        let audioIndex = 0;
        const openingAudioUrl = parsed.audioUrls[audioIndex++] || null;
        const openingVoice = openingAudioUrl ? filenameFromAudioUrl(openingAudioUrl) : '';

        const openingResult = await maybeDownload(openingAudioUrl, openingVoice, opts.dryRun);
        if (openingResult === 'downloaded' || openingResult === 'would-download') downloaded += 1;
        if (openingResult === 'skipped-existing') skipped += 1;

        lines.push({
            id: openingLineId,
            hero: 'Winston',
            voice: openingVoice,
            subtitles: cleanPeriodicTableOpeningSubtitle(parsed.opening.subtitles),
            render: pickHeroicRenderForHero('Winston', rendersMap),
        });

        let closingLineId = '';
        if (parsed.closing) {
            closingLineId = SUCCESS_CLOSING_LINE_ID;
            const closingAudioUrl = parsed.audioUrls[parsed.audioUrls.length - 1] || null;
            const closingVoice = closingAudioUrl ? filenameFromAudioUrl(closingAudioUrl) : '';
            const closingResult = await maybeDownload(closingAudioUrl, closingVoice, opts.dryRun);
            if (closingResult === 'downloaded' || closingResult === 'would-download') downloaded += 1;
            if (closingResult === 'skipped-existing') skipped += 1;

            lines.push({
                id: closingLineId,
                hero: 'Winston',
                voice: closingVoice,
                subtitles: parsed.closing.subtitles,
                render: pickHeroicRenderForHero('Winston', rendersMap),
            });
        }

        for (const variant of parsed.variants) {
            const heroKey = heroSegmentKey(variant.hero);
            let lineId = randomUUID();
            if (outcome === 'failure' && heroKey === 'ana') lineId = ANA_LINE_ID;
            if (outcome === 'success' && heroKey === 'brigitte') lineId = BRIGITTE_SUCCESS_LINE_ID;

            const audioUrl = parsed.closing
                ? parsed.audioUrls[audioIndex++] || null
                : parsed.audioUrls[audioIndex++] || null;
            const voiceFile = audioUrl ? filenameFromAudioUrl(audioUrl) : '';
            const dlResult = await maybeDownload(audioUrl, voiceFile, opts.dryRun);
            if (dlResult === 'downloaded' || dlResult === 'would-download') downloaded += 1;
            if (dlResult === 'skipped-existing') skipped += 1;

            lines.push({
                id: lineId,
                hero: variant.hero,
                voice: voiceFile,
                subtitles: variant.subtitles,
                render: pickHeroicRenderForHero(variant.hero, rendersMap),
            });

            /** @type {string[]} */
            const lineIds = [openingLineId, lineId];
            if (closingLineId) lineIds.push(closingLineId);

            /** @type {{ outcome: string, hero: string, variant?: string }} */
            const segments = { outcome, hero: heroKey };
            if (variant.variant) segments.variant = variant.variant;

            paths.push({
                id: createDialoguePathId(),
                label: variant.label || variant.hero,
                lineIds,
                segments,
            });
        }
    }

    await importOutcome('failure', failure);
    await importOutcome('success', success);

    const defaultPath =
        paths.find((row) => row.segments?.outcome === 'failure' && row.segments?.hero === 'ana') ||
        paths[0] ||
        null;

    conversations[convIndex] = {
        ...conversations[convIndex],
        name: 'Periodic Table',
        lines,
        paths,
        selectedPathId: defaultPath?.id || '',
    };

    const filtered = conversations.filter((row) => !DUPLICATE_CONVERSATION_IDS.includes(row.id));

    console.log(`Failure responses: ${failure.variants.length}`);
    console.log(`Success responses: ${success.variants.length}`);
    console.log(`Conversation: "Periodic Table"`);
    console.log(`Lines: ${lines.length}`);
    console.log(`Paths: ${paths.length}`);
    console.log(`Voicelines downloaded: ${downloaded}`);
    console.log(`Voicelines already present: ${skipped}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}`);

    if (!opts.dryRun) {
        await fs.writeFile(
            CONVERSATIONS_PATH,
            `${JSON.stringify({ conversations: filtered }, null, 2)}\n`,
            'utf8',
        );

        const assets = await scanTheaterAssets();
        await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

        console.log(`Updated: ${CONVERSATIONS_PATH}`);
        console.log(`Updated: ${MANIFEST_PATH}`);
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
