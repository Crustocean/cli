/**
 * CLI wallet commands — non-custodial.
 *
 * SECURITY:
 *   - `wallet generate` creates keys locally, prints them, never sends them anywhere
 *   - `wallet send` reads CRUSTOCEAN_WALLET_KEY from env, signs locally via SDK, reports tx hash
 *   - Private keys are NEVER stored in config, NEVER sent to the API
 */

import { resolveApiUrl, requireToken, resolveToken } from '../config.js';
import { CrustoceanClient } from '../client.js';
import { output, printSuccess, printHint, printWarning, printTable, spin } from '../output.js';
import { handleError } from '../errors.js';

export function registerWalletCommands(program) {
  const wallet = program.command('wallet').description('Wallet operations (non-custodial, keys stay local)');

  wallet
    .command('generate')
    .description('Generate a new wallet keypair locally (never sent to Crustocean)')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const { generateWallet } = await import('../../../sdk/packages/sdk/src/wallet.js');
        const { address, privateKey } = generateWallet();

        output({ address, privateKey }, {
          json: globalOpts.json,
          formatter: () => {
            printSuccess('Wallet generated locally');
            console.log('');
            console.log(`  Address:     ${address}`);
            console.log(`  Private Key: ${privateKey}`);
            console.log('');
            printWarning('Save the private key securely — it will NOT be shown again.');
            printWarning('Crustocean never stores or accesses your private key.');
            console.log('');
            printHint('Add to your environment:');
            console.log(`  export CRUSTOCEAN_WALLET_KEY="${privateKey}"`);
            console.log('');
            printHint('Register the public address:');
            console.log(`  crustocean wallet register ${address}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('register')
    .description('Register your public wallet address with Crustocean')
    .argument('<address>', 'Your 0x wallet address')
    .action(async (address) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Registering wallet address...', () =>
          client.post('/api/wallet/register', { address })
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Wallet registered: ${r.address || address}`);
            if (r.network) printHint(`Network: ${r.network}`);
            if (r.explorer) printHint(`Explorer: ${r.explorer}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('unregister')
    .description('Remove your wallet address from Crustocean')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        await spin('Removing wallet address...', () =>
          client.delete('/api/wallet/register')
        );

        printSuccess('Wallet address removed');
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('balance')
    .description('Check USDC and ETH balance')
    .argument('[username]', 'Username to look up (default: your own)')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);

        if (username) {
          const client = new CrustoceanClient(apiUrl);
          const info = await spin('Looking up wallet...', () =>
            client.get(`/api/explore/wallet/${encodeURIComponent(username)}`)
          );
          if (!info.address) {
            console.log(`@${username} has no wallet registered.`);
            return;
          }
          console.log(`@${username}: ${info.address}`);
          return;
        }

        const token = requireToken(globalOpts);
        const client = new CrustoceanClient(apiUrl, token);

        const result = await spin('Fetching balance...', () =>
          client.get('/api/wallet')
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            if (!r.hasWallet) {
              console.log('No wallet registered. Run `crustocean wallet register <address>` first.');
              return;
            }
            printTable(['Field', 'Value'], [
              ['Address', r.address],
              ['USDC', r.balances?.usdc || '0'],
              ['ETH', r.balances?.eth || '0'],
              ['Network', r.network || 'base'],
            ]);
            if (r.explorer) printHint(`Explorer: ${r.explorer}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('address')
    .description('Look up a user\'s public wallet address')
    .argument('<username>', 'Username')
    .action(async (username) => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Looking up address...', () =>
          client.get(`/api/explore/wallet/${encodeURIComponent(username)}`)
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            if (!r.address) {
              console.log(`@${r.username || username} has no wallet registered.`);
              return;
            }
            console.log(`@${r.username}: ${r.address}`);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('send')
    .description('Send USDC on Base (signs locally using CRUSTOCEAN_WALLET_KEY)')
    .argument('<to>', 'Recipient: @username or 0x address')
    .argument('<amount>', 'USDC amount')
    .option('--agency <id>', 'Agency ID to post payment message in (optional)')
    .action(async (to, amount, opts) => {
      const globalOpts = program.opts();
      try {
        const privateKey = process.env.CRUSTOCEAN_WALLET_KEY;
        if (!privateKey) {
          console.error('CRUSTOCEAN_WALLET_KEY environment variable is required.');
          printHint('Generate a wallet: `crustocean wallet generate`');
          printHint('Then: export CRUSTOCEAN_WALLET_KEY="0x..."');
          process.exit(1);
        }

        const apiUrl = resolveApiUrl(globalOpts);
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          console.error('Amount must be a positive number.');
          process.exit(1);
        }

        let toAddress = to;
        if (!to.startsWith('0x')) {
          const client = new CrustoceanClient(apiUrl);
          const username = to.replace(/^@/, '').toLowerCase();
          const lookup = await spin(`Resolving @${username}...`, () =>
            client.get(`/api/explore/wallet/${encodeURIComponent(username)}`)
          );
          if (!lookup.address) {
            console.error(`@${username} has no wallet registered.`);
            process.exit(1);
          }
          toAddress = lookup.address;
          console.log(`  @${username} → ${toAddress}`);
        }

        const { LocalWalletProvider } = await import('../../../sdk/packages/sdk/src/wallet.js');
        const provider = new LocalWalletProvider(privateKey);

        const result = await spin(`Sending ${parsedAmount} USDC...`, () =>
          provider.sendUSDC(toAddress, parsedAmount)
        );

        if (opts.agency) {
          const token = resolveToken(globalOpts);
          if (token) {
            const client = new CrustoceanClient(apiUrl, token);
            await client.post('/api/wallet/payment', {
              txHash: result.txHash,
              agencyId: opts.agency,
              to,
              amount: String(parsedAmount),
              token: 'USDC',
            }).catch(() => {});
          }
        }

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printSuccess(`Sent ${parsedAmount} USDC`);
            printTable(['Field', 'Value'], [
              ['To', to.startsWith('0x') ? to : `${to} (${toAddress})`],
              ['Amount', `${parsedAmount} USDC`],
              ['Tx Hash', r.txHash],
              ['Explorer', r.explorerUrl],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });

  wallet
    .command('capabilities')
    .description('Check what web3 features are enabled on the server')
    .action(async () => {
      const globalOpts = program.opts();
      try {
        const apiUrl = resolveApiUrl(globalOpts);
        const client = new CrustoceanClient(apiUrl);

        const result = await spin('Checking capabilities...', () =>
          client.get('/api/explore/capabilities')
        );

        output(result, {
          json: globalOpts.json,
          formatter: (r) => {
            printTable(['Capability', 'Status'], [
              ['Wallets', r.wallets ? 'Enabled' : 'Disabled'],
              ['Network', r.network || '-'],
              ['Token', r.token || '-'],
              ['x402 Payments', r.x402 ? 'Enabled' : 'Disabled'],
              ['Hook Transparency', r.hookTransparency ? 'Enabled' : 'Disabled'],
            ]);
          },
        });
      } catch (err) {
        handleError(err, globalOpts.json);
      }
    });
}
