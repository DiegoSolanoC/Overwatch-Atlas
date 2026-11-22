/**
 * Current dock page event slice — shared by dock thumbs, World 3D markers,
 * and map-2d lite markers so filter lock state lines up with what the dock shows.
 */

import { getDockTimelineEventsForPagination } from '../../gallery/gallery-mode/heroBiographyDockTimeline.js';

/**
 * @returns {{ events: object[], page: number, eventsPerPage: number, startIndex: number }}
 */
export function getCurrentDockPageEventSlice() {
    const all = getDockTimelineEventsForPagination();
    const pagination = typeof window !== 'undefined' ? window.standaloneDockPagination : null;
    const eventsPerPage = pagination?.eventsPerPage || 10;
    const page = Math.max(
        1,
        pagination?.getCurrentPage?.()
            || (typeof window !== 'undefined' ? window.standaloneEventSlide?.currentPage : null)
            || 1,
    );
    const startIndex = (page - 1) * eventsPerPage;
    return {
        events: all.slice(startIndex, startIndex + eventsPerPage),
        page,
        eventsPerPage,
        startIndex,
    };
}
