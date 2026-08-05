#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Build canvas: strict wiki buckets + missing full interactions + FA status.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = auditPath('_audit-matchtalk-unused.json');
const CLASSIFY = auditPath('_audit-matchtalk-wiki-classify.json');
const MISSING = auditPath('_audit-matchtalk-missing-interactions.json');
const FA_GAPS = auditPath('_audit-favorite-animals-gaps.json');
const CANVAS_OUT = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'matchtalk-wiki-classify.canvas.tsx',
);

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const classify = JSON.parse(fs.readFileSync(CLASSIFY, 'utf8'));
const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8'));
const faGaps = JSON.parse(fs.readFileSync(FA_GAPS, 'utf8'));

const bucketCounts = classify.summary.bucketCounts || {};
const bucketRows = Object.entries(bucketCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([bucket, count]) => ({ bucket, count }));

const matchedTotal = bucketRows
    .filter((row) => row.bucket !== 'Unmatched' && row.bucket !== 'No wiki page')
    .reduce((sum, row) => sum + row.count, 0);

const inRepoGaps = (audit.unusedDialogueInVoicelines || []).map((row) => ({
    hero: row.hero,
    label: row.label,
}));

const tableRows = (classify.rows || []).map((row) => ({
    bucket: row.wikiBucket,
    hero: row.hero,
    label: row.label,
    how: row.matchHow,
    wikiQuote: String(row.wikiQuote || '').slice(0, 140),
}));

const missingRows = (missing.exchanges || []).map((row) => ({
    speakers: (row.speakers || []).join(' + '),
    lines: row.lineCount,
    covered: row.coveredLineCount,
    preview: String(row.preview || '').slice(0, 220),
    source: row.sourceHeroPage,
}));

const heroes = [...new Set(tableRows.map((row) => row.hero))].sort((a, b) => a.localeCompare(b));

function embed(value) {
    return JSON.stringify(value, null, 2);
}

const canvas = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
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

const GENERATED_AT = ${embed(classify.generatedAt)};
const MATCHING = ${embed(classify.matching || 'strict')};
const BUCKET_ROWS = ${embed(bucketRows)};
const IN_REPO_GAPS = ${embed(inRepoGaps)};
const TABLE_ROWS = ${embed(tableRows)};
const MISSING_ROWS = ${embed(missingRows)};
const FA_MISSING = ${embed(faGaps.missingHeroes || [])};
const FA_PATH_COUNT = ${embed(faGaps.pathCount || 0)};
const MATCHED_TOTAL = ${embed(matchedTotal)};
const CLASSIFY_TOTAL = ${embed(classify.summary.classifiedTotal)};
const UNMATCHED = ${embed(bucketCounts.Unmatched || 0)};

const BUCKET_OPTIONS = [
  { value: 'all', label: 'All buckets' },
  ...BUCKET_ROWS.map((row) => ({ value: row.bucket, label: \`\${row.bucket} (\${row.count})\` })),
];
const HERO_OPTIONS = [
  { value: 'all', label: 'All heroes' },
  ...${embed(heroes)}.map((hero: string) => ({ value: hero, label: hero })),
];

export default function MatchTalkWikiClassify() {
  const [bucket, setBucket] = useCanvasState('bucket', 'Unmatched');
  const [hero, setHero] = useCanvasState('hero', 'all');
  const [query, setQuery] = useCanvasState('query', '');
  const [panel, setPanel] = useCanvasState('panel', 'missing');

  const q = String(query || '').trim().toLowerCase();
  const filtered = TABLE_ROWS.filter((row: (typeof TABLE_ROWS)[number]) => {
    if (bucket !== 'all' && row.bucket !== bucket) return false;
    if (hero !== 'all' && row.hero !== hero) return false;
    if (!q) return true;
    return (
      row.label.toLowerCase().includes(q) ||
      row.wikiQuote.toLowerCase().includes(q) ||
      row.hero.toLowerCase().includes(q)
    );
  });

  const missingFiltered = MISSING_ROWS.filter((row: (typeof MISSING_ROWS)[number]) => {
    if (!q) return true;
    return row.preview.toLowerCase().includes(q) || row.speakers.toLowerCase().includes(q);
  });

  return (
    <Stack gap={24} style={{ padding: 24 }}>
      <Stack gap={8}>
        <H1>MatchTalk audit — strict wiki + missing interactions</H1>
        <Text tone="secondary">
          {MATCHING}. Generated {GENERATED_AT}. No bulk auto-wiring except Favorite Animals gaps listed below.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(CLASSIFY_TOTAL)} label="Extract-only unused" />
        <Stat value={String(MATCHED_TOTAL)} label="Strict wiki section hits" tone="success" />
        <Stat value={String(UNMATCHED)} label="Unmatched (review)" tone="warning" />
        <Stat value={String(MISSING_ROWS.length)} label="Missing full interactions" tone="danger" />
      </Grid>

      <Callout tone="warning" title="Matching tightened">
        Word-overlap matching was removed. Abilities / PvE / Cosmetics / Mission / Eliminations /
        Call-Outs / Communication now require an exact spoken-text hit. Near-prefix only allowed for
        Chatter / Map / Skin / Interactions when length ratio is very close.
      </Callout>

      <Stack gap={12}>
        <H2>Favorite Animals</H2>
        <Text>
          Paths now: {FA_PATH_COUNT}. Missing heroes:{' '}
          {FA_MISSING.length ? FA_MISSING.join(', ') : 'none — Hazard, Junkrat, Juno, Soldier 76 wired.'}
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>In Voicelines still unused</H2>
        <Table
          headers={['Hero', 'Label']}
          rows={IN_REPO_GAPS.map((row: (typeof IN_REPO_GAPS)[number]) => [row.hero, row.label])}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>Audit panels</H2>
        <Select
          value={panel}
          onChange={setPanel}
          options={[
            { value: 'missing', label: \`Missing full interactions (\${MISSING_ROWS.length})\` },
            { value: 'buckets', label: 'Wiki section bucket totals' },
            { value: 'lines', label: 'Classified extract-only lines' },
          ]}
        />
      </Stack>

      {panel === 'missing' ? (
        <Stack gap={12}>
          <H3>Full missing interactions</H3>
          <Text tone="secondary" size="small">
            Wiki Interaction exchanges where most spoken lines are absent from conversations.json.
            Includes Junkrat↔Brigitte explosives proposal. Audit before wiring.
          </Text>
          <TextInput value={query} onChange={setQuery} placeholder="Filter speakers / dialogue…" />
          <Pill tone="neutral">{missingFiltered.length} shown</Pill>
          <Table
            headers={['Speakers', 'Lines', 'Covered', 'Exchange preview']}
            rows={missingFiltered.slice(0, 200).map((row: (typeof MISSING_ROWS)[number]) => [
              row.speakers,
              String(row.lines),
              String(row.covered),
              row.preview,
            ])}
          />
          <Text tone="secondary" size="small">
            Full CSV: scripts/_audit-matchtalk-missing-interactions.csv
          </Text>
        </Stack>
      ) : null}

      {panel === 'buckets' ? (
        <Stack gap={12}>
          <H3>Strict wiki buckets</H3>
          <Table
            headers={['Bucket', 'Count']}
            rows={BUCKET_ROWS.map((row: (typeof BUCKET_ROWS)[number]) => [
              row.bucket,
              String(row.count),
            ])}
          />
        </Stack>
      ) : null}

      {panel === 'lines' ? (
        <Stack gap={12}>
          <H3>Classified extract-only lines</H3>
          <Row gap={12} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Stack gap={4} style={{ minWidth: 200 }}>
              <Text size="small" weight="semibold">Bucket</Text>
              <Select value={bucket} onChange={setBucket} options={BUCKET_OPTIONS} />
            </Stack>
            <Stack gap={4} style={{ minWidth: 180 }}>
              <Text size="small" weight="semibold">Hero</Text>
              <Select value={hero} onChange={setHero} options={HERO_OPTIONS} />
            </Stack>
            <Stack gap={4} style={{ minWidth: 240, flex: 1 }}>
              <Text size="small" weight="semibold">Search</Text>
              <TextInput value={query} onChange={setQuery} placeholder="Filter…" />
            </Stack>
            <Pill tone="neutral">{filtered.length} shown</Pill>
          </Row>
          <Table
            headers={['Bucket', 'Hero', 'MatchTalk label', 'Wiki quote hit']}
            rows={filtered.slice(0, 300).map((row: (typeof TABLE_ROWS)[number]) => [
              row.bucket,
              row.hero,
              row.label,
              row.wikiQuote || '—',
            ])}
          />
          <Text tone="secondary" size="small">
            CSV: scripts/_audit-matchtalk-wiki-classify.csv
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
`;

fs.writeFileSync(CANVAS_OUT, canvas);
console.log(`Canvas: ${CANVAS_OUT}`);
console.log(`Missing interactions: ${missingRows.length}; FA missing: ${(faGaps.missingHeroes || []).join(', ') || 'none'}`);
