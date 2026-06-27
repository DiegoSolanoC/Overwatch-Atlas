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

    return {
        key: `pair:${baseIndex}:${incomingIndex}:${storyEventLooseKey(baseEvent) || storyEventPlaceKey(baseEvent)}`,
        label: storyEventDisplayLabel(baseEvent),
        baseEvent,
        incomingEvent,
        baseIndex,
        incomingIndex,
        kind: deepEqual && !repositioned ? 'identical' : kind,
        matchNote,
        changedFields: listChangedStoryEventFields(baseEvent, incomingEvent),
        pick: kind === 'reposition' ? 'base' : 'incoming',
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
    let identicalCount = 0;

    for (const [key, baseItem] of baseByStrict) {
        const incomingItem = incomingByStrict.get(key);
        if (!incomingItem) continue;

        matchedBaseIndices.add(baseItem.index);
        matchedIncomingIndices.add(incomingItem.index);

        if (storyEventsDeepEqual(baseItem.event, incomingItem.event)) {
            identicalCount += 1;
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
 * @param {MergeRow[]} rows
 * @returns {Map<number, MergeRow>}
 */
function rowsByBaseIndex(rows) {
    /** @type {Map<number, MergeRow>} */
    const map = new Map();
    for (const row of rows) {
        if (row.baseIndex != null && !map.has(row.baseIndex)) {
            map.set(row.baseIndex, row);
        }
    }
    return map;
}

/**
 * @param {StoryEventsMergePlan} plan
 * @param {MergeRow[]} rows
 * @returns {object[]}
 */
export function buildMergedStoryEventsFromPlan(plan, rows) {
    const byBaseIndex = rowsByBaseIndex(rows);

    /** @type {object[]} */
    const merged = [];

    for (let i = 0; i < plan.baseOrdered.length; i += 1) {
        const baseEvent = plan.baseOrdered[i];
        if (!baseEvent || typeof baseEvent !== 'object') continue;

        const row = byBaseIndex.get(i);
        if (!row) {
            merged.push(cloneEvent(baseEvent));
            continue;
        }

        if (row.kind === 'conflict' || row.kind === 'reposition') {
            const picked = row.pick === 'incoming' ? row.incomingEvent : row.baseEvent;
            if (picked) merged.push(cloneEvent(picked));
            continue;
        }

        if (row.kind === 'onlyBase') {
            if (row.include !== false) merged.push(cloneEvent(baseEvent));
        }
    }

    for (const row of rows) {
        if (row.kind === 'onlyIncoming' && row.include !== false && row.incomingEvent) {
            merged.push(cloneEvent(row.incomingEvent));
        }
    }

    return merged;
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
