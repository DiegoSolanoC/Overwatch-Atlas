/**
 * Collect calendar years referenced in a story timeline event entry.
 * Uses explicit yearStart/yearEnd fields and year tokens in string fields.
 */

const YEAR_TOKEN_RE = /\b(1[89]\d{2}|20\d{2})\b/g;
const YEAR_RANGE_RE = /\b(1\d{3}|20\d{2})\s*[-–—]\s*(1\d{3}|20\d{2})\b/g;

const MIN_YEAR = 1500;
const MAX_YEAR = 2200;

/**
 * @param {number} value
 */
function addYear(value, years) {
    if (!Number.isFinite(value)) return;
    const y = Math.round(value);
    if (y >= MIN_YEAR && y <= MAX_YEAR) years.add(y);
}

/**
 * @param {unknown} event
 * @returns {Set<number>}
 */
export function collectYearsFromEvent(event) {
    /** @type {Set<number>} */
    const years = new Set();
    if (!event || typeof event !== 'object') return years;

    /**
     * @param {string} text
     */
    function scanText(text) {
        if (!text) return;
        const s = String(text);

        let m;
        const rangeRe = new RegExp(YEAR_RANGE_RE.source, 'g');
        while ((m = rangeRe.exec(s)) !== null) {
            addYear(parseInt(m[1], 10), years);
            addYear(parseInt(m[2], 10), years);
        }

        const tokenRe = new RegExp(YEAR_TOKEN_RE.source, 'g');
        while ((m = tokenRe.exec(s)) !== null) {
            addYear(parseInt(m[0], 10), years);
        }
    }

    /**
     * @param {Record<string, unknown>} node
     */
    function walk(node) {
        if (!node || typeof node !== 'object') return;

        if (typeof node.yearStart === 'number') addYear(node.yearStart, years);
        if (typeof node.yearEnd === 'number') addYear(node.yearEnd, years);

        for (const [key, val] of Object.entries(node)) {
            if (key === 'yearStart' || key === 'yearEnd') continue;
            if (typeof val === 'string') scanText(val);
            else if (Array.isArray(val)) val.forEach((item) => walk(item));
            else if (val && typeof val === 'object') walk(/** @type {Record<string, unknown>} */ (val));
        }
    }

    walk(/** @type {Record<string, unknown>} */ (event));
    return years;
}

/**
 * @typedef {{ year: number, role: 'start'|'middle'|'end', ratio: number, x: number }} StoryTimelineYearMarker
 * @typedef {{
 *   startYear: number|null,
 *   endYear: number|null,
 *   markers: StoryTimelineYearMarker[],
 *   span: number,
 *   trackWidth: number,
 * }} StoryTimelineYearLayout
 */

/**
 * Year labels align with the first single-year event of each band after final layout.
 *
 * @param {import('./StoryTimelineEventLayout.js').StoryTimelineYearSegment[]} segments
 * @param {number} trackWidth
 * @param {import('./StoryTimelineEventLayout.js').StoryTimelineEventPosition[]} [positions]
 * @returns {StoryTimelineYearLayout}
 */
export function buildStoryTimelineYearLayoutFromSegments(segments, trackWidth, positions = []) {
    if (!segments.length) {
        return {
            startYear: null,
            endYear: null,
            markers: [],
            span: 0,
            trackWidth,
        };
    }

    const years = segments.map((seg) => seg.year);
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const span = Math.max(1, endYear - startYear);
    const safeWidth = Math.max(1, trackWidth);

    /** @type {StoryTimelineYearMarker[]} */
    const markers = segments.map((seg, index) => {
        const firstIndex = seg.indices[0];
        const placed = firstIndex != null ? positions[firstIndex] : null;
        const x = placed?.x ?? seg.startX;

        return {
            year: seg.year,
            role: index === 0 ? 'start' : index === segments.length - 1 ? 'end' : 'middle',
            ratio: x / safeWidth,
            x,
        };
    });

    return { startYear, endYear, markers, span, trackWidth: safeWidth };
}

/**
 * @param {unknown[]} events
 * @param {{
 *   segments: import('./StoryTimelineEventLayout.js').StoryTimelineYearSegment[],
 *   positions: import('./StoryTimelineEventLayout.js').StoryTimelineEventPosition[],
 *   trackWidth: number,
 * }} eventLayout
 * @returns {StoryTimelineYearLayout}
 */
export function buildStoryTimelineYearLayout(events, eventLayout) {
    if (eventLayout?.segments?.length) {
        return buildStoryTimelineYearLayoutFromSegments(
            eventLayout.segments,
            eventLayout.trackWidth,
            eventLayout.positions,
        );
    }

    return {
        startYear: null,
        endYear: null,
        markers: [],
        span: 0,
        trackWidth: eventLayout?.trackWidth ?? 0,
    };
}
