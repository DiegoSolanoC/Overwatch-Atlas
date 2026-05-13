/**
 * Event Manager data source adapter for Data Archive mode.
 * Handles switching Event Manager data context between different archive types.
 */

import { updateStatus } from "../../Universal-Features/runtime/statusFeed.js";

// === Data Source Management ======================================

/**
 * Switch EventManager data source to specified archive.
 * @param {string} archiveSource - 'story', 'heroes', 'factions', 'npcs', 'locations'
 */
export function switchEventManagerDataSource(archiveSource) {
  try {
    if (window.eventManager?.switchStoryArchiveSource) {
      window.eventManager.switchStoryArchiveSource(archiveSource);
    } else if (window.eventManager?.dataService?.setArchiveSource) {
      window.eventManager.dataService.setArchiveSource(archiveSource);
      window.eventManager.loadEvents?.();
      window.eventManager.renderEvents?.();
    }
    updateStatus(`Switched to ${archiveSource} archive`, "info");
  } catch (err) {
    updateStatus(`Failed to switch archive source: ${err.message}`, "error");
  }
}

/**
 * Reset EventManager data source to default (story).
 */
export function resetEventManagerDataSource() {
  switchEventManagerDataSource("story");
}

/**
 * Get current EventManager data source if available.
 * @returns {string|null} Current archive source or null if not available
 */
export function getCurrentEventManagerDataSource() {
  if (window.eventManager?.dataService?.getArchiveSource) {
    return window.eventManager.dataService.getArchiveSource();
  }
  return null;
}

/**
 * Check if EventManager supports archive source switching.
 * @returns {boolean} True if Event Manager can switch data sources
 */
export function supportsArchiveSwitching() {
  return !!(
    window.eventManager?.switchStoryArchiveSource ||
    window.eventManager?.dataService?.setArchiveSource
  );
}
