/**
 * Compare and merge two `{ events: [...] }` archives.
 *
 * Strict match: name + yearStart.
 * Reposition match: same story moved in the incoming list — paired by name (±year)
 * or by location + year when the title was renamed.
 */

import { normalizeStoryEventNameForMatch } from '../../../interface-shared/bio-archive/bioArchiveConnectionRanges.js';

/** @typedef {'base'|'incoming'} MergePickSide */

/**
 * @typedef {object} StoryEventsMergePlan
 * @property {object[]} baseOrdered
 * @property {object[]} incomingOrdered
 * @property {MergeRow[]} rows
 * @property {number} identicalCount
 * @property {Array<{ baseIndex: number, incomingIndex: number }>} identicalPairs
 * @property {boolean} hasDifferences
 */

/**
 * @typedef {object} MergeRow
 * @property {string} key
 * @property {string} label
 * @property {object|null} baseEvent
 * @property {object|null} incomingEvent
 * @property {number|null} [baseIndex]
 * @property {number|null} [incomingIndex]
 * @property {'identical'|'conflict'|'reposition'|'onlyBase'|'onlyIncoming'} kind
 * @property {string} [matchNote]
 * @property {string[]} [changedFields]
 * @property {MergePickSide} [pick]
 * @property {Record<string, MergePickSide>} [fieldPicks]
 * @property {MergePickSide} [positionPick]
 * @property {boolean} [include]
 */

const SUMMARY_FIELDS = [
    'name',
    'description',
    'yearStart',
    'yearEnd',
    'eraName',
    'cityDisplayName',
    'locationType',
    'lat',
    'lon',
    'image',
    'headlines',
    'sources',
    'heroFilterPlaces',
    'factionFilterPlaces',
    'npcFilterPlaces',
    'secondaryCountryPlaces',
    'relevantLocations',
    'connections',
    'heroRole',
    'heroSubRole',
    'birthday',
];

/** Max yearStart gap when pairing by title only (reordered / nudged dates). */
const REPOSITION_YEAR_TOLERANCE = 3;

/**
 * @param {unknown} event
 * @returns {string}
 */
export function storyEventMatchKey(event) {
    const name = normalizeStoryEventNameForMatch(
        event && typeof event === 'object' && 'name' in event ? event.name : '',
    );
    const year =
        event && typeof event === 'object' && event.yearStart != null && event.yearStart !== ''
            ? String(event.yearStart)
            : '';
    return year ? `${name}\0${year}` : name;
}

/**
 * Title-only key — pairs entries when yearStart differs or is missing on one side.
 * @param {unknown} event
 * @returns {string}
 */
export function storyEventLooseKey(event) {
    return normalizeStoryEventNameForMatch(
        event && typeof event === 'object' && 'name' in event ? event.name : '',
    );
}

/**
 * Location + year — pairs renamed entries (e.g. Open Talon ↔ Interrogation).
 * @param {unknown} event
 * @returns {string}
 */
export function storyEventPlaceKey(event) {
    if (!event || typeof event !== 'object') return '';
    const city = normalizeStoryEventNameForMatch(String(event.cityDisplayName || ''));
    const year =
        event.yearStart != null && event.yearStart !== '' ? String(event.yearStart) : '';
    if (!city || !year) return '';
    return `${city}\0${year}`;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function storyEventsDeepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {unknown} event
 * @returns {number|null}
 */
function numericYearStart(event) {
    if (!event || typeof event !== 'object') return null;
    const raw = event.yearStart;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function yearsCompatibleForReposition(a, b) {
    const ya = numericYearStart(a);
    const yb = numericYearStart(b);
    if (ya == null || yb == null) return true;
    return Math.abs(ya - yb) <= REPOSITION_YEAR_TOLERANCE;
}

/**
 * @param {object|null} baseEvent
 * @param {object|null} incomingEvent
 * @returns {string[]}
 */
export function listChangedStoryEventFields(baseEvent, incomingEvent) {
    /** @type {Set<string>} */
    const keys = new Set();
    if (baseEvent && typeof baseEvent === 'object') {
        Object.keys(baseEvent).forEach((key) => keys.add(key));
    }
    if (incomingEvent && typeof incomingEvent === 'object') {
        Object.keys(incomingEvent).forEach((key) => keys.add(key));
    }

    const ordered = [
        ...SUMMARY_FIELDS.filter((field) => keys.has(field)),
        ...[...keys].filter((field) => !SUMMARY_FIELDS.includes(field)).sort(),
    ];

    /** @type {string[]} */
    const changed = [];
    for (const field of ordered) {
        const left = baseEvent?.[field];
        const right = incomingEvent?.[field];
        if (JSON.stringify(left) !== JSON.stringify(right)) {
            changed.push(field);
        }
    }
    return changed;
}

/**
 * @param {unknown} event
 * @returns {string}
 */
export function storyEventDisplayLabel(event) {
    if (!event || typeof event !== 'object') return '(unnamed event)';
    const name = String(event.name || '').trim() || '(unnamed event)';
    const year =
        event.yearStart != null && event.yearStart !== '' ? ` (${event.yearStart})` : '';
    return `${name}${year}`;
}

/**
 * @param {unknown} event
 * @returns {string}
 */
export function storyEventDescriptionPreview(event) {
    const text = String(event?.description || '').replace(/\s+/g, ' ').trim();
    if (!text) return '—';
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/**
 * @param {unknown} event
 * @param {number} index
 * @returns {{ event: object, index: number }}
 */
function indexedEvent(event, index) {
    return { event, index };
}

/**
 * @param {object} baseItem
 * @param {object} incomingItem
 * @param {string} matchNote
 * @returns {MergeRow}
 */
function buildPairedRow(baseItem, incomingItem, matchNote) {
    const { event: baseEvent, index: baseIndex } = baseItem;
    const { event: incomingEvent, index: incomingIndex } = incomingItem;
    const strictMatch = storyEventMatchKey(baseEvent) === storyEventMatchKey(incomingEvent);
    const deepEqual = storyEventsDeepEqual(baseEvent, incomingEvent);
    const repositioned = baseIndex !== incomingIndex;
    const kind =
        strictMatch && !repositioned ? 'conflict' : 'reposition';

    const changedFields = listChangedStoryEventFields(baseEvent, incomingEvent);
    const defaultPick = kind === 'reposition' ? 'base' : 'incoming';
    /** @type {Record<string, MergePickSide>} */
    const fieldPicks = {};
    for (const field of changedFields) fieldPicks[field] = defaultPick;

    return {
        key: `pair:${baseIndex}:${incomingIndex}:${storyEventLooseKey(baseEvent) || storyEventPlaceKey(baseEvent)}`,
        label: storyEventDisplayLabel(baseEvent),
        baseEvent,
        incomingEvent,
        baseIndex,
        incomingIndex,
        kind: deepEqual && !repositioned ? 'identical' : kind,
        matchNote,
        changedFields,
        pick: defaultPick,
        fieldPicks,
        // Position source for reposition rows (kept independent of per-field content):
        // 'base' keeps the current position, 'incoming' adopts the incoming placement.
        positionPick: 'base',
    };
}

/**
 * @param {Array<{ event: object, index: number }>} orphanBase
 * @param {Array<{ event: object, index: number }>} orphanIncoming
 * @returns {{ paired: MergeRow[], orphanBase: typeof orphanBase, orphanIncoming: typeof orphanIncoming }}
 */
function pairRepositionedOrphans(orphanBase, orphanIncoming) {
    /** @type {MergeRow[]} */
    const paired = [];
    /** @type {Set<number>} */
    const usedBase = new Set();
    /** @type {Set<number>} */
    const usedIncoming = new Set();

    const tryPair = (incomingItem, matcher, matchNote) => {
        if (usedIncoming.has(incomingItem.index)) return false;
        for (const baseItem of orphanBase) {
            if (usedBase.has(baseItem.index)) continue;
            if (!matcher(baseItem, incomingItem)) continue;
            const row = buildPairedRow(baseItem, incomingItem, matchNote);
            if (row.kind === 'identical') continue;
            paired.push(row);
            usedBase.add(baseItem.index);
            usedIncoming.add(incomingItem.index);
            return true;
        }
        return false;
    };

    for (const incomingItem of orphanIncoming) {
        tryPair(
            incomingItem,
            (baseItem, incItem) => {
                const loose = storyEventLooseKey(baseItem.event);
                if (!loose || loose !== storyEventLooseKey(incItem.event)) return false;
                return yearsCompatibleForReposition(baseItem.event, incItem.event);
            },
            'Same title — different list position or year in incoming file',
        );
    }

    for (const incomingItem of orphanIncoming) {
        if (usedIncoming.has(incomingItem.index)) continue;
        tryPair(
            incomingItem,
            (baseItem, incItem) => {
                const place = storyEventPlaceKey(incItem.event);
                if (!place) return false;
                return place === storyEventPlaceKey(baseItem.event);
            },
            'Same place & year — title may have been renamed when moved',
        );
    }

    return {
        paired,
        orphanBase: orphanBase.filter((item) => !usedBase.has(item.index)),
        orphanIncoming: orphanIncoming.filter((item) => !usedIncoming.has(item.index)),
    };
}

/**
 * @param {unknown[]} baseEvents
 * @param {unknown[]} incomingEvents
 * @returns {StoryEventsMergePlan}
 */
export function buildStoryEventsMergePlan(baseEvents, incomingEvents) {
    const baseOrdered = Array.isArray(baseEvents) ? baseEvents : [];
    const incomingOrdered = Array.isArray(incomingEvents) ? incomingEvents : [];

    /** @type {Array<{ event: object, index: number }>} */
    const baseIndexed = baseOrdered
        .map((event, index) => (event && typeof event === 'object' ? indexedEvent(event, index) : null))
        .filter(Boolean);
    /** @type {Array<{ event: object, index: number }>} */
    const incomingIndexed = incomingOrdered
        .map((event, index) => (event && typeof event === 'object' ? indexedEvent(event, index) : null))
        .filter(Boolean);

    /** @type {Map<string, { event: object, index: number }>} */
    const baseByStrict = new Map();
    /** @type {Map<string, { event: object, index: number }>} */
    const incomingByStrict = new Map();

    for (const item of baseIndexed) {
        const key = storyEventMatchKey(item.event);
        if (!baseByStrict.has(key)) baseByStrict.set(key, item);
    }
    for (const item of incomingIndexed) {
        const key = storyEventMatchKey(item.event);
        if (!incomingByStrict.has(key)) incomingByStrict.set(key, item);
    }

    /** @type {Set<number>} */
    const matchedBaseIndices = new Set();
    /** @type {Set<number>} */
    const matchedIncomingIndices = new Set();
    /** @type {MergeRow[]} */
    const rows = [];
    /** @type {Array<{ baseIndex: number, incomingIndex: number }>} */
    const identicalPairs = [];
    let identicalCount = 0;

    for (const [key, baseItem] of baseByStrict) {
        const incomingItem = incomingByStrict.get(key);
        if (!incomingItem) continue;

        matchedBaseIndices.add(baseItem.index);
        matchedIncomingIndices.add(incomingItem.index);

        if (storyEventsDeepEqual(baseItem.event, incomingItem.event)) {
            identicalCount += 1;
            // Retain the base↔incoming index correspondence so the merge builder
            // can anchor incoming-positioned events against this stable common spine.
            identicalPairs.push({ baseIndex: baseItem.index, incomingIndex: incomingItem.index });
            continue;
        }

        const row = buildPairedRow(
            baseItem,
            incomingItem,
            baseItem.index === incomingItem.index
                ? 'Content differs at the same list position'
                : 'Same title & year — moved to a different list position in incoming file',
        );
        row.key = key;
        if (row.kind !== 'identical') {
            rows.push(row);
        } else {
            identicalCount += 1;
        }
    }

    /** @type {Array<{ event: object, index: number }>} */
    let orphanBase = baseIndexed.filter((item) => !matchedBaseIndices.has(item.index));
    /** @type {Array<{ event: object, index: number }>} */
    let orphanIncoming = incomingIndexed.filter((item) => !matchedIncomingIndices.has(item.index));

    const repositionPass = pairRepositionedOrphans(orphanBase, orphanIncoming);
    rows.push(...repositionPass.paired);
    orphanBase = repositionPass.orphanBase;
    orphanIncoming = repositionPass.orphanIncoming;

    for (const { event, index } of orphanBase) {
        rows.push({
            key: storyEventMatchKey(event),
            label: storyEventDisplayLabel(event),
            baseEvent: event,
            incomingEvent: null,
            baseIndex: index,
            incomingIndex: null,
            kind: 'onlyBase',
            include: true,
        });
    }

    for (const { event, index } of orphanIncoming) {
        rows.push({
            key: storyEventMatchKey(event),
            label: storyEventDisplayLabel(event),
            incomingEvent: event,
            baseEvent: null,
            baseIndex: null,
            incomingIndex: index,
            kind: 'onlyIncoming',
            include: true,
        });
    }

    rows.sort((a, b) => {
        const rank = (kind) => {
            if (kind === 'conflict') return 0;
            if (kind === 'reposition') return 1;
            if (kind === 'onlyIncoming') return 2;
            if (kind === 'onlyBase') return 3;
            return 4;
        };
        const rankDiff = rank(a.kind) - rank(b.kind);
        if (rankDiff !== 0) return rankDiff;
        const posA = a.baseIndex ?? a.incomingIndex ?? 0;
        const posB = b.baseIndex ?? b.incomingIndex ?? 0;
        if (posA !== posB) return posA - posB;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });

    return {
        baseOrdered,
        incomingOrdered,
        rows,
        identicalCount,
        identicalPairs,
        hasDifferences: rows.length > 0,
    };
}

/**
 * @param {unknown} value
 * @returns {object}
 */
function cloneEvent(value) {
    return JSON.parse(JSON.stringify(value));
}

/**
 * Which side supplies a given field's value for a paired row.
 * @param {MergeRow} row
 * @param {string} field
 * @returns {MergePickSide}
 */
export function resolveFieldSide(row, field) {
    const fromMap = row.fieldPicks ? row.fieldPicks[field] : undefined;
    return fromMap || row.pick || 'base';
}

/**
 * Which side supplies the list position for a repositioned row.
 * @param {MergeRow} row
 * @returns {MergePickSide}
 */
export function resolvePositionSide(row) {
    return row.positionPick || row.pick || 'base';
}

/**
 * Compose the merged event for a paired row, honoring per-field picks. Unchanged fields
 * are identical on both sides, so we start from the current (base) event and only rewrite
 * the fields that differ, taking each from its chosen side. A field absent on the chosen
 * side is removed. This is what lets you take everything from incoming while keeping, say,
 * the description or name from current.
 * @param {MergeRow} row
 * @returns {object}
 */
export function buildMergedEventForRow(row) {
    const base = row.baseEvent;
    const incoming = row.incomingEvent;
    const result = cloneEvent(base || incoming || {});
    const fields = Array.isArray(row.changedFields) ? row.changedFields : [];

    for (const field of fields) {
        const side = resolveFieldSide(row, field);
        const source = side === 'incoming' ? incoming : base;
        if (source && Object.prototype.hasOwnProperty.call(source, field)) {
            result[field] = cloneEvent(source[field]);
        } else {
            delete result[field];
        }
    }

    return result;
}

/**
 * Rebuild the merged event list.
 *
 * Ordering model:
 *   - The current (base) list is the backbone; events kept from current stay in their
 *     current order. Matched/identical events act as a stable spine and carry their
 *     incoming index as an anchor.
 *   - Events the user pulls from the incoming file — repositioned rows set to "incoming"
 *     and included incoming-only rows — are *floated* and re-inserted at their incoming
 *     position (relative to the spine), in incoming order. This is what makes picking
 *     "incoming" actually move the event, and drops incoming-only rows at their real
 *     placement instead of at the very end.
 *   - Repositioned rows left on "current" keep their current position (no move).
 *
 * @param {StoryEventsMergePlan} plan
 * @param {MergeRow[]} rows
 * @returns {object[]}
 */
export function buildMergedStoryEventsFromPlan(plan, rows) {
    /** @type {Map<number, MergeRow>} rows addressable by their base index */
    const rowByBase = new Map();
    for (const row of rows) {
        if (row.baseIndex != null && !rowByBase.has(row.baseIndex)) {
            rowByBase.set(row.baseIndex, row);
        }
    }

    /** @type {Map<number, number>} baseIndex → incomingIndex for identical (unchanged) matches */
    const identicalIncomingByBase = new Map();
    for (const pair of plan.identicalPairs || []) {
        identicalIncomingByBase.set(pair.baseIndex, pair.incomingIndex);
    }

    /** @type {Array<{ event: object, incomingIndex: number|null }>} */
    const backbone = [];
    /** @type {Array<{ event: object, incomingIndex: number }>} */
    const floats = [];

    for (let i = 0; i < plan.baseOrdered.length; i += 1) {
        const baseEvent = plan.baseOrdered[i];
        if (!baseEvent || typeof baseEvent !== 'object') continue;

        const row = rowByBase.get(i);

        if (!row) {
            // Unchanged / identical match (or an unpaired base row) — keep in place.
            const incomingIndex = identicalIncomingByBase.has(i)
                ? identicalIncomingByBase.get(i)
                : null;
            backbone.push({ event: cloneEvent(baseEvent), incomingIndex });
            continue;
        }

        if (row.kind === 'conflict') {
            backbone.push({
                event: buildMergedEventForRow(row),
                incomingIndex: row.incomingIndex ?? null,
            });
            continue;
        }

        if (row.kind === 'reposition') {
            const composed = buildMergedEventForRow(row);
            if (resolvePositionSide(row) === 'incoming') {
                // Adopt the incoming file's placement — float and re-insert below.
                floats.push({
                    event: composed,
                    incomingIndex: row.incomingIndex ?? 0,
                });
            } else {
                // Keep the current position (content still honors per-field picks).
                backbone.push({ event: composed, incomingIndex: null });
            }
            continue;
        }

        if (row.kind === 'onlyBase') {
            if (row.include !== false) {
                backbone.push({ event: cloneEvent(baseEvent), incomingIndex: null });
            }
        }
    }

    for (const row of rows) {
        if (row.kind === 'onlyIncoming' && row.include !== false && row.incomingEvent) {
            floats.push({
                event: cloneEvent(row.incomingEvent),
                incomingIndex: row.incomingIndex ?? 0,
            });
        }
    }

    // Insert floated events in incoming order, each anchored just after the last
    // backbone entry whose incoming index precedes it. Already-inserted floats become
    // anchors too, so floats keep their incoming order relative to one another.
    floats.sort((a, b) => a.incomingIndex - b.incomingIndex);
    for (const float of floats) {
        let insertAt = 0;
        for (let j = 0; j < backbone.length; j += 1) {
            const anchor = backbone[j].incomingIndex;
            if (anchor != null && anchor < float.incomingIndex) {
                insertAt = j + 1;
            }
        }
        backbone.splice(insertAt, 0, {
            event: float.event,
            incomingIndex: float.incomingIndex,
        });
    }

    return backbone.map((entry) => entry.event);
}

/**
 * @param {MergeRow} row
 * @returns {string}
 */
export function formatMergeRowPositionNote(row) {
    const basePos = row.baseIndex != null ? row.baseIndex + 1 : null;
    const incomingPos = row.incomingIndex != null ? row.incomingIndex + 1 : null;
    if (basePos != null && incomingPos != null && basePos !== incomingPos) {
        return `List position: #${basePos} in current → #${incomingPos} in incoming`;
    }
    if (basePos != null && incomingPos != null) {
        return `List position #${basePos} (same in both files)`;
    }
    if (row.matchNote) return row.matchNote;
    return '';
}
