/**
 * RouteController - Handles route finding, graph building, and reservations
 */
export class RouteController {
    constructor(transportModel) {
        this.transportModel = transportModel;
    }

    /**
     * Get unique route key for reservation system
     * @param {string} from - From location
     * @param {string} to - To location
     * @returns {string}
     */
    getRouteKey(from, to) {
        return [from, to].sort().join('-');
    }

    /**
     * Calculate route distance (approximate arc length)
     * @param {THREE.Curve} curve - Route curve
     * @returns {number}
     */
    calculateRouteDistance(curve) {
        const points = curve.getPoints(50);
        let distance = 0;
        for (let i = 1; i < points.length; i++) {
            distance += points[i].distanceTo(points[i - 1]);
        }
        return distance;
    }

    /**
     * Check if a route is available (not in use)
     * @param {string} from - From city
     * @param {string} to - To city
     * @returns {boolean}
     */
    isRouteAvailable(from, to) {
        const key = this.getRouteKey(from, to);
        const reservations = this.transportModel.getRouteReservations();
        return !reservations[key];
    }

    /**
     * Reserve a route for a train
     * @param {string} from - From city
     * @param {string} to - To city
     * @param {string} trainId - Train ID
     */
    reserveRoute(from, to, trainId) {
        const key = this.getRouteKey(from, to);
        const reservations = this.transportModel.getRouteReservations();
        reservations[key] = trainId;
    }

    /**
     * Release a route reservation
     * @param {string} from - From city
     * @param {string} to - To city
     * @param {string} trainId - Train ID
     */
    releaseRoute(from, to, trainId) {
        const key = this.getRouteKey(from, to);
        const reservations = this.transportModel.getRouteReservations();
        if (reservations[key] === trainId) {
            delete reservations[key];
        }
    }

    /**
     * Build route graph for multi-stop pathfinding
     */
    buildRouteGraph() {
        const routeGraph = {};
        const routeCurves = this.transportModel.getRouteCurves();
        
        routeCurves.forEach(routeData => {
            if (!routeGraph[routeData.from]) routeGraph[routeData.from] = [];
            if (!routeGraph[routeData.to]) routeGraph[routeData.to] = [];
            
            routeGraph[routeData.from].push({ city: routeData.to, routeData: routeData });
            routeGraph[routeData.to].push({ city: routeData.from, routeData: routeData });
        });
        
        this.transportModel.setRouteGraph(routeGraph);
    }

    /**
     * Find alternate route from current city to destination
     * @param {string} fromCity - From city
     * @param {string} toCity - To city
     * @param {string} previousCity - Previous city to avoid
     * @param {number} maxHops - Maximum hops
     * @returns {Array|null}
     */
    findAlternateRoute(fromCity, toCity, previousCity, maxHops = 5) {
        const routeGraph = this.transportModel.getRouteGraph();
        const queue = [{ city: fromCity, path: [fromCity], routes: [] }];
        const visited = new Set([fromCity]);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.city === toCity && current.routes.length > 0 && current.routes.length <= maxHops) {
                return current.routes;
            }
            
            if (current.routes.length >= maxHops) continue;
            
            const neighbors = routeGraph[current.city] || [];
            for (const neighbor of neighbors) {
                if (neighbor.city === previousCity) continue;
                if (visited.has(neighbor.city)) continue;
                if (!this.isRouteAvailable(current.city, neighbor.city)) continue;
                
                visited.add(neighbor.city);
                
                const orientedRoute = {
                    curve: neighbor.routeData.curve,
                    from: current.city,
                    to: neighbor.city,
                    isMainRoute: neighbor.routeData.isMainRoute,
                    needsReverse: neighbor.routeData.from !== current.city,
                    fromLat: (neighbor.routeData.from !== current.city) ? neighbor.routeData.toLat : neighbor.routeData.fromLat,
                    fromLon: (neighbor.routeData.from !== current.city) ? neighbor.routeData.toLon : neighbor.routeData.fromLon,
                    toLat: (neighbor.routeData.from !== current.city) ? neighbor.routeData.fromLat : neighbor.routeData.toLat,
                    toLon: (neighbor.routeData.from !== current.city) ? neighbor.routeData.fromLon : neighbor.routeData.toLon
                };
                
                queue.push({
                    city: neighbor.city,
                    path: [...current.path, neighbor.city],
                    routes: [...current.routes, orientedRoute]
                });
            }
        }
        
        return null;
    }

    /**
     * Find a multi-stop route (BFS with max depth)
     * @param {number} maxStops - Maximum stops
     * @returns {Object|null}
     */
    findMultiStopRoute(maxStops) {
        const routeGraph = this.transportModel.getRouteGraph();
        const allCities = Object.keys(routeGraph);
        if (allCities.length < 2) return null;
        
        function selectWeightedCity() {
            const rand = Math.random();
            if (rand < 0.35 && allCities.includes('Aatlis')) {
                return 'Aatlis';
            } else if (rand < 0.55 && allCities.includes('Midtown')) {
                return 'Midtown';
            } else {
                return allCities[Math.floor(Math.random() * allCities.length)];
            }
        }
        
        const startCity = selectWeightedCity();
        const queue = [{ city: startCity, path: [startCity], routes: [] }];
        const validPaths = [];
        const visited = new Set();
        
        while (queue.length > 0 && validPaths.length < 30) {
            const current = queue.shift();
            
            if (current.routes.length >= 2 && current.path.length <= maxStops + 1) {
                validPaths.push(current);
            }
            
            if (current.path.length > maxStops + 1) continue;
            
            const neighbors = routeGraph[current.city] || [];
            for (const neighbor of neighbors) {
                if (current.path.includes(neighbor.city)) continue;
                
                const pathKey = [...current.path, neighbor.city].join('-');
                if (visited.has(pathKey)) continue;
                visited.add(pathKey);
                
                if (!this.isRouteAvailable(current.city, neighbor.city)) continue;
                
                const orientedRoute = {
                    curve: neighbor.routeData.curve,
                    from: current.city,
                    to: neighbor.city,
                    isMainRoute: neighbor.routeData.isMainRoute,
                    needsReverse: neighbor.routeData.from !== current.city,
                    fromLat: (neighbor.routeData.from !== current.city) ? neighbor.routeData.toLat : neighbor.routeData.fromLat,
                    fromLon: (neighbor.routeData.from !== current.city) ? neighbor.routeData.toLon : neighbor.routeData.fromLon,
                    toLat: (neighbor.routeData.from !== current.city) ? neighbor.routeData.fromLat : neighbor.routeData.toLat,
                    toLon: (neighbor.routeData.from !== current.city) ? neighbor.routeData.fromLon : neighbor.routeData.toLon
                };
                
                queue.push({
                    city: neighbor.city,
                    path: [...current.path, neighbor.city],
                    routes: [...current.routes, orientedRoute]
                });
            }
        }
        
        if (validPaths.length === 0) return null;
        return validPaths[Math.floor(Math.random() * validPaths.length)];
    }

    /**
     * Build boat route graph for multi-stop routes
     */
    buildBoatRouteGraph() {
        const boatRouteGraph = {};
        const boatRouteCurves = this.transportModel.getBoatRouteCurves();
        
        boatRouteCurves.forEach(routeData => {
            if (!boatRouteGraph[routeData.from]) boatRouteGraph[routeData.from] = [];
            if (!boatRouteGraph[routeData.to]) boatRouteGraph[routeData.to] = [];
            
            boatRouteGraph[routeData.from].push({ port: routeData.to, routeData: routeData });
            boatRouteGraph[routeData.to].push({ port: routeData.from, routeData: routeData });
        });
        
        this.transportModel.setBoatRouteGraph(boatRouteGraph);
    }

    /**
     * Check if a boat route is available
     * @param {string} fromPort - From port
     * @param {string} toPort - To port
     * @returns {boolean}
     */
    isBoatRouteAvailable(fromPort, toPort) {
        const reservations = this.transportModel.getBoatRouteReservations();
        const key = `${fromPort}-${toPort}`;
        const reverseKey = `${toPort}-${fromPort}`;
        return !reservations[key] && !reservations[reverseKey];
    }

    /**
     * Reserve a boat route
     * @param {string} fromPort - From port
     * @param {string} toPort - To port
     * @param {string} boatId - Boat ID
     */
    reserveBoatRoute(fromPort, toPort, boatId) {
        const reservations = this.transportModel.getBoatRouteReservations();
        const key = `${fromPort}-${toPort}`;
        reservations[key] = boatId;
    }

    /**
     * Release a boat route
     * @param {string} fromPort - From port
     * @param {string} toPort - To port
     * @param {string} boatId - Boat ID
     */
    releaseBoatRoute(fromPort, toPort, boatId) {
        const reservations = this.transportModel.getBoatRouteReservations();
        const key = `${fromPort}-${toPort}`;
        if (reservations[key] === boatId) {
            delete reservations[key];
        }
    }

    /**
     * Find a multi-stop boat route (BFS with max depth)
     * @param {number} maxStops - Maximum stops
     * @returns {Object|null}
     */
    findMultiStopBoatRoute(maxStops) {
        const boatRouteGraph = this.transportModel.getBoatRouteGraph();
        const allPorts = Object.keys(boatRouteGraph);
        if (allPorts.length < 2) return null;
        
        const startPort = allPorts[Math.floor(Math.random() * allPorts.length)];
        const queue = [{ port: startPort, path: [startPort], routes: [] }];
        const validPaths = [];
        const visited = new Set();
        
        while (queue.length > 0 && validPaths.length < 30) {
            const current = queue.shift();
            
            if (current.routes.length >= 2 && current.path.length <= maxStops + 1) {
                validPaths.push(current);
            }
            
            if (current.path.length > maxStops + 1) continue;
            
            const neighbors = boatRouteGraph[current.port] || [];
            for (const neighbor of neighbors) {
                if (current.path.includes(neighbor.port)) continue;
                
                const pathKey = [...current.path, neighbor.port].join('-');
                if (visited.has(pathKey)) continue;
                visited.add(pathKey);
                
                if (!this.isBoatRouteAvailable(current.port, neighbor.port)) continue;
                
                const orientedRoute = {
                    curve: neighbor.routeData.curve,
                    from: current.port,
                    to: neighbor.port,
                    needsReverse: neighbor.routeData.from !== current.port,
                    fromLat: (neighbor.routeData.from !== current.port) ? neighbor.routeData.toLat : neighbor.routeData.fromLat,
                    fromLon: (neighbor.routeData.from !== current.port) ? neighbor.routeData.toLon : neighbor.routeData.fromLon,
                    toLat: (neighbor.routeData.from !== current.port) ? neighbor.routeData.fromLat : neighbor.routeData.toLat,
                    toLon: (neighbor.routeData.from !== current.port) ? neighbor.routeData.fromLon : neighbor.routeData.toLon
                };
                
                queue.push({
                    port: neighbor.port,
                    path: [...current.path, neighbor.port],
                    routes: [...current.routes, orientedRoute]
                });
            }
        }
        
        if (validPaths.length === 0) return null;
        return validPaths[Math.floor(Math.random() * validPaths.length)];
    }
}







