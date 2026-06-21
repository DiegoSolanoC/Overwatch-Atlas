#!/usr/bin/env node
/**
 * Repair Dialogue Theater variation paths by re-parsing wiki Interactions tables.
 *
 * Matches conversations by ordered hero + subtitle content, then applies parsed paths.
 *
 * Usage:
 *   node scripts/repair-dialogue-paths-from-wiki.mjs
 *   node scripts/repair-dialogue-paths-from-wiki.mjs --hero Hazard
 *   node scripts/repair-dialogue-paths-from-wiki.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialoguePathId, createDialogueLineId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds, wikiPageTitleForHero } from './lib/wiki-quotes-heroes.mjs';
import {
    extractInteractionsSection,
    fetchWikiPageHtml,
    parseInteractionRows,
} from './lib/wiki-interactions-table.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ dryRun: boolean, heroFilter: string }} */
    const opts = { dryRun: false, heroFilter: '' };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--dry-run') opts.dryRun = true;
        else if (argv[i] === '--hero' && argv[i + 1]) {
            opts.heroFilter = argv[i + 1];
            i += 1;
        }
    }
    return opts;
}

/**
 * @param {{ hero?: string, subtitles?: string }} line
 * @returns {string}
 */
function lineMatchKey(line) {
    const hero = String(line?.hero || '').trim().toLowerCase();
    const subtitles = String(line?.subtitles || '')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return `${hero}\x01${subtitles}`;
}

/**
 * @param {Array<{ hero?: string, subtitles?: string }>} lines
 * @returns {string}
 */
function conversationMatchKey(lines) {
    return (Array.isArray(lines) ? lines : []).map((line) => lineMatchKey(line)).join('\x02');
}

/**
 * Match flattened imports that kept only one branch but share opening/closing lines.
 *
 * @param {Array<{ hero?: string, subtitles?: string }>} lines
 * @returns {string}
 */
function conversationEndpointKey(lines) {
    const arr = Array.isArray(lines) ? lines : [];
    if (arr.length === 0) return '';
    if (arr.length === 1) return lineMatchKey(arr[0]);
    return `${lineMatchKey(arr[0])}\x03${lineMatchKey(arr[arr.length - 1])}`;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} paths
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation['lines']} convLines
 * @param {Array<{ label?: string, lineIndexes?: number[] }>} parsedPaths
 * @returns {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]|null}
 */
function buildPathsFromParsed(parsedPaths, convLines) {
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];

    for (const parsedPath of parsedPaths) {
        const lineIndexes = Array.isArray(parsedPath.lineIndexes) ? parsedPath.lineIndexes : [];
        const lineIds = lineIndexes
            .filter((index) => Number.isInteger(index) && index >= 0 && index < convLines.length)
            .map((index) => convLines[index].id);
        if (lineIds.length === 0) continue;

        paths.push({
            id: createDialoguePathId(),
            label: String(parsedPath.label || '').trim() || `Path ${paths.length + 1}`,
            lineIds,
        });
    }

    return paths.length >= 2 ? paths : null;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @returns {boolean}
 */
function applyPathsToConversation(conversation, interaction) {
    const convLines = conversation.lines || [];
    const parsedLines = interaction.lines || [];
    const parsedPaths = interaction.paths || [];

    if (parsedPaths.length < 2) return false;
    if (convLines.length !== parsedLines.length) return false;
    if (conversationMatchKey(convLines) !== conversationMatchKey(parsedLines)) return false;

    const paths = buildPathsFromParsed(parsedPaths, convLines);
    if (!paths) return false;

    conversation.paths = paths;
    conversation.selectedPathId = paths[0].id;
    return true;
}

/**
 * Rebuild lines + paths when a flattened import dropped alternate branches.
 *
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @param {{ manifestHeroes: string[], voicelines: string[] }} context
 * @returns {boolean}
 */
function rebuildConversationFromParsed(conversation, interaction, context) {
    const convLines = conversation.lines || [];
    const parsedLines = interaction.lines || [];
    const parsedPaths = interaction.paths || [];

    if (parsedPaths.length < 2) return false;
    if (convLines.length === parsedLines.length) return false;
    if (conversationEndpointKey(convLines) !== conversationEndpointKey(parsedLines)) return false;

    /** @type {Map<string, import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine>} */
    const existingByKey = new Map();
    /** @type {Map<string, string>} */
    const renderByHero = new Map();
    for (const line of convLines) {
        existingByKey.set(lineMatchKey(line), line);
        const heroKey = String(line?.hero || '').trim().toLowerCase();
        if (heroKey && line.render) {
            renderByHero.set(heroKey, line.render);
        }
    }

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine[]} */
    const newLines = [];

    for (const parsed of parsedLines) {
        const key = lineMatchKey(parsed);
        const existing = existingByKey.get(key);
        const hero = resolveManifestHeroId(String(parsed?.hero || '').trim(), context.manifestHeroes);
        const subtitles = String(parsed?.subtitles || '').trim();

        let voice = String(existing?.voice || '').trim();
        if (!voice) {
            voice = String(parsed?.voiceFile || '').trim();
        }
        if (!voice) {
            voice = resolveLineVoiceFile({ hero, subtitles }, context.voicelines) || '';
        }

        newLines.push({
            id: existing?.id || createDialogueLineId(),
            hero,
            voice,
            subtitles,
            render: String(existing?.render || renderByHero.get(hero.toLowerCase()) || '').trim(),
        });
    }

    const paths = buildPathsFromParsed(parsedPaths, newLines);
    if (!paths) return false;

    conversation.lines = newLines;
    conversation.paths = paths;
    conversation.selectedPathId = paths[0].id;
    return true;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const assets = await scanTheaterAssets();
    const voicelines = assets.voicelines || [];
    const manifestHeroes = await loadManifestHeroIds();

    /** @type {Map<string, import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation>} */
    const byKey = new Map();
    /** @type {Map<string, import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation>} */
    const byEndpoint = new Map();
    for (const row of conversations) {
        byKey.set(conversationMatchKey(row.lines), row);
        byEndpoint.set(conversationEndpointKey(row.lines), row);
    }

    let heroIds = manifestHeroes;
    if (opts.heroFilter) {
        const filter = opts.heroFilter.trim().toLowerCase();
        heroIds = heroIds.filter((hero) => hero.toLowerCase() === filter);
        if (heroIds.length === 0) {
            throw new Error(`Hero not found in manifest: ${opts.heroFilter}`);
        }
    }

    let repaired = 0;
    let rebuilt = 0;
    let scanned = 0;

    const repairContext = { manifestHeroes, voicelines };

    for (const heroId of heroIds) {
        const pageTitle = wikiPageTitleForHero(heroId);
        let html;
        try {
            html = await fetchWikiPageHtml(pageTitle);
        } catch (error) {
            console.warn(`[skip] ${heroId}: ${error instanceof Error ? error.message : error}`);
            continue;
        }

        let sectionHtml;
        try {
            sectionHtml = extractInteractionsSection(html);
        } catch {
            continue;
        }

        const interactions = parseInteractionRows(sectionHtml);
        for (const interaction of interactions) {
            if (!interaction.paths || interaction.paths.length < 2) continue;
            scanned += 1;

            const key = conversationMatchKey(interaction.lines);
            const endpointKey = conversationEndpointKey(interaction.lines);
            const conversation = byKey.get(key) || byEndpoint.get(endpointKey);
            if (!conversation) continue;

            const hadPaths = Array.isArray(conversation.paths) && conversation.paths.length >= 2;
            if (hadPaths) continue;

            if (applyPathsToConversation(conversation, interaction)) {
                repaired += 1;
                console.log(`[repair] ${conversation.name || conversation.id} — ${interaction.paths.length} paths`);
                continue;
            }

            if (rebuildConversationFromParsed(conversation, interaction, repairContext)) {
                rebuilt += 1;
                console.log(
                    `[rebuild] ${conversation.name || conversation.id} — ${interaction.paths.length} paths, ${conversation.lines.length} lines`,
                );
            }
        }
    }

    console.log(`Scanned ${scanned} wiki interaction(s) with multiple paths`);
    console.log(`Repaired ${repaired} conversation(s)`);
    console.log(`Rebuilt ${rebuilt} flattened conversation(s)`);

    if (opts.dryRun || (repaired === 0 && rebuilt === 0)) return;

    await fs.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify({ conversations }, null, 2)}\n`,
        'utf8',
    );
    console.log(`Updated ${CONVERSATIONS_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
