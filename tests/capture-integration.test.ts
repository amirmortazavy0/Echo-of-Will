import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {isolatedServer} from './helpers/server.mjs';
test('P4–P5 API preserves report/review semantics, shares corrected intervals, and exports authenticated complete snapshots',{timeout:60000},async()=>{
 const server=await isolatedServer();let token='';
 const request=async(method:string,route:string,body?:any,status=200)=>{
  const res=await fetch(server.url+route,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;
 };
 try{
 token=(await request('POST','/api/auth/signup',{username:'capture-owner',password:'synthetic-password'},201)).token;
 const j=await request('POST','/api/journeys',{name:'Evidence'},201);
 const n=await request('POST','/api/nodes',{journey_id:j.id,name:'Task'},201);
 const end=new Date(Date.now()-60000).toISOString(),start=new Date(Date.parse(end)-3600000).toISOString();
 const report='I investigated an issue, found a dependency, and revised the plan. Times are approximate.';
 const captured=await request('POST','/api/sessions/quick-log',{journey_id:j.id,node_id:n.id,intention:'Investigate',original_report:report,duration_minutes:60,started_at:start,ended_at:end,provider:'local_heuristic',proposal:{intention:'Suggested intention'},uncertainty:'approximately an hour',quality:'EXCELLENT',reviewed_entries:[
 {entry_type:'NOTE',note:'reported detail'},
 {entry_type:'DISCOVERY',discovery_node:{name:'Dependency',parent_id:n.id}},
 {entry_type:'INTENTION_REVISED',new_intention:'Resolve dependency',reason:'New evidence'}
 ]},201);
 assert.deepEqual(captured.entries.map((e:any)=>e.entry_type),['NOTE','DISCOVERY','INTENTION_REVISED']);
 assert.ok(captured.entries.every((e:any)=>e.source_report_id===captured.report.id&&e.captured_at));
 assert.equal(captured.report.original_text,report);assert.equal(captured.session.intention,'Investigate');
 const summary=await request('GET','/api/sessions/'+captured.session.id+'/summary');assert.equal(summary.activeMinutes,0);assert.equal(summary.unclassifiedPauseMinutes,60);
 const evidence=await request('GET','/api/sessions/'+captured.session.id+'/evidence');assert.equal(evidence.revisions[0].new_intention,'Resolve dependency');assert.equal(evidence.reports[0].proposal.intention,'Suggested intention');
 const file=path.join(server.dataDir,'pist_data.json'),before=fs.readFileSync(file);
 await request('POST','/api/sessions/quick-log',{journey_id:j.id,intention:'Invalid reviewed report',duration_minutes:10,reviewed_entries:[{entry_type:'DISCOVERY',discovery_node:{name:'Bad',parent_id:'missing'}}]},400);
 assert.deepEqual(fs.readFileSync(file),before);
 const bounded=await request('POST','/api/sessions/quick-log',{journey_id:j.id,node_id:n.id,intention:'Reported activity',original_report:'I estimate one continuous hour',duration_minutes:60,started_at:start,ended_at:end,boundaries_confirmed:true,reviewed_entries:[{entry_type:'NOTE',note:'Only explicit boundaries count'}]},201);
 const last=bounded.entries.at(-1);
 await request('POST','/api/entries/'+last.id+'/corrections',{field:'logged_at',corrected_value:new Date(Date.parse(start)+1800000).toISOString(),reason:'Stop was earlier'},201);
 const effectiveSummary=await request('GET','/api/sessions/'+bounded.session.id+'/summary');assert.equal(effectiveSummary.activeMinutes,30);assert.equal(effectiveSummary.unclassifiedPauseMinutes,30);
 const board=await request('GET','/api/board');assert.equal(board.total_active_minutes,30);
 const originalEntries=await request('GET','/api/sessions/'+bounded.session.id+'/entries');assert.equal(originalEntries.at(-1).logged_at,end);
 const effectiveEntries=await request('GET','/api/sessions/'+bounded.session.id+'/entries?view=effective');assert.ok(effectiveEntries.some((e:any)=>e.id===last.id&&e.logged_at!==end));
 const noNode=await request('POST','/api/sessions/quick-log',{journey_id:j.id,intention:'No Node report',duration_minutes:5,original_report:'A standalone report'},201);
 const response=await request('POST','/api/export/markdown',{});
 assert.equal((await fetch(server.url+response.zip_url)).status,401);
 const zip=await fetch(server.url+response.zip_url,{headers:{Authorization:'Bearer '+token}});assert.equal(zip.status,200);const bytes=Buffer.from(await zip.arrayBuffer()),files=new Map<string,Buffer>();
 let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),nameSize=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+nameSize).toString(),at=offset+30+nameSize+extra;files.set(name,zlib.inflateRawSync(bytes.subarray(at,at+size)));offset=at+size;}
 const raw=JSON.parse(files.get('canonical.json')!.toString());assert.equal(raw.capture_reports.length,3);assert.equal(raw.capture_reports[0].original_text,report);assert.equal([...files.keys()].filter(n=>n.includes('/Sessions/')).length,3);
 assert.ok([...files.keys()].some(p=>p.endsWith(Buffer.from(noNode.session.id).toString('hex')+'.md')));
 const exported=JSON.parse(files.get('summaries.json')!.toString());assert.equal(exported[bounded.session.id].activeMinutes,effectiveSummary.activeMinutes);
 const beforeRestart=fs.readFileSync(file);await server.stop();await server.start();assert.equal((await request('GET','/api/sessions/'+bounded.session.id+'/summary')).activeMinutes,30);assert.deepEqual(fs.readFileSync(file),beforeRestart);
 }finally{await server.stop();}
});

