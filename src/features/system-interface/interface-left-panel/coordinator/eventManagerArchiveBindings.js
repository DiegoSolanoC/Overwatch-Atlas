import {
    findHeroArchiveEventIndex,
    findFactionArchiveEventIndex,
    findNpcArchiveEventIndex,
    findLocationArchiveEventIndex
} from './search/findArchiveEventIndex.js';
import {
    openHeroArchiveEventByName,
    openFactionArchiveEventByName,
    openNpcArchiveEventByName,
    openLocationArchiveEventByName
} from './search/openArchiveEventByName.js';

const FIND_BINDINGS = [
    ['findHeroArchiveEventIndex', findHeroArchiveEventIndex],
    ['findFactionArchiveEventIndex', findFactionArchiveEventIndex],
    ['findNpcArchiveEventIndex', findNpcArchiveEventIndex],
    ['findLocationArchiveEventIndex', findLocationArchiveEventIndex]
];

const OPEN_BINDINGS = [
    ['openHeroArchiveEventByName', openHeroArchiveEventByName],
    ['openFactionArchiveEventByName', openFactionArchiveEventByName],
    ['openNpcArchiveEventByName', openNpcArchiveEventByName],
    ['openLocationArchiveEventByName', openLocationArchiveEventByName]
];

/** @param {new (...args: any[]) => any} Ctor */
export function installEventManagerArchiveBindings(Ctor) {
    for (const [name, fn] of FIND_BINDINGS) {
        Ctor.prototype[name] = function archiveFindBound(arg) {
            return fn(this, arg);
        };
    }
    for (const [name, fn] of OPEN_BINDINGS) {
        Ctor.prototype[name] = function archiveOpenBound(arg) {
            return fn(this, arg);
        };
    }
}
