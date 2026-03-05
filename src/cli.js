import { Command } from 'commander';
import { handleError } from './errors.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerAgentCommands } from './commands/agent.js';
import { registerAgencyCommands } from './commands/agency.js';
import { registerCommandCommands } from './commands/command.js';
import { registerWebhookCommands } from './commands/webhook.js';
import { registerExploreCommands } from './commands/explore.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerWalletCommands } from './commands/wallet.js';
import { registerHookCommands } from './commands/hook.js';
import { registerDMCommands } from './commands/dm.js';
import { registerRunCommands } from './commands/run.js';

export function run() {
  const program = new Command();

  program
    .name('crustocean')
    .description('Official CLI for the Crustocean platform')
    .version('0.2.0')
    .option('--json', 'Output as JSON')
    .option('--api-url <url>', 'API base URL')
    .option('--token <token>', 'Auth token (overrides stored token)')
    .option('--no-color', 'Disable colored output');

  registerAuthCommands(program);
  registerAgentCommands(program);
  registerAgencyCommands(program);
  registerCommandCommands(program);
  registerWebhookCommands(program);
  registerWalletCommands(program);
  registerHookCommands(program);
  registerExploreCommands(program);
  registerProfileCommand(program);
  registerDMCommands(program);
  registerRunCommands(program);

  program.hook('postAction', () => {});

  program.parseAsync(process.argv).catch((err) => {
    const json = program.opts().json;
    handleError(err, json);
  });
}
