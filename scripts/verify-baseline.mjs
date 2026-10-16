import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
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
const migrationPath='.private/p6-p7/migration-applied.json';
const migration=fs.existsSync(migrationPath)?JSON.parse(fs.readFileSync(migrationPath,'utf8')):null;
function reviewedTransition(record) {
 const transition=migration?.transitions.find(t=>t.source===record.source&&t.before_sha256.toUpperCase()===record.sha256);
 if(!transition)return false;
 if(hash(transition.snapshot)!==record.sha256||hash(transition.after_snapshot)!==transition.after_sha256.toUpperCase())throw Error('Migration preservation snapshot changed');
 return true;
}
if(migration){
 const current=JSON.parse(fs.readFileSync(migration.canonical,'utf8'));
 assert.equal(current.schema_version,2);
 assert.ok(current.migrations.some(m=>m.source_sha256===migration.source_sha256),'Missing migration lineage');
 const baseline=JSON.parse(fs.readFileSync(migration.transitions.find(t=>t.source===migration.canonical).after_snapshot,'utf8'));
 // New captures are allowed; original evidence and intention remain immutable.
 const subset=(a,b)=>{if(a&&typeof a==='object'&&!Array.isArray(a)){for(const[k,v]of Object.entries(a))subset(v,b?.[k]);}else assert.deepEqual(b,a);};
 for(const key of ['session_entries','audit_log','event_log'])for(const row of baseline[key]||[])subset(row,current[key]?.find(r=>r.id===row.id));
 for(const row of baseline.sessions||[]){const live=current.sessions.find(r=>r.id===row.id);for(const key of ['id','intention','started_at'])assert.deepEqual(live?.[key],row[key]);}
}
for (const record of records) {
  if (hash(record.snapshot) !== record.sha256) throw new Error('Snapshot mismatch');
  // Configuration/source files intentionally change; original datasets must not.
  if ((record.preserveSource || /[/\\](backend|data|export)[/\\]/.test(record.source)) && !currentRecords.some(current => current.source === record.source) && hash(record.source) !== record.sha256 && !reviewedTransition(record)) {
    throw new Error('Original data changed');
  }
}
for (const record of currentRecords) {
  if (hash(record.snapshot) !== record.sha256 || (hash(record.source) !== record.sha256 && !reviewedTransition(record))) throw new Error('Current repair baseline data changed');
}
const bundle = JSON.parse(fs.readFileSync('.private/p0-baseline/source-bundle-hash.json', 'utf8').replace(/^\uFEFF/, ''));
if (hash('.private/p0-baseline/source.bundle') !== bundle.Hash) throw new Error('Source bundle mismatch');
console.log(`PASS: ${records.length} P0 snapshots intact; ${migration ? 'reviewed migration snapshots/lineage and original evidence preserved' : 'current repair baseline datasets unchanged'}.`);
