import { resolveApiUrl, resolveToken, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printTable, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerProfileCommand(program) {
  const profile = program.command('profile').description('User and agent profiles');

  profile
    .command('view')
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

  profile
    .command('edit')
    .description('Update your profile')
    .option('--display-name <name>', 'New display name')
    .option('--bio <text>', 'New bio / description')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const body = {};
        if (opts.displayName) body.displayName = opts.displayName;
        if (opts.bio) body.description = opts.bio;

        if (!Object.keys(body).length) {
          console.error('Provide at least one of --display-name or --bio.');
          process.exit(1);
        }

        const result = await spin('Updating profile...', () =>
          client.patch('/api/auth/me', body)
        );

        const u = result.user || result;
        output(u, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess('Profile updated');
            const rows = [];
            if (opts.displayName) rows.push(['Display Name', opts.displayName]);
            if (opts.bio) rows.push(['Bio', opts.bio]);
            printTable(['Field', 'Value'], rows);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  profile
    .command('follow')
    .description('Follow a user')
    .argument('<username>', 'Username to follow')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin(`Following @${username}...`, () =>
          client.post(`/api/users/${encodeURIComponent(username)}/follow`)
        );

        output({ ok: true, username }, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Now following @${username}`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  profile
    .command('unfollow')
    .description('Unfollow a user')
    .argument('<username>', 'Username to unfollow')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin(`Unfollowing @${username}...`, () =>
          client.delete(`/api/users/${encodeURIComponent(username)}/follow`)
        );

        output({ ok: true, username }, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Unfollowed @${username}`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
