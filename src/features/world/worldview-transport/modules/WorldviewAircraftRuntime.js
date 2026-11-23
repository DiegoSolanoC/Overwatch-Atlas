import { latLonToVector3 } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getTransportCaps } from '../../worldview-shared-assets/constants/WorldviewQualitySettings.js';

const _planeUp = new THREE.Vector3();
const _planeRight = new THREE.Vector3();
const _planeCorrectedUp = new THREE.Vector3();
const _planeTangent = new THREE.Vector3();
const _planeForward = new THREE.Vector3();
const _planeRotMat = new THREE.Matrix4();
const _planeBankQuat = new THREE.Quaternion();
const _atcAway = new THREE.Vector3();
const _atcOtherPos = new THREE.Vector3();

/** Minimum center-to-center distance before ATC nudges a plane off-corridor. */
const ATC_SEPARATION = 0.048;
const ATC_MAX_LATERAL = 0.06;
const ATC_MAX_ALTITUDE = 0.018;

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/**
 * Soft air-traffic control: when another plane is too close, accumulate a
 * lateral / altitude detour target (planes may leave their assigned corridor).
 */
function computeAtcDetour(plane, planes, progress, right, up) {
    const data = plane.userData;
    let targetLat = 0;
    let targetAlt = 0;

    // Near airports, pull detours back so approaches still meet the runway
    const terminalFade = Math.sin(progress * Math.PI);
    if (terminalFade < 0.12) {
        return { targetLat: 0, targetAlt: 0, terminalFade };
    }

    for (let j = 0; j < planes.length; j++) {
        const other = planes[j];
        if (!other || other === plane) continue;
        const od = other.userData;
        if (!od?.isPlane || od.hasLanded) continue;
        if (od.progress <= 0 || od.progress > 1) continue;

        _atcOtherPos.copy(other.position);
        _atcAway.subVectors(plane.position, _atcOtherPos);
        const dist = _atcAway.length();
        if (dist >= ATC_SEPARATION || dist < 1e-6) continue;

        const push = (ATC_SEPARATION - dist) * 1.15;
        const lateral = _atcAway.dot(right);
        if (Math.abs(lateral) < 0.002) {
            // Head-on / stacked — pick a stable side from ATC ids
            const side = (data.atcId || '') > (od.atcId || '') ? 1 : -1;
            targetLat += side * push;
        } else {
            targetLat += Math.sign(lateral) * push;
        }

        if (dist < ATC_SEPARATION * 0.65) {
            const climbSide = (data.atcId || '') > (od.atcId || '') ? 1 : -1;
            targetAlt += climbSide * push * 0.35;
        }
    }

    return {
        targetLat: clamp(targetLat, -ATC_MAX_LATERAL, ATC_MAX_LATERAL),
        targetAlt: clamp(targetAlt, -ATC_MAX_ALTITUDE, ATC_MAX_ALTITUDE),
        terminalFade
    };
}

export const worldviewAircraftRuntime = {
    updatePlanes() {
        if (!this.sceneModel.getHyperloopVisible()) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        if (isMapView) return;

        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const planes = this.transportModel.getPlanes();

        for (let i = planes.length - 1; i >= 0; i--) {
            const plane = planes[i];
            const data = plane.userData;

            if (data.isMultiStop && data.progress >= 1.0 && !data.isTransitioning) {
                if (data.currentRouteIndex < data.routes.length - 1) {
                    data.isTransitioning = true;
                    data.currentRouteIndex++;
                    const nextRoute = data.routes[data.currentRouteIndex];

                    data.curve = nextRoute.curve;
                    data.speed = nextRoute.speed;
                    data.from = nextRoute.from;
                    data.to = nextRoute.to;
                    data.laneIndex = nextRoute.laneIndex;
                    data.progress = 0;
                    data.hasLanded = false;
                    data.landingTimer = 0;
                    data.detourLateral = 0;
                    data.detourAltitude = 0;
                    data.targetDetourLateral = 0;
                    data.targetDetourAltitude = 0;
                } else {
                    this.transportView?.disposePlaneContrail?.(plane);
                    if (plane.parent) plane.parent.remove(plane);
                    this.transportModel.removePlane(plane);
                    continue;
                }
            }

            if (data.hasLanded) {
                data.landingTimer += 1;
                if (data.landingTimer > 60) {
                    this.transportView?.disposePlaneContrail?.(plane);
                    if (plane.parent) plane.parent.remove(plane);
                    this.transportModel.removePlane(plane);
                    continue;
                }
                continue;
            }

            data.progress += data.speed;

            if (data.progress >= 1.0 && !data.isMultiStop) {
                data.progress = 1.0;
                data.hasLanded = true;
                data.landingTimer = 0;
                continue;
            }

            if (data.isMultiStop && data.progress > 0.1 && data.progress < 0.9 && data.isTransitioning) {
                data.isTransitioning = false;
            }

            if (data.progress > 0 && data.progress <= 1) {
                const position = data.curve.getPointAt(data.progress);
                plane.position.copy(position);

                data.curve.getTangentAt(data.progress, _planeTangent).normalize();
                _planeUp.copy(position).normalize();
                _planeRight.crossVectors(_planeTangent, _planeUp).normalize();
                _planeCorrectedUp.crossVectors(_planeRight, _planeTangent).normalize();
                _planeForward.copy(_planeTangent).negate();

                // ATC: ease toward a detour when traffic is too close
                const atc = computeAtcDetour(plane, planes, data.progress, _planeRight, _planeUp);
                data.targetDetourLateral = atc.targetLat;
                data.targetDetourAltitude = atc.targetAlt;
                data.detourLateral += (data.targetDetourLateral - (data.detourLateral || 0)) * 0.14;
                data.detourAltitude += (data.targetDetourAltitude - (data.detourAltitude || 0)) * 0.12;

                const fade = atc.terminalFade;
                if (fade > 0.01 && (Math.abs(data.detourLateral) > 1e-5 || Math.abs(data.detourAltitude) > 1e-5)) {
                    plane.position.addScaledVector(_planeRight, data.detourLateral * fade);
                    plane.position.addScaledVector(_planeUp, data.detourAltitude * fade);
                }

                /* Sample every frame while emitting — cut-offs create the visual gaps. */
                this.transportView.createTrailSegment(plane, plane.position, _planeForward, _planeRight);

                data.bankChangeTimer += 1;
                if (data.bankChangeTimer > 60) {
                    // Bank toward active detour when ATC is steering
                    if (Math.abs(data.detourLateral) > 0.01) {
                        data.targetBankAngle = clamp(-data.detourLateral * 4.5, -0.45, 0.45);
                    } else {
                        data.targetBankAngle = (Math.random() - 0.5) * 0.3;
                    }
                    data.bankChangeTimer = 0;
                }

                data.bankAngle += (data.targetBankAngle - data.bankAngle) * 0.05;

                _planeRotMat.makeBasis(_planeRight, _planeCorrectedUp, _planeTangent.negate());
                plane.quaternion.setFromRotationMatrix(_planeRotMat);

                _planeBankQuat.setFromAxisAngle(_planeTangent, data.bankAngle);
                plane.quaternion.multiply(_planeBankQuat);

                plane.visible = hyperloopVisible;
            }
        }
    },

    spawnPlanesRandomly() {
        const airports = this.dataModel ? this.dataModel.getAllAirports() : [];
        const airportByName = new Map(airports.map((a) => [a.name, a]));
        const connections = this.dataModel?.getAirportConnections?.() || [];
        const minDistance = 0.4;
        const DEPARTURE_COOLDOWN_MS = 8000;

        this.planeSpawnInterval = setInterval(() => {
            const isPageVisible = this.sceneModel.getPageVisible();
            const hyperloopVisible = this.sceneModel.getHyperloopVisible();
            const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;

            if (!isPageVisible || !hyperloopVisible || isMapView) return;

            const MAX_PLANES = getTransportCaps().maxPlanes;
            const planes = this.transportModel.getPlanes();
            if (planes.length >= MAX_PLANES || airports.length < 2) return;

            let from = null;
            let to = null;

            // Prefer authored corridors so traffic follows the network (lanes/ATC matter more)
            if (connections.length > 0 && Math.random() < 0.82) {
                for (let attempt = 0; attempt < 12; attempt++) {
                    const conn = connections[Math.floor(Math.random() * connections.length)];
                    let a = airportByName.get(conn.from);
                    let b = airportByName.get(conn.to);
                    if (!a || !b) continue;
                    if (Math.random() < 0.5) {
                        const tmp = a; a = b; b = tmp;
                    }
                    if (!this.transportModel.canDepart('plane', a.name, DEPARTURE_COOLDOWN_MS)) continue;
                    if (!this.transportModel.canDepartRoutePair(a.name, b.name, DEPARTURE_COOLDOWN_MS)) continue;
                    from = a;
                    to = b;
                    break;
                }
            }

            if (!from) {
                for (let attempt = 0; attempt < 10; attempt++) {
                    const candidateFrom = airports[Math.floor(Math.random() * airports.length)];
                    if (!candidateFrom) continue;
                    if (!this.transportModel.canDepart('plane', candidateFrom.name, DEPARTURE_COOLDOWN_MS)) continue;
                    from = candidateFrom;
                    break;
                }
                if (!from) return;

                to = airports[Math.floor(Math.random() * airports.length)];
                while (to === from) to = airports[Math.floor(Math.random() * airports.length)];
                if (!this.transportModel.canDepartRoutePair(from.name, to.name, DEPARTURE_COOLDOWN_MS)) return;
            }

            const fromPos = latLonToVector3(from.lat, from.lon, 1.0);
            const toPos = latLonToVector3(to.lat, to.lon, 1.0);
            const distance = fromPos.distanceTo(toPos);

            const isMultiStop = Math.random() < 0.35;
            if (isMultiStop && connections.length >= 2) {
                // Walk a short path along the connection graph when possible
                const selected = [from];
                let current = from;
                const hops = Math.floor(Math.random() * 2) + 2;
                for (let h = 0; h < hops; h++) {
                    const neighbors = [];
                    for (let c = 0; c < connections.length; c++) {
                        const conn = connections[c];
                        if (conn.from === current.name && airportByName.has(conn.to)) {
                            neighbors.push(airportByName.get(conn.to));
                        } else if (conn.to === current.name && airportByName.has(conn.from)) {
                            neighbors.push(airportByName.get(conn.from));
                        }
                    }
                    const unused = neighbors.filter((n) => n && !selected.includes(n));
                    if (!unused.length) break;
                    const next = unused[Math.floor(Math.random() * unused.length)];
                    selected.push(next);
                    current = next;
                }
                if (selected.length >= 2) {
                    this.transportModel.markDeparted('plane', selected[0].name);
                    this.transportModel.markDepartedRoutePair(selected[0].name, selected[1].name);
                    this.createMultiStopPlane(selected);
                    return;
                }
            }

            if (distance >= minDistance) {
                this.transportModel.markDeparted('plane', from.name);
                this.transportModel.markDepartedRoutePair(from.name, to.name);
                this.createPlane(from, to);
            }
        }, 3000);
    },

    stopSpawning() {
        if (!this.planeSpawnInterval) return;
        clearInterval(this.planeSpawnInterval);
        this.planeSpawnInterval = null;
    }
};
