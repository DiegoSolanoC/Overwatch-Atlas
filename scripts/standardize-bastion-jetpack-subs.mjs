#!/usr/bin/env node
/**
 * Standardize Bastion + Jetpack Cat sound-effect subtitles to **like this**.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

const HEROES = new Set(['Bastion', 'Jetpack Cat']);

/** Pull descriptive label from theater voice filename when possible. */
function labelFromVoice(voice) {
    const base = String(voice || '')
        .replace(/\.ogg$/i, '')
        .split(/[/\\]/)
        .pop();
    if (!base) return '';
    // Jetpack_Cat_-_(questioning_meows)_(2)  OR  Bastion_-_(impressed_beeps)
    // OR Jetpack_Cat_-_Match_Start_(cat_sounds)_2
    let body = base.replace(/^[^]+_-_/, '');
    // strip trailing _(2) / _2 counters
    body = body.replace(/_\(\d+\)$/i, '').replace(/_(\d+)$/i, '');
    // Match_Start_(cat_sounds) → cat sounds
    body = body.replace(/^(Match_Start|Set_Up)_/i, '');
    // drop interaction suffixes
    body = body.replace(/_\([^)]*interaction[^)]*\)$/i, '');
    body = body.replace(/_\(Gracie\)$/i, '');
    // unwrap outer ( ... )
    const m = body.match(/^\((.+)\)$/);
    if (m) body = m[1];
    // if still has _(cat_sounds) style mid
    const m2 = body.match(/\(([^)]+)\)/);
    if (m2 && /beep|meow|hiss|purr|chirp|whistle|noise|sound|box/i.test(m2[1])) {
        body = m2[1];
    }
    return body.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert a whole-line or partial stage direction to **text**.
 * Returns null if unchanged / not a stage line.
 */
function normalizeSubtitle(subtitles, voice) {
    const original = String(subtitles ?? '');
    let s = original.trim();
    if (!s) return null;

    // Special: translation arrows keep right-hand text
    // *[bastion beeps]* → (*"Wow..."*)
    const arrow = s.match(/^\*?\[([^\]]+)\]\*?\s*→\s*\(?\*?(.+?)\*?\)?\s*$/);
    if (arrow) {
        let left = arrow[1].trim();
        let right = arrow[2].trim().replace(/^\(|\)$/g, '').replace(/^\*|\*$/g, '').trim();
        const next = `**${left}** → (${right})`;
        return next === original ? null : next;
    }

    // **(cat sounds)** (Match Start 2)  →  **cat sounds**
    let m = s.match(/^\*\*\((.+)\)\*\*(?:\s*\([^)]+\))?$/);
    if (m) {
        const next = `**${m[1].trim()}**`;
        return next === original ? null : next;
    }

    // *(sheepish beeps)*
    m = s.match(/^\*\((.+)\)\*$/);
    if (m) {
        const next = `**${m[1].trim()}**`;
        return next === original ? null : next;
    }

    // *[sad beeps]*  or  *[whirs in approval]*
    m = s.match(/^\*\[(.+)\]\*$/);
    if (m) {
        let inner = m[1].trim();
        // prefer voice label when this is a generic/whir description
        const fromVoice = labelFromVoice(voice);
        if (fromVoice && /whirs in approval|bastion beeps|series of beeps|various beeps/i.test(inner)) {
            inner = fromVoice;
        } else if (fromVoice && /impressed beeps/i.test(fromVoice) && /whirs|approval/i.test(inner)) {
            inner = fromVoice;
        }
        const next = `**${inner}**`;
        return next === original ? null : next;
    }

    // *reverent beeping* / *happy beep boop* / *series of beeps*
    m = s.match(/^\*([^*]+)\*$/);
    if (m && !s.includes('**')) {
        let inner = m[1].trim();
        // strip accidental brackets inside
        inner = inner.replace(/^\[|\]$/g, '');
        const fromVoice = labelFromVoice(voice);
        if (fromVoice && /series of beeps|various beeps/i.test(inner)) inner = fromVoice;
        const next = `**${inner}**`;
        return next === original ? null : next;
    }

    // Already perfect **sad beeps**
    if (/^\*\*[^*]+\*\*$/.test(s) && !/^\*\*\(/.test(s)) {
        return null;
    }

    // Plain phonetic / meow text that should be descriptive stage direction
    const fromVoice = labelFromVoice(voice);
    if (fromVoice && /^(meow[\s?.!]*)+$/i.test(s.replace(/[?.!,]/g, (ch) => ch))) {
        // simplify: if only meow syllables
        if (/^[\smeowMEOW?.!,]+$/.test(s)) {
            const next = `**${fromVoice}**`;
            return next === original ? null : next;
        }
    }
    if (fromVoice && /^bwee/i.test(s)) {
        const next = `**${fromVoice}**`;
        return next === original ? null : next;
    }

    // Inline Lucio-style leftover on Bastion shouldn't happen; skip spoken dialogue
    return null;
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
let changed = 0;
/** @type {string[]} */
const log = [];

for (const c of raw.conversations) {
    for (const line of c.lines || []) {
        if (!HEROES.has(line.hero)) continue;
        const next = normalizeSubtitle(line.subtitles, line.voice);
        if (next == null) continue;
        log.push(`${line.hero} | ${c.name}: ${JSON.stringify(line.subtitles)} → ${JSON.stringify(next)}`);
        line.subtitles = next;
        changed += 1;
    }
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Updated ${changed} lines`);
for (const row of log) console.log(row);

// recount remaining nonstandard
const patterns = new Map();
for (const c of raw.conversations) {
    for (const l of c.lines || []) {
        if (!HEROES.has(l.hero)) continue;
        const s = String(l.subtitles || '').trim();
        if (!s) continue;
        let kind = 'other';
        if (/^\*\*[^*]+\*\*$/.test(s)) kind = '**ok**';
        else if (/^\*\*[^*]+\*\*/.test(s)) kind = '**partial**';
        else if (/\*|\[|\(/.test(s) || /^(meow|bwee)/i.test(s)) kind = 'still-odd';
        else kind = 'spoken/plain';
        patterns.set(kind, (patterns.get(kind) || 0) + 1);
        if (kind !== '**ok**') {
            // show leftovers
        }
    }
}
console.log('\nAfter:');
for (const [k, v] of patterns) console.log(v, k);

// list leftovers
console.log('\nLeftovers:');
for (const c of raw.conversations) {
    for (const l of c.lines || []) {
        if (!HEROES.has(l.hero)) continue;
        const s = String(l.subtitles || '').trim();
        if (!s) continue;
        if (/^\*\*[^*]+\*\*$/.test(s)) continue;
        console.log(l.hero, c.name, JSON.stringify(s), 'voice=', l.voice || '');
    }
}
