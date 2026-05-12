/**
 * Parse the optional year-start/year-end text inputs into a `{ yearStart?, yearEnd? }` shape,
 * or return an `{ error }` row that callers can surface as a validation message.
 *
 * Rules:
 *   - Both empty → returns `{}` (no timeline data).
 *   - Empty start + non-empty end → error (we need a starting year first).
 *   - Non-numeric → error per field.
 *   - When both are present, they're sorted so `yearStart <= yearEnd`. If they end up equal,
 *     `yearEnd` is dropped entirely so the canonical shape is just `{ yearStart }`.
 *
 * @param {string} [yearStartStr]
 * @param {string} [yearEndStr]
 * @returns {{ yearStart?: number, yearEnd?: number } | { error: string }}
 */
export function parseTimelineFormStrings(yearStartStr, yearEndStr) {
    const s = (yearStartStr != null ? String(yearStartStr) : '').trim();
    const e = (yearEndStr != null ? String(yearEndStr) : '').trim();

    if (!s && !e) return {};
    if (!s && e) return { error: 'Enter a first year, or clear all timeline fields.' };

    const yearStartRaw = parseInt(s, 10);
    if (Number.isNaN(yearStartRaw)) {
        return { error: 'First year must be a whole number.' };
    }

    let yearStart = yearStartRaw;
    /** @type {number | undefined} */
    let yearEnd;

    if (!e) {
        yearEnd = undefined;
    } else {
        const parsedEnd = parseInt(e, 10);
        if (Number.isNaN(parsedEnd)) {
            return { error: 'Second year must be a whole number.' };
        }
        const lo = Math.min(yearStartRaw, parsedEnd);
        const hi = Math.max(yearStartRaw, parsedEnd);
        yearStart = lo;
        yearEnd = lo === hi ? undefined : hi;
    }

    return {
        yearStart,
        ...(yearEnd != null ? { yearEnd } : {})
    };
}

/**
 * Stamp `yearStart` / `yearEnd` (and clear legacy `timePercentage`) onto an event from a
 * parsed timeline row.
 *
 * Always strips the three fields first so a re-save without timeline values cleanly removes
 * any stale legacy data.
 *
 * @param {Object} event
 * @param {Object} timeline From parseTimelineFormStrings (no `error` key).
 */
export function applyTimelineToEvent(event, timeline) {
    if (!event || !timeline) return;
    delete event.yearStart;
    delete event.yearEnd;
    delete event.timePercentage;
    if (timeline.yearStart != null) event.yearStart = timeline.yearStart;
    if (timeline.yearEnd != null) event.yearEnd = timeline.yearEnd;
}

/**
 * Stamp `eraName` onto an event. Empty trims to removal so we don't persist empty-string eras.
 *
 * @param {Object} event
 * @param {string} trimmedName Already trimmed; empty removes the field.
 */
export function applyEraNameToEvent(event, trimmedName) {
    if (!event) return;
    delete event.eraName;
    if (trimmedName) event.eraName = trimmedName;
}
