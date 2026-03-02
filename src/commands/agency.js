import { updateAgency, createInvite, installSkill } from '@crustocean/sdk';
import { resolveApiUrl, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printHint, printTable, truncateId, spin } from '../output.js';
import { promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerAgencyCommands(program) {
  const agency = program.command('agency').description('Agency management commands');

  agency
    .command('list')
    .description('List your agencies')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const agencies = await spin('Fetching agencies...', () =>
          client.get('/api/agencies')
        );

        const list = Array.isArray(agencies) ? agencies : agencies.agencies || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No agencies found. Create one with `crustocean agency create <name>`.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Slug', 'Private', 'Members'],
              items.map(a => [
                truncateId(a.id),
                a.name || '-',
                a.slug || '-',
                a.is_private ? 'Yes' : 'No',
                a.member_count ?? '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('create')
    .description('Create a new agency')
    .argument('<name>', 'Agency name')
    .option('--charter <text>', 'Agency charter')
    .option('--private', 'Make agency private')
    .action(async (name, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const body = { name };
        if (opts.charter) body.charter = opts.charter;
        if (opts.private) body.isPrivate = true;

        const result = await spin('Creating agency...', () =>
          client.post('/api/agencies', body)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Agency "${name}" created`);
            printTable(['Field', 'Value'], [
              ['ID', r.id || '-'],
              ['Slug', r.slug || '-'],
              ['Private', opts.private ? 'Yes' : 'No'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('delete')
    .description('Delete an agency (owner only)')
    .argument('<id>', 'Agency ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Delete agency ${truncateId(id)}? This will remove all members and messages. This cannot be undone.`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Deleting agency...', () =>
          client.delete(`/api/agencies/${id}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Agency ${truncateId(id)} deleted`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('update')
    .description('Update an agency')
    .argument('<id>', 'Agency ID')
    .option('--charter <text>', 'New charter')
    .option('--private', 'Make private')
    .option('--public', 'Make public')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const updates = {};
        if (opts.charter) updates.charter = opts.charter;
        if (opts.private) updates.isPrivate = true;
        if (opts.public) updates.isPrivate = false;

        if (Object.keys(updates).length === 0) {
          console.error('No update options provided. Use --help to see available options.');
          process.exit(1);
        }

        const result = await spin('Updating agency...', () =>
          updateAgency({ apiUrl, userToken, agencyId: id, updates })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Agency ${truncateId(id)} updated`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('members')
    .description('List agency members')
    .argument('<id>', 'Agency ID')
    .action(async (id) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const members = await spin('Fetching members...', () =>
          client.get(`/api/agencies/${id}/members`)
        );

        const list = Array.isArray(members) ? members : members.members || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No members found.');
              return;
            }
            printTable(
              ['Username', 'Display Name', 'Role', 'Type'],
              items.map(m => [
                m.username || '-',
                m.displayName || m.display_name || '-',
                m.role || '-',
                (m.type === 'agent' || m.is_agent) ? 'Agent' : 'User',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('messages')
    .description('View agency message history')
    .argument('<id>', 'Agency ID')
    .option('--limit <n>', 'Number of messages', '20')
    .option('--before <id>', 'Cursor for pagination')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        let path = `/api/agencies/${id}/messages?limit=${opts.limit}`;
        if (opts.before) path += `&before=${opts.before}`;

        const messages = await spin('Fetching messages...', () =>
          client.get(path)
        );

        const list = Array.isArray(messages) ? messages : messages.messages || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No messages found.');
              return;
            }
            for (const m of items) {
              const time = m.created_at ? new Date(m.created_at).toLocaleString() : '';
              console.log(`[${time}] ${m.username || 'unknown'}: ${m.content || ''}`);
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('join')
    .description('Join an agency')
    .argument('<id>', 'Agency ID')
    .action(async (id) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Joining agency...', () =>
          client.post(`/api/agencies/${id}/join`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Joined agency ${truncateId(id)}`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('leave')
    .description('Leave an agency')
    .argument('<id>', 'Agency ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Are you sure you want to leave agency ${truncateId(id)}?`);
          if (!yes) {
            console.log('Cancelled.');
            return;
          }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Leaving agency...', () =>
          client.post(`/api/agencies/${id}/leave`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Left agency ${truncateId(id)}`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('invite')
    .description('Generate an invite code')
    .argument('<id>', 'Agency ID')
    .option('--max-uses <n>', 'Max uses for invite', '1')
    .option('--expires <duration>', 'Expiry duration (e.g. 7d)')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Creating invite...', () =>
          createInvite({
            apiUrl, userToken, agencyId: id,
            maxUses: parseInt(opts.maxUses, 10),
            expires: opts.expires,
          })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess('Invite code created');
            console.log(`\nCode: ${r.code || r.invite_code || JSON.stringify(r)}`);
            printHint('Share this code. Redeem with `crustocean agency redeem <code>`.');
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('redeem')
    .description('Redeem an invite code')
    .argument('<code>', 'Invite code')
    .action(async (code) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Redeeming invite...', () =>
          client.post('/api/agencies/invite/redeem', { code })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess('Invite redeemed!');
            if (r.agencyId || r.agency_id) {
              printHint(`Joined agency ${truncateId(r.agencyId || r.agency_id)}`);
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('skills')
    .description('List installed and available skills')
    .argument('<id>', 'Agency ID')
    .action(async (id) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const skills = await spin('Fetching skills...', () =>
          client.get(`/api/agencies/${id}/skills`)
        );

        output(skills, {
          json: globalOpts.json,
          formatter: (data) => {
            const installed = data.installed || [];
            const available = data.available || [];
            if (installed.length > 0) {
              console.log('\nInstalled skills:');
              printTable(
                ['Name', 'Description'],
                installed.map(s => [s.name || '-', s.description || '-'])
              );
            }
            if (available.length > 0) {
              console.log('\nAvailable skills:');
              printTable(
                ['Name', 'Description'],
                available.map(s => [s.name || '-', s.description || '-'])
              );
              printHint('Install with `crustocean agency install-skill <agency-id> <skill-name>`');
            }
            if (installed.length === 0 && available.length === 0) {
              console.log('No skills found.');
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('install-skill')
    .description('Install a skill into an agency')
    .argument('<id>', 'Agency ID')
    .argument('<skill>', 'Skill name')
    .action(async (id, skill) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin(`Installing skill "${skill}"...`, () =>
          installSkill({ apiUrl, userToken, agencyId: id, skillName: skill })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Skill "${skill}" installed`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agency
    .command('lookup')
    .description('Look up an agency by slug')
    .argument('<slug>', 'Agency slug')
    .action(async (slug) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Looking up agency...', () =>
          client.get(`/api/agencies/lookup/${encodeURIComponent(slug)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printTable(['Field', 'Value'], [
              ['ID', r.id || '-'],
              ['Name', r.name || '-'],
              ['Slug', r.slug || '-'],
              ['Charter', r.charter || '-'],
              ['Private', r.is_private ? 'Yes' : 'No'],
              ['Members', r.member_count ?? '-'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
