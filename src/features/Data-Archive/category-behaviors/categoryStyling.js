import { ARCHIVE_CATEGORIES } from "../archive-ordering/category-types.js";

export function applyCategoryStyling(eventsManagePanel, archiveSource) {
  if (!eventsManagePanel) return;
  removeCategoryClasses(eventsManagePanel);
  eventsManagePanel.classList.add(`story-archive-category--${archiveSource}`);
}

export function removeCategoryClasses(eventsManagePanel) {
  if (!eventsManagePanel) return;
  ARCHIVE_CATEGORIES.forEach((cat) =>
    eventsManagePanel.classList.remove(`story-archive-category--${cat}`),
  );
}

export function setupCategoryBehaviors(eventsManagePanel, archiveSource) {
  // No-op: reserved for future category-specific behavior
}
