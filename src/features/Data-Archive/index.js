/**
 * Data Archive mode - refactored modular structure.
 * 
 * Provides organized access to Data Archive functionality through clear separation of concerns:
 * - Category hub for initial selection
 * - Archive shell for mode management
 * - Event Manager integration for embedding
 * - Layout adaptations for responsive design
 * - Navigation controls for category switching
 * - Category data management
 * - Archive-specific features
 * - Utilities and helpers
 */

// === Public API Exports ===========================================

// Category UI
export {
    buildCategoryHubUI,
    buildStoryArchiveCategoryHub
} from './category-ui/category-hub-ui.js';

// Archive Support
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

// Archive Support
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

// === Legacy Compatibility ==========================================
// Keep the old DataArchiveShell exports for backward compatibility
export {
    enterDataArchive as enterDataArchiveLegacy,
    exitDataArchive as exitDataArchiveLegacy
} from './data-archive-mode/mode-orchestrator.js';
