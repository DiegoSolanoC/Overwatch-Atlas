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
 * @param {unknown} row
 * @returns {{ heroRole: string, heroSubRole: string }}
 */
function readHeroRoleFieldsFromArchiveRow(row) {
    if (!row || typeof row !== 'object') return { heroRole: '', heroSubRole: '' };
    const variants = row.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const v0 = variants[0] || {};
        return {
            heroRole: String(v0.heroRole != null ? v0.heroRole : row.heroRole || '').trim(),
            heroSubRole: String(v0.heroSubRole != null ? v0.heroSubRole : row.heroSubRole || '').trim(),
        };
    }
    return {
        heroRole: String(row.heroRole != null ? row.heroRole : '').trim(),
        heroSubRole: String(row.heroSubRole != null ? row.heroSubRole : '').trim(),
    };
}

/**
 * @param {object} row
 * @param {string} heroRole
 * @param {string} heroSubRole
 * @returns {object}
 */
function withHeroRoleFieldsOnArchiveRow(row, heroRole, heroSubRole) {
    const role = String(heroRole || '').trim();
    const sub = String(heroSubRole || '').trim();
    const variants = row.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const vars = variants.map((v, idx) => (
            idx === 0 ? { ...v, heroRole: role, heroSubRole: sub } : v
        ));
        return { ...row, heroRole: role, heroSubRole: sub, variants: vars };
    }
    return { ...row, heroRole: role, heroSubRole: sub };
}

/**
 * Apply `heroRole` / `heroSubRole` from bundled heroes.json (localStorage may be stale).
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {{ events: unknown[], changed: number }}
 */
export function mergeHeroRolesFromBundledArchiveRows(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) {
        return { events: events || [], changed: 0 };
    }
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) {
        return { events, changed: 0 };
    }

    /** @type {Map<string, unknown>} */
    const byName = new Map();
    for (let i = 0; i < fileEvents.length; i++) {
        const fe = fileEvents[i];
        const n = readRowName(fe).toLowerCase();
        if (n) byName.set(n, fe);
    }

    let changed = 0;
    const out = events.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const name = readRowName(row).toLowerCase();
        if (!name) return row;
        const fromFile = byName.get(name);
        if (!fromFile) return row;
        const bundled = readHeroRoleFieldsFromArchiveRow(fromFile);
        if (!bundled.heroRole && !bundled.heroSubRole) return row;
        const existing = readHeroRoleFieldsFromArchiveRow(row);
        if (
            existing.heroRole === bundled.heroRole
            && existing.heroSubRole === bundled.heroSubRole
        ) {
            return row;
        }
        changed += 1;
        return withHeroRoleFieldsOnArchiveRow(row, bundled.heroRole, bundled.heroSubRole);
    });

    return { events: out, changed };
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
 * @param {unknown} row
 * @returns {string}
 */
/**
 * @param {string} raw
 * @returns {string} trimmed text, or '' for empty / placeholder copy
 */
function meaningfulDescription(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^no description available\.?$/i.test(text)) return '';
    return text;
}

function readRowDescription(row) {
    if (!row || typeof row !== 'object') return '';
    const variants = row.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const v0 = variants[0] || {};
        return meaningfulDescription(
            v0.description != null ? v0.description : row.description || '',
        );
    }
    return meaningfulDescription(row.description != null ? row.description : '');
}

/**
 * @param {object} row
 * @param {string} description
 * @returns {object}
 */
function withDescriptionOnArchiveRow(row, description) {
    const desc = String(description || '');
    const variants = row.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const vars = variants.map((v, idx) => (idx === 0 ? { ...v, description: desc } : v));
        return { ...row, description: desc, variants: vars };
    }
    return { ...row, description: desc };
}

/**
 * Fill empty Intel biography text from bundled heroes.json.
 * GitHub Pages prefers non-empty localStorage overlays; those snapshots often
 * predate committed bios, so empty local descriptions must pull from the file.
 *
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {{ events: unknown[], changed: number }}
 */
export function mergeHeroDescriptionsFromBundledFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) {
        return { events: events || [], changed: 0 };
    }
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) {
        return { events, changed: 0 };
    }

    /** @type {Map<string, unknown>} */
    const byName = new Map();
    for (let i = 0; i < fileEvents.length; i += 1) {
        const fe = fileEvents[i];
        const n = readRowName(fe).toLowerCase();
        if (!n) continue;
        byName.set(n, fe);
        // "D.va" / "D.Va" / "Dva" aliases for Pages localStorage drift
        const compact = n.replace(/[^a-z0-9]+/g, '');
        if (compact && compact !== n) byName.set(compact, fe);
    }

    let changed = 0;
    const out = events.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const name = readRowName(row).toLowerCase();
        if (!name) return row;
        if (readRowDescription(row)) return row;
        const fromFile =
            byName.get(name) || byName.get(name.replace(/[^a-z0-9]+/g, ''));
        if (!fromFile) return row;
        const fileDesc = readRowDescription(fromFile);
        if (!fileDesc) return row;
        changed += 1;
        return withDescriptionOnArchiveRow(row, fileDesc);
    });

    return { events: out, changed };
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
