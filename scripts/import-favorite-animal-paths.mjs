#!/usr/bin/env node
/**
 * Import Lúcio's "favorite animal" multi-response interaction from the wiki
 * into the existing Dialogue Theater conversation (variation paths).
 *
 * Usage:
 *   node scripts/import-favorite-animal-paths.mjs
 *   node scripts/import-favorite-animal-paths.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialoguePathId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const RENDERS_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Renders');
const SCENES_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Scene');

const CONVERSATION_ID = '8974246a-ee27-4a5b-a5ec-132a459895a3';
const OPENING_LINE_ID = '8a7a057c-db4f-4edc-8280-d9b6756d6ac1';
const ANRAN_LINE_ID = '20251b3f-77ab-4b8d-9283-49164e3360a4';
const CLOSING_LINE_ID = 'fc50de03-59a5-48e4-9262-3b2a48e8e682';

const USER_AGENT = 'OverwatchAtlas/1.0 (Dialogue Theater importer)';
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
 * @param {string} html
 * @returns {string|null}
 */
function extractAudioUrl(html) {
    const match = String(html || '').match(/<source\s+src="([^"]+)"/i);
    return match ? match[1] : null;
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
function resolveRenderHeroFolder(heroName, rendersMap) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed || !rendersMap || typeof rendersMap !== 'object') return '';

    if (Array.isArray(rendersMap[trimmed]) && rendersMap[trimmed].length > 0) {
        return trimmed;
    }

    const target = normalizeHeroKey(trimmed);
    if (!target) return '';

    for (const key of Object.keys(rendersMap)) {
        if (!Array.isArray(rendersMap[key]) || rendersMap[key].length === 0) continue;
        if (key.toLowerCase() === trimmed.toLowerCase()) return key;
        if (normalizeHeroKey(key) === target) return key;
    }

    return '';
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
function pickHeroicRenderForHero(heroName, rendersMap) {
    const folder = resolveRenderHeroFolder(heroName, rendersMap);
    if (!folder) return '';

    const files = rendersMap[folder] || [];
    const heroic = files.find((file) => file.toLowerCase() === 'heroic.png');
    return heroic || '';
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
 * @returns {Array<{ hero: string, label: string, subtitles: string, audioUrl: string|null }>}
 */
function expandHeroVariantResponses(hero, bodyHtml) {
    const innerUl = bodyHtml.match(/<ul>([\s\S]*?)<\/ul>/i);
    if (!innerUl) {
        return [
            {
                hero,
                label: hero,
                subtitles: stripHtmlToText(bodyHtml),
                audioUrl: extractAudioUrl(bodyHtml),
            },
        ];
    }

    /** @type {Array<{ hero: string, label: string, subtitles: string, audioUrl: string|null }>} */
    const responses = [];
    const innerLiRe = /<li>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = innerLiRe.exec(innerUl[1]))) {
        if (/<b>[^<]+:<\/b>/i.test(match[1])) continue;

        const subtitles = stripHtmlToText(match[1]);
        const audioUrl = extractAudioUrl(match[1]);
        if (!subtitles && !audioUrl) continue;

        const suffix = summarizePathLabel(subtitles, 40);
        responses.push({
            hero,
            label: suffix ? `${hero} — ${suffix}` : hero,
            subtitles,
            audioUrl,
        });
    }

    if (responses.length > 0) return responses;

    return [
        {
            hero,
            label: hero,
            subtitles: stripHtmlToText(bodyHtml),
            audioUrl: extractAudioUrl(bodyHtml),
        },
    ];
}

/**
 * @param {string} pageHtml
 * @returns {{ opening: { subtitles: string, audioUrl: string|null }, variants: Array<{ hero: string, label: string, subtitles: string, audioUrl: string|null }>, closing: { subtitles: string, audioUrl: string|null } }}
 */
function parseFavoriteAnimalRow(pageHtml) {
    const idx = pageHtml.indexOf('All Heroes, except');
    if (idx < 0) throw new Error('Could not find "All Heroes" favorite animal row on wiki page');

    const rowEnd = pageHtml.indexOf('</tr>', idx + 1000);
    const row = pageHtml.slice(idx, rowEnd);

    const openMatch = row.match(/<li><b>Lúcio:<\/b>\s*([\s\S]*?)<\/li>/i);
    if (!openMatch) throw new Error('Could not parse opening Lúcio line');

    const variantsStart = row.indexOf('One of the following');
    if (variantsStart < 0) throw new Error('Could not find response variants marker');

    const closingMarker = row.slice(variantsStart).match(/<\/ul><\/li>\s*<li><b>Lúcio:<\/b>/i);
    if (!closingMarker || closingMarker.index === undefined) {
        throw new Error('Could not find closing Lúcio line');
    }

    const variantsSection = row.slice(variantsStart, variantsStart + closingMarker.index);
    const closeMatch = row.match(/<\/ul><\/li>\s*<li><b>Lúcio:<\/b>\s*([\s\S]*?)<\/li>/i);
    if (!closeMatch) throw new Error('Could not parse closing Lúcio line');

    /** @type {Array<{ hero: string, label: string, subtitles: string, audioUrl: string|null }>} */
    const variants = [];

    for (const block of extractTopLevelVariantBlocks(variantsSection)) {
        const heroMatch = block.match(/^<li><b>([^:]+):<\/b>\s*/i);
        if (!heroMatch) continue;

        const hero = heroMatch[1].trim();
        const bodyHtml = block.slice(heroMatch[0].length);
        variants.push(...expandHeroVariantResponses(hero, bodyHtml));
    }

    return {
        opening: {
            subtitles: stripHtmlToText(openMatch[1]),
            audioUrl: extractAudioUrl(openMatch[1]),
        },
        variants,
        closing: {
            subtitles: stripHtmlToText(closeMatch[1]),
            audioUrl: extractAudioUrl(closeMatch[1]),
        },
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

async function main() {
    const opts = parseArgs(process.argv);

    const apiUrl = 'https://overwatch.fandom.com/api.php?action=parse&page=L%C3%BAcio/Quotes&prop=text&format=json';
    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Wiki API HTTP ${res.status}`);

    const payload = await res.json();
    const pageHtml = payload?.parse?.text?.['*'];
    if (!pageHtml) throw new Error('Wiki parse response missing HTML');

    const parsed = parseFavoriteAnimalRow(pageHtml);
    const rendersMap = (await scanTheaterAssets()).renders;

    const conversationsPayload = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(conversationsPayload?.conversations)
        ? conversationsPayload.conversations
        : [];
    const convIndex = conversations.findIndex((row) => row.id === CONVERSATION_ID);
    if (convIndex < 0) {
        throw new Error(`Conversation not found: ${CONVERSATION_ID} (aNRAN'S fAVORITE aNIMAL)`);
    }

    const existingConv = conversations[convIndex];
    const existingOpening = existingConv.lines?.find((line) => line.id === OPENING_LINE_ID);
    const existingAnran = existingConv.lines?.find((line) => line.id === ANRAN_LINE_ID);
    const existingClosing = existingConv.lines?.find((line) => line.id === CLOSING_LINE_ID);

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine[]} */
    const lines = [
        {
            id: OPENING_LINE_ID,
            hero: 'Lúcio',
            voice: existingOpening?.voice || "Lúcio_-_So,_I'm_trying_to_ask_everybody_this._What_is_your_favorite_animal.ogg",
            subtitles: existingOpening?.subtitles || parsed.opening.subtitles,
            render: '',
        },
    ];

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];

    let downloaded = 0;
    let skipped = 0;

    for (const variant of parsed.variants) {
        const heroKey = normalizeHeroKey(variant.hero);
        const isAnran = heroKey === 'anran';
        const lineId = isAnran ? ANRAN_LINE_ID : randomUUID();
        const voiceFile = variant.audioUrl ? filenameFromAudioUrl(variant.audioUrl) : '';

        if (voiceFile && variant.audioUrl) {
            const dest = path.join(VOICELINES_DIR, voiceFile);
            const result = await downloadVoicelineIfNeeded(variant.audioUrl, dest, opts.dryRun);
            if (result === 'downloaded' || result === 'would-download') downloaded += 1;
            if (result === 'skipped-existing') skipped += 1;
        }

        lines.push({
            id: lineId,
            hero: variant.hero,
            voice: isAnran ? (existingAnran?.voice || voiceFile) : voiceFile,
            subtitles: isAnran ? (existingAnran?.subtitles || variant.subtitles) : variant.subtitles,
            render: isAnran
                ? (existingAnran?.render || pickHeroicRenderForHero('Anran', rendersMap))
                : pickHeroicRenderForHero(variant.hero, rendersMap),
        });

        paths.push({
            id: createDialoguePathId(),
            label: variant.label || variant.hero,
            lineIds: [OPENING_LINE_ID, lineId, CLOSING_LINE_ID],
        });
    }

    lines.push({
        id: CLOSING_LINE_ID,
        hero: 'Lúcio',
        voice: existingClosing?.voice || (parsed.closing.audioUrl ? filenameFromAudioUrl(parsed.closing.audioUrl) : ''),
        subtitles: existingClosing?.subtitles || parsed.closing.subtitles,
        render: '',
    });

    // Ensure opening/closing audio present
    if (parsed.closing.audioUrl) {
        const closingFile = lines.find((line) => line.id === CLOSING_LINE_ID)?.voice;
        if (closingFile) {
            const dest = path.join(VOICELINES_DIR, closingFile);
            const result = await downloadVoicelineIfNeeded(parsed.closing.audioUrl, dest, opts.dryRun);
            if (result === 'downloaded' || result === 'would-download') downloaded += 1;
            if (result === 'skipped-existing') skipped += 1;
        }
    }

    const anranPath = paths.find((row) => row.lineIds.includes(ANRAN_LINE_ID));

    conversations[convIndex] = {
        ...existingConv,
        lines,
        paths,
        selectedPathId: anranPath?.id || paths[0]?.id || '',
    };

    console.log(`Parsed ${parsed.variants.length} hero responses from wiki`);
    console.log(`Conversation: "${existingConv.name}"`);
    console.log(`Lines: ${lines.length} (shared opening + closing, ${parsed.variants.length} responses)`);
    console.log(`Paths: ${paths.length}`);
    console.log(`Voicelines downloaded: ${downloaded}`);
    console.log(`Voicelines already present: ${skipped}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}`);

    if (!opts.dryRun) {
        await fs.writeFile(
            CONVERSATIONS_PATH,
            `${JSON.stringify({ conversations }, null, 2)}\n`,
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
