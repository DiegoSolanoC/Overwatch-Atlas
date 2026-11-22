/**
 * Build and mount the filters panel DOM (`#filtersPanel`).
 *
 * Pure DOM factory. The four-tab structure (Heroes / Factions / NPCs /
 * Countries), the search box, and the Clear / Confirm buttons are static
 * HTML; tab switching, chip population, and search filtering are owned by
 * `FiltersPanel.js` and the sibling `buttons/` / `tabs/` / `wiring/` modules.
 *
 * Layout: left = search + tabs row (4 categories + Clear); right = selection counts.
 * Chip size A−/A/A+ mounts under the title (same placement as info text size).
 *
 * The panel attaches to `.layout-container` when present so it overlays the
 * main stage inside that positioned box; it falls back to `<body>` otherwise.
 *
 * @returns {HTMLElement} The newly created `#filtersPanel`.
 */
export function createFiltersPanel() {
    const panel = document.createElement('div');
    panel.id = 'filtersPanel';
    panel.className = 'filters-panel';
    panel.innerHTML = `
        <div class="filters-panel-close" id="filtersPanelClose" role="button" tabindex="0" aria-label="Close"><img class="ui-close-icon" src="src/assets/images/Icons/Utility%20Icons/Close%20Icon.png" alt="" width="28" height="28" decoding="async" aria-hidden="true" /></div>
        <div class="filters-panel-content">
            <div class="filters-actions">
                <h2 class="filters-title">Filters</h2>
                <div class="filters-toolbar">
                    <div class="filters-toolbar-main">
                        <div class="filters-search-wrap">
                            <label for="filtersMenuSearch" class="filters-search-label">Search current category</label>
                            <input
                                type="text"
                                id="filtersMenuSearch"
                                class="filters-search-input"
                                placeholder="Search heroes..."
                                autocomplete="off"
                                spellcheck="false"
                            />
                        </div>
                        <div class="filters-tabs-row">
                            <div class="filters-tabs" role="tablist">
                                <button type="button" id="heroesTab" class="filter-tab filter-tab--slant active" role="tab" aria-selected="true">
                                    <span class="filter-tab-face">
                                        <span class="filter-tab-graphic">
                                            <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png" alt="" width="40" height="40" decoding="async" />
                                        </span>
                                        <span class="filter-tab-footer">
                                            <span class="filter-tab-label">Heroes</span>
                                        </span>
                                    </span>
                                </button>
                                <button type="button" id="factionsTab" class="filter-tab filter-tab--slant" role="tab" aria-selected="false">
                                    <span class="filter-tab-face">
                                        <span class="filter-tab-graphic">
                                            <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png" alt="" width="40" height="40" decoding="async" />
                                        </span>
                                        <span class="filter-tab-footer">
                                            <span class="filter-tab-label">Factions</span>
                                        </span>
                                    </span>
                                </button>
                                <button type="button" id="npcsTab" class="filter-tab filter-tab--slant" role="tab" aria-selected="false">
                                    <span class="filter-tab-face">
                                        <span class="filter-tab-graphic">
                                            <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png" alt="" width="40" height="40" decoding="async" />
                                        </span>
                                        <span class="filter-tab-footer">
                                            <span class="filter-tab-label">NPCs</span>
                                        </span>
                                    </span>
                                </button>
                                <button type="button" id="countriesTab" class="filter-tab filter-tab--slant" role="tab" aria-selected="false">
                                    <span class="filter-tab-face">
                                        <span class="filter-tab-graphic">
                                            <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="40" height="40" decoding="async" />
                                        </span>
                                        <span class="filter-tab-footer">
                                            <span class="filter-tab-label">Country</span>
                                        </span>
                                    </span>
                                </button>
                            </div>
                            <div class="filters-actions-buttons">
                                <button type="button" id="clearFiltersBtn" class="filters-action-btn filters-action-btn--slant">
                                    <span class="filters-action-btn__face">
                                        <img class="filters-action-btn__icon" src="src/assets/images/Icons/Filter%20Icons/Clear%20Filter%20Icon.png" alt="" width="28" height="28" decoding="async" />
                                        <span class="filters-action-btn__label">Clear</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="filters-actions-side">
                        <div
                            class="filters-selection-counts"
                            role="status"
                            aria-live="polite"
                            aria-label="Selected filters by category"
                        >
                            <span class="filters-selection-count" title="Heroes selected">
                                <img class="filters-selection-count__icon" src="src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png" alt="" width="36" height="36" decoding="async" />
                                <span class="filter-count" id="heroesCount">0</span>
                            </span>
                            <span class="filters-selection-count" title="Factions selected">
                                <img class="filters-selection-count__icon" src="src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png" alt="" width="36" height="36" decoding="async" />
                                <span class="filter-count" id="factionsCount">0</span>
                            </span>
                            <span class="filters-selection-count" title="NPCs selected">
                                <img class="filters-selection-count__icon" src="src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png" alt="" width="36" height="36" decoding="async" />
                                <span class="filter-count" id="npcsCount">0</span>
                            </span>
                            <span class="filters-selection-count" title="Countries selected">
                                <img class="filters-selection-count__icon" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="36" height="36" decoding="async" />
                                <span class="filter-count" id="countriesCount">0</span>
                            </span>
                        </div>
                    </div>
                </div>
                <p
                    class="filters-mode-disclaimer"
                    id="filtersModeDisclaimer"
                    role="note"
                ><span class="filters-mode-disclaimer__mode">Default</span><span class="filters-mode-disclaimer__body">: Select what you want to filter from the data. Functionality may vary with each mode.</span></p>
            </div>
            <div class="filters-grid" id="filtersGrid"></div>
        </div>
    `;
    const layoutContainer = document.querySelector('.layout-container');
    if (layoutContainer) {
        layoutContainer.appendChild(panel);
    } else {
        document.body.appendChild(panel);
    }
    return panel;
}
