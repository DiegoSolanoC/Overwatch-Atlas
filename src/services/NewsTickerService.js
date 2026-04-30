/**
 * NewsTickerService - Handles news ticker display in footer
 * Collects headlines from displayed events and creates a scrolling ticker effect
 */

class NewsTickerService {
    constructor() {
        this.tickerContainer = null;
        this.tickerContent = null;
        this.currentHeadlines = [];
        this.animationId = null;
        this._handlersAttached = false;
    }

    /**
     * Initialize the ticker - create HTML structure
     */
    init() {
        const footer = document.querySelector('footer');
        if (!footer) return;

        // Create ticker container if it doesn't exist
        if (!this.tickerContainer) {
            this.tickerContainer = document.createElement('div');
            this.tickerContainer.id = 'newsTickerContainer';
            this.tickerContainer.className = 'news-ticker-container';
            this.tickerContainer.style.display = 'none'; // Hidden until headlines are available
            
            this.tickerContent = document.createElement('div');
            this.tickerContent.className = 'news-ticker-content';
            this.tickerContainer.appendChild(this.tickerContent);
            
            // Insert into footer
            footer.appendChild(this.tickerContainer);
        }

        // One-time delegated handlers (work with duplicated content clones)
        if (!this._handlersAttached && this.tickerContainer) {
            this._handlersAttached = true;

            this.tickerContainer.addEventListener('click', (e) => {
                const item = e.target?.closest?.('.news-ticker-item');
                if (!item) return;

                const eventIndex = Number.parseInt(item.dataset.eventIndex || '', 10);
                if (!Number.isFinite(eventIndex) || eventIndex < 0) return;

                const variantIndex = Number.parseInt(item.dataset.variantIndex || '-1', 10);

                // Navigate to event using the old system (MenuServiceHelpers)
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

                // Show event slide (prefer standalone object used by the event system)
                if (ss?.showStandaloneEventSlide) {
                    ss.showStandaloneEventSlide(targetEvent, eventIndex);
                } else if (window.MenuServiceHelpers?.showStandaloneEventSlide) {
                    window.MenuServiceHelpers.showStandaloneEventSlide(targetEvent, eventIndex);
                }

                // If headline belongs to a multi-event variant, switch to that variant once slide is ready.
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

            // Keyboard accessibility: Enter/Space triggers click
            this.tickerContainer.addEventListener('keydown', (e) => {
                const item = e.target?.closest?.('.news-ticker-item');
                if (!item) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                item.click();
            });
        }
    }

    /**
     * Collect headlines from displayed events
     * @param {Array} events - Array of events currently displayed
     * @returns {Array<string>} Array of headline strings
     */
    collectHeadlines(events) {
        /** @type {{ text: string, sourceEvent: any, variantIndex: number }[]} */
        const headlines = [];
        
        if (!events || events.length === 0) {
            return headlines;
        }

        events.forEach(event => {
            // Check if event has variants (multi-event)
            if (event.variants && event.variants.length > 0) {
                // Collect headlines from all variants
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
            } else {
                // Single event - collect headlines directly
                if (event.headlines && Array.isArray(event.headlines)) {
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
            }
        });

        // Shuffle headlines for random order
        return this.shuffleArray(headlines);
    }

    /**
     * Shuffle array for random order
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Update ticker with new headlines
     * @param {Array} events - Events currently displayed on the page
     */
    updateTicker(events) {
        if (!this.tickerContainer || !this.tickerContent) {
            this.init();
            if (!this.tickerContainer || !this.tickerContent) {
                return; // Still couldn't initialize
            }
        }

        // Stop current animation
        this.stopAnimation();

        // Remove any existing duplicate content
        const existingDuplicate = this.tickerContainer.querySelector('.news-ticker-content-duplicate');
        if (existingDuplicate) {
            existingDuplicate.remove();
        }

        // Collect headlines from displayed events
        const headlines = this.collectHeadlines(events);
        this.currentHeadlines = headlines;

        // Clear existing content
        this.tickerContent.innerHTML = '';

        if (headlines.length === 0) {
            // No headlines - hide ticker
            this.tickerContainer.style.display = 'none';
            return;
        }

        // Show ticker
        this.tickerContainer.style.display = 'block';

        // Resolve headline -> global event index so clicks can open the correct event.
        const allEvents = (window.eventManager && window.eventManager.events)
            ? window.eventManager.events
            : window.globeController?.dataModel?.getAllEvents?.() || [];

        // Create ticker items with separators
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

            // Add separator between items (except last)
            if (index < headlines.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'news-ticker-separator';
                separator.textContent = ' • ';
                this.tickerContent.appendChild(separator);
            }
        });

        // Only create duplicate if we have content
        if (this.tickerContent.children.length > 0) {
            // Wait a frame for content to be measured
            requestAnimationFrame(() => {
                // Duplicate content for seamless loop
                const duplicate = this.tickerContent.cloneNode(true);
                duplicate.className = 'news-ticker-content news-ticker-content-duplicate';
                duplicate.style.visibility = 'hidden'; // Hidden until animation starts
                
                this.tickerContainer.appendChild(duplicate);
                
                // Start animation after duplicate is added (it will position the duplicate correctly)
                this.startAnimation();
            });
        } else {
            // No content, don't start animation
            this.stopAnimation();
        }
    }

    /**
     * Start the scrolling animation
     */
    startAnimation() {
        // Reset animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const tickerContainer = this.tickerContainer;
        const tickerContent = this.tickerContent;
        
        if (!tickerContainer || !tickerContent) return;

        // Get duplicate element
        const duplicate = tickerContainer.querySelector('.news-ticker-content-duplicate');
        if (!duplicate) {
            // Duplicate not ready yet, wait a bit
            setTimeout(() => this.startAnimation(), 50);
            return;
        }

        // Get content width (wait for layout)
        const contentWidth = tickerContent.offsetWidth;
        if (contentWidth === 0) {
            // Content not measured yet, wait a bit
            setTimeout(() => this.startAnimation(), 50);
            return;
        }

        // Get container width to ensure proper spacing
        const containerWidth = tickerContainer.offsetWidth;
        
        // Calculate spacing: if content is shorter than container, add extra spacing
        // Otherwise, use content width for seamless loop
        const spacing = Math.max(contentWidth, containerWidth + 100); // Add buffer for smooth transition

        // Reset position
        let position = 0;
        tickerContent.style.transform = 'translateX(0px)';
        duplicate.style.transform = `translateX(${spacing}px)`;
        duplicate.style.visibility = 'visible'; // Show duplicate now that it's positioned

        const speed = 0.5; // pixels per frame (adjust for speed)

        const animate = () => {
            position -= speed;
            
            // Get current content width (in case it changed)
            const currentContentWidth = tickerContent.offsetWidth;
            const currentContainerWidth = tickerContainer.offsetWidth;
            const currentSpacing = Math.max(currentContentWidth, currentContainerWidth + 100);
            
            // If we've scrolled past the spacing point, reset position
            if (currentSpacing > 0 && Math.abs(position) >= currentSpacing) {
                position = 0;
            }

            tickerContent.style.transform = `translateX(${position}px)`;
            
            // Move duplicate to follow seamlessly with proper spacing
            if (duplicate && currentSpacing > 0) {
                duplicate.style.transform = `translateX(${position + currentSpacing}px)`;
            }

            this.animationId = requestAnimationFrame(animate);
        };

        // Start animation
        animate();
    }

    /**
     * Stop the animation
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Clear ticker
     */
    clear() {
        if (this.tickerContent) {
            this.tickerContent.innerHTML = '';
        }
        if (this.tickerContainer) {
            this.tickerContainer.style.display = 'none';
        }
        this.stopAnimation();
        this.currentHeadlines = [];
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewsTickerService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.NewsTickerService = NewsTickerService;
}
