import { resolveApiUrl, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printTable, truncateId, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerRunCommands(program) {
  const run = program.command('run').description('Agent run history and transcripts');

  run
    .command('list')
    .description('List agent runs for an agency')
    .argument('<agency-id>', 'Agency ID')
    .option('--limit <n>', 'Results per page', '20')
    .option('--offset <n>', 'Offset for pagination', '0')
    .action(async (agencyId, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching runs...', () =>
          client.get(`/api/agencies/${encodeURIComponent(agencyId)}/runs?limit=${opts.limit}&offset=${opts.offset}`)
        );

        const runs = Array.isArray(result) ? result : result.runs || [];
        output(runs, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No runs found.');
              return;
            }
            printTable(
              ['Run ID', 'Agent', 'Status', 'Started', 'Duration'],
              list.map(r => [
                truncateId(r.id || r.runId),
                r.agent_username || r.agent || '-',
                r.status || '-',
                r.started_at ? new Date(r.started_at).toLocaleString() : '-',
                r.duration || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  run
    .command('view')
    .description('View the transcript of an agent run')
    .argument('<run-id>', 'Run ID')
    .action(async (runId) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching run transcript...', () =>
          client.get(`/api/runs/${encodeURIComponent(runId)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            const meta = [
              ['Run ID', r.id || r.runId || runId],
              ['Agent', r.agent_username || r.agent || '-'],
              ['Status', r.status || '-'],
              ['Started', r.started_at ? new Date(r.started_at).toLocaleString() : '-'],
              ['Duration', r.duration || '-'],
            ];
            if (r.summary) meta.push(['Summary', r.summary]);
            if (r.error) meta.push(['Error', r.error]);
            printTable(['Field', 'Value'], meta);

            const transcript = r.transcript || [];
            if (transcript.length) {
              console.log(`\nTranscript (${transcript.length} entries):`);
              for (const entry of transcript) {
                const prefix = entry.type ? `[${entry.type}]` : '[-]';
                const detail = entry.tool || entry.content || entry.status || entry.summary || entry.message || '';
                const duration = entry.duration ? ` (${entry.duration})` : '';
                console.log(`  ${prefix} ${detail}${duration}`);
              }
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
