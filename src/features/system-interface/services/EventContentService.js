/**
 * EventContentService - Handles event sources and filters display
 */
class EventContentService {
    updateSources(event) {
        const eventSourcesSection = document.getElementById('eventSourcesSection');
        const eventSourcesList = document.getElementById('eventSourcesList');
        
        if (event && event.sources && event.sources.length > 0) {
            if (eventSourcesSection && eventSourcesList) {
                eventSourcesList.innerHTML = '';
                
                event.sources.forEach((source) => {
                    const sourceItem = document.createElement('div');
                    sourceItem.className = 'event-source-display-item';
                    
                    if (source.url) {
                        const link = document.createElement('a');
                        link.href = source.url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = source.text;
                        link.className = 'event-source-link';
                        sourceItem.appendChild(link);
                    } else {
                        sourceItem.textContent = source.text;
                        sourceItem.className = 'event-source-text';
                    }
                    
                    eventSourcesList.appendChild(sourceItem);
                });
                
                eventSourcesSection.style.display = 'block';
            }
        } else {
            if (eventSourcesSection) {
                eventSourcesSection.style.display = 'none';
            }
        }
    }

    updateFilters(event) {
        const eventFiltersSection = document.getElementById('eventFiltersSection');
        const eventFiltersList = document.getElementById('eventFiltersList');
        
        if (event && eventFiltersSection && eventFiltersList) {
            eventFiltersList.innerHTML = '';
            
            const heroFilters = event.heroes || [];
            const factionFilters = event.factions || [];
            
            if (heroFilters.length > 0) {
                heroFilters.forEach((filter) => {
                    const filterItem = document.createElement('div');
                    filterItem.className = 'event-filter-display-item';
                    filterItem.textContent = filter;
                    eventFiltersList.appendChild(filterItem);
                });
            }
            
            if (factionFilters.length > 0) {
                factionFilters.forEach((filter) => {
                    const filterItem = document.createElement('div');
                    filterItem.className = 'event-filter-display-item';
                    filterItem.textContent = filter;
                    eventFiltersList.appendChild(filterItem);
                });
            }
            
            if (heroFilters.length > 0 || factionFilters.length > 0) {
                eventFiltersSection.style.display = 'block';
            } else {
                eventFiltersSection.style.display = 'none';
            }
        } else {
            if (eventFiltersSection) {
                eventFiltersSection.style.display = 'none';
            }
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.EventContentService = EventContentService;
}
