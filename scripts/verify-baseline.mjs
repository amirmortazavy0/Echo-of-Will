import fs from 'node:fs';
import crypto from 'node:crypto';
const manifestPath = '.private/p0-baseline/manifest.json';
if (!fs.existsSync(manifestPath)) {
  console.error('BLOCKED: private baseline manifest missing; preserve a baseline first.');
  process.exit(1);
}
const currentManifestPath = fs.existsSync('.private/p4-p5-baseline/manifest.json') ? '.private/p4-p5-baseline/manifest.json' : '.private/p1-p3-baseline/manifest.json';
if(fs.existsSync('.private/p4-p5-baseline/manifest.json')) { const prior=JSON.parse(fs.readFileSync('.private/p1-p3-baseline/manifest.json','utf8').replace(/^\uFEFF/,'')); for(const r of prior)if(crypto.createHash('sha256').update(fs.readFileSync(r.snapshot)).digest('hex').toUpperCase()!==r.sha256)throw Error('Earlier follow-up snapshot changed'); }
const currentRecords = fs.existsSync(currentManifestPath) ? JSON.parse(fs.readFileSync(currentManifestPath, 'utf8').replace(/^\uFEFF/, '')) : [];
const records = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
for (const record of records) {
  if (hash(record.snapshot) !== record.sha256) throw new Error('Snapshot mismatch');
  // Configuration/source files intentionally change; original datasets must not.
  if ((record.preserveSource || /[/\\](backend|data|export)[/\\]/.test(record.source)) && !currentRecords.some(current => current.source === record.source) && hash(record.source) !== record.sha256) {
    throw new Error('Original data changed');
  }
}
for (const record of currentRecords) {
  if (hash(record.snapshot) !== record.sha256 || hash(record.source) !== record.sha256) throw new Error('Current repair baseline data changed');
}
const bundle = JSON.parse(fs.readFileSync('.private/p0-baseline/source-bundle-hash.json', 'utf8').replace(/^\uFEFF/, ''));
if (hash('.private/p0-baseline/source.bundle') !== bundle.Hash) throw new Error('Source bundle mismatch');
console.log(`PASS: ${records.length} P0 snapshots intact; current repair baseline datasets unchanged.`);
