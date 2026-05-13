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
} from "./hero-roles.js";

import {
  HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
  HERO_ARCHIVE_SUBROLE_ALIASES,
  normalizeHeroArchiveSubrole,
  displayLabelForHeroArchiveSubrole,
  heroArchiveSubroleRank,
} from "./hero-subroles.js";

import {
  sortHeroesArchiveEventsStable,
  findFirstIndexForHeroRoleInList,
  findFirstIndexForHeroRoleAndSubroleInList,
  moveHeroEntryToLastInItsRoleGroup,
  moveHeroEntryToLastInItsSubroleGroup,
} from "./hero-sorting.js";

import {
  normalizeFactionArchiveType,
  displayLabelForFactionArchiveType,
  factionArchiveTypeRank,
  sortFactionsArchiveEventsStable,
  moveFactionEntryToLastInItsTypeGroup,
} from "./faction-ordering.js";

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
}
