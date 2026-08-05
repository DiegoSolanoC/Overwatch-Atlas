import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Fill chatter line partnerMode / partners from wiki-style (with …) conditions.
 *
 * OR  → "at least N of …" / "X, Y, or Z"
 * AND → "X and Y" / "both X and Y" / "X, Y, and Z"
 * Skips category-only, exclusive roster, absence, hybrid OR+AND, events (deferred).
 *
 * Usage: node scripts/apply-chatter-partners.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const convPath = path.join(root, 'src/data/dialogue-theater/conversations.json');
const dry = process.argv.includes('--dry');

/** Canonical hero display names used in theater data */
const CANONICAL = [
    'Ana',
    'Anran',
    'Ashe',
    'Baptiste',
    'Bastion',
    'Brigitte',
    'Cassidy',
    'D.mon',
    'D.va',
    'Domina',
    'Doomfist',
    'Echo',
    'Emre',
    'Freja',
    'Genji',
    'Hanzo',
    'Hazard',
    'Illari',
    'Jetpack Cat',
    'Junker Queen',
    'Junkrat',
    'Juno',
    'Kiriko',
    'Lifeweaver',
    'Lúcio',
    'Mauga',
    'Mei',
    'Mercy',
    'Mizuki',
    'Moira',
    'Orisa',
    'Pharah',
    'Ramattra',
    'Reaper',
    'Reinhardt',
    'Roadhog',
    'Shion',
    'Sierra',
    'Sigma',
    'Sojourn',
    'Soldier 76',
    'Sombra',
    'Symmetra',
    'Torbjörn',
    'Tracer',
    'Vendetta',
    'Venture',
    'Widowmaker',
    'Winston',
    'Wrecking Ball',
    'Wuyang',
    'Zarya',
    'Zenyatta',
];

const ALIASES = new Map([
    ['dva', 'D.va'],
    ['d.va', 'D.va'],
    ['lucio', 'Lúcio'],
    ['lúcio', 'Lúcio'],
    ['torbjorn', 'Torbjörn'],
    ['torbjörn', 'Torbjörn'],
    ['soldier76', 'Soldier 76'],
    ['soldier:76', 'Soldier 76'],
    ['soldier: 76', 'Soldier 76'],
    ['wreckingball', 'Wrecking Ball'],
    ['junkerqueen', 'Junker Queen'],
    ['jetpackcat', 'Jetpack Cat'],
    ['life weaver', 'Lifeweaver'],
]);

function normKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '');
}

const byKey = new Map();
for (const name of CANONICAL) byKey.set(normKey(name), name);
for (const [alias, name] of ALIASES) byKey.set(normKey(alias), name);

/**
 * Longest-first match of hero names in free text.
 * @param {string} text
 * @returns {string[]}
 */
function extractHeroes(text) {
    const raw = String(text || '');
    if (!raw) return [];
    /** @type {{ start: number, end: number, name: string }[]} */
    const hits = [];

    // Explicit aliases that don't substring-match cleanly (Soldier: 76).
    for (const m of raw.matchAll(/soldier\s*:?\s*76/gi)) {
        hits.push({
            start: m.index,
            end: m.index + m[0].length,
            name: 'Soldier 76',
        });
    }

    const names = [...CANONICAL].sort((a, b) => b.length - a.length);
    const lower = raw.toLowerCase();
    for (const name of names) {
        if (normKey(name) === 'soldier76') continue; // handled above
        const needle = name.toLowerCase();
        let from = 0;
        while (from < lower.length) {
            const idx = lower.indexOf(needle, from);
            if (idx < 0) break;
            const end = idx + needle.length;
            const before = idx === 0 ? '' : lower[idx - 1];
            const after = end >= lower.length ? '' : lower[end];
            const boundaryOk =
                (idx === 0 || /[^a-z0-9]/.test(before)) &&
                (end >= lower.length || /[^a-z0-9]/.test(after));
            if (boundaryOk) {
                const overlaps = hits.some((h) => !(end <= h.start || idx >= h.end));
                if (!overlaps) hits.push({ start: idx, end, name });
            }
            from = idx + 1;
        }
    }
    hits.sort((a, b) => a.start - b.start);
    const out = [];
    const seen = new Set();
    for (const h of hits) {
        const key = normKey(h.name);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(h.name);
    }
    return out;
}

/**
 * Pull mistaken-exclusion heroes from footnote text.
 * @param {string} text
 * @returns {string[]}
 */
function extractMistakenHeroes(text) {
    const t = String(text || '');
    if (!/mistakenly|await a fix|mistakenly excluded|mistakenly not included/i.test(t)) {
        return [];
    }
    // Prefer the clause before "are/is mistakenly"
    const m = t.match(
        /^(.+?)\s+(?:are|is)\s+mistakenly\b/i,
    );
    const clause = m ? m[1] : t;
    return extractHeroes(clause);
}

/**
 * Isolate the condition blob used for classification.
 * @param {object} line
 * @returns {{ condition: string, footnote: string, withFromSubtitle: string }}
 */
function splitConditionParts(line) {
    const sub = String(line.subtitles || '');
    const disc = String(line.disclaimer || '').trim();
    const withMatch = sub.match(/\(\s*with\b[\s\S]*?\)\s*$/i) || sub.match(/\(\s*with\b[^)]*\)/i);
    const withFromSubtitle = withMatch ? withMatch[0].replace(/^\(|\)$/g, '').trim() : '';

    let condition = '';
    let footnote = '';

    if (withFromSubtitle) {
        condition = withFromSubtitle.replace(/\.\s*$/, '').trim();
    }

    if (/^with\b/i.test(disc)) {
        // Disclaimer may be the condition, or condition + removed/footnote.
        const parts = disc.split(/;\s*/);
        const main = parts[0].trim();
        const rest = parts.slice(1).join('; ').trim();
        if (!condition) condition = main.replace(/\.\s*$/, '').trim();
        if (/mistakenly|removed|await a fix|broken/i.test(rest) || /mistakenly|removed/i.test(disc)) {
            footnote = disc;
        } else if (rest) {
            footnote = rest;
        }
    } else if (disc) {
        footnote = disc;
    }

    // Fold "mistakenly…" that was glued onto the condition itself.
    // Require ". " (period + space) so names like D.Va are not split.
    if (/mistakenly/i.test(condition)) {
        const cut = condition.search(/\.\s+[A-Z].*mistakenly|;\s*.*mistakenly/i);
        if (cut > 0) {
            footnote = footnote || condition.slice(cut).replace(/^[.;]\s*/, '');
            condition = condition.slice(0, cut).replace(/[.;]\s*$/, '').trim();
        }
    }

    return { condition, footnote, withFromSubtitle };
}

/**
 * @param {string} condition
 * @param {string} footnote
 * @param {string} speaker
 * @returns {{ mode: 'or'|'and'|null, partners: string[], skipReason?: string }}
 */
function classify(condition, footnote, speaker) {
    const raw = String(condition || '').trim();
    const lower = raw.toLowerCase();
    if (!raw) {
        return { mode: null, partners: [], skipReason: 'no-condition' };
    }

    if (/\bremoved\b/i.test(raw) || /\bremoved\b/i.test(footnote)) {
        // Still assign if we can parse named heroes — stage may still preview.
    }

    // Deferred circumstance families
    if (
        /\bonly\s+(talon|overwatch|veteran|old|young)/i.test(raw) ||
        /\bonly\s+talonn?\b/i.test(raw) ||
        /former overwatch|overwatch \(group\) members|multiple former|multiple talon/i.test(raw) ||
        /four female heroes|female heroes as teammates/i.test(raw) ||
        /only veteran\/old|only young heroes/i.test(raw) ||
        /not on the team/i.test(raw) ||
        /while in .+ event/i.test(raw) ||
        /^rare$/i.test(raw)
    ) {
        // Exception: category label BUT an explicit hero list is present → treat as OR
        const listed = extractHeroes(raw);
        if (
            listed.length >= 2 &&
            (/at least|of the following|omnic heroes|old heroes|airborne|ground-based|talon heroes/i.test(
                raw,
            ) ||
                /:\s*[A-Z]/.test(raw))
        ) {
            // fall through
        } else {
            return { mode: null, partners: [], skipReason: 'category-deferred' };
        }
    }

    // Hybrid AND+OR (e.g. Bastion or Zenyatta, Mercy, and Junkrat / WB and either Junkrat or Venture)
    if (
        (/\beither\b/i.test(raw) && /\bor\b/i.test(raw)) ||
        (/,\s*[^,]+,\s*and\b/i.test(raw) &&
            /\bor\b/i.test(raw) &&
            !/at least|following|of the following/i.test(raw) &&
            !/,\s*or\s+/i.test(raw) === false &&
            / or .+,\s*.+,\s*and /i.test(raw))
    ) {
        return { mode: null, partners: [], skipReason: 'hybrid-deferred' };
    }
    if (/bastion or zenyatta,\s*mercy,\s*and junkrat/i.test(raw)) {
        return { mode: null, partners: [], skipReason: 'hybrid-deferred' };
    }
    if (/wrecking ball and either/i.test(raw)) {
        return { mode: null, partners: [], skipReason: 'hybrid-deferred' };
    }

    let mode = null;

    if (
        /at least\s+\d+|at least\s+(two|three|four)|of the following|three or more/i.test(raw) ||
        /\b(?:two|three|four)\s+of\b/i.test(raw)
    ) {
        mode = 'or';
    } else if (/\bboth\b.+\band\b/i.test(raw)) {
        mode = 'and';
    } else if (/\bor\b/i.test(raw) && !/\band\b/i.test(raw)) {
        mode = 'or';
    } else if (/\band\b/i.test(raw) || /,/i.test(raw)) {
        // "X, Y and Z" / "X and Y" without "or" → AND
        // "Ana, Baptiste, or Mercy" has or → caught above if only or; if and+or without at least:
        if (/\bor\b/i.test(raw) && !/at least|following/i.test(raw)) {
            // "Ana, Baptiste, or Mercy" — commas + or, no and → OR
            if (!/\band\b/i.test(raw)) mode = 'or';
            else return { mode: null, partners: [], skipReason: 'hybrid-deferred' };
        } else {
            mode = 'and';
        }
    } else {
        // single hero
        mode = 'or';
    }

    let partners = extractHeroes(raw);
    const mistaken = extractMistakenHeroes(footnote);
    for (const h of mistaken) {
        if (!partners.some((p) => normKey(p) === normKey(h))) partners.push(h);
    }

    // Also pull mistaken heroes embedded after the list in the same condition string
    const embedded = raw.match(
        /\.\s*(.+?)\s+(?:are|is)\s+mistakenly\b/i,
    );
    if (embedded) {
        for (const h of extractHeroes(embedded[1])) {
            if (!partners.some((p) => normKey(p) === normKey(h))) partners.push(h);
        }
    }

    const speakerKey = normKey(speaker);
    partners = partners.filter((h) => normKey(h) !== speakerKey);

    if (partners.length === 0) {
        return { mode: null, partners: [], skipReason: 'no-heroes-parsed' };
    }

    return { mode, partners };
}

function cleanSubtitles(subtitles, withFromSubtitle) {
    let s = String(subtitles || '');
    if (!withFromSubtitle) return s.trim();
    // Remove the parenthetical with-note (prefer trailing)
    s = s.replace(/\(\s*with\b[\s\S]*?\)\s*$/i, '').trim();
    s = s.replace(/\(\s*with\b[^)]*\)/i, '').trim();
    return s.replace(/\s{2,}/g, ' ').trim();
}

function buildDisclaimer(condition, footnote) {
    const cond = String(condition || '')
        .replace(/\s+/g, ' ')
        .replace(/,?\s*removed\s*$/i, '')
        .trim();
    const foot = String(footnote || '')
        .replace(/\s+/g, ' ')
        .trim();

    const bits = [];
    if (cond) bits.push(cond);

    if (foot) {
        let bug = foot;
        // Strip a leading copy of the same condition
        if (cond && bug.toLowerCase().startsWith(cond.toLowerCase())) {
            bug = bug.slice(cond.length).replace(/^[—\-.;,\s]+/, '').trim();
        }
        bug = bug
            .replace(/^with\b[\s\S]*?;\s*/i, '')
            .replace(/^removed\b[—\-\s]*/i, 'removed')
            .trim();
        if (/^removed$/i.test(bug)) bug = 'removed';
        if (
            bug &&
            !bits.some((b) => b.toLowerCase() === bug.toLowerCase()) &&
            !bits.some((b) => b.toLowerCase().includes(bug.toLowerCase()))
        ) {
            bits.push(bug);
        }
    }

    return bits.join(' — ');
}

const data = JSON.parse(fs.readFileSync(convPath, 'utf8'));
const summary = {
    appliedOr: 0,
    appliedAnd: 0,
    skipped: /** @type {Record<string, number>} */ ({}),
    samples: /** @type {object[]} */ ([]),
};

for (const conv of data.conversations) {
    if (conv.entryType !== 'chatter') continue;
    for (const line of conv.lines || []) {
        const { condition, footnote, withFromSubtitle } = splitConditionParts(line);
        const hadSignal =
            withFromSubtitle ||
            String(line.disclaimer || '').trim() ||
            /\(with\b/i.test(String(line.subtitles || ''));
        if (!hadSignal) continue;

        const result = classify(condition, footnote, line.hero || conv.name);
        if (!result.mode) {
            const reason = result.skipReason || 'unknown';
            summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
            if (summary.samples.length < 30) {
                summary.samples.push({
                    hero: conv.name,
                    skip: reason,
                    condition,
                    footnote,
                });
            }
            // Still clean subtitle → disclaimer when we have a with-note but deferred
            if (withFromSubtitle && !dry) {
                line.subtitles = cleanSubtitles(line.subtitles, withFromSubtitle);
                if (!line.disclaimer) {
                    line.disclaimer = buildDisclaimer(condition, footnote);
                }
            }
            // Clear any prior partner fields on deferred lines
            if (!dry) {
                delete line.partnerMode;
                delete line.partners;
                delete line.partnerFocus;
                delete line.partnerStackOrder;
            }
            continue;
        }

        if (!dry) {
            if (withFromSubtitle) {
                line.subtitles = cleanSubtitles(line.subtitles, withFromSubtitle);
            }
            line.disclaimer = buildDisclaimer(condition, footnote) || line.disclaimer;
            line.partnerMode = result.mode;
            line.partners = result.partners;
            line.partnerFocus = result.partners[0];
            line.partnerStackOrder = [...result.partners];
        }

        if (result.mode === 'or') summary.appliedOr += 1;
        else summary.appliedAnd += 1;

        if (summary.samples.length < 40) {
            summary.samples.push({
                hero: conv.name,
                mode: result.mode,
                partners: result.partners,
                disclaimer: dry ? buildDisclaimer(condition, footnote) : line.disclaimer,
                sub: (dry ? cleanSubtitles(line.subtitles, withFromSubtitle) : line.subtitles).slice(
                    0,
                    70,
                ),
            });
        }
    }
}

if (!dry) {
    fs.writeFileSync(convPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const reportPath = auditPath('_partners-apply-report.json');
fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ appliedOr: summary.appliedOr, appliedAnd: summary.appliedAnd, skipped: summary.skipped }, null, 2));
console.log(dry ? `\n(dry run — no write) report: ${reportPath}` : `\nWrote ${convPath}\nReport: ${reportPath}`);
