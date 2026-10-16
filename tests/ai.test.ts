import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProposal } from '../server/aiProposal';
import { parseNaturalLanguageLog, checkOllamaHealth, setOllamaConfig, fallbackLocalParse } from '../server/aiLogger';
const journeys:any=[{id:'a',name:'A',status:'ACTIVE'}];
const valid=()=>({journey_id:'a',node_id:null,node_name:'',node_status:'ACTIVE',work_type:'UNKNOWN',duration_minutes:null,intention:'Investigated storage',summary:'A note',reasoning:'Reported',condition:{energy:'UNKNOWN',focus:'UNKNOWN',location:'UNKNOWN',environment:'UNKNOWN'},entry_types:['NOTE']});
test('model proposals reject malformed values, foreign references, commands and invented enum values',()=>{
 for(const patch of [{journey_id:'other'},{node_id:'foreign'},{duration_minutes:-1},{duration_minutes:'20'},{duration_minutes:Infinity},{node_status:'ABANDONED'},{condition:{energy:'HIGH'}},{entry_types:['DELETE']},{intention:''},{execute:'delete all'}]) assert.throws(()=>validateProposal({...valid(),...patch},'a',[]));
 assert.deepEqual(validateProposal(valid(),'a',[]),valid());
 assert.throws(()=>validateProposal({...valid(),node_id:'n',node_name:'wrong'},'a',[{id:'n',name:'Correct'}]));
});
test('fallback preserves English/Persian report and unknown conditions without inventing duration or boundaries',()=>{
 for(const report of ['Investigated storage','درباره ذخیره‌سازی مطالعه کردم']){
  const p=fallbackLocalParse(report,journeys,[],'a');assert.equal(p.intention,report);assert.equal(p.duration_minutes,null);assert.deepEqual(p.entry_types,['NOTE']);assert.ok(Object.values(p.condition).every(v=>v==='UNKNOWN'));
 }
 assert.equal(fallbackLocalParse('۲۰ دقیقه مطالعه کردم',journeys,[]).duration_minutes,20);
});
test('local provider validates responses, model availability, body failures and no cloud fallback',async t=>{
 const calls:any[]=[];let catalog:any={models:[{name:'test-local'}]},output:any={done:true,response:JSON.stringify(valid())};
 t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{calls.push({url,options});if(!String(url).endsWith('/api/tags') && output === 'body-error') return new Response(new ReadableStream({start(controller){controller.error(new DOMException('Deadline exceeded','TimeoutError'));}}));return new Response(JSON.stringify(String(url).endsWith('/api/tags')?catalog:output));});
 setOllamaConfig('http://127.0.0.1:11434','test-local');
 assert.equal((await checkOllamaHealth()).status,'online');
 assert.equal((await parseNaturalLanguageLog('A note',journeys,[])).provider,'ollama');
 const request=JSON.parse(calls.at(-1).options.body);assert.equal(request.stream,false);assert.equal(request.format.additionalProperties,false);assert.equal(calls.at(-1).options.redirect,'error');
 output={done:true,response:'{"bad":true}'};assert.equal((await parseNaturalLanguageLog('A note',journeys,[])).provider,'local_heuristic');
 output={done:false,response:JSON.stringify(valid())};assert.equal((await parseNaturalLanguageLog('A note',journeys,[])).provider,'local_heuristic');
 output='body-error';assert.equal((await parseNaturalLanguageLog('A note',journeys,[])).provider,'local_heuristic');
 output={done:true,response:'x'.repeat(210000)};assert.equal((await parseNaturalLanguageLog('A note',journeys,[])).provider,'local_heuristic');
 catalog={models:[{name:'test-local',remote_host:'https://cloud.invalid'}]};calls.length=0;
 assert.equal((await checkOllamaHealth()).status,'offline');assert.equal((await parseNaturalLanguageLog('PRIVATE',journeys,[])).provider,'local_heuristic');assert.ok(calls.every(c=>c.url.endsWith('/api/tags')));
 assert.throws(()=>setOllamaConfig(undefined,'model:cloud'));assert.throws(()=>setOllamaConfig('http://remote.invalid','x'));
 setOllamaConfig(undefined,'');calls.length=0;await parseNaturalLanguageLog('manual',journeys,[]);assert.equal(calls.length,0);
});
