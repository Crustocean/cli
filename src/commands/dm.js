import { resolveApiUrl, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printTable, truncateId, spin } from '../output.js';
import { promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerDMCommands(program) {
  const dm = program.command('dm').description('Direct message commands');

  dm
    .command('list')
    .description('List your DM conversations')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching DMs...', () =>
          client.get('/api/dm')
        );

        const dms = Array.isArray(result) ? result : result.conversations || [];
        output(dms, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No DM conversations.');
              return;
            }
            printTable(
              ['Agency ID', 'Participant', 'Last Message'],
              list.map(d => [
                truncateId(d.agencyId || d.agency_id || d.id),
                d.participant?.username || d.participant_username || d.username || '-',
                d.last_message ? d.last_message.slice(0, 40) : '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  dm
    .command('open')
    .description('Open or create a DM conversation with a user')
    .argument('<username>', 'Username to DM')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const user = await spin(`Looking up ${username}...`, () =>
          client.get(`/api/users/${encodeURIComponent(username)}`)
        );
        const userId = (user.user || user).id;

        const result = await spin('Opening DM...', () =>
          client.post(`/api/dm/${encodeURIComponent(userId)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`DM with @${username} ready`);
            printTable(['Field', 'Value'], [
              ['Agency ID', r.agencyId || r.agency_id || r.id || '-'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  dm
    .command('messages')
    .description('View messages in a DM conversation')
    .argument('<agency-id>', 'DM agency ID')
    .option('--limit <n>', 'Number of messages', '20')
    .action(async (agencyId, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching messages...', () =>
          client.get(`/api/dm/${encodeURIComponent(agencyId)}/messages?limit=${opts.limit}`)
        );

        const messages = Array.isArray(result) ? result : result.messages || [];
        output(messages, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No messages.');
              return;
            }
            for (const m of list) {
              const time = m.created_at ? new Date(m.created_at).toLocaleString() : '';
              const sender = m.sender_username || m.sender_display_name || '?';
              console.log(`[${time}] ${sender}: ${m.content}`);
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  dm
    .command('hide')
    .description('Hide a DM conversation')
    .argument('<agency-id>', 'DM agency ID')
    .action(async (agencyId) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin('Hiding DM...', () =>
          client.delete(`/api/dm/${encodeURIComponent(agencyId)}`)
        );

        output({ ok: true }, {
          json: globalOpts.json,
          formatter: () => printSuccess('DM conversation hidden.'),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  dm
    .command('purge')
    .description('Purge all messages in a DM conversation')
    .argument('<agency-id>', 'DM agency ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (agencyId, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm('Purge all messages in this DM? This cannot be undone.');
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin('Purging messages...', () =>
          client.post(`/api/dm/${encodeURIComponent(agencyId)}/purge`)
        );

        output({ ok: true }, {
          json: globalOpts.json,
          formatter: () => printSuccess('DM messages purged.'),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
