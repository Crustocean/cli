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

  // ── hook list ──────────────────────────────────────────────────────────
  hook
    .command('list')
    .description('List all public hooks')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Fetching public hooks...', () =>
          client.get('/api/explore/webhooks?limit=50')
        );

        const hooks = result.webhooks || [];

        output(hooks, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No public hooks found.');
              return;
            }
            printTable(
              ['Name', 'Slug', 'Creator', 'Commands', 'Verified'],
              list.map(h => [
                h.name || '-',
                h.slug || '-',
                h.creator || '-',
                String((h.commands || []).length),
                h.verified ? 'Yes' : 'No',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── hook info <slug> ───────────────────────────────────────────────────
  hook
    .command('info')
    .description('Show detailed information for a hook')
    .argument('<slug>', 'Hook slug (e.g. "dicebot")')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Fetching hook details...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (h) => {
            printTable(['Field', 'Value'], [
              ['Name', h.name || '-'],
              ['Slug', h.slug || '-'],
              ['@name', h.at_name || '-'],
              ['ID', h.id || '-'],
              ['Creator', h.creator || '-'],
              ['Description', h.description || '-'],
              ['Enabled', h.enabled !== undefined ? (h.enabled ? 'Yes' : 'No') : '-'],
              ['Permission', h.default_invoke_permission || '-'],
              ['Source URL', h.source_url || '(not set)'],
              ['Source Hash', h.source_hash || '(not set)'],
              ['Verified', h.verified ? 'Yes' : 'No'],
              ['Created', h.created_at || '-'],
              ['Updated', h.updated_at || '-'],
            ]);

            const commands = h.commands || [];
            if (commands.length) {
              console.log('\nCommands:');
              printTable(
                ['Name', 'Description'],
                commands.map(c => [c.name || '-', c.description || '-'])
              );
            }

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

  // ── hook update <slug> ─────────────────────────────────────────────────
  hook
    .command('update')
    .description('Update hook identity (creator only)')
    .argument('<slug>', 'Hook slug')
    .option('--name <name>', 'New display name')
    .option('--description <text>', 'New description')
    .option('--permission <mode>', 'Permission mode: open, closed, or whitelist')
    .action(async (slug, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        if (!opts.name && !opts.description && !opts.permission) {
          console.error('Provide at least one of --name, --description, or --permission.');
          process.exit(1);
        }

        if (opts.permission && !['open', 'closed', 'whitelist'].includes(opts.permission)) {
          console.error('--permission must be one of: open, closed, whitelist');
          process.exit(1);
        }

        const hookData = await spin('Looking up hook...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        const body = {};
        if (opts.name) body.name = opts.name;
        if (opts.description) body.description = opts.description;
        if (opts.permission) body.default_invoke_permission = opts.permission;

        const result = await spin('Updating hook...', () =>
          client.patch(`/api/hooks/by-id/${hookData.id}`, body)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess(`Hook "${slug}" updated`);
            printTable(['Field', 'Value'], [
              ['Name', result.name || hookData.name || '-'],
              ['Description', result.description || hookData.description || '-'],
              ['Permission', result.default_invoke_permission || hookData.default_invoke_permission || '-'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── hook enable <slug> ─────────────────────────────────────────────────
  hook
    .command('enable')
    .description('Enable a hook')
    .argument('<slug>', 'Hook slug')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const hookData = await spin('Looking up hook...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        const result = await spin('Enabling hook...', () =>
          client.patch(`/api/hooks/by-id/${hookData.id}`, { enabled: true })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess(`Hook "${slug}" is now enabled`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── hook disable <slug> ────────────────────────────────────────────────
  hook
    .command('disable')
    .description('Disable a hook')
    .argument('<slug>', 'Hook slug')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const hookData = await spin('Looking up hook...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        const result = await spin('Disabling hook...', () =>
          client.patch(`/api/hooks/by-id/${hookData.id}`, { enabled: false })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess(`Hook "${slug}" is now disabled`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── hook rotate-key <slug> ─────────────────────────────────────────────
  hook
    .command('rotate-key')
    .description('Rotate the signing key for a hook')
    .argument('<slug>', 'Hook slug')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const hookData = await spin('Looking up hook...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        const result = await spin('Rotating signing key...', () =>
          client.post(`/api/hooks/by-id/${hookData.id}/rotate-key`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Signing key rotated for "${slug}"`);
            printTable(['Field', 'Value'], [
              ['New Key', r.hookKey || '-'],
            ]);
            printHint('Store this key securely — it will not be shown again.');
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── hook revoke-key <slug> ─────────────────────────────────────────────
  hook
    .command('revoke-key')
    .description('Revoke the signing key for a hook')
    .argument('<slug>', 'Hook slug')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (slug, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        if (!opts.yes) {
          const { createInterface } = await import('readline');
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise((resolve) => {
            rl.question(`Revoke signing key for "${slug}"? This cannot be undone. [y/N] `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            return;
          }
        }

        const hookData = await spin('Looking up hook...', () =>
          client.get(`/api/hooks/by-slug/${encodeURIComponent(slug)}`)
        );

        await spin('Revoking signing key...', () =>
          client.delete(`/api/hooks/by-id/${hookData.id}/revoke-key`)
        );

        output({ success: true }, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess(`Signing key revoked for "${slug}"`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
