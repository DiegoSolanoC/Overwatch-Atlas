/**
 * Shared HTML for globe pagination slot buttons (desktop: image + title; mobile: numeric only via CSS).
 */

function oneButton(n) {
    return `<button type="button" class="event-number-btn" data-position="${n}" title="Event ${n}">
            <div class="event-number-btn__visual">
                <div class="event-number-btn__img-wrap" aria-hidden="true">
                    <img class="event-number-btn__img" alt="" decoding="async" loading="lazy" width="140" height="105" />
                </div>
                <span class="event-number-btn__name"></span>
                <span class="event-number-btn__key" aria-hidden="true">${n}</span>
                <div
                    class="multi-event-badge event-number-btn__variant-badge"
                    role="button"
                    data-event-index=""
                    title="Switch variant"
                    aria-label="Cycle event variant"
                    tabindex="-1"
                    hidden
                ></div>
            </div>
            <span class="event-number-btn__num">${n}</span>
        </button>`;
}

/**
 * @returns {string} HTML for 10 buttons (no wrapper)
 */
export function getEventThumbNumberButtonsHtml() {
    let html = '';
    for (let i = 1; i <= 10; i++) {
        html += oneButton(i);
    }
    return html;
}

if (typeof window !== 'undefined') {
    window.PaginationThumbMarkup = { getEventThumbNumberButtonsHtml };
}
