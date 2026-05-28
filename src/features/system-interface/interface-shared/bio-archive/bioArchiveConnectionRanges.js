/**
 * Story-event ranges on bio archive `connections[]` rows (same idea as hero look ranges).
 *
 * Each connection is still one linked entity (`kind` + `name`). Optional `ranges[]` holds
 * periods when the relationship text applied:
 *
 *   - `startEvent` — story event name when this wording begins (required per range).
 *   - `endEvent` — when it stops; omitted / empty = still active through the latest story entry.
 *
 * Legacy top-level `reasoningSubjectToLinked` / `reasoningLinkedToSubject` are kept in sync
 * with the effective “current” range (last open-ended range, else last range) for older UI.
 */

/**
 * @typedef {{
 *   startEvent: string,
 *   endEvent?: string,
 *   reasoningSubjectToLinked: string,
 *   reasoningLinkedToSubject: string,
 * }} BioArchiveConnectionRange
 */

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizeStoryEventNameForMatch(name) {
    return String(name || '')
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase();
}

/**
 * @param {unknown} raw
 * @returns {{ toLinked: string, toSubject: string }}
 */
export function directionalTextsFromConnectionRange(raw) {
    if (!raw || typeof raw !== 'object') {
        return { toLinked: '', toSubject: '' };
    }
    let toLinked =
        raw.reasoningSubjectToLinked != null ? String(raw.reasoningSubjectToLinked).trim() : '';
    let toSubject =
        raw.reasoningLinkedToSubject != null ? String(raw.reasoningLinkedToSubject).trim() : '';
    const legacy = raw.reasoning != null ? String(raw.reasoning).trim() : '';
    if (!toLinked && !toSubject && legacy) {
        toLinked = legacy;
        toSubject = legacy;
    }
    return { toLinked, toSubject };
}

/**
 * @param {unknown} raw
 * @returns {BioArchiveConnectionRange | null}
 */
export function normalizeBioConnectionRange(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const startEvent = String(raw.startEvent ?? '').trim();
    if (!startEvent) return null;

    const endEvent = raw.endEvent != null ? String(raw.endEvent).trim() : '';
    const { toLinked, toSubject } = directionalTextsFromConnectionRange(raw);

    /** @type {BioArchiveConnectionRange} */
    const out = {
        startEvent,
        reasoningSubjectToLinked: toLinked,
        reasoningLinkedToSubject: toSubject,
    };
    if (endEvent) out.endEvent = endEvent;
    return out;
}

/**
 * @param {unknown} raw
 * @returns {BioArchiveConnectionRange[]}
 */
export function normalizeBioConnectionRanges(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length; i += 1) {
        const row = normalizeBioConnectionRange(raw[i]);
        if (row) out.push(row);
    }
    return out;
}

/**
 * @param {BioArchiveConnectionRange | null | undefined} range
 * @returns {boolean}
 */
export function connectionRangeHasNarrativeText(range) {
    if (!range) return false;
    const { toLinked, toSubject } = directionalTextsFromConnectionRange(range);
    return Boolean(toLinked || toSubject);
}

/**
 * @param {object | null | undefined} connection
 * @returns {boolean}
 */
export function connectionRowHasNarrativeText(connection) {
    if (!connection) return false;
    const ranges = connection.ranges;
    if (Array.isArray(ranges)) {
        for (let i = 0; i < ranges.length; i += 1) {
            if (connectionRangeHasNarrativeText(ranges[i])) return true;
        }
    }
    const { toLinked, toSubject } = directionalTextsFromConnectionRange(connection);
    return Boolean(toLinked || toSubject);
}

/**
 * Open-ended range wins; otherwise last range in file order.
 * @param {object} connection
 * @returns {BioArchiveConnectionRange | null}
 */
export function getEffectiveBioConnectionRange(connection) {
    if (!connection || !Array.isArray(connection.ranges) || !connection.ranges.length) {
        return null;
    }
    const ranges = connection.ranges;
    for (let i = ranges.length - 1; i >= 0; i -= 1) {
        const r = ranges[i];
        if (r && !String(r.endEvent || '').trim()) return r;
    }
    return ranges[ranges.length - 1] || null;
}

/**
 * Copy effective range reasoning onto legacy top-level fields (for slide HTML / editor).
 * @param {object} connection
 */
export function syncLegacyReasoningFieldsFromRanges(connection) {
    if (!connection || typeof connection !== 'object') return;
    const effective = getEffectiveBioConnectionRange(connection);
    if (!effective) return;
    connection.reasoningSubjectToLinked = effective.reasoningSubjectToLinked;
    connection.reasoningLinkedToSubject = effective.reasoningLinkedToSubject;
}

/**
 * @param {object} connection
 * @param {number} eventIndex
 * @param {(eventName: string) => number} indexByEventName
 * @returns {BioArchiveConnectionRange | null}
 */
/**
 * @param {object[]} events
 * @returns {(eventName: string) => number}
 */
export function buildStoryEventIndexByName(events) {
    /** @type {Map<string, number>} */
    const map = new Map();
    const list = Array.isArray(events) ? events : [];
    for (let i = 0; i < list.length; i += 1) {
        const name = String(list[i]?.name || '')
            .replace(/<[^>]*>/g, '')
            .trim();
        if (!name) continue;
        const key = normalizeStoryEventNameForMatch(name);
        if (!map.has(key)) map.set(key, i);
    }
    return (eventName) => {
        const key = normalizeStoryEventNameForMatch(eventName);
        return map.has(key) ? map.get(key) : -1;
    };
}

/**
 * Inclusive overlap between a story range and a timeline index span (e.g. one dock page).
 * @param {BioArchiveConnectionRange} range
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {(eventName: string) => number} indexByEventName
 */
export function timelineRangeOverlapsIndexSpan(range, spanStart, spanEnd, indexByEventName) {
    if (!range?.startEvent || spanStart < 0 || spanEnd < spanStart) return false;
    const startIdx = indexByEventName(range.startEvent);
    if (startIdx < 0) return false;

    const endName = String(range.endEvent || '').trim();
    let rangeEndIdx = Number.POSITIVE_INFINITY;
    if (endName) {
        rangeEndIdx = indexByEventName(endName);
        if (rangeEndIdx < 0) return false;
    }

    return spanStart <= rangeEndIdx && spanEnd >= startIdx;
}

/**
 * @param {object} connection
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {(eventName: string) => number} indexByEventName
 * @returns {boolean}
 */
export function connectionActiveForTimelineIndexSpan(
    connection,
    spanStart,
    spanEnd,
    indexByEventName,
) {
    const ranges = connection?.ranges;
    if (!Array.isArray(ranges) || !ranges.length) return true;
    for (let i = 0; i < ranges.length; i += 1) {
        if (timelineRangeOverlapsIndexSpan(ranges[i], spanStart, spanEnd, indexByEventName)) {
            return true;
        }
    }
    return false;
}

export function resolveConnectionRangeAtTimelineIndex(connection, eventIndex, indexByEventName) {
    const ranges = connection?.ranges;
    if (!Array.isArray(ranges) || !ranges.length || eventIndex < 0) return null;

    let match = null;
    for (let i = 0; i < ranges.length; i += 1) {
        const r = ranges[i];
        if (!r?.startEvent) continue;
        const startIdx = indexByEventName(r.startEvent);
        if (startIdx < 0 || eventIndex < startIdx) continue;

        const endName = String(r.endEvent || '').trim();
        if (endName) {
            const endIdx = indexByEventName(endName);
            if (endIdx >= 0 && eventIndex > endIdx) continue;
        }

        match = r;
    }
    return match;
}

/**
 * @param {unknown} item
 * @param {(name: string) => string} [sanitizeName]
 * @returns {object | null}
 */
export function normalizeBioArchiveConnectionRow(item, sanitizeName) {
    const sanitize =
        typeof sanitizeName === 'function'
            ? sanitizeName
            : (n) => String(n == null ? '' : n).trim();

    let kind = String(item?.kind || '').toLowerCase();
    if (kind === 'character') kind = 'hero';
    if (kind !== 'faction' && kind !== 'npc') kind = 'hero';

    const name = sanitize(item?.name);
    let reasoningSubjectToLinked =
        item?.reasoningSubjectToLinked != null ? String(item.reasoningSubjectToLinked).trim() : '';
    let reasoningLinkedToSubject =
        item?.reasoningLinkedToSubject != null ? String(item.reasoningLinkedToSubject).trim() : '';
    const legacy = item?.reasoning != null ? String(item.reasoning).trim() : '';
    if (!reasoningSubjectToLinked && !reasoningLinkedToSubject && legacy) {
        reasoningSubjectToLinked = legacy;
        reasoningLinkedToSubject = legacy;
    }

    const laneRaw = String(item?.thisEntryLane ?? '').trim().toUpperCase();
    const thisEntryLane = laneRaw === 'B' ? 'B' : 'A';
    const showInCodex = item?.showInCodex === true;
    const ranges = normalizeBioConnectionRanges(item?.ranges);

    /** @type {Record<string, unknown>} */
    const out = {
        kind,
        name,
        reasoningSubjectToLinked,
        reasoningLinkedToSubject,
        thisEntryLane,
    };
    if (showInCodex) out.showInCodex = true;
    if (ranges.length) out.ranges = ranges;

    if (ranges.length) syncLegacyReasoningFieldsFromRanges(out);

    return out;
}

/**
 * Mirror one range onto the reciprocal connection (swap directional wording).
 * @param {BioArchiveConnectionRange} range
 * @returns {BioArchiveConnectionRange}
 */
export function mirrorBioConnectionRange(range) {
    const startEvent = String(range.startEvent || '').trim();
    /** @type {BioArchiveConnectionRange} */
    const out = {
        startEvent,
        reasoningSubjectToLinked: String(range.reasoningLinkedToSubject || '').trim(),
        reasoningLinkedToSubject: String(range.reasoningSubjectToLinked || '').trim(),
    };
    const endEvent = String(range.endEvent || '').trim();
    if (endEvent) out.endEvent = endEvent;
    return out;
}
