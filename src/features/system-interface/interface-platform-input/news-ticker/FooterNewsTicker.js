/**
 * Footer news ticker: collects headlines from the currently displayed events
 * and scrolls them across the bottom of the screen. Headlines are clickable —
 * tapping one opens its source event (and switches to the right variant if the
 * headline came from a multi-event variant).
 *
 * Lifecycle:
 *   - `init()` builds the container + delegated click/keydown handlers once.
 *   - `updateTicker(events)` is called whenever the page changes; it rebuilds
 *     the content, duplicates it for a seamless marquee, and starts rAF.
 *   - `clear()` empties and hides the ticker.
 *
 * Class name preserved as `NewsTickerService` because consumers reach for
 * `window.NewsTickerService` and `window.newsTickerService`.
 */

class NewsTickerService {
    constructor() {
        this.tickerContainer = null;
        this.tickerContent = null;
        this.currentHeadlines = [];
        this.animationId = null;
        this._handlersAttached = false;
    }

    /** Create the footer ticker container + one-time delegated click/keydown. */
    init() {
        const footer = document.querySelector('footer');
        if (!footer) return;

        if (!this.tickerContainer) {
            this.tickerContainer = document.createElement('div');
            this.tickerContainer.id = 'newsTickerContainer';
            this.tickerContainer.className = 'news-ticker-container';
            /* Hidden until at least one headline is available. */
            this.tickerContainer.style.display = 'none';

            this.tickerContent = document.createElement('div');
            this.tickerContent.className = 'news-ticker-content';
            this.tickerContainer.appendChild(this.tickerContent);

            footer.appendChild(this.tickerContainer);
        }

        if (!this._handlersAttached && this.tickerContainer) {
            this._handlersAttached = true;

            this.tickerContainer.addEventListener('click', (e) => {
                const item = e.target?.closest?.('.news-ticker-item');
                if (!item) return;

                const eventIndex = Number.parseInt(item.dataset.eventIndex || '', 10);
                if (!Number.isFinite(eventIndex) || eventIndex < 0) return;

                const variantIndex = Number.parseInt(item.dataset.variantIndex || '-1', 10);

                const allEvents = (window.eventManager && window.eventManager.events)
                    ? window.eventManager.events
                    : window.globeController?.dataModel?.getAllEvents?.() || [];
                const targetEvent = allEvents[eventIndex];
                if (!targetEvent) return;

                const ss = window.standaloneEventSlide;
                if (ss) {
                    const arch = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                    ss._presentationFromDockTimeline = arch === 'story';
                }

                if (ss?.showStandaloneEventSlide) {
                    ss.showStandaloneEventSlide(targetEvent, eventIndex);
                } else if (window.MenuServiceHelpers?.showStandaloneEventSlide) {
                    window.MenuServiceHelpers.showStandaloneEventSlide(targetEvent, eventIndex);
                }

                /* If headline belongs to a multi-event variant, switch to that variant once slide is ready. */
                if (Number.isFinite(variantIndex) && variantIndex >= 0) {
                    const uiView = window.globeController?.uiView;
                    let attempts = 0;
                    const tryApplyVariant = () => {
                        attempts += 1;
                        const current = uiView?.currentEventData;
                        if (current === targetEvent && current?.variants?.length > variantIndex) {
                            uiView.switchEventVariant(variantIndex, current);
                            return;
                        }
                        if (attempts < 12) setTimeout(tryApplyVariant, 50);
                    };
                    setTimeout(tryApplyVariant, 0);
                }
            });

            this.tickerContainer.addEventListener('keydown', (e) => {
                const item = e.target?.closest?.('.news-ticker-item');
                if (!item) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                item.click();
            });
        }
    }

    collectHeadlines(events) {
        /** @type {{ text: string, sourceEvent: any, variantIndex: number }[]} */
        const headlines = [];
        if (!events || events.length === 0) return headlines;

        events.forEach(event => {
            if (event.variants && event.variants.length > 0) {
                event.variants.forEach((variant, variantIndex) => {
                    if (variant.headlines && Array.isArray(variant.headlines)) {
                        variant.headlines.forEach(headline => {
                            if (headline && headline.trim()) {
                                headlines.push({
                                    text: headline.trim(),
                                    sourceEvent: event,
                                    variantIndex
                                });
                            }
                        });
                    }
                });
            } else if (event.headlines && Array.isArray(event.headlines)) {
                event.headlines.forEach(headline => {
                    if (headline && headline.trim()) {
                        headlines.push({
                            text: headline.trim(),
                            sourceEvent: event,
                            variantIndex: -1
                        });
                    }
                });
            }
        });

        return this.shuffleArray(headlines);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /** @param {Array} events Events currently displayed on the page. */
    updateTicker(events) {
        if (!this.tickerContainer || !this.tickerContent) {
            this.init();
            if (!this.tickerContainer || !this.tickerContent) return;
        }

        this.stopAnimation();

        const existingDuplicate = this.tickerContainer.querySelector('.news-ticker-content-duplicate');
        if (existingDuplicate) existingDuplicate.remove();

        const headlines = this.collectHeadlines(events);
        this.currentHeadlines = headlines;

        this.tickerContent.innerHTML = '';

        if (headlines.length === 0) {
            this.tickerContainer.style.display = 'none';
            return;
        }

        this.tickerContainer.style.display = 'block';

        const allEvents = (window.eventManager && window.eventManager.events)
            ? window.eventManager.events
            : window.globeController?.dataModel?.getAllEvents?.() || [];

        headlines.forEach((headlineObj, index) => {
            const tickerItem = document.createElement('span');
            tickerItem.className = 'news-ticker-item';
            tickerItem.textContent = headlineObj.text;

            const eventIndex = allEvents.indexOf(headlineObj.sourceEvent);
            tickerItem.dataset.eventIndex = String(eventIndex);
            tickerItem.dataset.variantIndex = String(headlineObj.variantIndex ?? -1);
            tickerItem.tabIndex = 0;
            tickerItem.setAttribute('role', 'button');
            tickerItem.setAttribute('aria-label', `Open event: ${headlineObj.text}`);
            this.tickerContent.appendChild(tickerItem);

            if (index < headlines.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'news-ticker-separator';
                separator.textContent = ' \u2022 ';
                this.tickerContent.appendChild(separator);
            }
        });

        if (this.tickerContent.children.length > 0) {
            requestAnimationFrame(() => {
                const duplicate = this.tickerContent.cloneNode(true);
                duplicate.className = 'news-ticker-content news-ticker-content-duplicate';
                /* Hidden until startAnimation positions it. */
                duplicate.style.visibility = 'hidden';
                this.tickerContainer.appendChild(duplicate);
                this.startAnimation();
            });
        } else {
            this.stopAnimation();
        }
    }

    startAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const tickerContainer = this.tickerContainer;
        const tickerContent = this.tickerContent;
        if (!tickerContainer || !tickerContent) return;

        const duplicate = tickerContainer.querySelector('.news-ticker-content-duplicate');
        if (!duplicate) {
            setTimeout(() => this.startAnimation(), 50);
            return;
        }

        const contentWidth = tickerContent.offsetWidth;
        if (contentWidth === 0) {
            setTimeout(() => this.startAnimation(), 50);
            return;
        }

        const containerWidth = tickerContainer.offsetWidth;
        /* If content is shorter than container, pad to "container + 100" so we still loop seamlessly. */
        const spacing = Math.max(contentWidth, containerWidth + 100);

        let position = 0;
        tickerContent.style.transform = 'translateX(0px)';
        duplicate.style.transform = `translateX(${spacing}px)`;
        duplicate.style.visibility = 'visible';

        const speed = 0.5;

        const animate = () => {
            position -= speed;
            const currentContentWidth = tickerContent.offsetWidth;
            const currentContainerWidth = tickerContainer.offsetWidth;
            const currentSpacing = Math.max(currentContentWidth, currentContainerWidth + 100);

            if (currentSpacing > 0 && Math.abs(position) >= currentSpacing) position = 0;

            tickerContent.style.transform = `translateX(${position}px)`;
            if (duplicate && currentSpacing > 0) {
                duplicate.style.transform = `translateX(${position + currentSpacing}px)`;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    clear() {
        if (this.tickerContent) this.tickerContent.innerHTML = '';
        if (this.tickerContainer) this.tickerContainer.style.display = 'none';
        this.stopAnimation();
        this.currentHeadlines = [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewsTickerService;
}

if (typeof window !== 'undefined') {
    window.NewsTickerService = NewsTickerService;
}
