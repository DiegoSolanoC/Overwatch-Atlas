/**
 * Story-timeline Commentary — Dialogue Theater interaction / Hero Chatter labels.
 *
 * Stored as `commentary` array entries:
 * - string — legacy theater resolve name (dialogue or chatter line label)
 * - `{ name, label?, theaterId?, lineId? }` — preferred:
 *   - `theaterId` = conversation.id (survives dialogue renames)
 *   - `lineId` = chatter line id when targeting a specific line
 *   - `name` = display / legacy fallback resolve key
 *   - `label` = optional simplified display title (chatters)
 */

import { CHATTER_COMMENTARY_SEP, stampCommentaryTheaterIds } from './storyEventCommentaryTheater.js';
import { dialogueTheaterDataService } from '../../dialogue-theater/data/DialogueTheaterDataService.js?v=105';

/**
 * @typedef {{
 *   name: string,
 *   label?: string,
 *   theaterId?: string,
 *   lineId?: string,
 * }} CommentaryEntry
 */

/**
 * @param {unknown} raw
 * @returns {CommentaryEntry | null}
 */
export function parseCommentaryEntry(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        const name = raw.trim();
        return name ? { name } : null;
    }
    if (typeof raw === 'object') {
        const obj = /** @type {{
            name?: unknown,
            label?: unknown,
            theater?: unknown,
            theaterId?: unknown,
            conversationId?: unknown,
            lineId?: unknown,
        }} */ (raw);
        const name = String(obj.name ?? obj.theater ?? '').trim();
        const theaterId = String(obj.theaterId ?? obj.conversationId ?? '').trim();
        if (!name && !theaterId) return null;
        /** @type {CommentaryEntry} */
        const entry = { name: name || theaterId };
        const label = String(obj.label ?? '').trim();
        if (label) entry.label = label;
        if (theaterId) entry.theaterId = theaterId;
        const lineId = String(obj.lineId ?? '').trim();
        if (lineId) entry.lineId = lineId;
        return entry;
    }
    return null;
}

/**
 * @param {unknown} value
 * @returns {CommentaryEntry[]}
 */
export function normalizeCommentaryEntries(value) {
    if (!Array.isArray(value)) return [];
    /** @type {CommentaryEntry[]} */
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const entry = parseCommentaryEntry(raw);
        if (!entry) continue;
        const key = entry.theaterId
            ? `id:${entry.theaterId}:${entry.lineId || ''}`
            : `name:${entry.name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
    }
    return out;
}

/**
 * Theater resolve names only (legacy helper name kept).
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeCommentaryList(value) {
    return normalizeCommentaryEntries(value).map((e) => e.name);
}

/**
 * Compact form for JSON: string when no extras, object when label / ids set.
 * @param {CommentaryEntry[]} entries
 * @returns {Array<string | { name: string, label?: string, theaterId?: string, lineId?: string }>}
 */
export function serializeCommentaryEntries(entries) {
    return normalizeCommentaryEntries(entries).map((e) => {
        const hasLabel = Boolean(e.label);
        const hasTheaterId = Boolean(e.theaterId);
        const hasLineId = Boolean(e.lineId);
        if (!hasLabel && !hasTheaterId && !hasLineId) return e.name;
        /** @type {{ name: string, label?: string, theaterId?: string, lineId?: string }} */
        const obj = { name: e.name };
        if (hasLabel) obj.label = e.label;
        if (hasTheaterId) obj.theaterId = e.theaterId;
        if (hasLineId) obj.lineId = e.lineId;
        return obj;
    });
}

/**
 * @param {unknown} event
 * @returns {CommentaryEntry[]}
 */
export function getEventCommentaryEntries(event) {
    if (!event || typeof event !== 'object') return [];
    return normalizeCommentaryEntries(/** @type {{ commentary?: unknown }} */ (event).commentary);
}

/**
 * @param {unknown} event
 * @returns {string[]}
 */
export function getEventCommentaryNames(event) {
    return getEventCommentaryEntries(event).map((e) => e.name);
}

/**
 * Display title on the story slide (simplified label when set).
 * @param {CommentaryEntry} entry
 * @returns {string}
 */
export function commentaryDisplayTitle(entry) {
    if (!entry) return '';
    return String(entry.label || entry.name || '').trim();
}

/**
 * Heuristic: chatter line labels use `Hero · text` (hub names alone are rare as commentary).
 * @param {string} name
 * @returns {boolean}
 */
export function looksLikeChatterCommentaryName(name) {
    const n = String(name || '').trim();
    if (!n) return false;
    return n.includes(CHATTER_COMMENTARY_SEP);
}

/**
 * @param {HTMLInputElement | null | undefined} nameInput
 * @param {CommentaryEntry | null | undefined} entry
 */
export function applyCommentaryEntryToNameInput(nameInput, entry) {
    if (!(nameInput instanceof HTMLInputElement)) return;
    if (entry?.theaterId) nameInput.dataset.theaterId = entry.theaterId;
    else delete nameInput.dataset.theaterId;
    if (entry?.lineId) nameInput.dataset.lineId = entry.lineId;
    else delete nameInput.dataset.lineId;
}

/**
 * @param {HTMLInputElement} nameInput
 * @returns {Pick<CommentaryEntry, 'theaterId' | 'lineId'>}
 */
export function readCommentaryIdsFromNameInput(nameInput) {
    const theaterId = String(nameInput?.dataset?.theaterId || '').trim();
    const lineId = String(nameInput?.dataset?.lineId || '').trim();
    /** @type {Pick<CommentaryEntry, 'theaterId' | 'lineId'>} */
    const out = {};
    if (theaterId) out.theaterId = theaterId;
    if (lineId) out.lineId = lineId;
    return out;
}

/**
 * Collect commentary entries from inline editor rows.
 * Stamps theaterId/lineId from Dialogue Theater when available so renames stay linked.
 * @param {ParentNode | null | undefined} container
 * @returns {Array<string | { name: string, label?: string, theaterId?: string, lineId?: string }>}
 */
export function collectCommentaryFromEditor(container) {
    if (!container) return [];
    const rows = container.querySelectorAll('.event-slide-inline-editor__commentary-row');
    /** @type {CommentaryEntry[]} */
    const entries = [];
    rows.forEach((row) => {
        const nameEl = row.querySelector('[data-role="commentary-name"]');
        const labelEl = row.querySelector('[data-role="commentary-label"]');
        const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : '';
        if (!name) return;
        const label =
            labelEl instanceof HTMLInputElement && !labelEl.hidden
                ? labelEl.value.trim()
                : '';
        /** @type {CommentaryEntry} */
        const entry = { name };
        if (label) entry.label = label;
        if (nameEl instanceof HTMLInputElement) {
            Object.assign(entry, readCommentaryIdsFromNameInput(nameEl));
        }
        entries.push(entry);
    });

    const stamped = stampCommentaryTheaterIds(
        entries,
        dialogueTheaterDataService?.conversations || [],
    );
    return serializeCommentaryEntries(stamped);
}
