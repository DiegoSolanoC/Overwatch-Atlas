/**
 * HeadlinesFieldManager - Handles news headlines management in event edit form
 * Manages adding, removing, and clearing headline fields
 */

class HeadlinesFieldManager {
    constructor() {
        this.container = null;
    }

    /**
     * Get the headlines container element
     * @returns {HTMLElement|null}
     */
    getContainer() {
        if (!this.container) {
            this.container = document.getElementById('eventHeadlinesContainer');
        }
        return this.container;
    }

    /**
     * Add a new headline field
     */
    addHeadlineField() {
        const container = this.getContainer();
        if (!container) return;
        
        const currentFields = container.querySelectorAll('.headline-field');
        const newIndex = currentFields.length;
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'headline-field';
        fieldDiv.dataset.headlineIndex = newIndex;
        
        fieldDiv.innerHTML = `
            <div class="event-edit-field">
                <label for="eventEditHeadline${newIndex}">Headline:</label>
                <input type="text" id="eventEditHeadline${newIndex}" class="event-edit-input headline-input" autocomplete="off">
            </div>
        `;
        
        container.appendChild(fieldDiv);
        this.updateRemoveHeadlineButton();
    }
    
    /**
     * Remove the last headline field (but keep at least one)
     */
    removeLastHeadlineField() {
        const container = this.getContainer();
        if (!container) return;
        
        const fields = container.querySelectorAll('.headline-field');
        if (fields.length <= 1) {
            alert('At least one headline field is required');
            return;
        }
        
        fields[fields.length - 1].remove();
        this.updateRemoveHeadlineButton();
    }
    
    /**
     * Clear all headline fields and reset to one empty field
     */
    clearHeadlineFields() {
        const container = this.getContainer();
        if (!container) return;
        
        container.innerHTML = `
            <div class="headline-field" data-headline-index="0">
                <div class="event-edit-field">
                    <label for="eventEditHeadline0">Headline:</label>
                    <input type="text" id="eventEditHeadline0" class="event-edit-input headline-input" autocomplete="off">
                </div>
            </div>
        `;
        this.updateRemoveHeadlineButton();
    }
    
    /**
     * Update the visibility of the remove headline button
     */
    updateRemoveHeadlineButton() {
        const removeBtn = document.getElementById('removeHeadlineBtn');
        const container = this.getContainer();
        if (removeBtn && container) {
            const fields = container.querySelectorAll('.headline-field');
            removeBtn.style.display = fields.length > 1 ? 'inline-block' : 'none';
        }
    }

    /**
     * Get all headlines data
     * @returns {Array<string>}
     */
    getHeadlinesData() {
        const container = this.getContainer();
        if (!container) return [];
        
        const headlines = [];
        const headlineFields = container.querySelectorAll('.headline-field');
        headlineFields.forEach((field) => {
            const input = field.querySelector('.headline-input');
            const value = input ? input.value.trim() : '';
            if (value) {
                headlines.push(value);
            }
        });
        return headlines;
    }

    /**
     * Load headlines into fields
     * @param {Array<string>} headlines
     */
    loadHeadlines(headlines) {
        this.clearHeadlineFields();
        if (headlines && headlines.length > 0) {
            headlines.forEach((headline, index) => {
                if (index > 0) {
                    this.addHeadlineField();
                }
                const field = document.querySelectorAll('.headline-field')[index];
                if (field) {
                    const input = field.querySelector('.headline-input');
                    if (input) input.value = headline || '';
                }
            });
        }
        this.updateRemoveHeadlineButton();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadlinesFieldManager;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.HeadlinesFieldManager = HeadlinesFieldManager;
}
