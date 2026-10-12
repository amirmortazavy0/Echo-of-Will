import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand, selectCondition, effectiveEntry } from '../server/commands';
import { parseNaturalLanguageLog, answerQueryChat, setOllamaConfig } from '../server/aiLogger';

const time=(minutes:number)=>new Date(Date.now()+minutes*60000).toISOString();
function fixture():any {return {journeys:[{id:'a'},{id:'b'}],nodes:[{id:'a1',journey_id:'a'},{id:'b1',journey_id:'b'}],sessions:[{id:'s',journey_id:'a',started_at:time(-60),status:'ACTIVE',intention:'original'}],entries:[],corrections:[]};}
const run=(data:any,path:string,body:any,method='POST')=>validateCommand({path,body,method},data);
test('full invalid commands reject context, enums, numbers and times across mutation families',()=>{
 const data=fixture();
 const invalid:[string,any,string?][]=[
 ['/api/nodes',{journey_id:'missing',name:'node'}],
 ['/api/nodes',{journey_id:'a',name:'node',parent_id:'b1'}],
 ['/api/nodes',{journey_id:'a',name:'node',node_type:'BOGUS'}],
 ['/api/nodes',{journey_id:'a',name:'node',estimated_minutes:Infinity}],
 ['/api/nodes',{journey_id:'a',name:'node',sequence:1.5}],
 ['/api/nodes',{journey_id:'a',name:'node',due_date:'2026-02-30'}],
 ['/api/sessions',{journey_id:'a',node_id:'b1',intention:'x'}],
 ['/api/sessions',{journey_id:'a',intention:'x',started_at:'2026-02-30T00:00:00Z'}],
 ['/api/sessions/quick-log',{duration_minutes:10,intention:'x'}],
 ['/api/sessions/quick-log',{journey_id:'a',duration_minutes:-1,intention:'x'}],
 ['/api/sessions/quick-log',{journey_id:'a',duration_minutes:10,intention:'x',ended_at:time(-50),started_at:time(-10)}],
 ['/api/sessions/s/entries',{entry_type:'NOT_A_TYPE'}],
 ['/api/sessions/s/entries',{entry_type:'NOTE',node_id:'b1'}],
 ['/api/sessions/s/entries',{entry_type:'DISCOVERY',discovery_node:{name:'x',parent_id:'b1'}}],
 ['/api/sessions/s/entries',{entry_type:'NOTE',condition:{energy:'INVALID'}}],
 ['/api/sessions/s/entries',{entry_type:'NOTE',logged_at:time(-90)}],
 ['/api/sessions/s/revise-intention',{new_intention:'x',condition:{focus:'INVALID'}}],
 ['/api/sessions/s/switch-journey',{target_journey_id:'b',target_node_id:'a1',new_intention:'x'}],
 ['/api/sessions/s/end',{status:'ABANDONED'}],
 ['/api/journeys',{name:'x',visibility:'PUBLIC'}],
 ['/api/journeys/a',{creation_snapshot:{name:'rewrite'}},'PUT'],
 ];
 for(const [path,body,method] of invalid){const before=structuredClone(data);assert.throws(()=>run(data,path,body,method),undefined,path);assert.deepEqual(data,before);}
});
test('deep same-Thing trees work without depth cap; self/deep cycles reject',()=>{
 const data=fixture();for(let i=0;i<300;i++)data.nodes.push({id:`n${i}`,journey_id:'a',parent_id:i?`n${i-1}`:null});
 assert.doesNotThrow(()=>run(data,'/api/nodes',{journey_id:'a',name:'deep',parent_id:'n299'}));
 assert.throws(()=>run(data,'/api/nodes/n0',{parent_id:'n299'},'PUT'),/cycle/);
 assert.throws(()=>run(data,'/api/nodes/n1',{parent_id:'n1'},'PUT'),/cycle/);
});
test('sticky Conditions use effective timestamp then persistent append order; missing fields remain unknown',()=>{
 const data=fixture(); const early=time(-40), late=time(-20);
 const condition=(energy:string)=>({energy,focus:'DEEP',location:'OFFICE',environment:'QUIET'});
 data.entries=[{id:'late',session_id:'s',logged_at:late,condition:condition('HIGH')},{id:'early',session_id:'s',logged_at:early,condition:condition('LOW')}];
 assert.equal(selectCondition(data,'s',time(-10)).energy,'HIGH');
 assert.equal(selectCondition(data,'s',time(-30)).energy,'LOW');
 data.entries.push({id:'tie',session_id:'s',logged_at:late,condition:condition('MEDIUM')});
 assert.equal(selectCondition(data,'s',time(-10)).energy,'MEDIUM');
 data.corrections.push({id:'c',entry_id:'early',field:'logged_at',corrected_value:time(-15),created_at:time(-1),sequence:1});
 assert.equal(selectCondition(data,'s',time(-10)).energy,'LOW');
 const unknown=selectCondition(data,undefined,time(0));assert.equal(unknown.location,'UNKNOWN');assert.equal(unknown.provenance,'unknown');
 const partial=selectCondition(data,'s',time(-10),{focus:'SCATTERED'});assert.equal(partial.energy,'LOW');assert.equal(partial.focus,'SCATTERED');
});
test('closed Session ending is idempotent; conflicting closure and ordinary late writes reject',()=>{
 const data=fixture();Object.assign(data.sessions[0],{ended_at:time(-10),status:'COMPLETE',end_reason:'NATURAL_COMPLETION',quality:'GOOD'});
 assert.equal(run(data,'/api/sessions/s/end',{end_reason:'NATURAL_COMPLETION',quality:'GOOD'}).response.id,'s');
 assert.throws(()=>run(data,'/api/sessions/s/end',{quality:'POOR'}),/already ended/);
 assert.throws(()=>run(data,'/api/sessions/s/entries',{entry_type:'NOTE'}),/closed/);
 assert.doesNotThrow(()=>run(data,'/api/sessions/s/entries',{entry_type:'NOTE',logged_at:time(-20),amendment_reason:'Forgot to record'}));
 assert.doesNotThrow(()=>run(data,'/api/sessions/s/amend',{field:'quality',value:'FAIR',reason:'Correct my rating'}));
});
test('corrections are typed, same-Thing, ordered and leave raw entries unchanged',()=>{
 const data=fixture();const raw={id:'entry',session_id:'s',node_id:'a1',entry_type:'NOTE',note:'original',logged_at:time(-30)};data.entries=[raw];
 for(const body of [{field:'owner_id',corrected_value:'someone'},{field:'node_id',corrected_value:'b1'},{field:'logged_at',corrected_value:time(-120)},{field:'entry_type',corrected_value:'DISCOVERY'}]) assert.throws(()=>run(data,'/api/entries/entry/corrections',body));
 data.corrections=[{id:'second',entry_id:'entry',field:'note',corrected_value:'second',sequence:2,created_at:time(-2)},{id:'first',entry_id:'entry',field:'note',corrected_value:'first',sequence:1,created_at:time(-1)}];
 assert.equal(effectiveEntry(data,raw as any).note,'second');assert.equal(raw.note,'original');
});
test('removed cloud configuration cannot disclose reports; local endpoints reject remote addresses and redirects',async t=>{
 const calls:string[]=[];t.mock.method(globalThis,'fetch',async (url:any,options:any)=>{calls.push(String(url));assert.equal(options.redirect,'error');throw new Error('local model unavailable');});
 process.env['GEMINI_API_KEY']='synthetic-unused';process.env['SUPABASE_URL']='https://must-not-contact.invalid';process.env['SUPABASE_KEY']='synthetic-unused';
 t.after(()=>{delete process.env['GEMINI_API_KEY'];delete process.env['SUPABASE_URL'];delete process.env['SUPABASE_KEY'];});
 assert.throws(()=>setOllamaConfig('https://remote.invalid','model'),/loopback/);
 setOllamaConfig('http://127.0.0.1:1','synthetic-model');
 const proposal=await parseNaturalLanguageLog('Worked 10 minutes on a test',[{id:'a',name:'Thing',status:'ACTIVE'} as any],[],'a');
 assert.equal(proposal.provider,'local_heuristic');
 await answerQueryChat('Am I drifting?',[],[],[],[]);
 assert.equal(calls.length,1);assert.ok(calls.every(url=>url.startsWith('http://127.0.0.1:1/')));
 setOllamaConfig(undefined,'');
});
