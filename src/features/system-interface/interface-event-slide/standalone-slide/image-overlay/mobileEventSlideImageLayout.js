/**
 * Mobile event info panel layout when toggling the hero image strip.
 * Hiding the image expands the panel from the header (full-screen);
 * showing the image restores the stacked strip + sheet layout.
 */

export function isMobileEventSlideViewport() {
    return window.innerWidth <= 768;
}

export function syncMobileEventSlideLayoutForImageHidden() {
    const eventSlide = document.getElementById('eventSlide');
    if (!isMobileEventSlideViewport() || !eventSlide?.classList.contains('open')) {
        return;
    }
    eventSlide.classList.add('full-screen');
}

export function syncMobileEventSlideLayoutForImageShown() {
    const eventSlide = document.getElementById('eventSlide');
    if (!isMobileEventSlideViewport() || !eventSlide) {
        return;
    }
    eventSlide.classList.remove('full-screen');
}
