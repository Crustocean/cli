import chalk from 'chalk';
import Table from 'cli-table3';

export function output(data, { json, formatter }) {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (formatter) {
    formatter(data);
  } else {
    console.log(data);
  }
}

export function printTable(headers, rows) {
  const table = new Table({ head: headers.map(h => chalk.cyan(h)) });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

export function printSuccess(msg) {
  console.log(chalk.green('✔') + ' ' + msg);
}

export function printError(msg) {
  console.error(chalk.red('✖') + ' ' + msg);
}

export function printWarning(msg) {
  console.log(chalk.yellow('⚠') + ' ' + msg);
}

export function printHint(msg) {
  console.log(chalk.dim('→ ' + msg));
}

export function truncateId(uuid) {
  if (!uuid) return '';
  return uuid.length > 12 ? uuid.slice(0, 8) + '...' : uuid;
}

/**
 * Run an async function with an ora spinner. Stops the spinner on
 * both success and failure so it never leaks into error output.
 */
export async function spin(message, fn) {
  const { default: ora } = await import('ora');
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
