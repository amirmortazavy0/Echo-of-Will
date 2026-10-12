import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { isolatedServer,root } from './helpers/server.mjs';

test('P1–P3 API: rejected commands, atomic history, ownership, corrections, closure, switching and restart', {timeout:90000}, async()=>{
 const server=await isolatedServer();
 try {
  let token;
  const request=async(method,route,body,status=200,headers={})=>{
   const response=await fetch(server.url+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const result=await response.json();assert.equal(response.status,status,`${method} ${route}: ${JSON.stringify(result)}`);return result;
  };
  token=(await request('POST','/api/auth/signup',{username:'owner',password:'synthetic-password'},201)).token;
  await request('POST','/api/auth/signup',{username:'second',password:'synthetic-password'},409);
  await request('GET','/api/journeys',undefined,403,{Origin:'https://untrusted.invalid'});
  const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(server.url+'/api/journeys',{headers:{Host:'untrusted.invalid',Authorization:`Bearer ${token}`}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(hostStatus,403);
  await request('POST','/api/ai/settings',{url:'https://external.invalid',model:'anything'},400);
  const a=await request('POST','/api/journeys',{name:'A',description:'original description'},201);
  const b=await request('POST','/api/journeys',{name:'B'},201);
  const n=await request('POST','/api/nodes',{journey_id:a.id,name:'Root',estimated_minutes:30},201);
  const other=await request('POST','/api/nodes',{journey_id:b.id,name:'Other'},201);
  const canonical=path.join(server.dataDir,'pist_data.json');
  const rejected=async(method,route,body,status=400)=>{const before=fs.readFileSync(canonical);await request(method,route,body,status);assert.deepEqual(fs.readFileSync(canonical),before,`${route} changed state on rejection`);};
  await rejected('POST','/api/nodes',{journey_id:a.id,name:'wrong parent',parent_id:other.id});
  await rejected('PUT',`/api/nodes/${n.id}`,{parent_id:n.id});
  await rejected('POST','/api/sessions/quick-log',{journey_id:'missing',duration_minutes:10,intention:'invalid'});
  await rejected('POST','/api/sessions/quick-log',{journey_id:a.id,node_id:other.id,duration_minutes:10,intention:'invalid'});
  await rejected('POST','/api/sessions/quick-log',{journey_id:a.id,node_name:'must not be created',duration_minutes:10,intention:'invalid',quality:'NORMAL'});
  await rejected('POST',`/api/nodes/${n.id}/estimate`,{estimated_minutes:-1});
  await request('PUT',`/api/journeys/${a.id}`,{name:'Renamed',description:'later wording'});
  assert.equal((await request('GET',`/api/journeys/${a.id}`)).creation_snapshot.description,'original description');
  const minutesAgo=minutes=>new Date(Date.now()-minutes*60000).toISOString();
  const s=(await request('POST','/api/sessions',{journey_id:a.id,intention:'Original intention',started_at:minutesAgo(10)},201)).session;
  assert.equal((await request('GET',`/api/sessions/${s.id}/entries`))[0].condition.provenance,'unknown');
  const high={energy:'HIGH',focus:'DEEP',location:'OFFICE',environment:'QUIET'};
  const late=(await request('POST',`/api/sessions/${s.id}/entries`,{entry_type:'NOTE',node_id:n.id,note:'later',logged_at:minutesAgo(8),condition:high},201)).entry;
  await request('POST',`/api/sessions/${s.id}/entries`,{entry_type:'NOTE',note:'backfilled',logged_at:minutesAgo(9),condition:{...high,energy:'LOW'}},201);
  const revision=await request('POST',`/api/sessions/${s.id}/revise-intention`,{new_intention:'Revised intention',reason:'new evidence',logged_at:minutesAgo(7)});
  assert.equal(revision.entry.condition.energy,'HIGH');assert.equal(revision.session.intention,'Original intention');
  await rejected('POST',`/api/sessions/${s.id}/entries`,{entry_type:'DISCOVERY',discovery_node:{name:'must not exist',parent_id:other.id}});
  const discovery=await request('POST',`/api/sessions/${s.id}/entries`,{entry_type:'DISCOVERY',node_id:n.id,discovery_node:{name:'Discovered',parent_id:n.id,estimated_minutes:5}},201);
  assert.equal(discovery.entry.discovery_ref,discovery.discovery_node.id);
  const corrected=await request('POST',`/api/entries/${late.id}/corrections`,{field:'note',corrected_value:'first correction',reason:'typo'},201);
  const correctedAgain=await request('POST',`/api/entries/${late.id}/corrections`,{field:'note',corrected_value:'second correction',reason:'clarify'},201);
  assert.equal(corrected.original_value,'later');assert.equal(correctedAgain.original_value,'later');assert.equal(correctedAgain.previous_value,'first correction');assert.ok(correctedAgain.sequence>corrected.sequence);
  await rejected('POST',`/api/entries/${late.id}/corrections`,{field:'node_id',corrected_value:other.id});
  await rejected('POST',`/api/sessions/${s.id}/switch-journey`,{target_journey_id:b.id,target_node_id:n.id,new_intention:'bad destination'});
  const switched=await request('POST',`/api/sessions/${s.id}/switch-journey`,{target_journey_id:b.id,new_intention:'Continue in B',switch_reason:'explicit move'},201);
  assert.equal(switched.previous_session.successor_session_id,switched.new_session.id);assert.equal(switched.new_session.predecessor_session_id,s.id);
  const carried=await request('GET',`/api/sessions/${switched.new_session.id}/entries`);assert.equal(carried[0].condition.energy,'HIGH');
  const ended=await request('POST',`/api/sessions/${switched.new_session.id}/end`,{end_reason:'NATURAL_COMPLETION',quality:'GOOD'});
  const beforeRetry=fs.readFileSync(canonical);const retry=await request('POST',`/api/sessions/${ended.id}/end`,{end_reason:'NATURAL_COMPLETION',quality:'GOOD'});assert.deepEqual(retry,ended);assert.deepEqual(fs.readFileSync(canonical),beforeRetry);
  await rejected('POST',`/api/sessions/${ended.id}/end`,{quality:'POOR'},409);
  await request('POST',`/api/sessions/${ended.id}/amend`,{field:'quality',value:'FAIR',reason:'Correct rating'},201);
  assert.equal((await request('GET',`/api/sessions/${ended.id}`)).quality,'GOOD');
  const saved=JSON.parse(fs.readFileSync(canonical,'utf8'));
  assert.ok(saved.conflicts.some(c=>c.conflict_type==='ENTRY_OUT_OF_ORDER'));
  assert.equal(saved.session_entries.find(e=>e.id===late.id).note,'later');assert.equal(saved.intention_revisions[0].new_intention,'Revised intention');
  for(const key of ['journeys','nodes','sessions','session_entries','audit_log','event_log','corrections','conflicts','intention_revisions','session_amendments']) for(const record of saved[key]) {assert.equal(record.owner_id,a.owner_id,key);assert.equal(record.visibility,'PRIVATE',key);if(record.condition){assert.equal(record.condition.owner_id,a.owner_id);assert.equal(record.condition.visibility,'PRIVATE');}}
  assert.ok(saved.event_log.every(e=>e.actor_id===a.owner_id));
  const beforeRestart=fs.readFileSync(canonical);await server.stop();await server.start();assert.equal((await request('GET','/api/sessions')).length,2);assert.deepEqual(fs.readFileSync(canonical),beforeRestart);
  const rejectedListener=spawnSync(process.execPath,[path.join(root,'scripts/start-production.mjs')],{cwd:root,env:{...process.env,HOST:'0.0.0.0',PIST_DATA_DIR:path.join(server.directory,'forbidden-listener')},windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(rejectedListener.status,1);assert.match(rejectedListener.stderr,/Only loopback/);
 } finally {await server.stop();}
});
