/**
 * Data Workshop — bio archive browsing (heroes/factions/npcs/locations). Story mode is separate.
 *
 * Folder map:
 * - `archive-mode/` — enter/leave mode, category hub navigation, embedded event panel layout
 * - `archive-controls-ui/` — hub tiles, category strip, styling, grid squish
 * - `archive-category-shared/` — category metadata and legacy window shims
 * - `archive-category-heroes/` — hero role/subrole ordering
 * - `archive-category-factions/` — faction ordering
 * - `archive-event-panel-bridge/` — Event Manager panel embed + archive data source
 * - `archive-support/` — environment checks, DOM helpers, SFX, dev styling
 */

export {
    buildCategoryHubUI,
    buildDataArchiveCategoryHub,
    buildStoryArchiveCategoryHub
} from './archive-controls-ui/ArchiveCategoryHubUi.js';

export {
    playStoryArchiveCategorySfx,
    playFilterInteractionSfx,
    playModeTransitionSfx
} from './archive-support/ArchiveSoundEffects.js';

export { showCategoryHub, hideCategoryHub } from './archive-controls-ui/ArchiveCategoryHubHost.js';

export {
    removePanelFromOriginalLocation,
    placePanelInArchiveContainer,
    returnPanelToOriginalLocation,
    isPanelEmbedded,
    detachEventManagerPanel,
    embedEventManagerInArchive,
    restoreEventManagerPanel,
    isEventManagerEmbedded
} from './archive-event-panel-bridge/ArchiveEventPanelEmbed.js';

export {
    switchEventManagerDataSource,
    resetEventManagerDataSource,
    getCurrentEventManagerDataSource,
    supportsArchiveSwitching
} from './archive-event-panel-bridge/ArchiveEventDataSource.js';

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
} from './archive-event-panel-bridge/ArchiveEventPanelState.js';

export {
    applyStoryArchiveGridSquish,
    applyStoryArchiveGridSquishFromDefaults
} from './archive-controls-ui/ArchiveGridSquish.js';

export {
    mountCategoryToolbar,
    updateActiveCategory,
    unmountCategoryToolbar
} from './archive-controls-ui/ArchiveCategoryToolbar.js';

export {
    ARCHIVE_CATEGORIES,
    BIO_ARCHIVE_CATEGORIES,
    CATEGORY_METADATA,
    STRIP_CATEGORIES,
    isValidArchiveCategory,
    isBioArchiveCategory,
    getCategoryMetadata
} from './archive-category-shared/ArchiveCategoryTypes.js';

export {
    embedArchiveEventsPanel,
    switchEmbeddedArchiveSource,
} from './archive-mode/ArchiveEventPanelEmbed.js';

export {
    HERO_ARCHIVE_ROLE_ORDER,
    HERO_ARCHIVE_ROLE_ALIASES,
    normalizeHeroArchiveRole,
    displayLabelForHeroArchiveRole,
    heroArchiveRoleRank
} from './archive-category-heroes/ArchiveHeroRoles.js';

export {
    HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
    HERO_ARCHIVE_SUBROLE_ALIASES,
    normalizeHeroArchiveSubrole,
    displayLabelForHeroArchiveSubrole,
    heroArchiveSubroleRank
} from './archive-category-heroes/ArchiveHeroSubroles.js';

export {
    sortHeroesArchiveEventsStable,
    findFirstIndexForHeroRoleInList,
    findFirstIndexForHeroRoleAndSubroleInList,
    moveHeroEntryToLastInItsRoleGroup,
    moveHeroEntryToLastInItsSubroleGroup
} from './archive-category-heroes/ArchiveHeroSorting.js';

export {
    normalizeFactionArchiveType,
    displayLabelForFactionArchiveType,
    factionArchiveTypeRank,
    sortFactionsArchiveEventsStable,
    moveFactionEntryToLastInItsTypeGroup
} from './archive-category-factions/ArchiveFactionOrdering.js';

export {
    NPC_ARCHIVE_CATEGORY_ORDER,
    NPC_ARCHIVE_CATEGORY_BY_NAME,
    normalizeNpcArchiveCategory,
    displayLabelForNpcArchiveCategory,
    npcArchiveCategoryRank,
    sortNpcsArchiveEventsStable,
    moveNpcEntryToLastInItsCategoryGroup,
    findFirstIndexForNpcCategoryInList,
    defaultNpcCategoryForName,
    resolveNpcCategoryFromArchiveRow,
    mapNpcArchiveRowsForGrouping
} from './archive-category-npcs/ArchiveNpcOrdering.js';

export {
    applyCategoryStyling,
    removeCategoryClasses,
    setupCategoryBehaviors
} from './archive-controls-ui/ArchiveCategoryStyling.js';

export {
    isLocalhost,
    eventsPanelMountedInStoryArchive
} from './archive-support/ArchiveEnvironmentChecks.js';

export {
    createArchiveObserver,
    safeRemoveElement,
    waitForElement
} from './archive-support/ArchiveDomHelpers.js';

export {
    applyStoryArchiveOverlapDevStyling,
    removeStoryArchiveOverlapDevStyling,
    applyOverlapBadgeHighlighting
} from './archive-support/ArchiveDevStyling.js';

export {
    mountDataArchiveMode,
    unmountDataArchiveMode,
    openDataArchiveAtSource,
    createDataArchivePanel,
    exitDataArchive,
    openDataArchiveEventsView,
    createDataArchivePanel as enterDataArchiveLegacy,
    exitDataArchive as exitDataArchiveLegacy
} from './archive-mode/ArchiveModeMount.js';
