/**
 * NavigationPaginationHelpers — aggregator that re-exports the dock pagination
 * helpers (now sliced into pagination/pageSliderMath.js,
 * pagination/pageNavigation.js, pagination/newsTickerFromGlobe.js) and exposes
 * them on `window.NavigationPaginationHelpers` for consumers that still reach
 * for the global (`platform/shortcuts/keyboardPaginationTriggers.js`,
 * CodexModeService).
 *
 * This file owns no logic of its own — keep it as a stable façade.
 */

import {
    EVENT_PAGE_SLIDER_RESOLUTION,
    normalizedProgressFromSliderValue,
    pageFromSliderProgress,
    sliderValueForPageCenter,
} from '../interface-pagination/dock/pageSliderMath.js';
import {
    clearEventPageSliderSuppressFromGlobe,
    pageHasAtLeastOneFilterMatch,
    resolveWrappedPageSkippingEmptyFilterPages,
    handlePrevPageClick,
    handleNextPageClick,
    handlePageInputChange,
    updatePaginationButtonStates,
} from '../interface-pagination/dock/pageNavigation.js';
import { updateNewsTickerFromGlobe } from '../interface-pagination/dock/newsTickerFromGlobe.js';

export {
    EVENT_PAGE_SLIDER_RESOLUTION,
    normalizedProgressFromSliderValue,
    pageFromSliderProgress,
    sliderValueForPageCenter,
    clearEventPageSliderSuppressFromGlobe,
    pageHasAtLeastOneFilterMatch,
    resolveWrappedPageSkippingEmptyFilterPages,
    handlePrevPageClick,
    handleNextPageClick,
    handlePageInputChange,
    updatePaginationButtonStates,
    updateNewsTickerFromGlobe,
};

if (typeof window !== 'undefined') {
    window.NavigationPaginationHelpers = {
        ...(window.NavigationPaginationHelpers || {}),
        EVENT_PAGE_SLIDER_RESOLUTION,
        normalizedProgressFromSliderValue,
        pageFromSliderProgress,
        sliderValueForPageCenter,
        clearEventPageSliderSuppressFromGlobe,
        pageHasAtLeastOneFilterMatch,
        resolveWrappedPageSkippingEmptyFilterPages,
        handlePrevPageClick,
        handleNextPageClick,
        handlePageInputChange,
        updatePaginationButtonStates,
        updateNewsTickerFromGlobe,
    };
}
