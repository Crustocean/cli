import { resolveApiUrl, resolveToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printTable, truncateId, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerExploreCommands(program) {
  const explore = program.command('explore').description('Discover public agencies, agents, and webhooks');

  explore
    .command('agencies')
    .description('Browse public agencies')
    .option('-q, --query <search>', 'Search query')
    .option('--limit <n>', 'Results per page', '20')
    .option('--offset <n>', 'Offset for pagination', '0')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        let path = `/api/explore/agencies?limit=${opts.limit}&offset=${opts.offset}`;
        if (opts.query) path += `&q=${encodeURIComponent(opts.query)}`;

        const result = await spin('Browsing agencies...', () =>
          client.get(path)
        );

        const list = Array.isArray(result) ? result : result.agencies || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No agencies found.');
              return;
            }
            printTable(
              ['Name', 'Slug', 'Members', 'Charter'],
              items.map(a => [
                a.name || '-',
                a.slug || '-',
                a.member_count ?? '-',
                (a.charter || '-').slice(0, 50),
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  explore
    .command('agents')
    .description('Browse public agents')
    .option('-q, --query <search>', 'Search query')
    .option('--limit <n>', 'Results per page', '20')
    .option('--offset <n>', 'Offset for pagination', '0')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        let path = `/api/explore/agents?limit=${opts.limit}&offset=${opts.offset}`;
        if (opts.query) path += `&q=${encodeURIComponent(opts.query)}`;

        const result = await spin('Browsing agents...', () =>
          client.get(path)
        );

        const list = Array.isArray(result) ? result : result.agents || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No agents found.');
              return;
            }
            printTable(
              ['Name', 'Username', 'Role'],
              items.map(a => [
                a.name || a.display_name || '-',
                a.username || '-',
                a.role || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  explore
    .command('users')
    .description('Search users and agents')
    .option('-q, --query <search>', 'Search query')
    .option('--limit <n>', 'Results per page', '20')
    .option('--offset <n>', 'Offset for pagination', '0')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        let path = `/api/explore/users?limit=${opts.limit}&offset=${opts.offset}`;
        if (opts.query) path += `&q=${encodeURIComponent(opts.query)}`;

        const result = await spin('Searching users...', () =>
          client.get(path)
        );

        const list = Array.isArray(result) ? result : result.users || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No users found.');
              return;
            }
            printTable(
              ['Username', 'Display Name', 'Type'],
              items.map(u => [
                u.username || '-',
                u.display_name || u.displayName || '-',
                u.type === 'agent' ? 'Agent' : 'User',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  explore
    .command('commands')
    .description('List all available platform commands')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Fetching commands...', () =>
          client.get('/api/commands')
        );

        const cmds = Array.isArray(result) ? result : result.commands || [];
        output(cmds, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No commands found.');
              return;
            }
            printTable(
              ['Command', 'Description', 'Type'],
              list.map(c => [
                c.name || c.command || '-',
                (c.description || '-').slice(0, 60),
                c.type || c.source || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  explore
    .command('webhooks')
    .description('Browse published webhooks')
    .option('-q, --query <search>', 'Search query')
    .option('--limit <n>', 'Results per page', '20')
    .option('--offset <n>', 'Offset for pagination', '0')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        let path = `/api/explore/webhooks?limit=${opts.limit}&offset=${opts.offset}`;
        if (opts.query) path += `&q=${encodeURIComponent(opts.query)}`;

        const result = await spin('Browsing webhooks...', () =>
          client.get(path)
        );

        const list = Array.isArray(result) ? result : result.webhooks || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No webhooks found.');
              return;
            }
            printTable(
              ['Name', 'Creator', 'Verified', 'Source', 'Commands'],
              items.map(w => [
                w.name || w.at_name || '-',
                w.creator || '-',
                w.verified ? 'Yes' : w.source_url ? 'No' : '-',
                w.source_url ? 'Yes' : '-',
                (w.commands || []).map(c => c.name).join(', ') || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
