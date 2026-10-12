// Copies bytes only. Never imports the application or its storage reader.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';

const root = process.cwd();
const destination = path.resolve('.private/p0-baseline');
if (fs.existsSync(destination)) throw new Error('Baseline already exists; preserve it and use a fresh checkout for a new baseline.');
const localEnv = fs.existsSync('.env') ? parse(fs.readFileSync('.env')) : {};
const dataDir = path.resolve(process.env.PIST_DATA_DIR || localEnv.PIST_DATA_DIR || 'backend/data');
const files = new Set();
for (const file of execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)) {
  files.add(path.resolve(file));
}
function inventory(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inventory(file);
    else if (entry.isFile()) files.add(path.resolve(file));
    else throw new Error('Review symbolic links before taking the baseline');
  }
}
for (const directory of ['backend', 'data', 'export', dataDir]) inventory(directory);
for (const name of fs.readdirSync(root)) {
  if (name.startsWith('.env') || ['.npmrc', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'start.bat', 'start.sh'].includes(name)) {
    if (fs.statSync(name).isFile()) files.add(path.resolve(name));
  }
}
fs.mkdirSync(destination, { recursive: true });
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const manifest = [];
for (const source of files) {
  const relative = path.relative(root, source);
  const local = !relative.startsWith('..') && !path.isAbsolute(relative);
  const snapshot = path.join(destination, local ? relative : path.join('external', String(manifest.length), path.basename(source)));
  fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.copyFileSync(source, snapshot, fs.constants.COPYFILE_EXCL);
  const sha256 = hash(source);
  if (sha256 !== hash(snapshot)) throw new Error('Snapshot changed while copying; stop the app and repeat in a fresh checkout');
  manifest.push({ source, snapshot, sha256, bytes: fs.statSync(source).size,
    preserveSource: !local || /^(backend|data|export)[/\\]/.test(relative) });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
execFileSync('git', ['bundle', 'create', path.join(destination, 'source.bundle'), 'HEAD']);
fs.writeFileSync(path.join(destination, 'source-bundle-hash.json'), JSON.stringify({ Hash: hash(path.join(destination, 'source.bundle')) }));
fs.writeFileSync(path.join(destination, 'baseline.json'), JSON.stringify({
  capturedAt: new Date().toISOString(), node: process.version,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  // Working changes are preserved privately alongside the committed bundle.
  configuredDataDir: dataDir, activeInstance: 'Not established by file inventory; inspect running processes separately',
}, null, 2));
fs.writeFileSync(path.join(destination, 'working-tree.patch'), execFileSync('git', ['diff', 'HEAD', '--binary'], { maxBuffer: 50 * 1024 * 1024 }));
console.log(`Preserved ${manifest.length} files in .private/p0-baseline; do not commit or share this directory.`);
