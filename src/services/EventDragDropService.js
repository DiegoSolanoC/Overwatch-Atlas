/**
 * EventDragDropService - Handles drag and drop functionality for event reordering
 * Separates drag and drop logic from event management
 */

class EventDragDropService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        if (!this.eventManager) return;
        
        // Disable drag and drop on GitHub Pages
        if (this.eventManager.isGitHubPages && this.eventManager.isGitHubPages()) {
            return;
        }
        
        const items = document.querySelectorAll('.event-item');
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.eventManager.draggedElement = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.event-item').forEach(i => {
                    i.classList.remove('drag-over');
                });
                this.eventManager.draggedElement = null;
                this.eventManager.dragOverIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const afterElement = this.getDragAfterElement(e.currentTarget, e.clientY);
                const index = parseInt(item.dataset.index);
                
                if (afterElement == null) {
                    item.classList.add('drag-over');
                } else {
                    item.classList.remove('drag-over');
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.eventManager.draggedElement && this.eventManager.draggedElement !== item) {
                    const fromIndex = parseInt(this.eventManager.draggedElement.dataset.index, 10);
                    const toIndex = parseInt(item.dataset.index, 10);
                    const arch = this.eventManager.dataService?.getArchiveSource?.();
                    const targetFactionType =
                        arch === 'factions' && item.dataset.factionType !== undefined
                            ? item.dataset.factionType
                            : undefined;
                    const targetHeroRole =
                        arch === 'heroes' && item.dataset.heroRole !== undefined
                            ? item.dataset.heroRole
                            : undefined;
                    const targetHeroSubRole =
                        arch === 'heroes' && item.dataset.heroSubRole !== undefined
                            ? item.dataset.heroSubRole
                            : undefined;
                    this.reorderEvents(fromIndex, toIndex, {
                        targetFactionType,
                        targetHeroRole,
                        targetHeroSubRole
                    });
                }
            });
        });

        const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
        const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
        const archSrc = this.eventManager.dataService?.getArchiveSource?.();
        if ((fgo && archSrc === 'factions') || (hro && archSrc === 'heroes')) {
            document.querySelectorAll('.event-archive-type-separator').forEach((sep) => {
                sep.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
                sep.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const dragged = this.eventManager.draggedElement;
                    if (!dragged || !dragged.classList.contains('event-item')) return;
                    const fromIndex = parseInt(dragged.dataset.index, 10);
                    const evs = this.eventManager.events;
                    if (archSrc === 'factions' && fgo && sep.dataset.dropFactionType !== undefined) {
                        const typeKey = sep.dataset.dropFactionType != null ? sep.dataset.dropFactionType : '';
                        const toIndex = fgo.findFirstIndexForFactionTypeInList(evs, typeKey);
                        this.reorderEvents(fromIndex, toIndex, { targetFactionType: typeKey });
                    } else if (archSrc === 'heroes' && hro && sep.dataset.dropHeroRole !== undefined) {
                        const roleKey = sep.dataset.dropHeroRole != null ? sep.dataset.dropHeroRole : '';
                        if ('dropHeroSubRole' in sep.dataset) {
                            const subKey = sep.dataset.dropHeroSubRole != null ? sep.dataset.dropHeroSubRole : '';
                            const toIndex = hro.findFirstIndexForHeroRoleAndSubroleInList(evs, roleKey, subKey);
                            this.reorderEvents(fromIndex, toIndex, {
                                targetHeroRole: roleKey,
                                targetHeroSubRole: subKey
                            });
                        } else {
                            const toIndex = hro.findFirstIndexForHeroRoleInList(evs, roleKey);
                            this.reorderEvents(fromIndex, toIndex, {
                                targetHeroRole: roleKey,
                                clearHeroSubRoleOnRoleDrop: true
                            });
                        }
                    }
                });
            });
        }
    }

    /**
     * Get element after which to insert dragged element
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.parentElement.querySelectorAll('.event-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Reorder events
     */
    reorderEvents(fromIndex, toIndex, options = {}) {
        if (!this.eventManager) return;
        
        const events = this.eventManager.events;
        if (fromIndex < 0 || fromIndex >= events.length || toIndex < 0 || toIndex > events.length) {
            return;
        }
        if (fromIndex === toIndex) {
            return;
        }

        const [moved] = events.splice(fromIndex, 1);
        let insertAt = toIndex;
        if (fromIndex < toIndex) {
            insertAt = toIndex - 1;
        }
        if (insertAt < 0) insertAt = 0;
        if (insertAt > events.length) insertAt = events.length;
        events.splice(insertAt, 0, moved);

        const arch = this.eventManager.dataService?.getArchiveSource?.();
        if (arch === 'factions' && options && options.targetFactionType !== undefined) {
            moved.factionType = options.targetFactionType;
        }
        if (arch === 'heroes' && options && options.targetHeroRole !== undefined) {
            moved.heroRole = options.targetHeroRole;
        }
        if (arch === 'heroes' && options && options.clearHeroSubRoleOnRoleDrop) {
            moved.heroSubRole = '';
        } else if (arch === 'heroes' && options && options.targetHeroSubRole !== undefined) {
            moved.heroSubRole = options.targetHeroSubRole;
        }

        if (this.eventManager.renderEvents) {
            this.eventManager.renderEvents();
        }
        // Mark all events as unsaved after reordering (user needs to save)
        events.forEach((_, idx) => this.eventManager.unsavedEventIndices.add(idx));
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventDragDropService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.EventDragDropService = new EventDragDropService();
}
