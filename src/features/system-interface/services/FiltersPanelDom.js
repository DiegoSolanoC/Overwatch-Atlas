/**
 * FiltersPanelDom — builds and mounts the filters panel DOM (#filtersPanel).
 *
 * Pure DOM factory. The four-tab structure (Heroes / Factions / NPCs /
 * Countries), the search box, and the Clear/Confirm buttons are static HTML;
 * tab switching, button population, and search filtering are owned by
 * `FilterService.js` and the `helpers/Filter*.js` modules.
 *
 * The panel is appended to `.layout-container` when present (so it can
 * participate in the flexbox layout) and falls back to `<body>` otherwise.
 */

/**
 * @returns {HTMLElement} The newly created #filtersPanel element.
 */
export function createFiltersPanel() {
    const panel = document.createElement('div');
    panel.id = 'filtersPanel';
    panel.className = 'filters-panel';
    panel.innerHTML = `
        <div class="filters-panel-close" id="filtersPanelClose">&times;</div>
        <div class="filters-panel-content">
            <div class="filters-actions">
                <h2 class="filters-title">Filters</h2>
                <div class="filters-toolbar">
                    <div class="filters-tabs" role="tablist">
                        <button type="button" id="heroesTab" class="filter-tab active" role="tab" aria-selected="true">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Heroes</span>
                                <span class="filter-count" id="heroesCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="factionsTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Factions</span>
                                <span class="filter-count" id="factionsCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="npcsTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">NPCs</span>
                                <span class="filter-count" id="npcsCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="countriesTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Country</span>
                                <span class="filter-count" id="countriesCount">0</span>
                            </span>
                        </button>
                    </div>
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
                    <div class="filters-actions-buttons">
                        <button type="button" id="clearFiltersBtn" class="filters-action-btn">
                            <img class="filters-action-btn__icon" src="src/assets/images/Icons/Filter%20Icons/Clear%20Filter%20Icon.png" alt="" width="22" height="22" decoding="async" />
                            <span class="filters-action-btn__label">Clear</span>
                        </button>
                        <button type="button" id="confirmFiltersBtn" class="filters-action-btn filters-confirm-btn">
                            <img class="filters-action-btn__icon" src="src/assets/images/Icons/Filter%20Icons/Confirm%20Filter%20Icon.png" alt="" width="22" height="22" decoding="async" />
                            <span class="filters-action-btn__label">Confirm</span>
                        </button>
                    </div>
                </div>
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
