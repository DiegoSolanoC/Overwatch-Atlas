/**
 * Timeline fields on events (optional):
 * - yearStart: integer, first year of range (or the single known year)
 * - yearEnd: optional; when omitted, treated as a single-year span
 * - eraName: optional string label for the historical era
 */

(function () {
    'use strict';

    /**
     * Inclusive calendar-year bounds for an event.
     * @param {Object} event
     * @returns {{ yearStart: number, yearEnd: number } | null}
     */
    function getInclusiveYearBounds(event) {
        if (!event || event.yearStart == null || Number.isNaN(Number(event.yearStart))) return null;
        const a = Math.trunc(Number(event.yearStart));
        const b = event.yearEnd != null && !Number.isNaN(Number(event.yearEnd))
            ? Math.trunc(Number(event.yearEnd))
            : a;
        return {
            yearStart: Math.min(a, b),
            yearEnd: Math.max(a, b),
        };
    }

    /**
     * Midpoint of the span in decimal years (Jan 1 yearStart … end of yearEnd).
     * @param {Object} event
     * @returns {number | null}
     */
    function getEstimatedDecimalYear(event) {
        const b = getInclusiveYearBounds(event);
        if (!b) return null;
        const rangeEndExclusive = b.yearEnd + 1;
        return b.yearStart + (rangeEndExclusive - b.yearStart) * 0.5;
    }

    /**
     * @param {Object} eventData
     * @returns {string}
     */
    function formatTimelineYearRangeOnly(eventData) {
        if (!eventData) return '';
        const ys = eventData.yearStart;
        const ye = eventData.yearEnd;
        if (ys == null || ys === '' || Number.isNaN(Number(ys))) return '';
        const ysn = Math.trunc(Number(ys));
        if (ye != null && ye !== '' && !Number.isNaN(Number(ye)) && Math.trunc(Number(ye)) !== ysn) {
            const lo = Math.min(ysn, Math.trunc(Number(ye)));
            const hi = Math.max(ysn, Math.trunc(Number(ye)));
            return `${lo}–${hi}`;
        }
        return String(ysn);
    }

    /**
     * Panel / hover copy: always a non-empty string. Single year or "lo - hi" with ASCII hyphen;
     * missing start year → "Year Unknown".
     * @param {Object|null|undefined} eventData
     * @returns {string}
     */
    function formatPanelYearRangeLine(eventData) {
        if (!eventData) return 'Year Unknown';
        const ys = eventData.yearStart;
        if (ys == null || ys === '' || Number.isNaN(Number(ys))) return 'Year Unknown';
        const ysn = Math.trunc(Number(ys));
        const ye = eventData.yearEnd;
        if (ye != null && ye !== '' && !Number.isNaN(Number(ye))) {
            const yen = Math.trunc(Number(ye));
            if (yen !== ysn) {
                const lo = Math.min(ysn, yen);
                const hi = Math.max(ysn, yen);
                return `${lo} - ${hi}`;
            }
        }
        return String(ysn);
    }

    /**
     * @param {Object} eventData
     * @returns {string}
     */
    function getEraNameTrimmed(eventData) {
        if (!eventData || eventData.eraName == null) return '';
        const t = String(eventData.eraName).trim();
        return t || '';
    }

    /**
     * Plain-text line for slide / UI (years and era).
     * @param {Object} eventData - Root event object
     * @returns {string}
     */
    function formatTimelineMetaLine(eventData) {
        const yearPart = formatTimelineYearRangeOnly(eventData);
        const eraTrim = getEraNameTrimmed(eventData);
        const parts = [];
        if (yearPart) parts.push(yearPart);
        if (eraTrim) parts.push(eraTrim);
        return parts.join(' · ');
    }

    if (typeof window !== 'undefined') {
        window.EventTimelineHelpers = {
            getInclusiveYearBounds,
            getEstimatedDecimalYear,
            formatTimelineMetaLine,
            formatTimelineYearRangeOnly,
            formatPanelYearRangeLine,
            getEraNameTrimmed,
        };
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            getInclusiveYearBounds,
            getEstimatedDecimalYear,
            formatTimelineMetaLine,
            formatTimelineYearRangeOnly,
            formatPanelYearRangeLine,
            getEraNameTrimmed,
        };
    }
})();
