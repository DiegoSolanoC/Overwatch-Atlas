import { parseQuoteListWithRoutes } from './lib/wiki-quote-list-parser.mjs';

const zen =
    '<ul><li><b>Zenyatta</b>: Those who seek only to enrich themselves live the most impoverished lives of all.</li>' +
    '<li><b>Roadhog</b>: <i>*sigh*</i></li><li><i>One of two:</i><ul>' +
    '<li><b>Ashe</b>: Yeah? And those who seek my wrath tend to find it.</li>' +
    "<li><b>Junkrat</b>: That's why I'm an artist.</li></ul></li></ul>";

const hanzo =
    '<ul><li><i>One of two:</i><ul>' +
    '<li><b>Junkrat</b>: You look like a man who inherited a vast trove of ostentatious wealth!</li>' +
    '<li><b>Roadhog</b>: You look rich.</li></ul></li>' +
    "<li><b>Hanzo</b>: I gave up my father's empire, and his fortune alongside it.</li>" +
    '<li><i>One of two:</i><ul><li><b>Junkrat</b>: Who has it now?</li>' +
    '<li><b>Roadhog</b>: Shame.</li></ul></li></ul>';

console.log('ZEN', JSON.stringify(parseQuoteListWithRoutes(zen), null, 2));
console.log('HANZO', JSON.stringify(parseQuoteListWithRoutes(hanzo), null, 2));
