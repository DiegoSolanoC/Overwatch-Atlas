/**
 * EventListenerService - Wires every DOM listener for the Event Manager panel.
 *
 * Facade only. The real logic lives in sibling modules so each concern stays small + testable:
 *   - `wireManagePanelButtons.js` Open/close toggle + Add/Save/Export/Import buttons
 *                                  (Add/Save/Export/Import are hidden on GitHub Pages builds).
 *   - `wireToolbarCollapse.js`    Mobile toolbar collapse with localStorage persistence.
 *   - `search/wireEventManagerSearch.js`
 *                                  The 900-line search bar: title + hero/faction/NPC tokens,
 *                                  country/flag tokens, FilterService selection sync, pagination.
 *
 * `setupEventListeners` retries once after 200ms if `#eventsManagePanel` is missing, then bails.
 * `eventManager.listenersSetup = true` blocks double-wiring on re-entry.
 *
 * Exposes `window.EventListenerService` (singleton instance) for back-compat with classic-script
 * consumers; new code receives the instance via `composeEventServices(eventManager)`.
 */

import { wireManagePanelButtons } from './wireManagePanelButtons.js';
import { wireToolbarCollapse } from './wireToolbarCollapse.js';
import { wireEventManagerSearch } from './search/wireEventManagerSearch.js';

class EventListenerService {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    setupEventListeners() {
        if (!this.eventManager) return;

        const toggleBtn = document.getElementById('eventsManageToggle');
        const panel = document.getElementById('eventsManagePanel');
        const closeBtn = document.getElementById('eventsManageClose');

        if (!panel) {
            console.error('EventListenerService: eventsManagePanel not found! Make sure the HTML panel exists in the page.');
            // Single retry after a short delay in case the DOM is still streaming in.
            setTimeout(() => this.setupEventListeners(), 200);
            return;
        }

        wireToolbarCollapse(this, panel);

        if (this.eventManager.listenersSetup) return;

        wireManagePanelButtons(this, { panel, toggleBtn, closeBtn });
        wireEventManagerSearch(this);

        this.eventManager.listenersSetup = true;
    }
}

if (typeof window !== 'undefined') {
    window.EventListenerService = new EventListenerService();
}

export default EventListenerService;
