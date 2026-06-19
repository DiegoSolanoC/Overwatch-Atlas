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

export const DIALOGUE_THEATER_LOCALSTORAGE_KEY = 'dialogueTheaterConversations';
const FILE_URL = FILES.dialogueTheater.conversations;
const EXPORT_FILENAME = 'dialogue-theater-export.json';

/** @typedef {{ id: string, name: string, status: 'active'|'outdated', eraName: string, scene: string, lines: DialogueLine[] }} DialogueConversation */
/** @typedef {{ id: string, hero: string, voice: string, subtitles: string, render: string }} DialogueLine */

class DialogueTheaterDataService {
    constructor() {
        /** @type {DialogueConversation[]} */
        this.conversations = [];
        this.isDirty = false;
        /** @type {Set<string>} */
        this.unsavedConversationIds = new Set();
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

        let fileRows = null;
        try {
            const data = await fetchJsonWithTimeout(FILE_URL);
            if (data && Array.isArray(data.conversations)) {
                fileRows = data.conversations;
            } else {
                fileRows = [];
            }
        } catch (err) {
            console.warn('DialogueTheaterDataService: bundled file fetch failed:', err);
            fileRows = [];
        }

        let localRows = null;
        try {
            const saved = localStorage.getItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) localRows = parsed;
            }
        } catch (err) {
            console.warn('DialogueTheaterDataService: localStorage parse failed:', err);
        }

        const localOk = Array.isArray(localRows) && localRows.length > 0;
        if (localOk) {
            this.conversations = this.normalizeConversations(localRows);
            this.clearUnsavedMarkers();
            updateStatus(
                `Dialogue Theater: loaded ${this.conversations.length} conversation(s) from localStorage`,
                'success',
            );
            return;
        }

        if (Array.isArray(fileRows)) {
            this.conversations = this.normalizeConversations(fileRows);
            this.save({ silent: true });
            this.clearUnsavedMarkers();
            updateStatus(
                `Dialogue Theater: loaded ${this.conversations.length} conversation(s) from bundled file`,
                'success',
            );
            return;
        }

        this.conversations = [];
        this.clearUnsavedMarkers();
        updateStatus('Dialogue Theater: no conversations found — starting empty', 'warning');
    }

    /**
     * @param {{ silent?: boolean }} [opts]
     */
    save(opts = {}) {
        this.conversations = this.normalizeConversations(this.conversations);
        localStorage.setItem(DIALOGUE_THEATER_LOCALSTORAGE_KEY, JSON.stringify(this.conversations));
        this.clearUnsavedMarkers();

        if (!this.canPersistToRepo()) {
            if (!opts.silent) {
                updateStatus(`Saved ${this.conversations.length} conversation(s) to localStorage`, 'success');
            }
            return;
        }

        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/dialogue-theater')
                : '/api/dialogue-theater';
        const body = JSON.stringify({ conversations: this.conversations });

        fetch(apiUrl, {
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
        this.isDirty = this.unsavedConversationIds.size > 0;
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
