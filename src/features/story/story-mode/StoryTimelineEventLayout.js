/**
 * Place story event previews on the timeline.
 * Each solid (single) year is a variable-width band — width scales with how many
 * single-year events belong to that year. Range events are placed later between
 * their yearStart and yearEnd on the calendar-mapped axis. Final spacing also
 * nudges apart consecutive events whose `eraName` differs.
 */

import { collectYearsFromEvent } from './StoryTimelineYears.js';

const TIMELINE_MIN_YEAR = 1500;
const TIMELINE_MAX_YEAR = 2200;

/** Extra track past start/end so edge cards are not clipped. */
export const TIMELINE_EDGE_BLEED_PX = 220;
/** Minimum horizontal gap between consecutive events (JSON order). */
export const TIMELINE_MIN_EVENT_GAP_PX = 220;
/** Horizontal slot per event inside a year band. */
export const TIMELINE_CARD_SLOT_PX = TIMELINE_MIN_EVENT_GAP_PX;
/** Minimum width for a year that only has one event. */
export const TIMELINE_MIN_YEAR_SEGMENT_PX = TIMELINE_MIN_EVENT_GAP_PX;
/** Extra space when consecutive events belong to different story eras. */
export const TIMELINE_ERA_BOUNDARY_EXTRA_PX = 88;

/**
 * @typedef {'above'|'below'} StoryTimelineEventSide
 * @typedef {{
 *   year: number,
 *   indices: number[],
 *   order: number,
 *   startX: number,
 *   width: number,
 *   endX: number,
 * }} StoryTimelineYearSegment
 * @typedef {{
 *   index: number,
 *   anchorYear: number,
 *   idealX: number,
 *   x: number,
 *   side: StoryTimelineEventSide,
 * }} StoryTimelineEventPosition
 */

/**
 * @param {unknown} event
 * @returns {number|null}
 */
export function getSingleYearFromEvent(event) {
    if (!event || typeof event !== 'object') return null;

    const row = /** @type {Record<string, unknown>} */ (event);
    const ys = typeof row.yearStart === 'number' ? Math.round(row.yearStart) : null;
    const ye = typeof row.yearEnd === 'number' ? Math.round(row.yearEnd) : null;

    if (ys != null && (ye == null || ye === ys)) return ys;
    if (ys == null && ye != null) return ye;
    return null;
}

/**
 * @param {number} year
 */
function clampTimelineYear(year) {
    return Math.max(TIMELINE_MIN_YEAR, Math.min(TIMELINE_MAX_YEAR, Math.round(year)));
}

/**
 * Fix obvious typos (e.g. 5053 when paired with 2051) before placement.
 *
 * @param {number} yearStart
 * @param {number} yearEnd
 */
function sanitizeRangeYears(yearStart, yearEnd) {
    let ys = clampTimelineYear(yearStart);
    let ye = clampTimelineYear(yearEnd);

    if (ye <= ys) {
        return { yearStart: ys, yearEnd: ye };
    }

    if (yearEnd > TIMELINE_MAX_YEAR && yearStart >= 1900 && yearStart < 2100) {
        const tail = yearEnd % 100;
        if (tail >= 0 && tail <= 99) {
            const repaired = 2000 + tail;
            if (repaired > ys && repaired <= TIMELINE_MAX_YEAR) {
                ye = repaired;
            }
        }
    }

    return { yearStart: ys, yearEnd: ye };
}

/**
 * @param {unknown} event
 * @returns {{ yearStart: number, yearEnd: number } | null}
 */
export function getRangeYearsFromEvent(event) {
    if (!event || typeof event !== 'object') return null;

    const row = /** @type {Record<string, unknown>} */ (event);
    const ys = typeof row.yearStart === 'number' ? Math.round(row.yearStart) : null;
    const ye = typeof row.yearEnd === 'number' ? Math.round(row.yearEnd) : null;

    if (ys != null && ye != null && ye !== ys) {
        return sanitizeRangeYears(ys, ye);
    }
    return null;
}

/**
 * @param {unknown} event
 * @returns {number|null}
 */
export function getEventAnchorYear(event) {
    const single = getSingleYearFromEvent(event);
    if (single != null) return single;

    const range = getRangeYearsFromEvent(event);
    if (range) return range.yearStart;

    const years = collectYearsFromEvent(event);
    if (years.size === 0) return null;
    return Math.min(...years);
}

/**
 * Year used for timeline bands — single year, else range start, else earliest mentioned year.
 *
 * @param {unknown} event
 * @returns {number|null}
 */
export function getSegmentYearFromEvent(event) {
    const single = getSingleYearFromEvent(event);
    if (single != null) return single;

    const range = getRangeYearsFromEvent(event);
    if (range) return range.yearStart;

    const years = collectYearsFromEvent(event);
    if (years.size > 0) return Math.min(...years);
    return null;
}

/**
 * @param {unknown} event
 * @returns {string}
 */
function getEraNameFromEvent(event) {
    if (!event || typeof event !== 'object') return '';
    const row = /** @type {Record<string, unknown>} */ (event);
    return String(row.eraName ?? '').trim();
}

/**
 * Year bands in JSON first-appearance order (singles, ranges, and text years).
 *
 * @param {unknown[]} events
 * @returns {Omit<StoryTimelineYearSegment, 'startX'|'width'|'endX'>[]}
 */
export function buildSolidYearSegments(events) {
    /** @type {Map<number, { year: number, indices: number[], order: number }>} */
    const byYear = new Map();
    /** @type {number[]} */
    const order = [];

    if (!Array.isArray(events)) return [];

    for (let i = 0; i < events.length; i++) {
        const year = getSegmentYearFromEvent(events[i]);
        if (year == null) continue;

        if (!byYear.has(year)) {
            byYear.set(year, { year, indices: [], order: order.length });
            order.push(year);
        }
        byYear.get(year).indices.push(i);
    }

    return order.map((year) => byYear.get(year));
}

/**
 * @param {Omit<StoryTimelineYearSegment, 'startX'|'width'|'endX'>[]} segments
 * @param {number} trackPadding
 */
export function assignSegmentGeometry(segments, trackPadding) {
    let x = trackPadding + TIMELINE_EDGE_BLEED_PX;

    /** @type {StoryTimelineYearSegment[]} */
    const resolved = [];

    for (const seg of segments) {
        const count = Math.max(1, seg.indices.length);
        const width = Math.max(TIMELINE_MIN_YEAR_SEGMENT_PX, count * TIMELINE_CARD_SLOT_PX);
        const startX = x;
        const endX = x + width;
        resolved.push({
            ...seg,
            startX,
            width,
            endX,
        });
        x = endX;
    }

    const tailPad = TIMELINE_EDGE_BLEED_PX + trackPadding;
    const trackWidth = x + tailPad;

    return { segments: resolved, trackWidth };
}

/**
 * Map a calendar year to X using solid-year anchors (calendar order) on the band axis.
 *
 * @param {number} year
 * @param {StoryTimelineYearSegment[]} segments
 */
export function calendarYearToX(year, segments) {
    if (!segments.length) return TIMELINE_EDGE_BLEED_PX;

    /** @type {Map<number, StoryTimelineYearSegment>} */
    const byYear = new Map(segments.map((seg) => [seg.year, seg]));

    if (byYear.has(year)) {
        const seg = byYear.get(year);
        return seg.startX + seg.width / 2;
    }

    const anchors = [...segments]
        .map((seg) => ({ year: seg.year, x: seg.startX + seg.width / 2 }))
        .sort((a, b) => a.year - b.year);

    if (year <= anchors[0].year) {
        return anchors[0].x;
    }
    if (year >= anchors[anchors.length - 1].year) {
        return anchors[anchors.length - 1].x;
    }

    for (let i = 0; i < anchors.length - 1; i++) {
        const left = anchors[i];
        const right = anchors[i + 1];
        if (year >= left.year && year <= right.year) {
            const span = right.year - left.year;
            if (span <= 0) return left.x;
            const t = (year - left.year) / span;
            return left.x + t * (right.x - left.x);
        }
    }

    return anchors[anchors.length - 1].x;
}

/**
 * @param {StoryTimelineYearSegment} seg
 * @param {number} slotIndex 0-based position within the year band
 * @param {number} slotCount
 */
function xInYearSegment(seg, slotIndex, slotCount) {
    const slotWidth = seg.width / slotCount;
    return seg.startX + slotIndex * slotWidth + slotWidth / 2;
}

/**
 * Place every event in its year band, evenly spaced in JSON order.
 * Singles and range events share the same band — avoids calendar midpoint
 * jumps that blow gaps within the same year.
 *
 * @param {unknown[]} events
 * @param {StoryTimelineYearSegment[]} segments
 * @returns {StoryTimelineEventPosition[]}
 */
function placeEventsInYearBands(events, segments) {
    /** @type {StoryTimelineEventPosition[]} */
    const positions = new Array(events.length);

    for (const seg of segments) {
        const count = seg.indices.length;
        if (!count) continue;

        for (let j = 0; j < count; j++) {
            const index = seg.indices[j];
            const x = xInYearSegment(seg, j, count);
            const single = getSingleYearFromEvent(events[index]);
            const range = getRangeYearsFromEvent(events[index]);
            const anchorYear = single ?? (range
                ? Math.round((range.yearStart + range.yearEnd) / 2)
                : seg.year);

            positions[index] = {
                index,
                anchorYear,
                idealX: x,
                x,
                side: index % 2 === 0 ? 'above' : 'below',
            };
        }
    }

    return positions;
}

/**
 * @param {unknown[]} events
 * @param {StoryTimelineYearSegment[]} segments
 * @param {StoryTimelineEventPosition[]} positions
 */
function placeRemainingEvents(events, segments, positions) {
    let carryYear = segments[0]?.year ?? null;

    for (let i = 0; i < events.length; i++) {
        if (positions[i]) {
            carryYear = positions[i].anchorYear;
            continue;
        }

        const years = collectYearsFromEvent(events[i]);
        const year = years.size > 0 ? Math.min(...years) : carryYear;
        const x = year != null
            ? calendarYearToX(year, segments)
            : null;

        positions[i] = {
            index: i,
            anchorYear: year ?? carryYear ?? 0,
            idealX: x,
            x: x ?? 0,
            side: i % 2 === 0 ? 'above' : 'below',
        };

        carryYear = positions[i].anchorYear;
    }
}

/**
 * Walk JSON order — even spacing, with a modest bump when the calendar year jumps forward
 * and a slight extra gap when the story era changes.
 *
 * @param {StoryTimelineEventPosition[]} positions
 * @param {unknown[]} events
 */
function enforceJsonOrderMonotonicLayout(positions, events) {
    const gap = TIMELINE_MIN_EVENT_GAP_PX;
    /** @type {number|null} */
    let prevX = null;
    /** @type {number|null} */
    let prevYear = null;
    /** @type {string|null} */
    let prevEra = null;

    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        if (!pos) continue;

        const curYear = getSegmentYearFromEvent(events[i]);
        const curEra = getEraNameFromEvent(events[i]);
        let x;

        if (prevX == null) {
            x = Number.isFinite(pos.x) && pos.x > 0
                ? pos.x
                : TIMELINE_EDGE_BLEED_PX + gap;
        } else {
            let step = gap;
            if (prevYear != null && curYear != null && curYear > prevYear + 1) {
                step = gap * 2;
            }
            if (prevEra && curEra && prevEra !== curEra) {
                step += TIMELINE_ERA_BOUNDARY_EXTRA_PX;
            }
            x = prevX + step;
        }

        pos.x = x;
        pos.idealX = x;
        pos.side = i % 2 === 0 ? 'above' : 'below';
        prevX = x;
        if (curYear != null) prevYear = curYear;
        if (curEra) prevEra = curEra;
    }
}

/**
 * @param {unknown[]} events
 * @param {number} trackPadding
 */
export function buildStoryTimelineEventLayout(events, trackPadding) {
    const rawSegments = buildSolidYearSegments(events);

    if (!Array.isArray(events) || events.length === 0 || rawSegments.length === 0) {
        const emptyWidth = trackPadding * 2 + TIMELINE_EDGE_BLEED_PX * 2;
        return {
            positions: [],
            segments: [],
            trackWidth: emptyWidth,
        };
    }

    const { segments, trackWidth: baseTrackWidth } = assignSegmentGeometry(rawSegments, trackPadding);
    const positions = placeEventsInYearBands(events, segments);
    placeRemainingEvents(events, segments, positions);
    enforceJsonOrderMonotonicLayout(positions, events);

    let maxX = baseTrackWidth;
    for (const pos of positions) {
        if (pos && pos.x > maxX) maxX = pos.x;
    }

    const tailPad = TIMELINE_EDGE_BLEED_PX + TIMELINE_CARD_SLOT_PX / 2 + trackPadding;
    const trackWidth = Math.max(baseTrackWidth, maxX + tailPad);

    return { positions, segments, trackWidth };
}

/**
 * @param {number} ratio
 * @param {number} trackPadding
 * @param {{ trackWidth: number }} layout
 */
export function yearRatioToX(ratio, trackPadding, layout) {
    const width = Math.max(1, layout.trackWidth - trackPadding * 2);
    const clamped = Math.max(0, Math.min(1, ratio));
    return trackPadding + clamped * width;
}
