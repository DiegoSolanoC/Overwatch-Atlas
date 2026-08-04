/**
 * In-memory store for Dialogue Theater conversation entries.
 * Persists to localStorage and, on the dev server, src/data/dialogue-theater/conversations.json.
 */

import { FILES } from '../../../data/registry.js';
import { fetchJsonWithTimeout } from '../../system-interface/interface-left-panel/event-system/data/fetchWithTimeout.js';
import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import {
    buildBlankConversationRecord,
    normalizeConversationRecord,
} from './dialogueTheaterConversationSchema.js';
import { nextConversationNumber, isNumberedConversationName, isUnknownDialogueHero } from './dialogueTheaterConversationValidation.js';
import {
    applyHeroicRendersToConversations,
    loadDialogueTheaterAssets,
    loadDialogueTheaterHeroes,
    shouldUpgradeDialogueLineRender,
} from './loadDialogueTheaterAssets.js';
import { resolveManifestHeroId } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { DIALOGUE_THEATER_RETIRED_WORKING_TAGS } from '../dialogue-theater-list/dialogueTheaterEraFilter.js';
import {
    buildDialogueTheaterBundleStamp,
    clearDialogueTheaterBundleStamp,
    readDialogueTheaterBundleStampFromMeta,
    readStoredDialogueTheaterBundleStamp,
    writeDialogueTheaterBundleStamp,
} from './dialogueTheaterBundleStamp.js';

export const DIALOGUE_THEATER_LOCALSTORAGE_KEY = 'dialogueTheaterConversations';
export const DIALOGUE_THEATER_DELETED_IDS_KEY = 'dialogueTheaterDeletedConversationIds';
export const DIALOGUE_THEATER_NAME_RESET_KEY = 'dialogueTheaterNameResetAt';
export const DIALOGUE_THEATER_TAGS_RESET_KEY = 'dialogueTheaterTagsResetAt';
const FILE_URL = FILES.dialogueTheater.conversations;
const RETIRED_WORKING_TAGS = new Set(DIALOGUE_THEATER_RETIRED_WORKING_TAGS);
const EXPORT_FILENAME = 'dialogue-theater-export.json';

/**
 * Escape hatch: `?resetDialogue=1` drops cached theater conversations and reloads from the bundle.
 * @returns {boolean}
 */
function consumeResetDialogueUrlParam() {
    if (typeof window === 'undefined') return false;
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('resetDialogue') !== '1') return false;
        localStorage.removeItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY);
        localStorage.removeItem(DIALOGUE_THEATER_DELETED_IDS_KEY);
        localStorage.removeItem(DIALOGUE_THEATER_NAME_RESET_KEY);
        localStorage.removeItem(DIALOGUE_THEATER_TAGS_RESET_KEY);
        clearDialogueTheaterBundleStamp();
        params.delete('resetDialogue');
        const nextSearch = params.toString();
        const nextUrl =
            window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash;
        window.history.replaceState(null, '', nextUrl);
        return true;
    } catch (_) {
        return false;
    }
}

/** @typedef {{ id: string, name: string, status: 'active'|'outdated', eraName: string, tags: string[], scene: string, lines: DialogueLine[], paths?: DialoguePath[], selectedPathId?: string }} DialogueConversation */
/** @typedef {{ id: string, hero: string, voice: string, voicePrefix?: string, subtitles: string, render: string }} DialogueLine */
/** @typedef {{ id: string, label: string, lineIds: string[], segments?: { asker?: string, job?: string, reactor?: string, epilogue?: string } }} DialoguePath */

class DialogueTheaterDataService {
    constructor() {
        /** @type {DialogueConversation[]} */
        this.conversations = [];
        this.isDirty = false;
        /** @type {Set<string>} */
        this.unsavedConversationIds = new Set();
        /** @type {Set<string>} */
        this.deletedConversationIds = new Set();
    }

    loadDeletedConversationIds() {
        try {
            const raw = localStorage.getItem(DIALOGUE_THEATER_DELETED_IDS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.deletedConversationIds = new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean));
            }
        } catch (err) {
            console.warn('DialogueTheaterDataService: deleted-id parse failed:', err);
        }
    }

    persistDeletedConversationIds() {
        localStorage.setItem(
            DIALOGUE_THEATER_DELETED_IDS_KEY,
            JSON.stringify([...this.deletedConversationIds]),
        );
    }

    /** @param {string} id */
    markConversationDeleted(id) {
        if (!id) return;
        this.deletedConversationIds.add(id);
        this.persistDeletedConversationIds();
    }

    /** @param {string} id */
    markConversationUnsaved(id) {
        if (!id) return;
        this.unsavedConversationIds.add(id);
        this.isDirty = true;
    }

    clearUnsavedMarkers() {
        this.unsavedConversationIds.clear();
        this.isDirty = false;
    }

    /** @param {string} id */
    isConversationUnsaved(id) {
        return this.unsavedConversationIds.has(id);
    }

    /** @returns {boolean} */
    canPersistToRepo() {
        try {
            const proto = window.location.protocol;
            if (proto !== 'http:' && proto !== 'https:') return false;
            const host = window.location.hostname || '';
            const isLoopbackHost = host === 'localhost' || host === '127.0.0.1';
            const isDevServerPort = String(window.location.port || '') === '8000';
            return isLoopbackHost || isDevServerPort;
        } catch (_) {
            return false;
        }
    }

    /**
     * @param {unknown} raw
     * @returns {DialogueConversation|null}
     */
    normalizeConversation(raw) {
        return normalizeConversationRecord(raw);
    }

    /**
     * Prefer the row with more paths/lines; when equal, prefer the local copy (b).
     * @param {import('./DialogueTheaterDataService.js').DialogueConversation} a
     * @param {import('./DialogueTheaterDataService.js').DialogueConversation} b
     */
    pickRicherConversationRow(a, b) {
        const score = (row) => {
            const pathCount = Array.isArray(row.paths) ? row.paths.length : 0;
            const lineCount = Array.isArray(row.lines) ? row.lines.length : 0;
            return pathCount * 10000 + lineCount;
        };
        const scoreA = score(a);
        const scoreB = score(b);
        if (scoreB > scoreA) return b;
        if (scoreA > scoreB) return a;
        return b;
    }

    /**
     * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} fileRows
     * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} localRows
     * @param {{ applyFileNames?: boolean }} [options]
     */
    overlayFileLineRenders(fileRow, pickedRow) {
        const fileLinesById = new Map(
            (Array.isArray(fileRow?.lines) ? fileRow.lines : []).map((line) => [line.id, line]),
        );
        const lines = (Array.isArray(pickedRow?.lines) ? pickedRow.lines : []).map((line) => {
            const fileLine = fileLinesById.get(line.id);
            if (!fileLine) return line;
            let next = line;
            if (shouldUpgradeDialogueLineRender(line.render, fileLine.render)) {
                next = { ...next, render: fileLine.render };
            }
            const filePrefix = String(fileLine.voicePrefix || '').trim();
            const fileVoice = String(fileLine.voice || '').trim();
            if (filePrefix && filePrefix !== fileVoice) {
                next = { ...next, voicePrefix: filePrefix };
            }
            // Repo voice wins for shared line ids so MatchTalk/script repairs beat stale localStorage
            // (e.g. wiki-wrong Mei_-_Na!.ogg after a Save that rewrote the file).
            if (fileVoice && fileVoice !== String(line.voice || '').trim()) {
                next = { ...next, voice: fileLine.voice };
            }
            return next;
        });
        return { ...pickedRow, lines };
    }

    mergeConversationRows(fileRows, localRows, options = {}) {
        const applyFileNames = Boolean(options.applyFileNames);
        const applyFileTags = Boolean(options.applyFileTags);
        const localById = new Map(localRows.map((row) => [row.id, row]));
        const fileIds = new Set(fileRows.map((row) => row.id));
        const merged = fileRows
            .filter((fileRow) => !this.deletedConversationIds.has(fileRow.id))
            .map((fileRow) => {
                const localRow = localById.get(fileRow.id);
                if (!localRow) return fileRow;

                let picked = this.pickRicherConversationRow(fileRow, localRow);

                const filePaths = Array.isArray(fileRow.paths) ? fileRow.paths : [];
                const localPaths = Array.isArray(localRow.paths) ? localRow.paths : [];
                const localEra = String(localRow.eraName || '').trim();
                const fileEra = String(fileRow.eraName || '').trim();
                // Finalized YouTube batches: file wins so untagging + line fixes beat stale localStorage.
                const retireLocalWorkingTag =
                    RETIRED_WORKING_TAGS.has(localEra) && !RETIRED_WORKING_TAGS.has(fileEra);

                if (retireLocalWorkingTag) {
                    picked = {
                        ...fileRow,
                        selectedPathId:
                            fileRow.selectedPathId ||
                            (filePaths[0] && filePaths[0].id) ||
                            '',
                    };
                } else if (localPaths.length > 0 && filePaths.length > 0) {
                    const localLineIds = new Set(
                        (Array.isArray(localRow.lines) ? localRow.lines : []).map((line) => line.id),
                    );
                    const fileIntroducesLines = filePaths.some((pathRow) =>
                        (Array.isArray(pathRow.lineIds) ? pathRow.lineIds : []).some(
                            (lineId) => lineId && !localLineIds.has(lineId),
                        ),
                    );
                    const localHasUnknown = (Array.isArray(localRow.lines) ? localRow.lines : []).some(
                        (line) => isUnknownDialogueHero(line?.hero),
                    );
                    const fileHasUnknown = (Array.isArray(fileRow.lines) ? fileRow.lines : []).some(
                        (line) => isUnknownDialogueHero(line?.hero),
                    );
                    // Script repairs that split/rebuild multipaths (new line ids, Unknown cleanup).
                    if (fileIntroducesLines || (localHasUnknown && !fileHasUnknown)) {
                        picked = {
                            ...fileRow,
                            selectedPathId:
                                fileRow.selectedPathId ||
                                (filePaths[0] && filePaths[0].id) ||
                                '',
                        };
                    } else {
                        const pathIds = new Set(localPaths.map((pathRow) => pathRow.id));
                        picked = {
                            ...picked,
                            lines: localRow.lines,
                            paths: localPaths,
                            selectedPathId:
                                localRow.selectedPathId && pathIds.has(localRow.selectedPathId)
                                    ? localRow.selectedPathId
                                    : localPaths[0]?.id || '',
                        };
                    }
                } else if (localPaths.length > 0) {
                    // Saved local route edits win over the bundled file (manual path/line tuning).
                    const pathIds = new Set(localPaths.map((pathRow) => pathRow.id));
                    picked = {
                        ...picked,
                        lines: localRow.lines,
                        paths: localPaths,
                        selectedPathId:
                            localRow.selectedPathId && pathIds.has(localRow.selectedPathId)
                                ? localRow.selectedPathId
                                : localPaths[0]?.id || '',
                    };
                } else if (filePaths.length > 0) {
                    // Wiki/script repairs in the repo file replace a flat local copy.
                    const pathIds = new Set(filePaths.map((pathRow) => pathRow.id));
                    picked = {
                        ...picked,
                        lines: fileRow.lines,
                        paths: filePaths,
                        selectedPathId:
                            localRow.selectedPathId && pathIds.has(localRow.selectedPathId)
                                ? localRow.selectedPathId
                                : fileRow.selectedPathId || filePaths[0]?.id || '',
                    };
                }
                let withRenders = this.overlayFileLineRenders(fileRow, picked);
                // Tags live on the shipped file after the multi-tag migration; clear legacy eraName.
                if (applyFileTags) {
                    withRenders = {
                        ...withRenders,
                        tags: Array.isArray(fileRow.tags) ? [...fileRow.tags] : [],
                        eraName: '',
                    };
                } else {
                    withRenders = { ...withRenders, eraName: '' };
                }
                if (applyFileNames) {
                    return { ...withRenders, name: fileRow.name };
                }
                // Prefer a real title over numbered review placeholders from either side.
                // Repo/script custom names beat stale numbered localStorage; in-progress
                // local naming beats numbered placeholders still sitting in the file.
                const fileName = String(fileRow.name || '').trim();
                const localName = String(localRow.name || '').trim();
                const fileNumbered = isNumberedConversationName(fileName);
                const localNumbered = isNumberedConversationName(localName);
                if (!fileNumbered && localNumbered) {
                    return { ...withRenders, name: fileName };
                }
                if (fileNumbered && !localNumbered && localName) {
                    return { ...withRenders, name: localName };
                }
                return withRenders;
            });
        merged.push(...localRows.filter((row) => !fileIds.has(row.id)));
        return merged;
    }

    async applyHeroicRenderUpgrades() {
        const assets = await loadDialogueTheaterAssets();
        return applyHeroicRendersToConversations(this.conversations, assets.renders || {});
    }

    /**
     * Map skin/display hero spellings to manifest roster ids on every line (and hero path labels).
     * @param {string[]} manifestHeroes
     * @returns {number}
     */
    canonicalizeConversationLineHeroes(manifestHeroes) {
        let updated = 0;

        for (const conversation of this.conversations) {
            for (const line of conversation.lines || []) {
                const current = String(line?.hero || '').trim();
                if (!current || current === 'Unknown') continue;
                const canonical = resolveManifestHeroId(current, manifestHeroes);
                if (!canonical || canonical === current) continue;
                line.hero = canonical;
                updated += 1;
            }

            for (const pathRow of conversation.paths || []) {
                const label = String(pathRow?.label || '').trim();
                if (!label) continue;
                const canonical = resolveManifestHeroId(label, manifestHeroes);
                if (!canonical || canonical === label) continue;
                pathRow.label = canonical;
                updated += 1;
            }
        }

        return updated;
    }

    /** @param {unknown[]} list */
    normalizeConversations(list) {
        if (!Array.isArray(list)) return [];
        const out = [];
        const seen = new Set();
        for (let i = 0; i < list.length; i += 1) {
            const row = this.normalizeConversation(list[i]);
            if (!row || seen.has(row.id)) continue;
            seen.add(row.id);
            out.push(row);
        }
        return out;
    }

    async load() {
        updateStatus('Dialogue Theater: loading conversations…', 'info');
        const forcedReset = consumeResetDialogueUrlParam();
        this.loadDeletedConversationIds();

        let fileRows = null;
        /** @type {{ nameResetAt?: string, tagsResetAt?: string, purgedConversationIds?: string[] }} */
        let fileMeta = {};
        try {
            const data = await fetchJsonWithTimeout(FILE_URL);
            if (data && Array.isArray(data.conversations)) {
                fileRows = data.conversations;
                fileMeta = data._meta && typeof data._meta === 'object' ? data._meta : {};
            } else {
                fileRows = [];
            }
        } catch (err) {
            console.warn('DialogueTheaterDataService: bundled file fetch failed:', err);
            fileRows = [];
        }

        const purgedIds = new Set(
            (Array.isArray(fileMeta.purgedConversationIds) ? fileMeta.purgedConversationIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean),
        );
        for (const id of purgedIds) {
            this.deletedConversationIds.add(id);
        }

        const fileResetAt = String(fileMeta.nameResetAt || '').trim();
        const seenResetAt = localStorage.getItem(DIALOGUE_THEATER_NAME_RESET_KEY) || '';
        const applyFileNames = Boolean(fileResetAt && fileResetAt !== seenResetAt);

        const fileTagsResetAt = String(fileMeta.tagsResetAt || '').trim();
        const seenTagsResetAt = localStorage.getItem(DIALOGUE_THEATER_TAGS_RESET_KEY) || '';
        const applyFileTags = Boolean(fileTagsResetAt && fileTagsResetAt !== seenTagsResetAt);

        const fileNormalized = this.normalizeConversations(fileRows || []);
        let localNormalized = [];
        try {
            const saved = localStorage.getItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localNormalized = this.normalizeConversations(parsed).filter(
                        (row) => !purgedIds.has(row.id),
                    );
                }
            }
        } catch (err) {
            console.warn('DialogueTheaterDataService: localStorage parse failed:', err);
        }

        if (fileNormalized.length === 0 && localNormalized.length === 0) {
            this.conversations = [];
            this.clearUnsavedMarkers();
            updateStatus('Dialogue Theater: no conversations found — starting empty', 'warning');
            return;
        }

        const fileStamp =
            readDialogueTheaterBundleStampFromMeta() ||
            buildDialogueTheaterBundleStamp(fileNormalized);
        const storedStamp = readStoredDialogueTheaterBundleStamp();
        const stampMismatch = Boolean(fileStamp && fileStamp !== storedStamp);
        // Shipped/pulled conversations.json is source of truth after a push/deploy/pull.
        // Keep only local-only drafts (ids not in the file).
        const preferShippedFile =
            forcedReset || (fileNormalized.length > 0 && stampMismatch);

        if (fileNormalized.length === 0) {
            this.conversations = localNormalized;
        } else if (localNormalized.length === 0 || preferShippedFile) {
            const fileIds = new Set(fileNormalized.map((row) => row.id));
            const localOnlyDrafts = preferShippedFile
                ? localNormalized.filter((row) => !fileIds.has(row.id))
                : [];
            this.conversations = [...fileNormalized, ...localOnlyDrafts];
        } else {
            /** Bundled file wins on id unless local has saved route data; keep local-only drafts. */
            this.conversations = this.mergeConversationRows(fileNormalized, localNormalized, {
                applyFileNames,
                applyFileTags,
            });
        }

        const manifestHeroes = await loadDialogueTheaterHeroes();
        const heroRenames = this.canonicalizeConversationLineHeroes(manifestHeroes);
        if (heroRenames > 0) {
            updateStatus(
                `Dialogue Theater: normalized ${heroRenames} line hero name(s) to roster ids`,
                'info',
            );
        }

        const heroicUpgrades = await this.applyHeroicRenderUpgrades();
        this.persistLocalStorageOnly();
        if (fileStamp) writeDialogueTheaterBundleStamp(fileStamp);

        if (applyFileNames) {
            localStorage.setItem(DIALOGUE_THEATER_NAME_RESET_KEY, fileResetAt);
            updateStatus(
                `Dialogue Theater: reset ${this.conversations.length} conversation title(s) to numbered review placeholders`,
                'info',
            );
        }

        if (applyFileTags) {
            localStorage.setItem(DIALOGUE_THEATER_TAGS_RESET_KEY, fileTagsResetAt);
            updateStatus(
                `Dialogue Theater: reset conversation tags to the multi-tag scheme (Overwatch + extras)`,
                'info',
            );
        }

        this.clearUnsavedMarkers();
        let loadSource = 'file + local drafts';
        if (fileNormalized.length === 0) loadSource = 'localStorage';
        else if (localNormalized.length === 0) loadSource = 'bundled file';
        else if (preferShippedFile) {
            loadSource = stampMismatch
                ? 'bundled file (deploy/push refresh)'
                : 'bundled file (reset)';
        }
        const heroicNote =
            heroicUpgrades > 0 ? ` — upgraded ${heroicUpgrades} line render(s) to Heroic` : '';
        updateStatus(
            `Dialogue Theater: loaded ${this.conversations.length} conversation(s) (${loadSource})${heroicNote}`,
            'success',
        );
    }

    /**
     * Sync in-memory conversations to localStorage without touching the repo file.
     */
    persistLocalStorageOnly() {
        this.conversations = this.normalizeConversations(this.conversations);
        localStorage.setItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY, JSON.stringify(this.conversations));
    }

    /**
     * @param {{ silent?: boolean }} [opts]
     * @returns {Promise<void>}
     */
    save(opts = {}) {
        this.conversations = this.normalizeConversations(this.conversations);
        localStorage.setItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY, JSON.stringify(this.conversations));
        const savedStamp = buildDialogueTheaterBundleStamp(this.conversations);
        if (savedStamp) writeDialogueTheaterBundleStamp(savedStamp);
        this.deletedConversationIds.clear();
        this.persistDeletedConversationIds();
        this.clearUnsavedMarkers();

        if (!this.canPersistToRepo()) {
            if (!opts.silent) {
                updateStatus(`Saved ${this.conversations.length} conversation(s) to localStorage`, 'success');
            }
            return Promise.resolve();
        }

        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/dialogue-theater')
                : '/api/dialogue-theater';
        const body = JSON.stringify({ conversations: this.conversations });

        return fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (!opts.silent) {
                    updateStatus(
                        `Saved ${this.conversations.length} conversation(s) to localStorage and src/data`,
                        'success',
                    );
                }
            })
            .catch((err) => {
                console.warn('DialogueTheaterDataService: dev API save failed:', err);
                if (!opts.silent) {
                    updateStatus(
                        `Saved ${this.conversations.length} conversation(s) to localStorage (dev file write failed)`,
                        'warning',
                    );
                }
            });
    }

    /** @returns {DialogueConversation} */
    addBlankConversation() {
        const row = buildBlankConversationRecord();
        row.name = String(nextConversationNumber(this.conversations));
        this.conversations.push(row);
        this.markConversationUnsaved(row.id);
        return row;
    }

    /**
     * @param {string} id
     * @param {Partial<DialogueConversation>} patch
     */
    updateConversation(id, patch) {
        const idx = this.conversations.findIndex((c) => c.id === id);
        if (idx < 0) return;
        const merged = this.normalizeConversation({
            ...this.conversations[idx],
            ...patch,
            id,
        });
        if (!merged) return;
        this.conversations[idx] = merged;
        this.markConversationUnsaved(id);
    }

    /**
     * @param {string} id
     * @param {string} name
     */
    updateConversationName(id, name) {
        this.updateConversation(id, { name });
    }

    /**
     * @param {string} id
     * @returns {DialogueConversation|null}
     */
    getConversationById(id) {
        return this.conversations.find((c) => c.id === id) || null;
    }

    /**
     * @param {string} id
     * @param {string} title
     * @deprecated Use updateConversationName
     */
    updateConversationTitle(id, title) {
        this.updateConversationName(id, title);
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    removeConversation(id) {
        const before = this.conversations.length;
        this.conversations = this.conversations.filter((c) => c.id !== id);
        if (this.conversations.length === before) return false;
        this.unsavedConversationIds.delete(id);
        this.markConversationDeleted(id);
        this.isDirty = true;
        return true;
    }

    exportConversations() {
        const dataStr = JSON.stringify({ conversations: this.conversations }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = EXPORT_FILENAME;
        link.click();
        URL.revokeObjectURL(url);
        updateStatus(
            `Exported ${this.conversations.length} conversation(s) (${EXPORT_FILENAME})`,
            'success',
        );
    }

    /**
     * @param {File} file
     */
    importConversations(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(String(e.target?.result || ''));
                    const list = Array.isArray(data?.conversations) ? data.conversations : null;
                    if (!list) {
                        throw new Error('Invalid file format: expected { conversations: [...] }');
                    }
                    this.conversations = this.normalizeConversations(list);
                    this.deletedConversationIds.clear();
                    this.persistDeletedConversationIds();
                    this.save();
                    updateStatus(`Imported ${this.conversations.length} conversation(s)`, 'success');
                    resolve({ success: true, count: this.conversations.length });
                } catch (error) {
                    console.error('DialogueTheaterDataService: import failed:', error);
                    updateStatus(`Import failed: ${error.message || error}`, 'error');
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}

export const dialogueTheaterDataService = new DialogueTheaterDataService();

if (typeof window !== 'undefined') {
    window.dialogueTheaterDataService = dialogueTheaterDataService;
}
