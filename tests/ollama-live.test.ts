import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedServer } from './helpers/server.mjs';
const model=process.env.OLLAMA_MODEL || 'llama3.2:3b';
const endpoint=process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const reports=['I spent 20 minutes studying storage. My energy was low.','۲۰ دقیقه درباره ذخیره‌سازی مطالعه کردم. انرژی من کم بود.'];
test('actual local model: English/Persian inference, API proposal review and historical preservation', {timeout:360000}, async()=>{
 const server=await isolatedServer();
 try {
  let token='';
  const request=async(route:string,body?:any,status=200)=>{
   const r=await fetch(server.url+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;
  };
  token=(await request('/api/auth/signup',{username:'ollama-test',password:'synthetic-password'},201)).token;
  const journey=await request('/api/journeys',{name:'Local inference test'},201);
  await request('/api/ai/settings',{url:endpoint,model});
  assert.equal((await request('/api/ai/status')).status,'online');
  const file=path.join(server.dataDir,'pist_data.json');
  for(const report of reports){
   const before=fs.readFileSync(file),started=Date.now();
   const p=await request('/api/ai/parse-log',{journey_id:journey.id,message:report});
   console.log(JSON.stringify({language:/[\u0600-\u06ff]/.test(report)?'Persian':'English',elapsed_ms:Date.now()-started,provider:p.provider,model:p.model,duration:p.duration_minutes}));
   assert.equal(p.provider,'ollama');assert.equal(p.model,model);assert.equal(p.duration_minutes,20);
   assert.equal(p.condition.energy,'LOW');assert.equal(p.condition.location,'UNKNOWN');
   if(/[\u0600-\u06ff]/.test(report))assert.match(p.intention,/[\u0600-\u06ff]/);else assert.doesNotMatch(p.intention,/[\u0600-\u06ff]/);
   assert.deepEqual(fs.readFileSync(file),before,'suggestion must not write any evidence');
   const saved=await request('/api/sessions/quick-log',{journey_id:journey.id,intention:'Human reviewed: '+report,original_report:report,duration_minutes:20,provider:p.provider,proposal:p,condition:p.condition,boundaries_confirmed:false,reviewed_entries:[{entry_type:'NOTE',note:report}]},201);
   assert.equal(saved.report.original_text,report);assert.deepEqual(saved.report.proposal,p);assert.equal(saved.session.intention,'Human reviewed: '+report);assert.ok(saved.entries.every((e:any)=>e.entry_type==='NOTE'));
   assert.equal((await request('/api/sessions/'+saved.session.id+'/summary')).activeMinutes,0);
  }
  const before=fs.readFileSync(file);
  await request('/api/ai/parse-log',{message:'Invalid context',journey_id:'missing'},400);
  await request('/api/ai/parse-log',{message:{bad:true}},400);
  await request('/api/ai/settings',{url:endpoint,model:'not-installed'});
  assert.equal((await request('/api/ai/status')).status,'offline');
  assert.equal((await request('/api/ai/parse-log',{message:reports[1],journey_id:journey.id})).provider,'local_heuristic');
  await request('/api/ai/settings',{url:'http://127.0.0.1:1',model});
  assert.equal((await request('/api/ai/parse-log',{message:reports[0],journey_id:journey.id})).provider,'local_heuristic');
  assert.deepEqual(fs.readFileSync(file),before);
  await server.stop();await server.start();assert.deepEqual(fs.readFileSync(file),before);
 } finally {await server.stop();}
});
