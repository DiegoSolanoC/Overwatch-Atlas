/**
 * Heal known timeline lifecycle-row corruption (wrong hero copy / glitch save artifacts).
 * Used when localStorage wins over bundled timeline-events.json on load.
 */

const LIFECYCLE_SUFFIX_RE = / (is Born|is Made|Goes Online|was Made|Was Made)$/i;
const GLITCH_CHARS_RE = /[$\][@#{}|`~^%\\<>]|&lt;|&gt;|\(\d|\d\)|_\d|\d_|\|/;

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeLifecycleBaseName(name) {
    return String(name || '')
        .replace(LIFECYCLE_SUFFIX_RE, '')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * @param {unknown} row
 * @returns {string}
 */
function heroFilterToken(row) {
    if (!row || typeof row !== 'object') return '';
    const places = row.heroFilterPlaces;
    if (!Array.isArray(places) || !places[0]) return '';
    return String(places[0].country || '').trim().toLowerCase();
}

/**
 * @param {unknown} row
 * @returns {boolean}
 */
function lifecycleRowLooksGlitchCorrupted(row) {
    if (!row || typeof row !== 'object') return false;
    const name = String(row.name ?? '');
    const desc = String(row.description ?? '');
    if (GLITCH_CHARS_RE.test(name)) return true;
    if (/glitchy-text/i.test(desc)) return true;
    if (/6\+34/.test(desc)) return true;
    if (/&lt;/.test(desc) && /olivia/i.test(desc)) return true;
    if (/olivia\s+colomar/i.test(name) && /siebren|march 15th of 2015/i.test(desc)) return true;
    if (/siebren/i.test(name) && /olivia\s+colomar/i.test(desc)) return true;
    return false;
}

/**
 * @param {object[]} fileEvents
 * @returns {Map<string, object>}
 */
function buildFileRowByHeroToken(fileEvents) {
    /** @type {Map<string, object>} */
    const map = new Map();
    for (let i = 0; i < fileEvents.length; i += 1) {
        const fe = fileEvents[i];
        if (!fe || typeof fe !== 'object') continue;
        const token = heroFilterToken(fe);
        if (token) map.set(token, fe);
    }
    return map;
}

/**
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
export function repairMisfiledLifecycleEventsFromFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    /** @type {Map<string, object>} */
    const fileByName = new Map();
    for (let i = 0; i < fileEvents.length; i += 1) {
        const fe = fileEvents[i];
        if (!fe || typeof fe !== 'object') continue;
        const n = String(fe.name ?? '').trim().toLowerCase();
        if (n) fileByName.set(n, fe);
    }

    const fileByHero = buildFileRowByHeroToken(fileEvents);
    const fileFirst = fileEvents[0] && typeof fileEvents[0] === 'object' ? fileEvents[0] : null;

    let changed = false;
    const out = events.map((row, index) => {
        if (!row || typeof row !== 'object') return row;

        const name = String(row.name ?? '').trim();
        const desc = String(row.description ?? '');
        const fileRow = fileByName.get(name.toLowerCase());
        const heroToken = heroFilterToken(row);
        const fileByToken = heroToken ? fileByHero.get(heroToken) : null;

        // Slot 0 must match canonical first lifecycle event (Siebren / Sigma).
        if (
            index === 0
            && fileFirst
            && (
                lifecycleRowLooksGlitchCorrupted(row)
                || heroToken === 'sombra'
                || normalizeLifecycleBaseName(name) !== normalizeLifecycleBaseName(String(fileFirst.name ?? ''))
            )
            && heroFilterToken(fileFirst) === 'sigma'
        ) {
            changed = true;
            return { ...row, ...fileFirst };
        }

        if (fileRow) {
            if (/siebren\s+de\s+kuiper\s+is\s+born/i.test(name) && /olivia\s+colomar/i.test(desc)) {
                changed = true;
                return { ...row, ...fileRow, name: fileRow.name ?? name };
            }

            if (/olivia\s+colomar\s+is\s+born/i.test(name)) {
                const fileDesc = String(fileRow.description ?? '');
                const corrupted =
                    /december 31st of 204[^0-9]/i.test(desc)
                    || lifecycleRowLooksGlitchCorrupted(row);
                if (corrupted && fileDesc) {
                    changed = true;
                    return { ...row, name: fileRow.name ?? name, description: fileDesc };
                }
            }
        }

        if (lifecycleRowLooksGlitchCorrupted(row) && fileByToken) {
            changed = true;
            return { ...row, ...fileByToken };
        }

        if (lifecycleRowLooksGlitchCorrupted(row)) {
            const base = normalizeLifecycleBaseName(name);
            for (const [fileName, candidate] of fileByName.entries()) {
                if (normalizeLifecycleBaseName(fileName) === base) {
                    changed = true;
                    return { ...row, ...candidate };
                }
            }
        }

        return row;
    });

    return changed ? out : events;
}
