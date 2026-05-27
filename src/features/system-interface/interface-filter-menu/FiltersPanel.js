/**
 * `FiltersPanel` — orchestrator for the right-side filters panel (formerly
 * `FilterService`). Wires together state, image loading, manifest fetch,
 * grouped archive layouts, search box, and tab switching.
 *
 * **Public surface preserved on `window.FilterService`** (class name is
 * kept as `FilterService` for compat with classic-script consumers):
 *   - `init()`, `reset()`
 *   - `openPanelWithMode(mode)`              — used by panel-resize trapezium
 *   - `invalidateBioArchiveFilterLayouts()`  — used by EventManager when the
 *                                              user switches bio archives
 *   - `stateManager`                         — pending selection state
 *   - `updateButtonStates()`                 — chip selection visuals
 *
 * Confirm / Clear button handlers are owned by
 * `load-out/mountEventSystemFilters.js` — this class only wires the toggle
 * and close buttons (everything else is rebound by mount after we run).
 *
 * The legacy `FilterPanelHelpers` / `FilterButtonSetupHelpers` indirection
 * has been removed: every helper is now a direct ES import. Inline fallback
 * classes for `FilterStateManager` / `FilterImageService` have also been
 * removed since script-load order guarantees both are available.
 */

import { FilterStateManager } from "./state/FilterSelectionState.js";
import { FilterImageService } from "./images/FilterImageLoader.js";
import { loadFilterManifest } from "./manifest/loadFilterManifest.js";
import {
  orderHeroOrNpcIdsByArchive,
  orderFactionsByArchive,
} from "./manifest/storyArchiveFilterOrder.js";
import { wireFilterTabs } from "./tabs/wireFilterTabs.js";
import { updateFilterTabCounts } from "./counts/updateFilterTabCounts.js";
import { createFilterButtonsGrid } from "./buttons/createFilterButtonsGrid.js";
import {
  invalidateArchiveLayoutFileCaches,
  ensureArchiveLayoutSnapshotsForFilter,
} from "./buttons/archive-layouts/archiveLayoutSnapshots.js";
import { wireFilterPanelToggleAndClose } from "./wiring/wireFilterPanelToggleAndClose.js";
import {
  bindFilterSearchInputOnce,
  applyFilterChipSearch,
} from "./wiring/wireFiltersSearchBox.js";
import { createPanelExclusivityObserver } from "./panel/panelExclusivityObserver.js";
import { dismissAllPanelsExcept } from "../interface-shared/dismissAllPanelsExcept.js";
import {
  adoptLegacyMusicContentIntoSharedPanel,
  getPanelModeFor,
  setPanelModeFor,
} from "./panel/sharedPanelMode.js";

class FilterService {
  constructor(
    stateManager = null,
    imageService = null,
    globeController = null,
    soundManager = null,
  ) {
    this.initialized = false;
    this.heroes = [];
    this.factions = [];
    this.npcs = [];
    this.countries = [];
    this.currentFilterType = "heroes";
    this.buttonCache = {
      heroes: null,
      factions: null,
      npcs: null,
      countries: null,
      music: null,
    };

    this.stateManager = stateManager || new FilterStateManager();
    this.imageService = imageService || new FilterImageService();
    this.globeController = globeController || window.globeController;
    this.soundManager = soundManager || window.SoundEffectsManager;

    /* DOM elements bind in `init()`. */
    this.filtersButton = null;
    this.filtersPanel = null;
    this.filtersPanelClose = null;
    this.filtersGrid = null;
    this.clearFiltersBtn = null;
    this.confirmFiltersBtn = null;
    this.heroesTab = null;
    this.factionsTab = null;
    this.npcsTab = null;
    this.countriesTab = null;
    this.filtersMenuSearchInput = null;
    this.panelMode = "filters";
    this._exclusivity = createPanelExclusivityObserver();
    this._onAtlasBioArchivesRefreshedForFilters = null;
  }

  /**
   * Initialize the filters panel. Returns a promise that resolves once
   * the manifest fetch + initial button wiring are complete, so callers
   * (notably the boot sequence) can `await` the panel being fully
   * populated before dropping the loading overlay.
   */
  async init() {
    if (this.initialized) return;

    this.filtersButton = document.getElementById("filtersToggle");
    this.filtersPanel = document.getElementById("filtersPanel");
    this.filtersPanelClose = document.getElementById("filtersPanelClose");
    this.filtersGrid = document.getElementById("filtersGrid");
    this.clearFiltersBtn = document.getElementById("clearFiltersBtn");
    this.confirmFiltersBtn = document.getElementById("confirmFiltersBtn");
    this.heroesTab = document.getElementById("heroesTab");
    this.factionsTab = document.getElementById("factionsTab");
    this.npcsTab = document.getElementById("npcsTab");
    this.countriesTab = document.getElementById("countriesTab");
    this.filtersMenuSearchInput = document.getElementById("filtersMenuSearch");

    /* Panel DOM may not exist yet if event system hasn't mounted — bail
           silently and let the next init() call try again. */
    if (!this.filtersButton || !this.filtersPanel || !this.filtersGrid) return;

    this.initialized = true;
    this.setPanelMode("filters");
    this._exclusivity.start();

    this.resetToConfirmedFilters();

    await this.loadManifest();
    this._wireTabs();
    this._wireButtons();
    this._wireSearchBox();
    this._wireBioArchiveRefreshListener();
  }

  reset() {
    this._exclusivity.stop();
    if (this._onAtlasBioArchivesRefreshedForFilters) {
      try {
        window.removeEventListener(
          "atlas-bio-archives-refreshed",
          this._onAtlasBioArchivesRefreshedForFilters,
        );
      } catch (_) {}
      this._onAtlasBioArchivesRefreshedForFilters = null;
    }
    this.initialized = false;
    this.filtersButton = null;
    this.filtersPanel = null;
    this.filtersPanelClose = null;
    this.filtersGrid = null;
    this.clearFiltersBtn = null;
    this.confirmFiltersBtn = null;
    this.heroesTab = null;
    this.factionsTab = null;
    this.npcsTab = null;
    this.countriesTab = null;
    this.filtersMenuSearchInput = null;
    this.panelMode = "filters";
    this.buttonCache = {
      heroes: null,
      factions: null,
      npcs: null,
      countries: null,
      music: null,
    };
  }

  /* ------------------------------ Panel mode ----------------------------- */

  setPanelMode(mode) {
    this.panelMode = setPanelModeFor(this.filtersPanel, mode);
  }

  getPanelMode() {
    return getPanelModeFor(this.filtersPanel, this.panelMode);
  }

  openPanelWithMode(mode) {
    const nextMode = mode === "music" ? "music" : "filters";
    if (nextMode === "music") {
      adoptLegacyMusicContentIntoSharedPanel(this.filtersPanel);
      this.setPanelMode("music");
      if (!this.filtersPanel?.classList.contains("open")) {
        this.closeOtherPanels();
        this.filtersPanel?.classList.add("open");
      }
      document.getElementById("filtersToggle")?.classList.remove("active");
      document.getElementById("musicToggle")?.classList.add("active");
      return;
    }
    this.setPanelMode("filters");
    if (this.filtersPanel?.classList.contains("open")) {
      document.getElementById("filtersToggle")?.classList.add("active");
      document.getElementById("musicToggle")?.classList.remove("active");
      return;
    }
    this.openPanel();
  }

  /* ------------------------------ State + scene -------------------------- */

  getSceneModel() {
    const globeController =
      this.globeController ||
      (typeof window !== "undefined" ? window.globeController : null);
    return globeController?.sceneModel || null;
  }

  /** Standalone (Event System) mode owns `window.standaloneActiveFilters`. */
  isStandaloneMode() {
    return (
      typeof window !== "undefined" &&
      window.standaloneActiveFilters instanceof Set
    );
  }

  resetToConfirmedFilters() {
    if (window.standaloneActiveFilters) {
      this.stateManager.selectedFilters = new Set(
        window.standaloneActiveFilters,
      );
    } else {
      this.stateManager.selectedFilters.clear();
    }
    this.updateButtonStates();
    this.updateFilterCounts();
  }

  updateButtonStates() {
    if (!this.filtersGrid) return;
    const allButtons = this.filtersGrid.querySelectorAll(".filter-btn");
    allButtons.forEach((btn) => {
      const filterKey = btn.dataset.filterKey;
      if (!filterKey) return;
      if (this.stateManager.has(filterKey)) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
    window.syncFiltersPanelTrapIcon?.();
  }

  /* ------------------------------ Manifest ------------------------------- */

  async loadManifest() {
    /* Cached chips reference stale dataset.filterKey values after manifest edits. */
    this.buttonCache.heroes = null;
    this.buttonCache.factions = null;
    this.buttonCache.npcs = null;
    this.buttonCache.countries = null;
    invalidateArchiveLayoutFileCaches();

    const result = await loadFilterManifest(
      (items, type, folder) => this.createFilterButtons(items, type, folder),
      () => this.updateFilterCounts(),
      (items, type, folder) => this.preloadImages(items, type, folder),
    );
    this.heroes = result.heroes;
    this.factions = result.factions;
    this.npcs = result.npcs || [];
    this._initCountryFilterItems();
  }

  _initCountryFilterItems() {
    const map =
      typeof window !== "undefined" ? window.FLAG_FILE_BY_COMMON : null;
    if (!map) {
      this.countries = [];
      return;
    }
    this.countries = Object.keys(map)
      .map((commonName) => ({ commonName, flagFile: map[commonName] }))
      .sort((a, b) => a.commonName.localeCompare(b.commonName));
  }

  /* ------------------------------ Counts + grid -------------------------- */

  updateFilterCounts() {
    updateFilterTabCounts(this.stateManager);
  }

  preloadImages(items, type, folder) {
    this.imageService.preloadImages(items, type, folder);
  }

  /**
   * Build the chip grid for the active tab. Hero / faction tabs always pass
   * the archive-grouping flag because the visual design specifies role-aware
   * separators on those tabs regardless of which archive is open.
   */
  async createFilterButtons(items, type, folder) {
    const groupFactionsByArchiveType = type === "factions";
    const groupHeroesByArchiveRole = type === "heroes";
    if (groupFactionsByArchiveType)
      await ensureArchiveLayoutSnapshotsForFilter("factions");
    if (groupHeroesByArchiveRole)
      await ensureArchiveLayoutSnapshotsForFilter("heroes");

    createFilterButtonsGrid(
      items,
      type,
      folder,
      this.filtersGrid,
      this.buttonCache,
      this.stateManager,
      this.imageService,
      this.soundManager,
      this.heroes,
      this.factions,
      this.npcs,
      this.countries,
      (itemsPre, typePre, folderPre) =>
        this.preloadImages(itemsPre, typePre, folderPre),
      () => this.updateFilterCounts(),
      groupFactionsByArchiveType,
      groupHeroesByArchiveRole,
    );
    this._applyCurrentCategorySearch();
  }

  /**
   * Bio-archive switch (e.g. user toggled Heroes <-> Factions archive in the
   * Event Manager). Drop cached chip DOM + snapshot files so the next chip
   * build re-reads the right archive data.
   */
  invalidateBioArchiveFilterLayouts() {
    invalidateArchiveLayoutFileCaches();
    this.buttonCache.factions = null;
    this.buttonCache.heroes = null;
    if (!this.initialized || !this.filtersGrid) return;
    const t = this.currentFilterType;
    if (t === "factions") {
      void this.createFilterButtons(
        this.factions,
        "factions",
        "src/assets/images/Filters/Factions",
      );
    } else if (t === "heroes") {
      void this.createFilterButtons(
        this.heroes,
        "heroes",
        "src/assets/images/Filters/Heroes",
      );
    } else {
      return;
    }
    this._applyCurrentCategorySearch();
    this.updateButtonStates();
    void this.updateFilterCounts();
  }

  /* ------------------------------ Panel open / close --------------------- */

  closeOtherPanels() {
    dismissAllPanelsExcept("filtersPanel");
  }

  openPanel() {
    /* Mutual exclusion: if Event Info is open, close it before opening Filters. */
    const eventSlide = document.getElementById("eventSlide");
    if (eventSlide?.classList.contains("open"))
      eventSlide.classList.remove("open");

    /* Reset the pending selection to the confirmed snapshot every time we open. */
    if (this.isStandaloneMode() && window.standaloneActiveFilters) {
      this.stateManager.selectedFilters = new Set(
        window.standaloneActiveFilters,
      );
    } else {
      this.stateManager.resetToConfirmed();
    }

    const tabFolder = {
      heroes: "src/assets/images/Filters/Heroes",
      factions: "src/assets/images/Filters/Factions",
      npcs: "src/assets/images/Filters/NPCs",
      countries: "src/assets/images/Filters/Flags",
    };
    const tabItems = {
      heroes: this.heroes,
      factions: this.factions,
      npcs: this.npcs,
      countries: this.countries,
    };
    const t = this.currentFilterType;
    this.createFilterButtons(
      tabItems[t] || this.npcs,
      t,
      tabFolder[t] || tabFolder.npcs,
    );

    this.updateButtonStates();
    this.filtersPanel.classList.add("open");
    this.filtersButton?.classList.add("active");
  }

  closePanel() {
    this.filtersPanel?.classList.remove("open");
    this.filtersButton?.classList.remove("active");
    document.getElementById("musicToggle")?.classList.remove("active");
    this.setPanelMode("filters");
  }

  togglePanel() {
    const isOpening = !this.filtersPanel.classList.contains("open");
    if (isOpening) {
      this.closeOtherPanels();
      this.openPanel();
    } else {
      this.resetToConfirmedFilters();
      this.closePanel();
    }
  }

  /* ------------------------------ Internal wiring ------------------------ */

  _wireTabs() {
    wireFilterTabs(
      this.heroesTab,
      this.factionsTab,
      this.npcsTab,
      this.countriesTab,
      this.heroes,
      this.factions,
      this.npcs,
      this.countries,
      (items, type, folder) => {
        this.currentFilterType = type;
        this.createFilterButtons(items, type, folder);
      },
      () => this.updateFilterCounts(),
    );
  }

  _wireButtons() {
    wireFilterPanelToggleAndClose(this.filtersPanel, {
      filtersButton: this.filtersButton,
      filtersPanelClose: this.filtersPanelClose,
      soundManager: this.soundManager,
      getPanelMode: () => this.getPanelMode(),
      setPanelMode: (m) => this.setPanelMode(m),
      togglePanel: () => this.togglePanel(),
      resetToConfirmedFilters: () => this.resetToConfirmedFilters(),
      closePanel: () => this.closePanel(),
    });
  }

  _wireSearchBox() {
    bindFilterSearchInputOnce(
      this.filtersMenuSearchInput,
      () => this.currentFilterType,
      () => this.filtersGrid,
    );
  }

  _applyCurrentCategorySearch() {
    applyFilterChipSearch(
      this.filtersMenuSearchInput ||
        document.getElementById("filtersMenuSearch"),
      this.filtersGrid || document.getElementById("filtersGrid"),
      this.currentFilterType,
    );
  }

  _wireBioArchiveRefreshListener() {
    if (this._onAtlasBioArchivesRefreshedForFilters) return;
    this._onAtlasBioArchivesRefreshedForFilters = (ev) => {
      const d = ev && ev.detail ? ev.detail : {};
      const orderNames = Array.isArray(d.orderNames) ? d.orderNames : null;
      const archives = Array.isArray(d.archives) ? d.archives : [];

      const repaintCurrentFilterTab = () => {
        const folder = {
          heroes: "src/assets/images/Filters/Heroes",
          factions: "src/assets/images/Filters/Factions",
          npcs: "src/assets/images/Filters/NPCs",
          countries: "src/assets/images/Filters/Flags",
        };
        const items = {
          heroes: this.heroes,
          factions: this.factions,
          npcs: this.npcs,
          countries: this.countries,
        };
        const t = this.currentFilterType || "heroes";
        this.createFilterButtons(items[t] || [], t, folder[t]);
        this._applyCurrentCategorySearch();
        this.updateButtonStates();
      };

      this.buttonCache.heroes = null;
      this.buttonCache.factions = null;
      this.buttonCache.npcs = null;
      invalidateArchiveLayoutFileCaches();

      if (orderNames && orderNames.length && archives.length) {
        for (const arch of archives) {
          if (arch === "heroes") {
            this.heroes = orderHeroOrNpcIdsByArchive(this.heroes, orderNames);
          } else if (arch === "npcs") {
            this.npcs = orderHeroOrNpcIdsByArchive(this.npcs, orderNames);
          } else if (arch === "factions") {
            this.factions = orderFactionsByArchive(this.factions, orderNames);
          }
        }
        repaintCurrentFilterTab();
        return;
      }

      this.loadManifest().then(() => repaintCurrentFilterTab());
    };
    window.addEventListener(
      "atlas-bio-archives-refreshed",
      this._onAtlasBioArchivesRefreshedForFilters,
    );
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = FilterService;
}
if (typeof window !== "undefined") {
  window.FilterService = new FilterService();
}

export { FilterService };
export default FilterService;
