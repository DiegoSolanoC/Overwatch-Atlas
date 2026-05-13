/**
 * Heroes archive: sorting algorithms and list manipulation utilities.
 * Extracted from the massive HeroArchiveRoleOrder.js file.
 */

import { normalizeHeroArchiveRole, heroArchiveRoleRank } from "./hero-roles.js";
import {
  normalizeHeroArchiveSubrole,
  heroArchiveSubroleRank,
} from "./hero-subroles.js";

/**
 * Sort heroes archive events stably by role then subrole.
 * @param {Array} events - Array of event objects with heroRole and heroSubrole properties
 */
export function sortHeroesArchiveEventsStable(events) {
  events.sort((a, b) => {
    const roleRankA = heroArchiveRoleRank(a?.heroRole);
    const roleRankB = heroArchiveRoleRank(b?.heroRole);

    if (roleRankA !== roleRankB) {
      return roleRankA - roleRankB;
    }

    // Same role, sort by subrole
    const subroleRankA = heroArchiveSubroleRank(a?.heroSubrole, a?.heroRole);
    const subroleRankB = heroArchiveSubroleRank(b?.heroSubrole, b?.heroRole);

    return subroleRankA - subroleRankB;
  });
}

/**
 * Find first index for hero role in list.
 * @param {Array} events - Array of events
 * @param {string} role - Hero role to find
 * @returns {number}
 */
export function findFirstIndexForHeroRoleInList(events, role) {
  const normalizedRole = normalizeHeroArchiveRole(role);
  for (let i = 0; i < events.length; i++) {
    if (normalizeHeroArchiveRole(events[i]?.heroRole) === normalizedRole) {
      return i;
    }
  }
  return -1;
}

/**
 * Find first index for hero role and subrole in list.
 * @param {Array} events - Array of events
 * @param {string} role - Hero role
 * @param {string} subrole - Hero subrole
 * @returns {number}
 */
export function findFirstIndexForHeroRoleAndSubroleInList(
  events,
  role,
  subrole,
) {
  const normalizedRole = normalizeHeroArchiveRole(role);
  const normalizedSubrole = normalizeHeroArchiveSubrole(subrole);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (
      normalizeHeroArchiveRole(event?.heroRole) === normalizedRole &&
      normalizeHeroArchiveSubrole(event?.heroSubrole) === normalizedSubrole
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Move the entry at `index` to the last position within its contiguous group.
 * @param {Array} events - Array of events
 * @param {number} index - Index of event to move
 * @param {(event: object) => boolean} matchFn - Returns true if an event belongs to the same group
 */
function _moveEntryToLastInGroup(events, index, matchFn) {
  const targetEvent = events[index];
  if (!targetEvent) return;

  let groupEnd = index;

  for (let i = index + 1; i < events.length; i++) {
    if (matchFn(events[i])) {
      groupEnd = i;
    } else {
      break;
    }
  }

  if (groupEnd > index) {
    const [movedEvent] = events.splice(index, 1);
    events.splice(groupEnd, 0, movedEvent);
  }
}

/**
 * Move hero entry to last in its role group.
 * @param {Array} events - Array of events
 * @param {number} index - Index of event to move
 */
export function moveHeroEntryToLastInItsRoleGroup(events, index) {
  const targetEvent = events[index];
  if (!targetEvent) return;

  const targetRole = normalizeHeroArchiveRole(targetEvent.heroRole);

  // Find the end of this hero role group
  _moveEntryToLastInGroup(
    events,
    index,
    (event) => normalizeHeroArchiveRole(event?.heroRole) === targetRole,
  );
}

/**
 * Move hero entry to last in its subrole group.
 * @param {Array} events - Array of events
 * @param {number} index - Index of event to move
 */
export function moveHeroEntryToLastInItsSubroleGroup(events, index) {
  const targetEvent = events[index];
  if (!targetEvent) return;

  const targetRole = normalizeHeroArchiveRole(targetEvent.heroRole);
  const targetSubrole = normalizeHeroArchiveSubrole(targetEvent.heroSubrole);

  // Find the end of this hero subrole group
  _moveEntryToLastInGroup(
    events,
    index,
    (event) =>
      normalizeHeroArchiveRole(event?.heroRole) === targetRole &&
      normalizeHeroArchiveSubrole(event?.heroSubrole) === targetSubrole,
  );
}
