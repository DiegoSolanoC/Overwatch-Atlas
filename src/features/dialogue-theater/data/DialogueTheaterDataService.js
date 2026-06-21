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
import { nextConversationNumber } from './dialogueTheaterConversationValidation.js';

export const DIALOGUE_THEATER_LOCALSTORAGE_KEY = 'dialogueTheaterConversations';
export const DIALOGUE_THEATER_DELETED_IDS_KEY = 'dialogueTheaterDeletedConversationIds';
export const DIALOGUE_THEATER_NAME_RESET_KEY = 'dialogueTheaterNameResetAt';
const FILE_URL = FILES.dialogueTheater.conversations;
const EXPORT_FILENAME = 'dialogue-theater-export.json';

/** @typedef {{ id: string, name: string, status: 'active'|'outdated', eraName: string, scene: string, lines: DialogueLine[], paths?: DialoguePath[], selectedPathId?: string }} DialogueConversation */
/** @typedef {{ id: string, hero: string, voice: string, subtitles: string, render: string }} DialogueLine */
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
            return pathCount * 1000 + lineCount;
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
    mergeConversationRows(fileRows, localRows, options = {}) {
        const applyFileNames = Boolean(options.applyFileNames);
        const localById = new Map(localRows.map((row) => [row.id, row]));
        const fileIds = new Set(fileRows.map((row) => row.id));
        const merged = fileRows
            .filter((fileRow) => !this.deletedConversationIds.has(fileRow.id))
            .map((fileRow) => {
                const localRow = localById.get(fileRow.id);
                if (!localRow) return fileRow;

                const picked = this.pickRicherConversationRow(fileRow, localRow);
                if (!applyFileNames) return picked;
                return { ...picked, name: fileRow.name };
            });
        merged.push(...localRows.filter((row) => !fileIds.has(row.id)));
        return merged;
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
        this.loadDeletedConversationIds();

        let fileRows = null;
        /** @type {{ nameResetAt?: string }} */
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

        const fileResetAt = String(fileMeta.nameResetAt || '').trim();
        const seenResetAt = localStorage.getItem(DIALOGUE_THEATER_NAME_RESET_KEY) || '';
        const applyFileNames = Boolean(fileResetAt && fileResetAt !== seenResetAt);

        const fileNormalized = this.normalizeConversations(fileRows || []);
        let localNormalized = [];
        try {
            const saved = localStorage.getItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localNormalized = this.normalizeConversations(parsed);
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

        if (fileNormalized.length === 0) {
            this.conversations = localNormalized;
            this.clearUnsavedMarkers();
            updateStatus(
                `Dialogue Theater: loaded ${this.conversations.length} conversation(s) from localStorage`,
                'success',
            );
            return;
        }

        if (localNormalized.length === 0) {
            this.conversations = fileNormalized;
            this.persistLocalStorageOnly();
            this.clearUnsavedMarkers();
            updateStatus(
                `Dialogue Theater: loaded ${this.conversations.length} conversation(s) from bundled file`,
                'success',
            );
            return;
        }

        /** Bundled file wins on id unless local has richer paths/lines; keep local-only drafts. */
        this.conversations = this.mergeConversationRows(fileNormalized, localNormalized, {
            applyFileNames,
        });
        this.persistLocalStorageOnly();

        if (applyFileNames) {
            localStorage.setItem(DIALOGUE_THEATER_NAME_RESET_KEY, fileResetAt);
            updateStatus(
                `Dialogue Theater: reset ${this.conversations.length} conversation title(s) to numbered review placeholders`,
                'info',
            );
        }

        this.clearUnsavedMarkers();
        updateStatus(
            `Dialogue Theater: loaded ${this.conversations.length} conversation(s) (file + local drafts)`,
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
