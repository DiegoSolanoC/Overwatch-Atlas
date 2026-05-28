/** Expose connection-range helpers to legacy non-module scripts (editor, mirror). */
import * as BioArchiveConnectionRanges from './bioArchiveConnectionRanges.js';
import * as HeroBiographyStoryEventAutocomplete from '../../../hero-biography/hero-biography-mode/heroBiographyEventNameAutocomplete.js';
import {
    resolveLiveArchiveEventDataForSlide,
    resolveLiveArchiveEventIndexForSlide,
} from './bioArchiveSlideEventData.js';

if (typeof window !== 'undefined') {
    window.BioArchiveConnectionRanges = BioArchiveConnectionRanges;
    window.HeroBiographyStoryEventAutocomplete = HeroBiographyStoryEventAutocomplete;
    window.BioArchiveSlideEventData = {
        resolveLiveArchiveEventDataForSlide,
        resolveLiveArchiveEventIndexForSlide,
    };
}
