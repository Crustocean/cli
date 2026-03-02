import {
  listWebhookEventTypes, listWebhookSubscriptions,
  createWebhookSubscription, updateWebhookSubscription,
  deleteWebhookSubscription,
} from '@crustocean/sdk';
import { resolveApiUrl, requireToken } from '../config.js';
import { output, printSuccess, printTable, truncateId, spin } from '../output.js';
import { promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerWebhookCommands(program) {
  const wh = program.command('webhook').description('Webhook subscription management');

  wh
    .command('event-types')
    .description('List available webhook event types')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);

        const result = await spin('Fetching event types...', () =>
          listWebhookEventTypes({ apiUrl })
        );

        const types = Array.isArray(result) ? result : result.events || result.eventTypes || result.event_types || [];
        output(types, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No event types available.');
              return;
            }
            for (const t of items) {
              if (typeof t === 'string') {
                console.log(`  - ${t}`);
              } else {
                console.log(`  - ${t.name || t.type}: ${t.description || ''}`);
              }
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wh
    .command('list')
    .description('List webhook subscriptions for an agency')
    .argument('<agency>', 'Agency ID')
    .action(async (agency) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Fetching subscriptions...', () =>
          listWebhookSubscriptions({ apiUrl, userToken, agencyId: agency })
        );

        const list = Array.isArray(result) ? result : result.subscriptions || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No webhook subscriptions found.');
              return;
            }
            printTable(
              ['ID', 'URL', 'Events', 'Enabled'],
              items.map(s => [
                truncateId(s.id),
                s.url || '-',
                (s.events || []).join(', ') || '-',
                s.enabled !== false ? 'Yes' : 'No',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wh
    .command('create')
    .description('Create a webhook subscription')
    .argument('<agency>', 'Agency ID')
    .requiredOption('--url <url>', 'Webhook URL')
    .requiredOption('--events <events>', 'Comma-separated event types')
    .option('--secret <secret>', 'Webhook secret')
    .option('--description <text>', 'Description')
    .action(async (agency, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);
        const events = opts.events.split(',').map(e => e.trim());

        const result = await spin('Creating subscription...', () =>
          createWebhookSubscription({
            apiUrl, userToken, agencyId: agency,
            url: opts.url, events,
            secret: opts.secret,
            description: opts.description,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess('Webhook subscription created');
            if (r.id) console.log(`ID: ${r.id}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wh
    .command('update')
    .description('Update a webhook subscription')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Subscription ID')
    .option('--url <url>', 'New webhook URL')
    .option('--events <events>', 'New comma-separated event types')
    .option('--secret <secret>', 'New secret')
    .option('--description <text>', 'New description')
    .option('--enable', 'Enable subscription')
    .option('--disable', 'Disable subscription')
    .action(async (agency, id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const updates = {};
        if (opts.url) updates.url = opts.url;
        if (opts.events) updates.events = opts.events.split(',').map(e => e.trim());
        if (opts.secret) updates.secret = opts.secret;
        if (opts.description) updates.description = opts.description;
        if (opts.enable) updates.enabled = true;
        if (opts.disable) updates.enabled = false;

        if (Object.keys(updates).length === 0) {
          console.error('No update options provided. Use --help to see available options.');
          process.exit(1);
        }

        const result = await spin('Updating subscription...', () =>
          updateWebhookSubscription({
            apiUrl, userToken, agencyId: agency, subscriptionId: id,
            ...updates,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Subscription ${truncateId(id)} updated`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wh
    .command('delete')
    .description('Delete a webhook subscription')
    .argument('<agency>', 'Agency ID')
    .argument('<id>', 'Subscription ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (agency, id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Delete webhook subscription ${truncateId(id)}?`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Deleting subscription...', () =>
          deleteWebhookSubscription({
            apiUrl, userToken, agencyId: agency, subscriptionId: id,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Subscription ${truncateId(id)} deleted`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
