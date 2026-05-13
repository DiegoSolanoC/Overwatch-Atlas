/**
 * Data Archive — lore archive browsing (story/heroes/factions/npcs/locations) and
 * related ordering/styling helpers used across the app.
 *
 * Folder map (user flow vs plumbing):
 * - `archive-mode/` — entering/leaving Data Archive as a mode (category hub, embed #eventsManagePanel).
 * - `category-ui/` + `category-toolbar/` + `category-behaviors/` — tiles, strip, and CSS hooks.
 * - `category-hub-manager/` — optional standalone hub host (see note on `showCategoryHub`).
 * - `event-manager-adapter/` — panel move + archive JSON source switching.
 * - `archive-ordering/` — sort/group rules (plus `legacy-helpers.js` for `window.*` shims).
 * - `archive-support/` — env checks, DOM helpers, dev-only overlap styling, SFX.
 * - `layout-adaptations/` — embedded list layout (grid squish).
 * Globe ↔ Event System marker sync lives under `system-interface/integration/` (see index.html).
 */
// === Public API Exports ===========================================

// Category UI
export {
    buildCategoryHubUI,
    buildDataArchiveCategoryHub,
    buildStoryArchiveCategoryHub
} from './category-ui/category-hub-ui.js';

// Archive Support — sound effects
export {
    playStoryArchiveCategorySfx,
    playFilterInteractionSfx,
    playModeTransitionSfx
} from './archive-support/sound-effects.js';

// Category Hub Manager
export { showCategoryHub, hideCategoryHub } from './category-hub-manager/categoryHubManager.js';

// Event Manager Adapter
export {
    removePanelFromOriginalLocation,
    placePanelInArchiveContainer,
    returnPanelToOriginalLocation,
    isPanelEmbedded,
    detachEventManagerPanel,
    embedEventManagerInArchive,
    restoreEventManagerPanel,
    isEventManagerEmbedded
} from './event-manager-adapter/panel-manager.js';

export {
    switchEventManagerDataSource,
    resetEventManagerDataSource,
    getCurrentEventManagerDataSource,
    supportsArchiveSwitching
} from './event-manager-adapter/data-adapter.js';

export {
    originalEventsPanelParent,
    originalEventsPanelClasses,
    currentArchiveSource,
    storeOriginalPanelState,
    clearOriginalPanelState,
    setCurrentArchiveSource,
    getCurrentArchiveSource as getCurrentAdapterArchiveSource,
    hasOriginalState,
    resetAdapterState
} from './event-manager-adapter/adapter-state.js';

// Layout Adaptations
export {
    applyStoryArchiveGridSquish,
    applyStoryArchiveGridSquishFromDefaults
} from './layout-adaptations/gridSquish.js';

// Category Toolbar
export {
    mountCategoryToolbar,
    updateActiveCategory,
    unmountCategoryToolbar
} from './category-toolbar/categoryToolbar.js';

// Archive Ordering
export {
    ARCHIVE_CATEGORIES,
    CATEGORY_METADATA,
    STRIP_CATEGORIES,
    isValidArchiveCategory,
    getCategoryMetadata
} from './archive-ordering/category-types.js';

// Hero Ordering
export {
    HERO_ARCHIVE_ROLE_ORDER,
    HERO_ARCHIVE_ROLE_ALIASES,
    normalizeHeroArchiveRole,
    displayLabelForHeroArchiveRole,
    heroArchiveRoleRank
} from './archive-ordering/hero-roles.js';

export {
    HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
    HERO_ARCHIVE_SUBROLE_ALIASES,
    normalizeHeroArchiveSubrole,
    displayLabelForHeroArchiveSubrole,
    heroArchiveSubroleRank
} from './archive-ordering/hero-subroles.js';

export {
    sortHeroesArchiveEventsStable,
    findFirstIndexForHeroRoleInList,
    findFirstIndexForHeroRoleAndSubroleInList,
    moveHeroEntryToLastInItsRoleGroup,
    moveHeroEntryToLastInItsSubroleGroup
} from './archive-ordering/hero-sorting.js';

// Faction Ordering
export {
    normalizeFactionArchiveType,
    displayLabelForFactionArchiveType,
    factionArchiveTypeRank,
    sortFactionsArchiveEventsStable,
    moveFactionEntryToLastInItsTypeGroup
} from './archive-ordering/faction-ordering.js';

// Category Behaviors
export {
    applyCategoryStyling,
    removeCategoryClasses,
    setupCategoryBehaviors
} from './category-behaviors/categoryStyling.js';

// Archive Support — environment, DOM helpers, dev-only overlap styling
export {
    isLocalhost,
    eventsPanelMountedInStoryArchive
} from './archive-support/environment-checks.js';

export {
    createArchiveObserver,
    safeRemoveElement,
    waitForElement
} from './archive-support/dom-helpers.js';

export {
    applyStoryArchiveOverlapDevStyling,
    removeStoryArchiveOverlapDevStyling,
    applyOverlapBadgeHighlighting
} from './archive-support/dev-styling.js';

// === Data Archive mode (Event Manager embedded in #storyViewerContainer) ===
export {
    mountDataArchiveMode,
    unmountDataArchiveMode,
    openDataArchiveAtSource,
    createDataArchivePanel,
    exitDataArchive,
    openDataArchiveEventsView,
    createDataArchivePanel as enterDataArchiveLegacy,
    exitDataArchive as exitDataArchiveLegacy
} from './archive-mode/dataArchiveMode.js';
