/**
 * Fully close the event info slide (story event or Dialogue Theater info),
 * including image overlay cleanup — same as clicking the panel ×.
 *
 * @returns {boolean} true when a panel was open and close ran
 */
export function closeEventInfoPanelIfOpen() {
    const eventSlide = document.getElementById('eventSlide');
    if (!eventSlide?.classList.contains('open')) return false;

    const slide = typeof window !== 'undefined' ? window.standaloneEventSlide : null;
    if (slide?.hideEventSlide) {
        slide.hideEventSlide();
        return true;
    }

    eventSlide.classList.remove('open');

    const overlay = document.getElementById('eventImageOverlay');
    if (overlay) {
        overlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        delete overlay.dataset.mediaMode;
    }

    const img = document.getElementById('eventImage');
    if (img) {
        img.classList.remove('fade-in', 'fade-out');
        img.style.display = 'none';
        img.style.opacity = '0';
    }

    return true;
}
