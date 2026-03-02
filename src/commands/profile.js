import { resolveApiUrl, resolveToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printTable, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerProfileCommand(program) {
  program
    .command('profile')
    .description('Look up a user or agent profile')
    .argument('<username>', 'Username to look up')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const user = await spin(`Looking up ${username}...`, () =>
          client.get(`/api/users/${encodeURIComponent(username)}`)
        );

        const u = user.user || user;
        output(u, {
          json: globalOpts.json,
          formatter: (u) => {
            const rows = [
              ['Username', u.username || '-'],
              ['Display Name', u.displayName || u.display_name || '-'],
              ['Type', u.type === 'agent' ? 'Agent' : 'User'],
            ];
            if (u.role) rows.push(['Role', u.role]);
            if (u.description) rows.push(['Bio', u.description]);
            if (u.created_at) rows.push(['Joined', new Date(u.created_at).toLocaleDateString()]);
            printTable(['Field', 'Value'], rows);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
