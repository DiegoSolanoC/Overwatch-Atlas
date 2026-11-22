import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const j = JSON.parse(
    readFileSync(join(__dirname, 'unused-dialogues-commentary.json'), 'utf8'),
);

const unused = j.unused.map((d, i) => ({
    n: i + 1,
    name: d.name,
    status: d.status || 'active',
    tags: d.tags || '',
}));

const canvasPath = join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas/canvases/dialogue-commentary-coverage.canvas.tsx',
);

const src = `import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useMemo,
  useState,
} from 'cursor/canvas';

type UnusedRow = { n: number; name: string; status: string; tags: string };

const REPORT = ${JSON.stringify(j.report)} as const;
const UNUSED: UnusedRow[] = ${JSON.stringify(unused)};

export default function DialogueCommentaryUsageCanvas() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'removed'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return UNUSED.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.tags.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  const pctUsed = Math.round((REPORT.usedCount / REPORT.dialogueTotal) * 1000) / 10;

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Dialogue commentary coverage</H1>
        <Text tone="secondary" size="small">
          Source: timeline-events.json commentary × conversations.json dialogues · chatters excluded
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value={String(REPORT.dialogueTotal)} label="Dialogue entries" />
        <Stat value={String(REPORT.usedCount)} label="Used in commentary" tone="success" />
        <Stat value={String(REPORT.unusedCount)} label="Unused dialogues" tone="warning" />
        <Stat value={pctUsed + '%'} label="Coverage" />
      </Grid>

      <Card>
        <CardHeader>Used vs unused (of 1664 dialogues)</CardHeader>
        <CardBody>
          <BarChart
            categories={['Dialogues']}
            series={[
              { name: 'Used', data: [REPORT.usedCount], tone: 'success' },
              { name: 'Unused active', data: [REPORT.unusedActive], tone: 'warning' },
              { name: 'Unused removed', data: [REPORT.unusedRemoved], tone: 'neutral' },
            ]}
            height={160}
            valueSuffix=" entries"
          />
        </CardBody>
      </Card>

      <Callout tone="info">
        {REPORT.dialogueCommentarySlots} dialogue commentary slots across{' '}
        {REPORT.eventsWithAnyCommentary}/{REPORT.eventsTotal} events (
        {REPORT.chatterCommentarySkipped} chatter slots skipped). One unresolved name:
        "Ilegal Activities" on event Hero.
      </Callout>

      <Divider />

      <Stack gap={12}>
        <Row gap={12} align="center" style={{ flexWrap: 'wrap' }}>
          <H2 style={{ margin: 0 }}>Unused dialogues ({filtered.length})</H2>
          <Pill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            All {REPORT.unusedCount}
          </Pill>
          <Pill active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
            Active {REPORT.unusedActive}
          </Pill>
          <Pill active={statusFilter === 'removed'} onClick={() => setStatusFilter('removed')}>
            Removed {REPORT.unusedRemoved}
          </Pill>
        </Row>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Filter by name or tags…"
        />
        <Table
          stickyHeader
          striped
          headers={['#', 'Dialogue name', 'Status', 'Tags']}
          columnAlign={['right', 'left', 'left', 'left']}
          rowTone={filtered.map((row) =>
            row.status === 'removed' ? 'warning' : undefined,
          )}
          rows={filtered.map((row) => [
            String(row.n),
            row.name,
            row.status,
            row.tags || '—',
          ])}
        />
      </Stack>
    </Stack>
  );
}
`;

writeFileSync(canvasPath, src);
console.log('Wrote', canvasPath, 'bytes', src.length);
console.log('Also keeping plain list at scripts/_cache/unused-dialogues-commentary.txt');
void root;
