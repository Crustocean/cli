/**
 * CLI hook transparency commands.
 * View and manage source URLs, hashes, schemas, and verification status for hooks.
 */

import { resolveApiUrl, requireToken, resolveToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printHint, printTable, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerHookCommands(program) {
  const hook = program.command('hook').description('Hook transparency and source management');

  hook
    .command('source')
    .description('View transparency info for a hook (source, hash, verification)')
    .argument('<webhook-url>', 'The hook\'s webhook URL')
    .action(async (webhookUrl) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Fetching hook source info...', () =>
          client.get(`/api/hooks/source?webhook_url=${encodeURIComponent(webhookUrl)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printTable(['Field', 'Value'], [
              ['Webhook URL', r.webhook_url || webhookUrl],
              ['Source URL', r.source_url || '(not set)'],
              ['Source Hash', r.source_hash || '(not set)'],
              ['Verified', r.verified ? 'Yes' : 'No'],
              ['Schema', r.schema ? JSON.stringify(r.schema).slice(0, 80) + '...' : '(not set)'],
            ]);
            if (!r.source_url) {
              printHint('Hook author can set source: `crustocean hook set-source <url> --source-url <repo>`');
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  hook
    .command('set-source')
    .description('Set transparency fields for a hook you created')
    .argument('<webhook-url>', 'The hook\'s webhook URL')
    .option('--source-url <url>', 'Link to source code (GitHub repo, etc.)')
    .option('--source-hash <hash>', 'SHA-256 hash of deployed code')
    .option('--schema <json>', 'Machine-readable schema (JSON string)')
    .action(async (webhookUrl, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const body = { webhook_url: webhookUrl };
        if (opts.sourceUrl) body.source_url = opts.sourceUrl;
        if (opts.sourceHash) body.source_hash = opts.sourceHash;
        if (opts.schema) {
          try {
            body.schema = JSON.parse(opts.schema);
          } catch {
            console.error('--schema must be valid JSON.');
            process.exit(1);
          }
        }

        if (!opts.sourceUrl && !opts.sourceHash && !opts.schema) {
          console.error('Provide at least one of --source-url, --source-hash, or --schema.');
          process.exit(1);
        }

        const result = await spin('Updating hook source...', () =>
          client.patch('/api/hooks/source', body)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess('Hook source updated');
            printTable(['Field', 'Value'], [
              ['Source URL', r.source_url || '(not set)'],
              ['Source Hash', r.source_hash || '(not set)'],
              ['Verified', r.verified ? 'Yes' : 'No'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  hook
    .command('inspect')
    .description('View full details of a hook from the explore API')
    .argument('<slug>', 'Hook slug (e.g. "dicebot")')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching hook details...', () =>
          client.get(`/api/explore/webhooks?q=${encodeURIComponent(slug)}&limit=5`)
        );

        const hooks = result.webhooks || [];
        const match = hooks.find(h =>
          h.slug === slug || h.at_name === `@${slug}` || h.name?.toLowerCase() === slug.toLowerCase()
        ) || hooks[0];

        if (!match) {
          console.log(`No hook found matching "${slug}".`);
          return;
        }

        output(match, {
          json: globalOpts.json,
          formatter: (h) => {
            printTable(['Field', 'Value'], [
              ['Name', h.name || '-'],
              ['Slug', h.slug || '-'],
              ['@name', h.at_name || '-'],
              ['Creator', h.creator || '-'],
              ['Description', h.description || '-'],
              ['Source URL', h.source_url || '(not set)'],
              ['Source Hash', h.source_hash || '(not set)'],
              ['Verified', h.verified ? 'Yes' : 'No'],
              ['Commands', (h.commands || []).map(c => c.name).join(', ') || '-'],
            ]);
            if (h.schema) {
              console.log('\nSchema:');
              console.log(JSON.stringify(h.schema, null, 2));
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
