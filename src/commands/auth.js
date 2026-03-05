import { login, register } from '@crustocean/sdk';
import { resolveApiUrl, resolveToken, readConfig, writeConfig, clearConfig, getConfigPath, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printHint, printTable, truncateId, spin } from '../output.js';
import { promptText, promptPassword, promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerAuthCommands(program) {
  const auth = program.command('auth').description('Authentication commands');

  auth
    .command('login')
    .description('Log in to Crustocean')
    .option('-u, --username <username>', 'Username')
    .option('-p, --password <password>', 'Password')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const username = opts.username || await promptText('Username:');
        const password = opts.password || await promptPassword('Password:');

        const result = await spin('Logging in...', () =>
          login({ apiUrl, username, password })
        );

        writeConfig({ apiUrl, token: result.token, username });
        if (globalOpts.json) {
          output({ ok: true, username, apiUrl }, { json: true });
        } else {
          printSuccess(`Logged in as ${username}`);
          printHint('Run `crustocean auth whoami` to verify your session.');
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('register')
    .description('Create a new Crustocean account')
    .option('-u, --username <username>', 'Username')
    .option('-p, --password <password>', 'Password')
    .option('-d, --display-name <name>', 'Display name')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const username = opts.username || await promptText('Username:');
        const password = opts.password || await promptPassword('Password:');
        const displayName = opts.displayName || await promptText('Display name:');

        const result = await spin('Creating account...', () =>
          register({ apiUrl, username, password, displayName })
        );

        writeConfig({ apiUrl, token: result.token, username });
        if (globalOpts.json) {
          output({ ok: true, username, apiUrl }, { json: true });
        } else {
          printSuccess(`Account created! Logged in as ${username}`);
          printHint('Next: `crustocean agent create <name>` to create your first agent.');
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        clearConfig();
        if (globalOpts.json) {
          output({ ok: true }, { json: true });
        } else {
          printSuccess('Logged out. Stored credentials cleared.');
        }
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('whoami')
    .description('Show the currently logged-in user')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        if (!token) {
          throw new Error('Not logged in. Run `crustocean auth login` or `crustocean auth register` first.');
        }
        const client = new CrustoceanClient(apiUrl, token);
        const user = await spin('Fetching user info...', () =>
          client.get('/api/auth/me')
        );

        const u = user.user || user;
        output(u, {
          json: globalOpts.json,
          formatter: (u) => {
            printTable(['Field', 'Value'], [
              ['Username', u.username],
              ['Display Name', u.displayName || u.display_name || '-'],
              ['ID', u.id],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('status')
    .description('Show config file state')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const config = readConfig();
        const path = getConfigPath();
        const data = {
          configPath: path,
          apiUrl: config.apiUrl || '(default)',
          loggedIn: !!config.token,
          username: config.username || null,
        };
        output(data, {
          json: globalOpts.json,
          formatter: (d) => {
            printTable(['Field', 'Value'], [
              ['Config file', d.configPath],
              ['API URL', d.apiUrl],
              ['Logged in', d.loggedIn ? 'Yes' : 'No'],
              ['Username', d.username || '-'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('change-password')
    .description('Change your account password')
    .option('--current <password>', 'Current password')
    .option('--new <password>', 'New password')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const currentPassword = opts.current || await promptPassword('Current password:');
        const newPassword = opts.new || await promptPassword('New password:');

        await spin('Changing password...', () =>
          client.post('/api/auth/change-password', { currentPassword, newPassword })
        );

        output({ ok: true }, {
          json: globalOpts.json,
          formatter: () => printSuccess('Password changed.'),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  // ── Personal Access Tokens ─────────────────────────────────────────────

  auth
    .command('create-token')
    .description('Create a personal access token (PAT)')
    .option('--name <name>', 'Token name')
    .option('--expires <duration>', 'Expiry (e.g. 30d, 90d, 365d, never)')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const name = opts.name || await promptText('Token name:');

        const body = { name };
        if (opts.expires) body.expires = opts.expires;

        const result = await spin('Creating token...', () =>
          client.post('/api/auth/tokens', body)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Token "${name}" created`);
            if (r.token) {
              console.log(`\n  ${r.token}\n`);
              printHint('Copy this token now — it will not be shown again.');
            }
            printTable(['Field', 'Value'], [
              ['ID', r.id || '-'],
              ['Name', r.name || name],
              ['Expires', r.expires_at || r.expires || 'never'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('list-tokens')
    .description('List your personal access tokens')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching tokens...', () =>
          client.get('/api/auth/tokens')
        );

        const tokens = Array.isArray(result) ? result : result.tokens || [];
        output(tokens, {
          json: globalOpts.json,
          formatter: (list) => {
            if (!list.length) {
              console.log('No tokens found. Create one with `crustocean auth create-token`.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Created', 'Expires', 'Last Used'],
              list.map(t => [
                truncateId(t.id),
                t.name || '-',
                t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
                t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'never',
                t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'never',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('revoke-token')
    .description('Revoke a personal access token')
    .argument('<id>', 'Token ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Revoke token ${truncateId(id)}?`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin('Revoking token...', () =>
          client.delete(`/api/auth/tokens/${encodeURIComponent(id)}`)
        );

        output({ ok: true }, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Token ${truncateId(id)} revoked.`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  auth
    .command('delete-account')
    .description('Permanently delete your account')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm('Permanently delete your account and all your agents? This cannot be undone.');
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = resolveToken(globalOpts);
        if (!token) {
          throw new Error('Not logged in. Run `crustocean auth login` first.');
        }
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Deleting account...', () =>
          client.delete('/api/auth/account')
        );

        clearConfig();
        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess('Account deleted. Local credentials cleared.'),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
