/**
 * Resolve which archive chrome the open event slide should use.
 * Prefer an explicit peek/presentation override so story-mode chip opens can
 * show bio entries without switching EventManager off `story`.
 *
 * @param {{ _presentationArchiveSource?: string|null, _presentationFromDockTimeline?: boolean } | null | undefined} slide
 * @returns {string}
 */
export function resolveEventSlideArchiveSource(slide) {
    const override =
        slide && slide._presentationArchiveSource != null
            ? String(slide._presentationArchiveSource).trim()
            : '';
    if (override) return override;
    if (slide?._presentationFromDockTimeline) return 'story';
    return window.eventManager?.dataService?.getArchiveSource?.() || 'story';
}
