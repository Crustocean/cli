import {
  listCustomCommands, createCustomCommand,
  updateCustomCommand, deleteCustomCommand,
} from '@crustocean/sdk';
import { resolveApiUrl, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printTable, truncateId, spin } from '../output.js';
import { promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerCommandCommands(program) {
  const cmd = program.command('command').description('Custom command management');

  cmd
    .command('list')
    .description('List custom commands for an agency')
    .argument('<agency>', 'Agency ID')
    .action(async (agency) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Fetching commands...', () =>
          listCustomCommands({ apiUrl, userToken, agencyId: agency })
        );

        const list = Array.isArray(result) ? result : result.commands || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No custom commands found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Webhook URL', 'Description'],
              items.map(c => [
                truncateId(c.id),
                c.name || '-',
                c.webhook_url || '-',
                c.description || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  cmd
    .command('create')
    .description('Create a custom command')
    .argument('<agency>', 'Agency ID')
    .requiredOption('--name <name>', 'Command name')
    .requiredOption('--webhook-url <url>', 'Webhook URL')
    .option('--description <text>', 'Command description')
    .action(async (agency, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Creating command...', () =>
          createCustomCommand({
            apiUrl, userToken, agencyId: agency,
            name: opts.name,
            webhook_url: opts.webhookUrl,
            description: opts.description,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Command "${opts.name}" created`);
            if (r.id) console.log(`ID: ${r.id}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  cmd
    .command('update')
    .description('Update a custom command')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Command ID')
    .option('--name <name>', 'New name')
    .option('--webhook-url <url>', 'New webhook URL')
    .option('--description <text>', 'New description')
    .action(async (agency, id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const updates = {};
        if (opts.name) updates.name = opts.name;
        if (opts.webhookUrl) updates.webhook_url = opts.webhookUrl;
        if (opts.description) updates.description = opts.description;

        if (Object.keys(updates).length === 0) {
          console.error('No update options provided. Use --help to see available options.');
          process.exit(1);
        }

        const result = await spin('Updating command...', () =>
          updateCustomCommand({
            apiUrl, userToken, agencyId: agency, commandId: id,
            ...updates,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Command ${truncateId(id)} updated`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  cmd
    .command('delete')
    .description('Delete a custom command')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Command ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (agency, id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Delete command ${truncateId(id)}?`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Deleting command...', () =>
          deleteCustomCommand({ apiUrl, userToken, agencyId: agency, commandId: id })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Command ${truncateId(id)} deleted`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  cmd
    .command('rotate-key')
    .description('Rotate hook key for a command')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Command ID')
    .action(async (agency, id) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Rotating hook key...', () =>
          client.post(`/api/custom-commands/${agency}/commands/${id}/hook-key`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess('Hook key rotated');
            if (r.hookKey || r.hook_key) {
              console.log(`\nNew key: ${r.hookKey || r.hook_key}`);
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  cmd
    .command('revoke-key')
    .description('Revoke hook key for a command')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Command ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (agency, id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Revoke hook key for command ${truncateId(id)}?`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Revoking hook key...', () =>
          client.delete(`/api/custom-commands/${agency}/commands/${id}/hook-key`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess('Hook key revoked'),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
