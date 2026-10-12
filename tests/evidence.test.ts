import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {effectiveData,interpretSession} from '../src/domain/evidence';
import {calculateDurationVsEstimate,calculateSessionSummary} from '../server/queries';
import {computeBoardData} from '../server/boardService';
import {runMarkdownExport} from '../server/exportService';
import {validateCommand} from '../server/commands';
import type {AppData,Session,SessionEntry} from '../src/types';
const time=(minute:number)=>new Date(Date.UTC(2026,9,11,10,minute)).toISOString();
const session:Session={id:'s',journey_id:'j',intention:'original',started_at:time(0),ended_at:time(60),status:'COMPLETE',created_at:time(0),updated_at:time(60)};
const entry=(id:string,type:any,minute:number,node:string|null='n'):SessionEntry=>({id,session_id:'s',entry_type:type,logged_at:time(minute),node_id:node,condition:{energy:'UNKNOWN',focus:'UNKNOWN',location:'UNKNOWN',environment:'UNKNOWN'}});
function fixture(entries:SessionEntry[]):AppData{return {schema_version:2,journeys:[{id:'j',name:'Thing',status:'ACTIVE',created_at:time(0)}],nodes:[{id:'n',journey_id:'j',name:'Node',node_type:'TASK',status:'ACTIVE',created_at:time(0)}],sessions:[structuredClone(session)],entries,session_entries:entries,corrections:[],conflicts:[],event_log:[],audit_log:[],capture_reports:[]};}
test('note-only, empty and discovery reports leave the bounded interval unclassified',()=>{
 for(const entries of [[],[entry('a','NOTE',10)],[entry('b','DISCOVERY',15)]]){
  const result=interpretSession(session,entries);assert.equal(result.activeMinutes,0);assert.equal(result.unclassifiedPauseMinutes,60);assert.equal(result.nodeMinutes.size,0);
 }
});
test('repeated pauses preserve gaps, notes never switch Nodes, and explicit Node-null activity stays unattributed',()=>{
 const entries=[entry('a','TASK_STARTED',10),entry('b','NOTE',20,'other'),entry('c','TASK_PAUSED',30),entry('d','TASK_PAUSED',40),entry('e','TASK_STARTED',50,null)];
 const result=interpretSession(session,entries);assert.equal(result.activeMinutes,30);assert.equal(result.unclassifiedPauseMinutes,30);assert.equal(result.nodeMinutes.get('n'),20);assert.equal(result.nodeMinutes.has('other'),false);assert.equal(result.intervals.reduce((a,i)=>a+i.minutes,0),60);assert.ok(result.issues.length);
});
test('out-of-order and tied entries have stable append order; train/switch/request boundaries share the interpreter',()=>{
 const entries=[entry('later','STOP_DEPARTED',40),entry('start','STOP_ARRIVED',10),entry('note','NOTE',15,'other'),entry('switch','CONTEXT_SWITCH',20,'other'),entry('request','CONTEXT_SWITCH_REQUEST',30)];
 const result=interpretSession(session,entries);assert.equal(result.activeMinutes,20);assert.equal(result.nodeMinutes.get('n'),10);assert.equal(result.nodeMinutes.get('other'),10);
 const tied=interpretSession(session,[entry('z','TASK_STARTED',10),entry('a','TASK_PAUSED',10)]);assert.equal(tied.activeMinutes,0);
});
test('open bounds are explicit, invalid times retained as issues, and no duration is invented for unknown bounds',()=>{
 const open=interpretSession({...session,status:'ACTIVE',ended_at:null},[entry('a','TASK_STARTED',10)],new Date(time(20)));assert.equal(open.activeMinutes,10);assert.equal(open.open,true);
 const bad=interpretSession({...session,started_at:'invalid'},[entry('a','TASK_STARTED',10)]);assert.equal(bad.validBounds,false);assert.equal(bad.activeMinutes,0);
 const outside=interpretSession(session,[entry('a','TASK_STARTED',-5)]);assert.equal(outside.activeMinutes,0);assert.equal(outside.issues.length,1);
});
test('ordered corrections and amendments reconcile Board, summary and estimates without modifying originals',()=>{
 const data=fixture([entry('a','TASK_STARTED',10),entry('b','TASK_PAUSED',30)]);
 data.corrections=[{id:'c2',entry_id:'b',field:'logged_at',corrected_value:time(40),original_value:time(30),created_at:time(60),sequence:2},{id:'c1',entry_id:'b',field:'logged_at',corrected_value:time(35),original_value:time(30),created_at:time(60),sequence:1}];
 data.session_amendments=[{id:'amend',session_id:'s',field:'ended_at',value:time(70),created_at:time(60)}];
 const before=JSON.stringify(data),effective=effectiveData(data),summary=calculateSessionSummary(effective.sessions[0],effective.entries);
 assert.equal(summary.activeMinutes,30);assert.equal(summary.unclassifiedPauseMinutes,40);assert.equal(computeBoardData(data).total_active_minutes,30);assert.equal(calculateDurationVsEstimate(data)[0].actual_minutes,30);assert.equal(JSON.stringify(data),before);
});
export function unzip(buffer:Buffer){const files=new Map<string,Buffer>();let offset=0;while(buffer.readUInt32LE(offset)===0x04034b50){const size=buffer.readUInt32LE(offset+18),nameSize=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28),name=buffer.subarray(offset+30,offset+30+nameSize).toString(),start=offset+30+nameSize+extra;files.set(name,zlib.inflateRawSync(buffer.subarray(start,start+size)));offset=start+size;}return files;}
test('fresh export contains full canonical evidence, one document per Session, no-node records and no stale files',()=>{
 const root=path.resolve('.private/test-runs',randomUUID());fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'stale.md'),'must not leak');
 const data=fixture([entry('note','NOTE',10,null),entry('revision','INTENTION_REVISED',20,null)]);(data as any).unknown_history={retain:true};data.sessions.push({...session,id:'no-entries',node_id:null});
 const first=runMarkdownExport(root,data),files=unzip(fs.readFileSync(first.zipPath));assert.equal([...files.keys()].filter(k=>k.includes('/Sessions/')).length,2);assert.ok(!files.has('stale.md'));assert.deepEqual(JSON.parse(files.get('canonical.json')!.toString()),data);assert.equal(JSON.parse(files.get('summaries.json')!.toString()).s.activeMinutes,0);
 const empty=fixture([]);empty.sessions=[];empty.nodes=[];empty.journeys=[];const second=runMarkdownExport(root,empty),emptyFiles=unzip(fs.readFileSync(second.zipPath));assert.notEqual(first.exportDir,second.exportDir);assert.equal([...emptyFiles.keys()].filter(k=>k.endsWith('.md')).length,1);assert.equal(JSON.parse(emptyFiles.get('canonical.json')!.toString()).sessions.length,0);
});
test('reviewed capture validates all semantics before mutation',()=>{
 const data=fixture([]),body={journey_id:'j',intention:'reported',duration_minutes:60,started_at:time(0),ended_at:time(60),original_report:'source',reviewed_entries:[{entry_type:'DISCOVERY',discovery_node:{name:'found',parent_id:'missing'}}]};
 const before=JSON.stringify(data);assert.throws(()=>validateCommand({path:'/api/sessions/quick-log',method:'POST',body},data),/Node/);assert.equal(JSON.stringify(data),before);
});

