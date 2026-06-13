/**
 * Merge bundled heroes.json fields into stale localStorage / in-memory rows.
 */

import { getHeroBirthdayRawFromEntry, writeBirthdayToArchiveRow } from './heroArchiveRowBirthday.js';

/**
 * @param {unknown} row
 * @returns {string}
 */
function readRowName(row) {
    if (!row || typeof row !== 'object') return '';
    const variants = row.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const v0 = variants[0];
        return String(v0?.name != null ? v0.name : row.name || '').trim();
    }
    return String(row.name != null ? row.name : '').trim();
}

/**
 * Fill empty hero `birthday` fields from bundled heroes.json rows (matched by name).
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function mergeHeroBirthdaysFromBundledFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    const byName = new Map();
    for (let i = 0; i < fileEvents.length; i++) {
        const fe = fileEvents[i];
        const n = readRowName(fe).toLowerCase();
        if (n) byName.set(n, fe);
    }

    return events.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const existing = getHeroBirthdayRawFromEntry(row);
        if (existing) return row;
        const fromFile = byName.get(readRowName(row).toLowerCase());
        if (!fromFile) return row;
        const fileBirthday = getHeroBirthdayRawFromEntry(fromFile);
        if (!fileBirthday) return row;
        return writeBirthdayToArchiveRow(row, fileBirthday);
    });
}

/**
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {boolean}
 */
export function heroArchiveBirthdaysMergedFromFile(events, fileEvents) {
    if (!Array.isArray(events) || !Array.isArray(fileEvents)) return false;
    const merged = mergeHeroBirthdaysFromBundledFile(events, fileEvents);
    return JSON.stringify(events) !== JSON.stringify(merged);
}

/**
 * Clear Sombra (and similar) biography rows corrupted by glitch-text saves.
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function repairCorruptedHeroArchiveDescriptionsFromFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    const byName = new Map();
    for (let i = 0; i < fileEvents.length; i += 1) {
        const fe = fileEvents[i];
        const n = readRowName(fe).toLowerCase();
        if (n) byName.set(n, fe);
    }

    return events.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const name = readRowName(row).toLowerCase();
        if (!name) return row;
        const desc = String(row.description ?? '');
        const corrupted =
            /6\+34/.test(desc)
            || /glitchy-text/i.test(desc)
            || (name === 'sombra' && /^olivia colomar$/i.test(desc.trim()));
        if (!corrupted) return row;
        const fromFile = byName.get(name);
        const cleanDesc =
            fromFile && typeof fromFile.description === 'string' ? fromFile.description : '';
        return { ...row, description: cleanDesc };
    });
}
