/**
 * WorldviewLocationCatalog - Manages location and connection data
 * Loads data from JSON files and provides access methods
 */
export class WorldviewLocationCatalog {
    constructor() {
        this.events = [];
        this.cities = [];
        this.fictionalCities = [];
        this.airports = [];
        this.seaports = [];
        this.allSeaports = []; // Store all seaports before filtering (for display purposes)
        this.trainConnections = [];
        this.secondaryConnections = [];
        this.seaportConnections = [];
        this.loaded = false;
        this.currentEventPage = 1; // Current page (1-indexed)
        this.eventsPerPage = 10; // Number of events per page
    }

    /**
     * Load all data from JSON files
     * @returns {Promise<void>}
     */
    async loadData() {
        try {
            // Load locations
            const locationsResponse = await fetch('src/data/worldview/locations.json');
            const locationsData = await locationsResponse.json();
            
            // Check localStorage first for events (user's saved events)
            const savedEvents = localStorage.getItem('timelineEvents');
            if (savedEvents) {
                try {
                    this.events = JSON.parse(savedEvents);
                    console.log('WorldviewLocationCatalog: Loaded events from localStorage');
                } catch (error) {
                    console.error('WorldviewLocationCatalog: Error parsing events from localStorage:', error);
                    // Fallback to locations.json if localStorage is corrupted
                    this.events = locationsData.events || [];
                }
            } else {
                // No saved events, use empty array (test events removed)
                this.events = [];
                console.log('WorldviewLocationCatalog: No saved events in localStorage, using empty array');
            }
            
            this.cities = locationsData.cities || [];
            this.fictionalCities = locationsData.fictionalCities || [];
            this.airports = locationsData.airports || [];
            this.seaports = locationsData.seaports || [];
            this.allSeaports = [...(locationsData.seaports || [])]; // Store all seaports before filtering

            // Load connections
            const connectionsResponse = await fetch('src/data/connection-codex/connections.json');
            const connectionsData = await connectionsResponse.json();
            this.trainConnections = connectionsData.trainConnections || [];
            this.secondaryConnections = connectionsData.secondaryConnections || [];
            this.seaportConnections = connectionsData.seaportConnections || [];

            // Filter out seaports with 0 connections (for transport system only)
            this.filterSeaports();

            this.loaded = true;
            console.log('WorldviewLocationCatalog: All data loaded successfully');
        } catch (error) {
            console.error('WorldviewLocationCatalog: Error loading data:', error);
            throw error;
        }
    }

    /**
     * Filter out seaports with no connections
     */
    filterSeaports() {
        const connectionCounts = {};
        this.seaports.forEach(port => {
            connectionCounts[port.name] = 0;
        });

        // Count connections (both from and to)
        this.seaportConnections.forEach(conn => {
            if (connectionCounts.hasOwnProperty(conn.from)) {
                connectionCounts[conn.from]++;
            }
            if (connectionCounts.hasOwnProperty(conn.to)) {
                connectionCounts[conn.to]++;
            }
        });

        // Find ports with 0 connections
        const portsToRemove = new Set();
        Object.keys(connectionCounts).forEach(portName => {
            if (connectionCounts[portName] === 0) {
                portsToRemove.add(portName);
                console.log(`WorldviewLocationCatalog: Removing port with 0 connections: ${portName}`);
            }
        });

        // Filter seaports array
        this.seaports = this.seaports.filter(port => !portsToRemove.has(port.name));

        // Filter seaportConnections to remove any connections referencing deleted ports
        this.seaportConnections = this.seaportConnections.filter(conn => 
            !portsToRemove.has(conn.from) && !portsToRemove.has(conn.to)
        );

        console.log(`WorldviewLocationCatalog: Filtered seaports: ${this.seaports.length} ports remaining (removed ${portsToRemove.size})`);
    }

    /**
     * Get city by name
     * @param {string} name - City name
     * @returns {Object|null}
     */
    getCity(name) {
        return this.cities.find(city => city.name === name) || null;
    }

    /**
     * Get airport by name
     * @param {string} name - Airport name
     * @returns {Object|null}
     */
    getAirport(name) {
        return this.airports.find(airport => airport.name === name) || null;
    }

    /**
     * Get seaport by name
     * @param {string} name - Seaport name
     * @returns {Object|null}
     */
    getSeaport(name) {
        return this.seaports.find(port => port.name === name) || null;
    }

    /**
     * Get all cities
     * @returns {Array}
     */
    getAllCities() {
        return this.cities;
    }

    /**
     * Get all airports
     * @returns {Array}
     */
    getAllAirports() {
        return this.airports;
    }

    /**
     * Get all seaports
     * @returns {Array}
     */
    getAllSeaports() {
        return this.seaports;
    }

    /**
     * Get all events
     * @returns {Array}
     */
    getAllEvents() {
        return this.events;
    }
    
    /**
     * Get events for the current page
     * @returns {Array}
     */
    getEventsForCurrentPage() {
        const startIndex = (this.currentEventPage - 1) * this.eventsPerPage;
        const endIndex = startIndex + this.eventsPerPage;
        return this.events.slice(startIndex, endIndex);
    }
    
    /**
     * Get total number of event pages
     * @returns {number}
     */
    getTotalEventPages() {
        return Math.ceil(this.events.length / this.eventsPerPage);
    }
    
    /**
     * Get current event page number
     * @returns {number}
     */
    getCurrentEventPage() {
        return this.currentEventPage;
    }
    
    /**
     * Set current event page
     * @param {number} page - Page number (1-indexed)
     */
    setCurrentEventPage(page) {
        const totalPages = this.getTotalEventPages();
        if (page >= 1 && page <= totalPages) {
            this.currentEventPage = page;
        }
    }
    
    /**
     * Go to next event page
     * @returns {boolean} - True if page changed, false if already on last page
     */
    nextEventPage() {
        const totalPages = this.getTotalEventPages();
        if (this.currentEventPage < totalPages) {
            this.currentEventPage++;
            return true;
        }
        return false;
    }
    
    /**
     * Go to previous event page
     * @returns {boolean} - True if page changed, false if already on first page
     */
    previousEventPage() {
        if (this.currentEventPage > 1) {
            this.currentEventPage--;
            return true;
        }
        return false;
    }

    /**
     * Get train connections
     * @returns {Array}
     */
    getTrainConnections() {
        return this.trainConnections;
    }

    /**
     * Get secondary connections
     * @returns {Array}
     */
    getSecondaryConnections() {
        return this.secondaryConnections;
    }

    /**
     * Get seaport connections
     * @returns {Array}
     */
    getSeaportConnections() {
        return this.seaportConnections;
    }
}


