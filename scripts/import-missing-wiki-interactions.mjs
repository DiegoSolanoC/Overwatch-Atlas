#!/usr/bin/env node
/**
 * Targeted wiki import — add Interaction rows that are missing from conversations.json.
 *
 * Usage:
 *   node scripts/import-missing-wiki-interactions.mjs --hero Hazard
 *   node scripts/import-missing-wiki-interactions.mjs --hero Hazard --match unicorn
 *   node scripts/import-missing-wiki-interactions.mjs --hero Hazard --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import {
    conversationVoiceFingerprint,
    nextConversationNumber,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
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
const REPO_ROOT = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const USER_AGENT = 'OverwatchAtlas/1.0 (missing wiki interaction importer)';

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ dryRun: boolean, heroFilter: string, matchFilter: string }} */
    const opts = { dryRun: false, heroFilter: '', matchFilter: '' };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--dry-run') opts.dryRun = true;
        else if (argv[i] === '--hero' && argv[i + 1]) {
            opts.heroFilter = argv[i + 1];
            i += 1;
        } else if (argv[i] === '--match' && argv[i + 1]) {
            opts.matchFilter = argv[i + 1];
            i += 1;
        }
    }
    return opts;
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
    return files.find((file) => file.toLowerCase() === 'heroic.png') || '';
}

/**
 * @param {{ hero?: string, subtitles?: string, voiceFile?: string|null }} line
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
 * @param {Array<{ hero?: string, subtitles?: string, voiceFile?: string|null }>} lines
 * @returns {string}
 */
function conversationMatchKey(lines) {
    return (Array.isArray(lines) ? lines : []).map((line) => lineMatchKey(line)).join('\x02');
}

/**
 * @param {Array<{ voiceFile?: string|null }>} lines
 * @returns {string}
 */
function wikiVoiceFingerprint(lines) {
    const voices = (Array.isArray(lines) ? lines : [])
        .map((line) => String(line?.voiceFile || '').trim().toLowerCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    return voices.join('|');
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @returns {boolean}
 */
/**
 * @param {string} text
 * @returns {string}
 */
function normalizeSubtitleKey(text) {
    return String(text || '')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Wiki one-offs that already exist as multi-route conversations in the app. */
const MULTI_ROUTE_OPENING_RULES = [
    { needle: 'favorite animal', names: ['Favorite Animals'] },
    { needle: 'chicken cross the road', names: ['To Stagnate is to Die'] },
    { needle: 'periodic table', names: ['Periodic Table'] },
    { needle: 'tripped over your sword in training', names: ['233'] },
];

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @returns {boolean}
 */
function interactionOpeningAlreadyCovered(conversations, interaction) {
    const opening = normalizeSubtitleKey(interaction.lines?.[0]?.subtitles || '');
    if (!opening) return false;

    for (const rule of MULTI_ROUTE_OPENING_RULES) {
        if (!opening.includes(rule.needle)) continue;
        const covered = conversations.some((conversation) => {
            const name = String(conversation?.name || '').trim();
            return rule.names.includes(name) && (conversation?.paths?.length || 0) > 1;
        });
        if (covered) return true;
    }

    return false;
}

function interactionAlreadyImported(conversations, interaction) {
    if (interactionOpeningAlreadyCovered(conversations, interaction)) return true;

    const wikiKey = conversationMatchKey(interaction.lines);
    const wikiVoices = wikiVoiceFingerprint(interaction.lines);
    if (!wikiKey && !wikiVoices) return false;

    for (const conversation of conversations) {
        if (conversationMatchKey(conversation.lines) === wikiKey) return true;

        const convFp = conversationVoiceFingerprint(conversation.lines || []);
        if (wikiVoices && convFp === wikiVoices) return true;

        const convVoiceSet = new Set(
            (conversation.lines || [])
                .map((line) => String(line?.voice || '').trim().toLowerCase())
                .filter(Boolean),
        );
        const wikiVoiceFiles = (interaction.lines || [])
            .map((line) => String(line?.voiceFile || '').trim().toLowerCase())
            .filter(Boolean);
        if (
            wikiVoiceFiles.length > 0 &&
            wikiVoiceFiles.every((voiceFile) => convVoiceSet.has(voiceFile))
        ) {
            return true;
        }
    }

    return false;
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
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @param {{ manifestHeroes: string[], rendersMap: Record<string, string[]>, voicelines: string[] }} context
 * @param {string} conversationName
 */
function buildConversationFromWikiInteraction(interaction, context, conversationName) {
    const conversation = buildBlankConversationRecord();
    conversation.name = conversationName;
    conversation.status = 'active';
    conversation.eraName = '';
    conversation.scene = DEFAULT_DIALOGUE_SCENE;

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine[]} */
    const lines = [];

    for (const parsedLine of interaction.lines || []) {
        const hero = resolveManifestHeroId(String(parsedLine?.hero || '').trim(), context.manifestHeroes);
        const subtitles = String(parsedLine?.subtitles || '').trim();
        let voice = String(parsedLine?.voiceFile || '').trim();
        if (!voice) {
            voice = resolveLineVoiceFile({ hero, subtitles }, context.voicelines) || '';
        }

        lines.push({
            id: createDialogueLineId(),
            hero,
            voice,
            subtitles,
            render: pickHeroicRenderForHero(hero, context.rendersMap),
        });
    }

    conversation.lines = lines;

    const parsedPaths = Array.isArray(interaction.paths) ? interaction.paths : [];
    if (parsedPaths.length >= 2) {
        /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
        const paths = [];
        for (const parsedPath of parsedPaths) {
            const lineIndexes = Array.isArray(parsedPath.lineIndexes) ? parsedPath.lineIndexes : [];
            const lineIds = lineIndexes
                .filter((index) => Number.isInteger(index) && index >= 0 && index < lines.length)
                .map((index) => lines[index].id);
            if (lineIds.length === 0) continue;
            paths.push({
                id: createDialoguePathId(),
                label: String(parsedPath.label || '').trim() || `Path ${paths.length + 1}`,
                lineIds,
            });
        }
        if (paths.length >= 2) {
            conversation.paths = paths;
            conversation.selectedPathId = paths[0].id;
        }
    }

    return conversation;
}

/**
 * @param {ReturnType<typeof parseInteractionRows>[number]} interaction
 * @param {string} pageHero
 * @returns {string}
 */
function conversationTitleForInteraction(interaction, pageHero) {
    const first = interaction.lines?.[0];
    const snippet = String(first?.subtitles || '')
        .replace(/\*+/g, '')
        .trim()
        .split(/(?<=[.!?])\s+/)[0];
    if (snippet && snippet.length <= 64) return snippet;

    const partner = String(interaction.partnerHero || '').trim();
    if (partner && pageHero) return `${pageHero} & ${partner}`;
    return partner || pageHero || 'Imported interaction';
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];

    let heroIds = await loadManifestHeroIds();
    if (opts.heroFilter) {
        const filter = opts.heroFilter.trim().toLowerCase();
        heroIds = heroIds.filter(
            (hero) =>
                hero.toLowerCase() === filter ||
                normalizeHeroKey(hero) === normalizeHeroKey(filter),
        );
        if (heroIds.length === 0) {
            throw new Error(`Hero not found in manifest: ${opts.heroFilter}`);
        }
    }

    const assets = await scanTheaterAssets();
    const context = {
        manifestHeroes: heroIds,
        rendersMap: assets.renders || {},
        voicelines: assets.voicelines || [],
    };

    let scanned = 0;
    let imported = 0;
    let downloaded = 0;

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
            scanned += 1;

            if (opts.matchFilter) {
                const needle = opts.matchFilter.toLowerCase();
                const haystack = [
                    interaction.partnerHero,
                    ...(interaction.lines || []).map((line) => `${line.hero} ${line.subtitles}`),
                ]
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(needle)) continue;
            }

            if (interactionAlreadyImported(conversations, interaction)) continue;

            for (const line of interaction.lines || []) {
                if (!line.audioUrl || !line.voiceFile) continue;
                const dest = path.join(VOICELINES_DIR, line.voiceFile);
                const result = await downloadVoicelineIfNeeded(line.audioUrl, dest, opts.dryRun);
                if (result === 'downloaded' || result === 'would-download') downloaded += 1;
            }

            const title = conversationTitleForInteraction(interaction, heroId);
            const conversation = buildConversationFromWikiInteraction(
                interaction,
                context,
                String(nextConversationNumber(conversations)),
            );

            conversations.push(conversation);
            imported += 1;
            console.log(`[import] #${conversation.name} — ${interaction.lines.length} line(s), partner: ${interaction.partnerHero} (${title})`);
        }
    }

    console.log(`Scanned ${scanned} wiki interaction row(s)`);
    console.log(`Imported ${imported} missing conversation(s)`);
    console.log(`Voicelines downloaded or pending: ${downloaded}`);

    if (opts.dryRun || imported === 0) return;

    let existingMeta = {};
    try {
        const onDisk = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
        if (onDisk?._meta && typeof onDisk._meta === 'object') {
            existingMeta = onDisk._meta;
        }
    } catch {
        /* first write */
    }

    await fs.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify({
            _meta: {
                ...existingMeta,
                nameResetAt: new Date().toISOString(),
            },
            conversations,
        }, null, 2)}\n`,
        'utf8',
    );

    const refreshedAssets = await scanTheaterAssets();
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(refreshedAssets, null, 2)}\n`, 'utf8');
    console.log(`Updated ${CONVERSATIONS_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
