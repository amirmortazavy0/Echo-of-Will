import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readAppData, writeAppData, getCanonicalStoragePath, getBackupStoragePath, fileHash, migrateStorageFile, inspectStorageFile, appendEvent } from '../server/storage';

const empty=()=>({schema_version:2,journeys:[],nodes:[],sessions:[],session_entries:[],audit_log:[],event_log:[],corrections:[],conflicts:[]});
const thing=(id='thing')=>({id,name:id,status:'ACTIVE',created_at:'2026-10-11T00:00:00Z'});
function setup(t:any) {const previous=process.env.PIST_DATA_DIR; const dir=path.resolve('.private/repair-tests',randomUUID());fs.mkdirSync(dir,{recursive:true});process.env.PIST_DATA_DIR=dir;t.after(()=>{if(previous===undefined)delete process.env.PIST_DATA_DIR;else process.env.PIST_DATA_DIR=previous;});return dir;}
function put(file:string,data:any){fs.writeFileSync(file,JSON.stringify(data));}
test('corrupt canonical uses validated backup ahead of legacy; read is byte-preserving and recovery keeps backup',t=>{
 const dir=setup(t);fs.writeFileSync(getCanonicalStoragePath(),'{broken');put(getBackupStoragePath(),{...empty(),journeys:[thing('backup')]});put(path.join(dir,'human_drift.json'),{...empty(),journeys:[thing('legacy')]});
 const backup=fileHash(getBackupStoragePath());const data=readAppData();assert.equal(data.journeys[0].id,'backup');assert.equal(fs.readFileSync(getCanonicalStoragePath(),'utf8'),'{broken');
 data.journeys.push(thing('new') as any);writeAppData(data);assert.equal(fileHash(getBackupStoragePath()),backup);assert.equal(fs.readdirSync(dir).filter(f=>f.includes('.damaged-')).length,1);assert.equal(readAppData().journeys.length,2);
});
test('valid empty and audit-only canonical win over populated legacy; old actors remain untouched',t=>{
 const dir=setup(t);put(path.join(dir,'human_drift.json'),{...empty(),journeys:[thing('legacy')]});put(getCanonicalStoragePath(),empty());assert.equal(readAppData().journeys.length,0);
 const event={id:'historic',actor_id:'original-actor',event_type:'UNKNOWN_HISTORICAL_EVENT',payload:{keep:true}};put(getCanonicalStoragePath(),{...empty(),event_log:[event]});assert.deepEqual(readAppData().event_log,[event]);
});
test('corrupt candidates and legacy-only state fail closed; brand-new read does not write',t=>{
 const dir=setup(t);assert.equal(readAppData().schema_version,2);assert.equal(fs.existsSync(getCanonicalStoragePath()),false);
 put(path.join(dir,'human_drift.json'),{...empty(),journeys:[thing()]});assert.throws(()=>readAppData(),/Explicit storage migration/);
 fs.writeFileSync(getCanonicalStoragePath(),'bad');fs.writeFileSync(getBackupStoragePath(),'bad backup');assert.throws(()=>readAppData(),/unusable/);assert.equal(fs.readFileSync(getBackupStoragePath(),'utf8'),'bad backup');
});
test('conflicting duplicate IDs/aliases are rejected and unknown top-level/record fields survive',t=>{
 setup(t);put(getCanonicalStoragePath(),{...empty(),journeys:[thing(),thing()]});assert.throws(()=>inspectStorageFile(getCanonicalStoragePath()),/duplicate/);
 const e={id:'entry',note:'one'};put(getCanonicalStoragePath(),{...empty(),session_entries:[e],entries:[{...e,note:'two'}]});assert.throws(()=>inspectStorageFile(getCanonicalStoragePath()),/Conflicting/);
 put(getCanonicalStoragePath(),{...empty(),journeys:[{...thing(),custom:{evidence:'kept'}}],unknown_history:{source:'preserve'}});const data=readAppData();data.journeys[0].name='renamed';writeAppData(data);const loaded:any=readAppData();assert.deepEqual(loaded.unknown_history,{source:'preserve'});assert.deepEqual(loaded.journeys[0].custom,{evidence:'kept'});
});
test('failed final/backup rename preserves the last good state, reports failure, and releases lock',t=>{
 const dir=setup(t);let data=readAppData();data.journeys.push(thing() as any);writeAppData(data);
 for(const failure of ['canonical','backup']) {
   data=readAppData();const before=fileHash(getCanonicalStoragePath());data.journeys[0].name=failure;
   const rename=fs.renameSync;const mocked=t.mock.method(fs,'renameSync',(source:any,target:any)=>{if(target===(failure==='canonical'?getCanonicalStoragePath():getBackupStoragePath()))throw new Error('simulated interrupted write');return rename(source,target);});
   assert.throws(()=>writeAppData(data),/interrupted/);mocked.mock.restore();assert.equal(fileHash(getCanonicalStoragePath()),before);assert.equal(fs.existsSync(path.join(dir,'.write.lock')),false);assert.equal(readAppData().journeys[0].name,'thing');
 }
});
test('stale snapshots and overlapping writer locks cannot overwrite newer state',t=>{
 const dir=setup(t);const first=readAppData();first.journeys.push(thing() as any);writeAppData(first);const stale=readAppData();const fresh=readAppData();fresh.journeys[0].name='fresh';writeAppData(fresh);stale.journeys[0].name='stale';assert.throws(()=>writeAppData(stale),/changed since read/);
 const data=readAppData();fs.writeFileSync(path.join(dir,'.write.lock'),'other writer');assert.throws(()=>writeAppData(data),/locked/);assert.equal(readAppData().journeys[0].name,'fresh');
});
test('explicit migration previews defaults, preserves source/unknowns/actors and is idempotent',t=>{
 const dir=setup(t);const source=path.join(dir,'human_drift.json');const legacy:any={...empty(),schema_version:1,journeys:[thing()],event_log:[{id:'old',actor_id:'historic-user',payload:{original:true}}],extra:{preserved:true}};put(source,legacy);const hash=fileHash(source)!;
 const preview=migrateStorageFile(source,hash);assert.equal(preview.applied,false);assert.ok(preview.defaults.length);assert.equal(fs.existsSync(getCanonicalStoragePath()),false);
 assert.equal(migrateStorageFile(source,hash,true).applied,true);const data:any=readAppData();assert.deepEqual(data.extra,legacy.extra);assert.equal(data.event_log[0].actor_id,'historic-user');assert.equal(data.journeys[0].visibility,'PRIVATE');assert.equal(data.journeys[0].creation_snapshot.provenance,'legacy_unknown');assert.equal(fileHash(source),hash);
 const canonical=fileHash(getCanonicalStoragePath());assert.equal(migrateStorageFile(source,hash,true).already_applied,true);assert.equal(fileHash(getCanonicalStoragePath()),canonical);
});
test('audit payload snapshots and supplied actors are preserved across later in-memory edits',t=>{
 setup(t);const data=readAppData();const record=thing() as any;data.journeys.push(record);appendEvent(data,{entity_type:'Journey',entity_id:record.id,event_type:'CREATED',actor_id:'actual-actor',payload:record});record.name='edited after event';writeAppData(data);const saved=readAppData();assert.equal(saved.event_log[0].actor_id,'actual-actor');assert.equal(saved.event_log[0].payload.name,'thing');assert.equal(saved.event_log[0].payload.owner_id,saved.journeys[0].owner_id);
});
