import { setLoadingAssetImageSrc } from '../atlas-ui/loadingAssetSlot.js';

/**
 * @returns {{ plainName: string, imagePath: string|null } | null}
 */
export function getLatestDockEventPreview() {
    const dock = window.eventManager?.getDockTimelineEvents?.() || [];
    if (!dock.length) return null;

    const event = dock[dock.length - 1];
    const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
    const displayEvent =
        isMultiEvent && event.variants[0] ? { ...event, ...event.variants[0] } : event;
    const plainName = displayEvent.name || event.name || 'Latest event';

    let imagePath = null;
    if (window.NavigationImageHelpers?.getEventImagePath) {
        imagePath = window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
    } else if (window.eventManager?.getEventImagePath) {
        imagePath = window.eventManager.getEventImagePath(
            displayEvent.name,
            displayEvent.image,
            'story',
        );
    } else {
        imagePath = displayEvent.image || displayEvent.imagePath || null;
    }

    return { plainName, imagePath };
}

/** Sync See the Latest tile art with the last dock timeline entry. */
export function refreshSeeTheLatestMenuPreview() {
    const btn = document.getElementById('seeTheLatestBtn');
    if (!btn) return;

    const preview = getLatestDockEventPreview();
    const img = btn.querySelector('.main-menu-image-container img');
    const wrap = btn.querySelector('.main-menu-image-container');

    if (img) {
        setLoadingAssetImageSrc(img, preview?.imagePath ?? null, { wrap });
    }

    btn.title = preview ? `See the Latest — ${preview.plainName}` : 'See the Latest';
    btn.toggleAttribute('disabled', !preview);
    btn.setAttribute('aria-disabled', preview ? 'false' : 'true');
}
