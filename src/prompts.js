import { createInterface } from 'node:readline';

function createRL() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

export function promptText(question) {
  return new Promise((resolve) => {
    const rl = createRL();
    rl.question(question + ' ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, terminal: true });
    process.stdout.write(question + ' ');

    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (ch) => {
      const c = ch.toString();
      if (c === '\n' || c === '\r' || c === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (c === '\u0003') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (c === '\u007f' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += c;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

export function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = createRL();
    rl.question(question + ' (y/N) ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
