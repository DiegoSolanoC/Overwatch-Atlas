/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's createInlineEditor method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runCreateInlineEditor(slide) {
            const editor = document.createElement('div');
            editor.id = 'eventSlideInlineEditor';
            editor.className = 'event-slide-inline-editor';
            editor.innerHTML = `
                <section class="event-slide-inline-editor__section event-slide-inline-editor__section--placement" aria-labelledby="eventSlideEditPlacementHeading">
                    <h4 id="eventSlideEditPlacementHeading" class="event-filter-header">Placement</h4>
                    <div class="event-slide-inline-editor__placement" id="eventSlidePlacementBlock">
                        <div class="event-slide-inline-editor__row" id="eventSlideCityLookupRow">
                            <label class="event-slide-inline-editor__label" for="eventSlideEditCityLookup">City name (for coordinate lookup)</label>
                            <div class="event-slide-inline-editor__lookup-row">
                                <input class="event-slide-inline-editor__input event-slide-inline-editor__input--grow" id="eventSlideEditCityLookup" type="text" spellcheck="true" autocomplete="on" />
                                <label class="event-slide-inline-editor__inline-check"><input type="checkbox" id="eventSlideUseCodeLookup" checked /> Code lookup</label>
                                <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideLookupCityBtn">Lookup</button>
                            </div>
                        </div>
                        <div class="event-slide-inline-editor__row">
                            <div class="event-slide-inline-editor__label">Location type</div>
                            <div class="event-slide-inline-editor__loc-types" role="group" aria-label="Location type">
                                <button type="button" class="event-slide-loc-type-btn active" data-location-type="earth">Earth</button>
                                <button type="button" class="event-slide-loc-type-btn" data-location-type="moon">Moon</button>
                                <button type="button" class="event-slide-loc-type-btn" data-location-type="mars">Mars</button>
                                <button type="button" class="event-slide-loc-type-btn" data-location-type="station">Station</button>
                                <button type="button" class="event-slide-loc-type-btn" data-location-type="marsShip">Ship</button>
                            </div>
                            <input type="hidden" id="eventSlideEditLocationType" value="earth" />
                        </div>
                        <div class="event-slide-inline-editor__year-row" id="eventSlideLatLonRow" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; margin-bottom: 10px;">
                            <div class="event-slide-inline-editor__year-cell">
                                <label class="event-slide-inline-editor__label" for="eventSlideEditLat">Latitude</label>
                                <input class="event-slide-inline-editor__input" id="eventSlideEditLat" type="number" step="any" autocomplete="off" />
                            </div>
                            <div class="event-slide-inline-editor__year-cell">
                                <label class="event-slide-inline-editor__label" for="eventSlideEditLon">Longitude</label>
                                <input class="event-slide-inline-editor__input" id="eventSlideEditLon" type="number" step="any" autocomplete="off" />
                            </div>
                        </div>
                        <div class="event-slide-inline-editor__year-row" id="eventSlideXyRow" style="display: none; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; margin-bottom: 10px;">
                            <div class="event-slide-inline-editor__year-cell">
                                <label class="event-slide-inline-editor__label" for="eventSlideEditX">X (0—100)</label>
                                <input class="event-slide-inline-editor__input" id="eventSlideEditX" type="number" step="any" min="0" max="100" autocomplete="off" />
                            </div>
                            <div class="event-slide-inline-editor__year-cell">
                                <label class="event-slide-inline-editor__label" for="eventSlideEditY">Y (0—100)</label>
                                <input class="event-slide-inline-editor__input" id="eventSlideEditY" type="number" step="any" min="0" max="100" autocomplete="off" />
                            </div>
                        </div>
                    </div>
                    <div class="event-slide-inline-editor__row">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditCityDisplayName">Location label</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditCityDisplayName" type="text" spellcheck="true" autocomplete="on" />
                    </div>
                    <div class="event-slide-inline-editor__row event-slide-inline-editor__year-row">
                        <div class="event-slide-inline-editor__year-cell">
                            <label class="event-slide-inline-editor__label" for="eventSlideEditYearStart">First year</label>
                            <input class="event-slide-inline-editor__input" id="eventSlideEditYearStart" type="number" step="1" />
                        </div>
                        <div class="event-slide-inline-editor__year-cell">
                            <label class="event-slide-inline-editor__label" for="eventSlideEditYearEnd">Second year (optional)</label>
                            <input class="event-slide-inline-editor__input" id="eventSlideEditYearEnd" type="number" step="1" />
                        </div>
                    </div>
                    <div class="event-slide-inline-editor__row">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditEraName">Era name (optional)</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditEraName" type="text" spellcheck="true" autocomplete="on" />
                    </div>
                </section>
                <section class="event-slide-inline-editor__section event-slide-inline-editor__section--description" aria-labelledby="eventSlideEditStoryHeading">
                    <h4 id="eventSlideEditStoryHeading" class="event-filter-header">Story</h4>
                    <div class="event-slide-inline-editor__row" id="eventSlideEditDescriptionContainer">
                        <label class="event-slide-inline-editor__label">Description</label>
                    </div>
                </section>
                <section class="event-slide-inline-editor__section" id="eventSlideEditCommentaryRow" aria-labelledby="eventSlideEditCommentaryHeading">
                    <h4 id="eventSlideEditCommentaryHeading" class="event-filter-header">Commentary</h4>
                    <p class="event-slide-inline-editor__hint">Dialogue Theater interactions that comment on this entry. Predictive names; play opens the interaction (Back returns here).</p>
                    <div class="event-slide-inline-editor__sources" id="eventSlideEditCommentary"></div>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddCommentaryBtn">+ Commentary</button>
                    </div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditPlacesHeading">
                    <h4 id="eventSlideEditPlacesHeading" class="event-filter-header event-filter-header--category">
                        <img class="event-filter-header-icon" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="36" height="36" decoding="async" />
                        <span class="event-filter-header-label">Relevant locations</span>
                    </h4>
                    <p class="event-slide-inline-editor__hint">Add one row per group. Reorder with ↑ / ↓. Each row: group label, countries (comma-separated for multiple flags), and why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSecondaryCountryPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditSecondaryCountryPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Secondary country groups"></div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditHeroesHeading">
                    <h4 id="eventSlideEditHeroesHeading" class="event-filter-header event-filter-header--category">
                        <img class="event-filter-header-icon" src="src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png" alt="" width="36" height="36" decoding="async" />
                        <span class="event-filter-header-label">Relevant heroes</span>
                    </h4>
                    <p class="event-slide-inline-editor__hint">Same pattern as countries: group label, comma-separated heroes, why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddHeroFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditHeroFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Hero groups"></div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditFactionsHeading">
                    <h4 id="eventSlideEditFactionsHeading" class="event-filter-header event-filter-header--category">
                        <img class="event-filter-header-icon" src="src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png" alt="" width="36" height="36" decoding="async" />
                        <span class="event-filter-header-label">Relevant factions</span>
                    </h4>
                    <p class="event-slide-inline-editor__hint">Group label, comma-separated factions, why they matter. ☆ marks a group as priority on the map badge.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddFactionFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditFactionFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Faction groups"></div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditNpcsHeading">
                    <h4 id="eventSlideEditNpcsHeading" class="event-filter-header event-filter-header--category">
                        <img class="event-filter-header-icon" src="src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png" alt="" width="36" height="36" decoding="async" />
                        <span class="event-filter-header-label">Relevant NPCs</span>
                    </h4>
                    <p class="event-slide-inline-editor__hint">Group label, comma-separated NPCs, why they matter. ☆ marks a group as priority on the map badge (shown before heroes).</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddNpcFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditNpcFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="NPC groups"></div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditHeadlinesHeading">
                    <h4 id="eventSlideEditHeadlinesHeading" class="event-filter-header">Headlines</h4>
                    <div class="event-slide-inline-editor__row">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditHeadlines">One per line</label>
                        <textarea class="event-slide-inline-editor__textarea" id="eventSlideEditHeadlines" rows="4" spellcheck="true"></textarea>
                    </div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditSourcesHeading">
                    <h4 id="eventSlideEditSourcesHeading" class="event-filter-header">Sources</h4>
                    <div class="event-slide-inline-editor__sources" id="eventSlideEditSources"></div>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSourceBtn">+ Source</button>
                    </div>
                </section>
                <section class="event-slide-inline-editor__section" aria-labelledby="eventSlideEditVariantsHeading">
                    <h4 id="eventSlideEditVariantsHeading" class="event-filter-header">Variants</h4>
                    <div class="event-slide-inline-variant-bar" id="eventSlideInlineVariantBar"></div>
                    <p class="event-slide-inline-editor__hint">Switch tabs to edit another variant. + / - add or remove (saved when you click Save).</p>
                </section>
            `;
            
            // Wire add source button
            setTimeout(() => {
                const addBtn = document.getElementById('eventSlideAddSourceBtn');
                addBtn?.addEventListener('click', () => slide.addSourceRow());

                const addCommentaryBtn = document.getElementById('eventSlideAddCommentaryBtn');
                addCommentaryBtn?.addEventListener('click', () => slide.addCommentaryRow());
                
                // Wire variant bar
                const variantBar = document.getElementById('eventSlideInlineVariantBar');
                if (variantBar) {
                    variantBar.addEventListener('click', (e) => {
                        const btn = e.target.closest('button');
                        if (!btn || !slide.isEditing) return;
                        if (btn.dataset.role === 'variant-tab') {
                            const idx = parseInt(btn.dataset.variantIndex, 10);
                            if (!Number.isNaN(idx)) slide.onVariantTabSelect(idx);
                        } else if (btn.dataset.role === 'add-variant') {
                            slide.onVariantAdd();
                        } else if (btn.dataset.role === 'remove-variant') {
                            slide.onVariantRemove();
                        } else if (btn.dataset.role === 'make-primary') {
                            slide.onVariantMakePrimary();
                        }
                    });
                }
                
                // Wire location type buttons
                const locBtns = document.querySelectorAll('.event-slide-loc-type-btn');
                locBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const hid = document.getElementById('eventSlideEditLocationType');
                        if (hid) hid.value = btn.dataset.locationType || 'earth';
                        slide.syncLocationTypeUI();
                    });
                });
                
                // Wire city lookup button
                const lookupBtn = document.getElementById('eventSlideLookupCityBtn');
                lookupBtn?.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.eventManager?.lookupCitySlide) {
                        window.eventManager.lookupCitySlide();
                    }
                });
            }, 0);
            
            return editor;
}
