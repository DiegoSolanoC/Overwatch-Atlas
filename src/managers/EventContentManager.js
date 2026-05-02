/**
 * EventContentManager - Manages event sources and filters display
 */

export class EventContentManager {
    constructor(sceneModel) {
        this.sceneModel = sceneModel;
    }
    
    /**
     * Update event sources section
     * @param {Object} event - Event or variant object
     */
    updateEventSources(event) {
        const eventSourcesSection = document.getElementById('eventSourcesSection');
        const eventSourcesList = document.getElementById('eventSourcesList');
        
        if (event && event.sources && event.sources.length > 0) {
            if (eventSourcesSection && eventSourcesList) {
                eventSourcesList.innerHTML = '';
                
                event.sources.forEach((source) => {
                    const sourceItem = document.createElement('div');
                    sourceItem.className = 'event-source-display-item';
                    
                    if (source.url) {
                        const link = document.createElement('a');
                        link.href = source.url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'event-source-link';
                        link.textContent = source.text;
                        link.addEventListener('click', () => {
                            const sfx = window.SoundEffectsManager;
                            if (sfx && typeof sfx.play === 'function') {
                                sfx.play('filterConfirm');
                            }
                        });
                        sourceItem.appendChild(link);
                    } else {
                        sourceItem.textContent = source.text;
                        sourceItem.className = 'event-source-text';
                    }
                    
                    eventSourcesList.appendChild(sourceItem);
                });
                
                eventSourcesSection.style.display = 'block';
            }
        } else {
            if (eventSourcesSection) {
                eventSourcesSection.style.display = 'none';
            }
        }
    }

    /**
     * Update event filters section
     * @param {Object} event - Event or variant object
     */
    updateEventFilters(event) {
        const eventFiltersSection = document.getElementById('eventFiltersSection');
        const eventFiltersList = document.getElementById('eventFiltersList');

        const CATEGORY_ICON_COUNTRIES = 'assets/images/icons/Location Icon.png';

        const collectCountryFlagFilesForEvent = (ev) => {
            const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
            if (lh && typeof lh.collectCountryFlagFilesForEntity === 'function') {
                return lh.collectCountryFlagFilesForEntity(ev);
            }
            const ordered = [];
            const seen = new Set();
            const loc = (ev && ev.cityDisplayName != null) ? String(ev.cityDisplayName) : '';
            const locType = (ev && ev.locationType) ? String(ev.locationType) : 'earth';
            const primary = lh && typeof lh.getResolvedFlagFilename === 'function'
                ? lh.getResolvedFlagFilename(loc, locType)
                : null;
            if (primary) {
                seen.add(primary);
                ordered.push(primary);
            }
            const sec =
                lh && typeof lh.getSecondaryCountryFlagFilenamesForEntity === 'function'
                    ? lh.getSecondaryCountryFlagFilenamesForEntity(ev)
                    : [];
            sec.forEach((f) => {
                const fn = f != null ? String(f).trim() : '';
                if (fn && !seen.has(fn)) {
                    seen.add(fn);
                    ordered.push(fn);
                }
            });
            return ordered;
        };

        const commonLabelForFlagFile = (flagFile) => {
            const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
            const file = String(flagFile || '').trim();
            if (!file) return '';
            if (map) {
                for (const common of Object.keys(map).sort()) {
                    if (map[common] === file) return common;
                }
            }
            return file.replace(/\.png$/i, '').trim() || file;
        };

        const createCategoryFilterHeader = (labelText, iconSrc) => {
            const h = document.createElement('h4');
            h.className = 'event-filter-header event-filter-header--category';
            const img = document.createElement('img');
            img.className = 'event-filter-header-icon';
            img.src = iconSrc;
            img.alt = '';
            img.decoding = 'async';
            img.width = 20;
            img.height = 20;
            const label = document.createElement('span');
            label.className = 'event-filter-header-label';
            label.textContent = labelText;
            h.appendChild(img);
            h.appendChild(label);
            return h;
        };

        const createCountryIconTag = (flagFile, displayName) => {
            const tag = document.createElement('span');
            tag.className = 'event-filter-tag event-filter-tag--icon event-filter-tag--clickable event-filter-tag--country';
            tag.title = displayName;
            tag.setAttribute('aria-label', displayName);
            tag.setAttribute('role', 'button');
            tag.tabIndex = 0;

            const em = typeof window !== 'undefined' ? window.eventManager : null;
            const countryFilters = em?.searchCountryFilters;
            if (Array.isArray(countryFilters) && countryFilters.includes(flagFile)) {
                tag.classList.add('selected');
            }

            const box = document.createElement('span');
            box.className = 'event-filter-image-container';

            const img = document.createElement('img');
            img.className = 'event-filter-icon event-filter-icon--country';
            img.alt = displayName;
            img.loading = 'lazy';
            const lh = window.LocationFlagHelpers;
            img.src = lh && typeof lh.flagSrc === 'function'
                ? lh.flagSrc(flagFile)
                : `assets/images/flags/${encodeURIComponent(flagFile)}`;

            box.appendChild(img);
            tag.appendChild(box);

            const onActivate = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mgr = window.eventManager;
                if (!mgr?.prependEventManagerSearchTokens || !mgr.openEventsManagePanel) return;
                mgr.prependEventManagerSearchTokens({ countryFlagFilename: flagFile });
                mgr.openEventsManagePanel();
                window.SoundEffectsManager?.play?.('filterConfirm');
            };

            tag.addEventListener('click', onActivate);
            tag.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') onActivate(e);
            });

            return tag;
        };

        if (event && eventFiltersSection && eventFiltersList) {
            eventFiltersList.innerHTML = '';

            const countryFlagFiles = collectCountryFlagFilesForEvent(event);
            const lhSlide = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
            const hasGroupedSecondary =
                lhSlide && typeof lhSlide.getSecondaryCountryPlacesRowsForDisplay === 'function'
                    ? lhSlide.getSecondaryCountryPlacesRowsForDisplay(event).length > 0
                    : false;

            const showCountryChips = countryFlagFiles.length > 0 && !hasGroupedSecondary;
            if (showCountryChips) {
                eventFiltersList.appendChild(
                    createCategoryFilterHeader('Relevant Countries:', CATEGORY_ICON_COUNTRIES)
                );
                countryFlagFiles.forEach((flagFile) => {
                    const label = commonLabelForFlagFile(flagFile);
                    eventFiltersList.appendChild(createCountryIconTag(flagFile, label));
                });
            }

            if (hasGroupedSecondary) {
                lhSlide?.updateRelevantLocationsSlideFromSecondaryPlaces?.(event);
            } else {
                lhSlide?.clearRelevantLocationsSlideDom?.();
            }

            lhSlide?.updateStoryFilterPlacesSlideFromEvent?.(event);
            lhSlide?.updateBioConnectionsSlideFromEvent?.(event);

            eventFiltersSection.style.display = showCountryChips ? 'block' : 'none';
        } else {
            if (eventFiltersSection) {
                eventFiltersSection.style.display = 'none';
            }
            const lhClear = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
            lhClear?.clearRelevantLocationsSlideDom?.();
            lhClear?.clearStoryFilterPlacesSlideDom?.();
            lhClear?.clearBioConnectionsSlideDom?.();
        }
    }
}
