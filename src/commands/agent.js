import { createAgent, verifyAgent, updateAgentConfig, addAgentToAgency, transferAgent } from '@crustocean/sdk';
import { resolveApiUrl, requireToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printHint, printTable, truncateId, spin } from '../output.js';
import { promptConfirm } from '../prompts.js';
import { handleError } from '../errors.js';

export function registerAgentCommands(program) {
  const agent = program.command('agent').description('Agent lifecycle commands');

  agent
    .command('create')
    .description('Create a new agent')
    .argument('<name>', 'Agent name')
    .option('--role <role>', 'Agent role')
    .option('--agency-id <id>', 'Agency to add agent to')
    .action(async (name, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Creating agent...', () =>
          createAgent({ apiUrl, userToken, name, role: opts.role, agencyId: opts.agencyId })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Agent "${name}" created`);
            printTable(['Field', 'Value'], [
              ['Agent ID', r.agent?.id || r.id || '-'],
              ['Name', name],
              ['Role', opts.role || 'default'],
            ]);
            const id = r.agent?.id || r.id;
            if (id) printHint(`Next: \`crustocean agent verify ${id}\``);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('list')
    .description('List your agents')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const agents = await spin('Fetching agents...', () =>
          client.get('/api/agents')
        );

        const list = Array.isArray(agents) ? agents : agents.agents || [];
        output(list, {
          json: globalOpts.json,
          formatter: (items) => {
            if (items.length === 0) {
              console.log('No agents found. Create one with `crustocean agent create <name>`.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Role', 'Verified', 'Status'],
              items.map(a => [
                truncateId(a.id),
                a.displayName || a.name || a.username || '-',
                a.role || '-',
                (a.verified || a.is_verified) ? 'Yes' : 'No',
                a.status || '-',
              ])
            );
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('verify')
    .description('Verify an agent for SDK access')
    .argument('<id>', 'Agent ID')
    .action(async (id) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Verifying agent...', () =>
          verifyAgent({ apiUrl, userToken, agentId: id })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Agent ${truncateId(id)} verified`);
            if (r.agentToken) {
              console.log(`\nAgent Token: ${r.agentToken}`);
              printHint('Store this token securely — it will not be shown again.');
            }
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('config')
    .description('View or update agent configuration')
    .argument('<id>', 'Agent ID')
    .option('--personality <text>', 'Agent personality')
    .option('--webhook-url <url>', 'Webhook URL')
    .option('--llm-provider <provider>', 'LLM provider')
    .option('--llm-api-key <key>', 'LLM API key')
    .option('--ollama-endpoint <url>', 'Ollama endpoint')
    .option('--ollama-model <model>', 'Ollama model')
    .option('--role <role>', 'Agent role')
    .option('--spend-limit-tx <n>', 'Max USDC per transaction (default: 10)')
    .option('--spend-limit-daily <n>', 'Max USDC per day (default: 50)')
    .option('--wallet-approval <mode>', 'Approval mode: auto or manual')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const config = {};
        if (opts.personality) config.personality = opts.personality;
        if (opts.webhookUrl) config.webhook_url = opts.webhookUrl;
        if (opts.llmProvider) config.llm_provider = opts.llmProvider;
        if (opts.llmApiKey) config.llm_api_key = opts.llmApiKey;
        if (opts.ollamaEndpoint) config.ollama_endpoint = opts.ollamaEndpoint;
        if (opts.ollamaModel) config.ollama_model = opts.ollamaModel;
        if (opts.role) config.role = opts.role;
        if (opts.spendLimitTx) config.wallet_spend_limit_per_tx = parseFloat(opts.spendLimitTx);
        if (opts.spendLimitDaily) config.wallet_spend_limit_daily = parseFloat(opts.spendLimitDaily);
        if (opts.walletApproval) config.wallet_approval_mode = opts.walletApproval;

        if (Object.keys(config).length === 0) {
          const client = new CrustoceanClient(apiUrl, userToken);
          const result = await spin('Fetching agent config...', () =>
            client.get(`/api/agents/${encodeURIComponent(id)}/config`)
          );

          const c = result.config || result;
          output(c, {
            json: globalOpts.json,
            formatter: (cfg) => {
              const rows = Object.entries(cfg)
                .filter(([, v]) => v != null && v !== '')
                .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
              if (!rows.length) {
                console.log('No configuration set for this agent.');
                return;
              }
              printTable(['Key', 'Value'], rows);
            },
          });
          return;
        }

        const result = await spin('Updating agent config...', () =>
          updateAgentConfig({ apiUrl, userToken, agentId: id, config })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Agent ${truncateId(id)} config updated`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('add')
    .description('Add agent to an agency')
    .argument('<id>', 'Agent ID')
    .option('--agency <id>', 'Agency ID (required)')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        if (!opts.agency) {
          console.error('--agency is required. Specify the agency ID.');
          process.exit(1);
        }

        const result = await spin('Adding agent to agency...', () =>
          addAgentToAgency({ apiUrl, userToken, agencyId: opts.agency, agentId: id })
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Agent ${truncateId(id)} added to agency ${truncateId(opts.agency)}`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('transfer')
    .description('Transfer agent ownership to another user')
    .argument('<id>', 'Agent ID')
    .requiredOption('--to <username>', 'Username of the new owner')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Transfer agent ${truncateId(id)} to @${opts.to}?`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const userToken = requireToken(globalOpts);

        const result = await spin('Transferring agent...', () =>
          transferAgent({ apiUrl, userToken, agentId: id, newOwnerUsername: opts.to })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Agent ${truncateId(id)} transferred to @${r.newOwner?.username || opts.to}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  agent
    .command('delete')
    .description('Delete an agent')
    .argument('<id>', 'Agent ID')
    .option('-y, --confirm', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      const globalOpts = program.opts();
      try {
        if (!opts.confirm) {
          const yes = await promptConfirm(`Delete agent ${truncateId(id)}? This cannot be undone.`);
          if (!yes) { console.log('Cancelled.'); return; }
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Deleting agent...', () =>
          client.delete(`/api/agents/${id}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: () => printSuccess(`Agent ${truncateId(id)} deleted`),
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
