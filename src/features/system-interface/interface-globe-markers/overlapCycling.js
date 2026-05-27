const OVERLAP_CYCLE_MS = 5000;
const OVERLAP_SECOND_COLOR = 0xff69b4;

/**
 * Auto-rotates visibility for multiple markers that share the same lat/lon.
 */
export class OverlapCyclingController {
    constructor() {
        this.overlapCycleInterval = null;
        this.overlapGroups = [];
        this.overlapCyclingPaused = false;
    }

    setupOverlapCycling(markers) {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];

        const coordinateGroups = new Map();

        markers.forEach(marker => {
            if (!marker.userData || !marker.userData.event) return;

            const event = marker.userData.event;
            const lat = event.lat;
            const lon = event.lon;

            if (lat == null || lon == null) return;

            const key = `${lat},${lon}`;
            if (!coordinateGroups.has(key)) {
                coordinateGroups.set(key, []);
            }
            coordinateGroups.get(key).push(marker);
        });

        coordinateGroups.forEach((groupMarkers) => {
            if (groupMarkers.length > 1) {
                this.overlapGroups.push({
                    markers: groupMarkers,
                    currentIndex: 0
                });

                groupMarkers.forEach((marker, index) => {
                    marker.visible = (index === 0);
                    if (marker.userData.pinLine) {
                        marker.userData.pinLine.visible = (index === 0);
                    }

                    if (!marker.userData._trueOriginalColor && marker.userData.originalColor) {
                        marker.userData._trueOriginalColor = marker.userData.originalColor;
                    }

                    if (index === 0) {
                        if (marker.userData.originalColor) {
                            marker.material.color.setHex(marker.userData.originalColor);
                        }
                    } else if (index === 1) {
                        marker.material.color.setHex(OVERLAP_SECOND_COLOR);
                    }
                });
            }
        });

        if (this.overlapGroups.length > 0) {
            this.overlapCycleInterval = setInterval(() => {
                this.cycleOverlaps();
            }, OVERLAP_CYCLE_MS);
        }
    }

    cycleOverlaps() {
        if (this.overlapCyclingPaused) {
            return;
        }

        this.overlapGroups.forEach(group => {
            const currentMarker = group.markers[group.currentIndex];
            if (currentMarker) {
                currentMarker.visible = false;
                if (currentMarker.userData.pinLine) {
                    currentMarker.userData.pinLine.visible = false;
                }
                if (window.globeController?.markerPulseService) {
                    window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
                }
            }

            group.currentIndex = (group.currentIndex + 1) % group.markers.length;

            const nextMarker = group.markers[group.currentIndex];
            if (nextMarker) {
                nextMarker.visible = true;
                if (nextMarker.userData.pinLine) {
                    nextMarker.userData.pinLine.visible = true;
                }

                if (group.currentIndex === 0) {
                    if (nextMarker.userData.originalColor) {
                        nextMarker.material.color.setHex(nextMarker.userData.originalColor);
                    }
                } else if (group.currentIndex === 1) {
                    nextMarker.material.color.setHex(OVERLAP_SECOND_COLOR);
                }

                if (nextMarker.userData._hoverGlowBase) {
                    delete nextMarker.userData._hoverGlowBase;
                }

                const hoveredMarker = window.globeController?.markerPulseService?.getHoveredMarker();
                if (hoveredMarker === currentMarker) {
                    if (window.globeController?.markerPulseService) {
                        window.globeController.markerPulseService.startEventMarkerPulse(nextMarker);
                        window.globeController.markerPulseService.setHoveredMarker(nextMarker);
                    }
                }
            }
        });
    }

    pauseOverlapCycling() {
        if (!this.overlapCyclingPaused && this.overlapGroups.length > 0) {
            this.overlapCyclingPaused = true;
        }
    }

    resumeOverlapCycling() {
        if (this.overlapCyclingPaused) {
            this.overlapCyclingPaused = false;
        }
    }

    stopOverlapCycling() {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = null;
        }
        this.overlapGroups = [];
    }

    /**
     * @returns {THREE.Object3D|null}
     */
    forceCycleToEvent(event) {
        if (!event) return null;

        const group = this.overlapGroups.find(g =>
            g.markers.some(m => {
                const markerEvent = m.userData.event;
                if (!markerEvent) return false;
                return markerEvent.name === event.name
                    && markerEvent.lat === event.lat
                    && markerEvent.lon === event.lon;
            })
        );

        if (!group) {
            return null;
        }

        const targetIndex = group.markers.findIndex(m => {
            const markerEvent = m.userData.event;
            if (!markerEvent) return false;
            return markerEvent.name === event.name
                && markerEvent.lat === event.lat
                && markerEvent.lon === event.lon;
        });

        if (targetIndex === -1) {
            return null;
        }

        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.visible = false;
            if (currentMarker.userData.pinLine) {
                currentMarker.userData.pinLine.visible = false;
            }
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
            }
        }

        group.currentIndex = targetIndex;

        const targetMarker = group.markers[targetIndex];
        if (targetMarker) {
            targetMarker.visible = true;
            if (targetMarker.userData.pinLine) {
                targetMarker.userData.pinLine.visible = true;
            }

            if (targetIndex === 0) {
                if (targetMarker.userData._trueOriginalColor) {
                    targetMarker.material.color.setHex(targetMarker.userData._trueOriginalColor);
                    targetMarker.userData.originalColor = targetMarker.userData._trueOriginalColor;
                } else if (targetMarker.userData.originalColor) {
                    targetMarker.material.color.setHex(targetMarker.userData.originalColor);
                }
            } else if (targetIndex === 1) {
                targetMarker.material.color.setHex(OVERLAP_SECOND_COLOR);
                targetMarker.userData.originalColor = OVERLAP_SECOND_COLOR;
            }

            if (targetMarker.userData._hoverGlowBase) {
                delete targetMarker.userData._hoverGlowBase;
            }
        }

        this._restartOverlapInterval();
        return targetMarker;
    }

    forceCycleMarker(marker) {
        const group = this.overlapGroups.find(g => g.markers.includes(marker));
        if (!group) return;

        const currentMarker = group.markers[group.currentIndex];
        if (currentMarker) {
            currentMarker.visible = false;
            if (currentMarker.userData.pinLine) {
                currentMarker.userData.pinLine.visible = false;
            }
            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
            }
        }

        group.currentIndex = (group.currentIndex + 1) % group.markers.length;

        const nextMarker = group.markers[group.currentIndex];
        if (nextMarker) {
            nextMarker.visible = true;
            if (nextMarker.userData.pinLine) {
                nextMarker.userData.pinLine.visible = true;
            }

            if (group.currentIndex === 0) {
                if (nextMarker.userData._trueOriginalColor) {
                    nextMarker.material.color.setHex(nextMarker.userData._trueOriginalColor);
                    nextMarker.userData.originalColor = nextMarker.userData._trueOriginalColor;
                } else if (nextMarker.userData.originalColor) {
                    nextMarker.material.color.setHex(nextMarker.userData.originalColor);
                }
            } else if (group.currentIndex === 1) {
                nextMarker.material.color.setHex(OVERLAP_SECOND_COLOR);
                nextMarker.userData.originalColor = OVERLAP_SECOND_COLOR;
            }

            if (nextMarker.userData._hoverGlowBase) {
                delete nextMarker.userData._hoverGlowBase;
            }

            if (nextMarker.material) {
                nextMarker.userData._hoverGlowBase = {
                    colorHex: nextMarker.material.color.getHex(),
                    opacity: (typeof nextMarker.material.opacity === 'number') ? nextMarker.material.opacity : 1
                };
            }

            if (window.globeController?.markerPulseService) {
                window.globeController.markerPulseService.setHoveredMarker(null);
                window.globeController.markerPulseService.stopEventMarkerPulse(currentMarker);
                window.globeController.markerPulseService.stopEventMarkerPulse(nextMarker);

                if (nextMarker.material) {
                    nextMarker.material.needsUpdate = true;
                }

                window.globeController.markerPulseService.startEventMarkerPulse(nextMarker);
                window.globeController.markerPulseService.setHoveredMarker(nextMarker);

                if (window.globeController?.interactionController?.markerService) {
                    const markerService = window.globeController.interactionController.markerService;
                    markerService.highlightNumberButtonForMarker(nextMarker);
                    markerService._syncEventsHoverPreviewFromMarker(nextMarker);
                }
            }
        }

        this._restartOverlapInterval();
    }

    _restartOverlapInterval() {
        if (this.overlapCycleInterval) {
            clearInterval(this.overlapCycleInterval);
            this.overlapCycleInterval = setInterval(() => {
                this.cycleOverlaps();
            }, OVERLAP_CYCLE_MS);
        }
    }
}
