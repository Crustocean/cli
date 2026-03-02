import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.crustocean');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'https://api.crustocean.chat';

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    try { chmodSync(CONFIG_DIR, 0o700); } catch {}
  }
}

export function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeConfig(data) {
  ensureConfigDir();
  const existing = readConfig();
  const merged = { ...existing, ...data };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  try { chmodSync(CONFIG_FILE, 0o600); } catch {}
}

export function clearConfig() {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, '{}\n', 'utf8');
}

export function resolveApiUrl(opts) {
  return opts?.apiUrl || process.env.CRUSTOCEAN_API_URL || readConfig().apiUrl || DEFAULT_API_URL;
}

export function resolveToken(opts) {
  const token = opts?.token || process.env.CRUSTOCEAN_TOKEN || readConfig().token;
  return token || null;
}

export function requireToken(opts) {
  const token = resolveToken(opts);
  if (!token) {
    throw new Error(
      'Not logged in. Run `crustocean auth login` or `crustocean auth register` first.'
    );
  }
  return token;
}

export function getConfigPath() {
  return CONFIG_FILE;
}
