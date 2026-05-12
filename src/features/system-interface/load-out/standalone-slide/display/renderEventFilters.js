/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's renderEventFilters method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runRenderEventFilters(slide, event) {
            const filtersSection = document.getElementById('eventFiltersSection');
            const filtersList = document.getElementById('eventFiltersList');
            if (!filtersSection || !filtersList) return;

            filtersList.innerHTML = '';

            const CATEGORY_ICON_COUNTRIES = 'src/assets/images/Icons/Filter%20Icons/Location%20Icon.png';

            const lh = window.LocationFlagHelpers;
            const countryFlags =
                lh && typeof lh.collectCountryFlagFilesForEntity === 'function'
                    ? lh.collectCountryFlagFilesForEntity(event)
                    : (() => {
                          const out = [];
                          if (event?.cityDisplayName) {
                              const flagFile = lh?.getResolvedFlagFilename?.(
                                  event.cityDisplayName,
                                  event.locationType || 'earth'
                              );
                              if (flagFile) out.push(flagFile);
                          }
                          const secFn =
                              lh?.getSecondaryCountryFlagFilenamesForEntity?.(event) || [];
                          if (secFn.length) {
                              out.push(...secFn);
                          }
                          return out;
                      })();
            const hasGroupedSecondary =
                lh && typeof lh.getSecondaryCountryPlacesRowsForDisplay === 'function'
                    ? lh.getSecondaryCountryPlacesRowsForDisplay(event).length > 0
                    : false;
            const showCountryChips = countryFlags.length > 0 && !hasGroupedSecondary;

            const createHeader = (label, iconSrc) => {
                const h = document.createElement('h4');
                h.className = 'event-filter-header event-filter-header--category';
                h.innerHTML = `<img class="event-filter-header-icon" src="${iconSrc}" alt="" width="20" height="20" decoding="async"><span class="event-filter-header-label">${label}</span>`;
                return h;
            };

            const createCountryIconTag = (key, displayName) => {
                const tag = document.createElement('span');
                tag.className = 'event-filter-tag event-filter-tag--icon event-filter-tag--clickable event-filter-tag--country';
                tag.title = displayName;
                tag.setAttribute('role', 'button');
                tag.tabIndex = 0;

                const em = window.eventManager;
                const countryFilters = em?.searchCountryFilters;
                if (Array.isArray(countryFilters) && countryFilters.includes(key)) {
                    tag.classList.add('selected');
                }

                const box = document.createElement('span');
                box.className = 'event-filter-image-container';

                const img = document.createElement('img');
                img.className = 'event-filter-icon event-filter-icon--country';
                img.alt = displayName;
                img.loading = 'lazy';
                img.src = lh?.flagSrc?.(key) || `src/assets/images/Filters/Flags/${encodeURIComponent(key)}`;

                box.appendChild(img);
                tag.appendChild(box);

                tag.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const mgr = window.eventManager;
                    if (!mgr?.prependEventManagerSearchTokens || !mgr.openEventsManagePanel) return;
                    mgr.prependEventManagerSearchTokens({ countryFlagFilename: key });
                    mgr.openEventsManagePanel();
                    window.SoundEffectsManager?.play?.('filterConfirm');
                });

                tag.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        tag.click();
                    }
                });

                return tag;
            };

            if (showCountryChips) {
                filtersList.appendChild(createHeader('Relevant Countries:', CATEGORY_ICON_COUNTRIES));
                countryFlags.forEach((flagFile) => {
                    const label = slide.getCountryLabel(flagFile);
                    if (flagFile) filtersList.appendChild(createCountryIconTag(flagFile, label));
                });
            }

            if (hasGroupedSecondary) {
                lh?.updateRelevantLocationsSlideFromSecondaryPlaces?.(event);
            } else {
                lh?.clearRelevantLocationsSlideDom?.();
            }

            lh?.updateStoryFilterPlacesSlideFromEvent?.(event);
            lh?.updateBioConnectionsSlideFromEvent?.(event);

            filtersSection.style.display = showCountryChips ? 'block' : 'none';
}
