/**
 * SourceFieldManager - Handles source pair management in event edit form
 * Manages adding, removing, and clearing source pairs
 */

class SourceFieldManager {
    constructor() {
        this.container = null;
    }

    /**
     * Get the source container element
     * @returns {HTMLElement|null}
     */
    getContainer() {
        if (!this.container) {
            this.container = document.getElementById('eventSourcesContainer');
        }
        return this.container;
    }

    /**
     * Add a new source pair
     */
    addSourcePair() {
        const container = this.getContainer();
        if (!container) return;
        
        const currentPairs = container.querySelectorAll('.source-pair');
        const newIndex = currentPairs.length;
        
        const pairDiv = document.createElement('div');
        pairDiv.className = 'source-pair';
        pairDiv.dataset.sourceIndex = newIndex;
        
        pairDiv.innerHTML = `
            <div class="event-edit-field">
                <label for="eventEditSourceName${newIndex}">Source Name:</label>
                <input type="text" id="eventEditSourceName${newIndex}" class="event-edit-input source-name-input" autocomplete="off">
            </div>
            <div class="event-edit-field">
                <label for="eventEditSourceLink${newIndex}">Source Link (optional):</label>
                <input type="url" id="eventEditSourceLink${newIndex}" class="event-edit-input source-link-input" autocomplete="off">
            </div>
        `;
        
        container.appendChild(pairDiv);
        this.updateRemoveSourceButton();
    }
    
    /**
     * Remove the last source pair (but keep at least one)
     */
    removeLastSourcePair() {
        const container = this.getContainer();
        if (!container) return;
        
        const pairs = container.querySelectorAll('.source-pair');
        if (pairs.length <= 1) {
            alert('At least one source field is required');
            return;
        }
        
        pairs[pairs.length - 1].remove();
        this.updateRemoveSourceButton();
    }
    
    /**
     * Clear all source pairs and reset to one empty pair
     */
    clearSourcePairs() {
        const container = this.getContainer();
        if (!container) return;
        
        container.innerHTML = `
            <div class="source-pair" data-source-index="0">
                <div class="event-edit-field">
                    <label for="eventEditSourceName0">Source Name:</label>
                    <input type="text" id="eventEditSourceName0" class="event-edit-input source-name-input" autocomplete="off">
                </div>
                <div class="event-edit-field">
                    <label for="eventEditSourceLink0">Source Link (optional):</label>
                    <input type="url" id="eventEditSourceLink0" class="event-edit-input source-link-input" autocomplete="off">
                </div>
            </div>
        `;
        this.updateRemoveSourceButton();
    }
    
    /**
     * Update the visibility of the remove source button
     */
    updateRemoveSourceButton() {
        const removeBtn = document.getElementById('removeSourcePairBtn');
        const container = this.getContainer();
        if (removeBtn && container) {
            const pairs = container.querySelectorAll('.source-pair');
            removeBtn.style.display = pairs.length > 1 ? 'inline-block' : 'none';
        }
    }

    /**
     * Get all source pairs data
     * @returns {Array<{text: string, url?: string}>}
     */
    getSourcePairsData() {
        const container = this.getContainer();
        if (!container) return [];
        
        const sources = [];
        const sourcePairs = container.querySelectorAll('.source-pair');
        sourcePairs.forEach((pair) => {
            const nameInput = pair.querySelector('.source-name-input');
            const linkInput = pair.querySelector('.source-link-input');
            const name = nameInput ? nameInput.value.trim() : '';
            const link = linkInput ? linkInput.value.trim() : '';
            if (name) {
                sources.push({
                    text: name,
                    url: link || undefined
                });
            }
        });
        return sources;
    }

    /**
     * Load sources into source pairs
     * @param {Array<{text: string, url?: string}>} sources
     */
    loadSources(sources) {
        this.clearSourcePairs();
        if (sources && sources.length > 0) {
            sources.forEach((source, index) => {
                if (index > 0) {
                    this.addSourcePair();
                }
                const pair = document.querySelectorAll('.source-pair')[index];
                if (pair) {
                    const nameInput = pair.querySelector('.source-name-input');
                    const linkInput = pair.querySelector('.source-link-input');
                    if (nameInput) nameInput.value = source.text || '';
                    if (linkInput) linkInput.value = source.url || '';
                }
            });
        }
        this.updateRemoveSourceButton();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SourceFieldManager;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.SourceFieldManager = SourceFieldManager;
}
