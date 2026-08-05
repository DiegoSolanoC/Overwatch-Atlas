#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Build canvas for no-MatchTalk full-voice audit.
 * Run after: node scripts/audit-no-matchtalk-full-voice.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT = auditPath('_audit-no-matchtalk-full-voice.json');
const OUT = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'no-matchtalk-full-voice.canvas.tsx',
);

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

function slim(list) {
    return list.map((x) => ({
        name: x.conversationName,
        buckets: x.buckets,
        mt: x.matchTalkHits,
        other: x.otherHits,
        missing: x.missing,
        theater: x.theaterHits,
        lines: x.lineCount,
        preview: x.preview,
    }));
}

const SUMMARY = report.summary;
const FALSE_NEG = slim(report.falseNegatives || []);
const OUTSIDE = slim(report.foundOutsideMatchTalk || []);
const PARTIAL = slim(report.partial || []);
const THEATER = slim(report.theaterOnly || []);
const MISSING = slim(report.trulyMissing || []);

function embed(v) {
    return JSON.stringify(v, null, 2);
}

const src = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from 'cursor/canvas';

const SUMMARY = ${embed(SUMMARY)};
const FALSE_NEG = ${embed(FALSE_NEG)};
const OUTSIDE = ${embed(OUTSIDE)};
const PARTIAL = ${embed(PARTIAL)};
const THEATER = ${embed(THEATER)};
const MISSING = ${embed(MISSING)};

function filterRows(rows, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    [r.name, r.preview, (r.buckets || []).join(' ')].join(' ').toLowerCase().includes(needle),
  );
}

export default function NoMatchTalkFullVoice() {
  const [tab, setTab] = useCanvasState('tab', 'outside');
  const [q, setQ] = useCanvasState('q', '');

  const cats = SUMMARY.byCategory || {};
  const rows =
    tab === 'falseNeg'
      ? FALSE_NEG
      : tab === 'outside'
        ? OUTSIDE
        : tab === 'partial'
          ? PARTIAL
          : tab === 'theater'
            ? THEATER
            : MISSING;

  const shown = filterRows(rows, q);

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>No-MatchTalk re-audit (full HeroVoice)</H1>
        <Text tone="secondary">
          Re-checked {SUMMARY.candidates} conversations previously flagged as missing MatchTalk,
          against {SUMMARY.indexedExtractFiles} extract files (MatchTalk + Unknown + Ultimate + all
          other folders). Improved matching uses voice filenames and Cap'n/Captain-style
          normalization.
        </Text>
      </Stack>

      <Grid columns={5} gap={12}>
        <Stat value={String(cats['false-negative-matchtalk'] || 0)} label="Actually in MatchTalk" tone="success" />
        <Stat value={String(cats['found-outside-matchtalk'] || 0)} label="Found outside MatchTalk" tone="warning" />
        <Stat value={String(cats.partial || 0)} label="Partial extract hits" />
        <Stat value={String(cats['theater-only-no-extract'] || 0)} label="Theater only (no extract)" tone="danger" />
        <Stat value={String(cats['truly-missing'] || 0)} label="Missing even in Theater" />
      </Grid>

      <Callout tone="info" title="What this means">
        Almost all recoverable misses live under Unknown (newer dumps), not Ultimate/skin/map
        folders. The large Theater-only set has wired Atlas audio but no matching file anywhere
        under HeroVoice extracts — likely Classic / pre-extract / not-yet-dumped lines.
      </Callout>

      <Divider />

      <Row gap={12} align="center">
        <Select
          value={tab}
          onChange={setTab}
          options={[
            { value: 'outside', label: \`Found outside MatchTalk (\${OUTSIDE.length})\` },
            { value: 'falseNeg', label: \`False negatives — MatchTalk (\${FALSE_NEG.length})\` },
            { value: 'partial', label: \`Partial (\${PARTIAL.length})\` },
            { value: 'theater', label: \`Theater only (\${THEATER.length})\` },
            { value: 'missing', label: \`Truly missing (\${MISSING.length})\` },
          ]}
        />
        <TextInput value={q} onChange={setQ} placeholder="Filter by name / preview / bucket" />
        <Pill tone="neutral">{shown.length} shown</Pill>
      </Row>

      <Table
        headers={['Name', 'Buckets', 'MT', 'Other', 'Miss', 'Theater', 'Preview']}
        rows={shown.map((r) => [
          r.name,
          (r.buckets || []).join(', ') || '—',
          String(r.mt),
          String(r.other),
          String(r.missing),
          \`\${r.theater}/\${r.lines}\`,
          r.preview || '',
        ])}
      />

      <H2>Extract bucket hits (line-level)</H2>
      <Text tone="secondary">
        {Object.entries(SUMMARY.bucketHitCounts || {})
          .map(([k, v]) => \`\${k}: \${v}\`)
          .join(' · ') || '—'}
      </Text>

      <Text tone="secondary">
        Source: scripts/_audit-no-matchtalk-full-voice.json · CSV:
        scripts/_audit-no-matchtalk-full-voice.csv · generated ${report.generatedAt}
      </Text>
    </Stack>
  );
}
`;

fs.writeFileSync(OUT, src);
console.log('Wrote', OUT);
