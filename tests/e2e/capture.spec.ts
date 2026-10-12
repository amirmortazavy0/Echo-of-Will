import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {isolatedServer} from '../helpers/server.mjs';

test('mounted live discovery/revision/switch/correction, reviewed local proposal and authenticated export',async({page})=>{
 const server=await isolatedServer();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith(server.url)?route.continue():route.abort());
 try{
 await page.goto(server.url);await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByPlaceholder('Username',{exact:true}).fill('workflow-owner');await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');await page.getByPlaceholder('Confirm password',{exact:true}).fill('synthetic-password');await page.locator('button[type="submit"]').click();
 await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 const token=await page.evaluate(()=>localStorage.getItem('token'));
 const post=async(route:string,body:any)=>{const res=await page.request.post(server.url+route,{headers:{Authorization:'Bearer '+token},data:body});expect(res.ok(),await res.text()).toBeTruthy();return res.json();};
 const a=await post('/api/journeys',{name:'A'}),b=await post('/api/journeys',{name:'B'});
 const n=await post('/api/nodes',{journey_id:a.id,name:'First'}),n2=await post('/api/nodes',{journey_id:a.id,name:'Second'});
 const source=(await post('/api/sessions',{journey_id:a.id,intention:'Immutable live intention',node_id:n.id})).session;
 await page.reload();await page.getByRole('button',{name:'Log Event',exact:true}).click();
 let live=page.getByRole('dialog',{name:'Tracking Session'});
 await live.getByRole('button',{name:'Discovery',exact:true}).click();await live.getByLabel('Live discovery name').fill('New dependency');await live.getByLabel('Live discovery parent').selectOption(n.id);await live.getByPlaceholder('What happened or what did you accomplish?').fill('Found dependency');
 let saved=page.waitForResponse(r=>r.url().endsWith('/entries')&&r.request().method()==='POST');await live.getByRole('button',{name:'Record Entry',exact:true}).click();expect((await saved).status()).toBe(201);
 await live.getByRole('button',{name:'Switch Node',exact:true}).click();await live.getByLabel('Live Node').selectOption(n2.id);saved=page.waitForResponse(r=>r.url().endsWith('/entries')&&r.request().method()==='POST');await live.getByRole('button',{name:'Record Entry',exact:true}).click();expect((await saved).status()).toBe(201);
 await live.getByText('Revise intention or move to another Thing',{exact:true}).click();await live.getByLabel('New intention').fill('Revised after discovery');await live.getByLabel('Change reason').fill('New evidence');saved=page.waitForResponse(r=>r.url().endsWith('/revise-intention'));await live.getByRole('button',{name:'Append intention revision'}).click();expect((await saved).status()).toBe(200);
 await live.getByText(/Entries and corrections/).click();await live.getByRole('button',{name:'Correct entry',exact:true}).first().click();
 const correction=page.locator('form').filter({has:page.getByRole('button',{name:'Record Correction',exact:true})});
 await correction.locator('input[type="text"]').fill('Corrected capture note');await correction.getByPlaceholder('e.g. Typo in notes, logged 5 minutes after actual departure').fill('Clarify wording');saved=page.waitForResponse(r=>r.url().endsWith('/corrections')&&r.request().method()==='POST');await correction.getByRole('button',{name:'Record Correction',exact:true}).click();expect((await saved).status()).toBe(201);
 await live.getByLabel('New intention').fill('Continue in B');await live.getByLabel('Destination Thing').selectOption(b.id);saved=page.waitForResponse(r=>r.url().endsWith('/switch-journey'));await live.getByRole('button',{name:'Move to selected Thing'}).click();expect((await saved).status()).toBe(201);
 live=page.getByRole('dialog',{name:'Tracking Session'});await expect(live.getByRole('heading',{name:'"Continue in B"'})).toBeVisible();
 await live.getByRole('button',{name:'Conclude Tracking'}).click();await live.getByRole('button',{name:'Excellent',exact:true}).click();saved=page.waitForResponse(r=>r.url().endsWith('/end'));await live.getByRole('button',{name:'End Session',exact:true}).click();expect((await saved).status()).toBe(200);
 const form=page.locator('form').filter({has:page.getByLabel('Original report',{exact:true})});
 await form.getByLabel('Original report').fill('I worked on research in A for 20 minutes and discovered a dependency.');
 await form.getByLabel('Capture Thing').selectOption(a.id);
 saved=page.waitForResponse(r=>r.url().endsWith('/ai/parse-log'));await form.getByRole('button',{name:'Suggest with local AI'}).click();expect((await saved).status()).toBe(200);
 await expect(form.getByRole('status')).toContainText('Suggestion from');
 await form.getByPlaceholder('e.g. Debugging storage synchronization, writing test cases').fill('Reviewed reconstructed intention');
 await form.getByLabel('Uncertainty').fill('Approximate timing');
 await form.getByLabel('Entry semantics 1').selectOption('DISCOVERY');await form.getByLabel('Discovery name',{exact:true}).fill('Reviewed discovery');
 await form.getByRole('button',{name:'Add reviewed entry'}).click();await form.getByLabel('Entry semantics 2').selectOption('INTENTION_REVISED');await form.getByLabel('Revised intention',{exact:true}).fill('Follow the dependency');await form.getByLabel('Revision reason',{exact:true}).fill('Reported change');
 await form.getByRole('button',{name:'Add reviewed entry'}).click();await form.getByLabel('Entry note 3').fill('Preserve this note');
 saved=page.waitForResponse(r=>r.url().endsWith('/quick-log'));await form.getByRole('button',{name:'Log Completed Work'}).click();const committed=await saved;expect(committed.status(),await committed.text()).toBe(201);
 const persisted=JSON.parse(fs.readFileSync(path.join(server.dataDir,'pist_data.json'),'utf8'));
 expect(persisted.sessions.find((s:any)=>s.id===source.id).intention).toBe('Immutable live intention');
 const report=persisted.capture_reports[0];expect(report.original_text).toContain('I worked on research');expect(report.proposal).toBeTruthy();expect(report.uncertainty).toBe('Approximate timing');
 expect(persisted.session_entries.filter((e:any)=>e.source_report_id===report.id).map((e:any)=>e.entry_type)).toEqual(['DISCOVERY','INTENTION_REVISED','NOTE']);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export .md',exact:true}).click();const download=await downloadPromise;expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toContain('.zip');
 await page.reload();await page.getByRole('button',{name:'Audit Trail',exact:true}).click();await expect(page.getByText('"Reviewed reconstructed intention"',{exact:true})).toBeVisible();expect(errors).toEqual([]);
 }finally{await server.stop();}
});

