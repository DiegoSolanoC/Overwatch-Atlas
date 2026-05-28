/**
 * Legacy compatibility script for Data Archive ordering helpers.
 * Restores global window.HeroArchiveRoleOrderHelpers and window.FactionArchiveGroupOrderHelpers
 * that existing filtering and grouping systems depend on.
 */

import {
  HERO_ARCHIVE_ROLE_ORDER,
  HERO_ARCHIVE_ROLE_ALIASES,
  normalizeHeroArchiveRole,
  displayLabelForHeroArchiveRole,
  heroArchiveRoleRank,
} from "../archive-category-heroes/ArchiveHeroRoles.js";

import {
  HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
  HERO_ARCHIVE_SUBROLE_ALIASES,
  normalizeHeroArchiveSubrole,
  displayLabelForHeroArchiveSubrole,
  heroArchiveSubroleRank,
} from "../archive-category-heroes/ArchiveHeroSubroles.js";

import {
  sortHeroesArchiveEventsStable,
  findFirstIndexForHeroRoleInList,
  findFirstIndexForHeroRoleAndSubroleInList,
  moveHeroEntryToLastInItsRoleGroup,
  moveHeroEntryToLastInItsSubroleGroup,
} from "../archive-category-heroes/ArchiveHeroSorting.js";

import {
  normalizeFactionArchiveType,
  displayLabelForFactionArchiveType,
  factionArchiveTypeRank,
  sortFactionsArchiveEventsStable,
  moveFactionEntryToLastInItsTypeGroup,
} from "../archive-category-factions/ArchiveFactionOrdering.js";

import {
  NPC_ARCHIVE_CATEGORY_ORDER,
  normalizeNpcArchiveCategory,
  displayLabelForNpcArchiveCategory,
  npcArchiveCategoryRank,
  sortNpcsArchiveEventsStable,
  moveNpcEntryToLastInItsCategoryGroup,
  findFirstIndexForNpcCategoryInList,
  defaultNpcCategoryForName,
  resolveNpcCategoryFromArchiveRow,
  mapNpcArchiveRowsForGrouping,
} from "../archive-category-npcs/ArchiveNpcOrdering.js";

// Attach to window for legacy compatibility
if (typeof window !== "undefined") {
  // Heroes helpers - combined from all hero modules
  window.HeroArchiveRoleOrderHelpers = {
    // Role helpers
    HERO_ARCHIVE_ROLE_ORDER,
    HERO_ARCHIVE_ROLE_ALIASES,
    normalizeHeroArchiveRole,
    displayLabelForHeroArchiveRole,
    heroArchiveRoleRank,

    // Subrole helpers
    HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
    HERO_ARCHIVE_SUBROLE_ALIASES,
    normalizeHeroArchiveSubrole,
    displayLabelForHeroArchiveSubrole,
    heroArchiveSubroleRank,

    // Sorting helpers
    sortHeroesArchiveEventsStable,
    findFirstIndexForHeroRoleInList,
    findFirstIndexForHeroRoleAndSubroleInList,
    moveHeroEntryToLastInItsRoleGroup,
    moveHeroEntryToLastInItsSubroleGroup,
  };

  // Faction helpers
  window.FactionArchiveGroupOrderHelpers = {
    normalizeFactionArchiveType,
    displayLabelForFactionArchiveType,
    factionArchiveTypeRank,
    sortFactionsArchiveEventsStable,
    moveFactionEntryToLastInItsTypeGroup,
  };

  // NPC helpers
  window.NpcArchiveGroupOrderHelpers = {
    NPC_ARCHIVE_CATEGORY_ORDER,
    normalizeNpcArchiveCategory,
    displayLabelForNpcArchiveCategory,
    npcArchiveCategoryRank,
    sortNpcsArchiveEventsStable,
    moveNpcEntryToLastInItsCategoryGroup,
    findFirstIndexForNpcCategoryInList,
    defaultNpcCategoryForName,
    resolveNpcCategoryFromArchiveRow,
    mapNpcArchiveRowsForGrouping,
  };
}
