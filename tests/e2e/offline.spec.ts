import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';import {isolatedServer} from '../helpers/server.mjs';
test('P6: disconnected shell/reload, owner scoped pending report, retry and restart are exactly once',async({page,context})=>{
 const server=await isolatedServer();try{
 await page.goto(server.url);await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByPlaceholder('Username',{exact:true}).fill('offline-owner');await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');await page.getByPlaceholder('Confirm password',{exact:true}).fill('synthetic-password');await page.locator('button[type="submit"]').click();await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 const token=await page.evaluate(()=>localStorage.getItem('token'));const headers={Authorization:'Bearer '+token};
 const r=await page.request.post(server.url+'/api/journeys',{headers,data:{name:'Offline context'}});expect(r.ok()).toBeTruthy();const j=await r.json();await page.reload();await expect(page.getByLabel('Capture Thing')).toContainText('Offline context');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const before=fs.readFileSync(path.join(server.dataDir,'pist_data.json'));
 await context.setOffline(true);await page.reload();
 await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();await expect(page.getByLabel('Capture Thing')).toContainText('Offline context');
 await page.getByLabel('Capture Thing').selectOption(j.id);await page.getByLabel('Original report',{exact:true}).fill('گزارش ذخیره‌شده بدون اتصال');await page.getByLabel('Reconstructed intention').fill('Offline original intention');await page.getByLabel('Reported duration (minutes)').fill('12');await page.getByLabel('Reported end',{exact:true}).fill('2026-10-15T10:30');
 await page.getByRole('button',{name:'Log Completed Work',exact:true}).click();await expect(page.getByText('Saved on this device — pending server acceptance.',{exact:true})).toBeVisible();
 expect(fs.readFileSync(path.join(server.dataDir,'pist_data.json'))).toEqual(before);
 const queued=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('eow-pending:')).map(k=>JSON.parse(localStorage.getItem(k)!)));expect(queued).toHaveLength(1);
 await page.reload();await expect(page.getByLabel('Pending reports')).toContainText('1 pending report');expect(await page.evaluate(()=>localStorage.getItem('token'))).toBe(token);
 // An invalid session pauses delivery without deleting the pending report.
 await server.stop();await server.start();await context.setOffline(false);
 await expect.poll(()=>{const d=JSON.parse(fs.readFileSync(path.join(server.dataDir,'pist_data.json'),'utf8'));return d.capture_reports.length;},{timeout:15000}).toBe(1);
 const data=JSON.parse(fs.readFileSync(path.join(server.dataDir,'pist_data.json'),'utf8'));expect(data.command_receipts).toHaveLength(1);expect(data.capture_reports[0].original_text).toBe('گزارش ذخیره‌شده بدون اتصال');expect(data.capture_reports[0].client_confirmed_at).toBe(queued[0].queuedAt);expect(data.capture_reports[0].claimed_ended_at).toBe(queued[0].payload.ended_at);expect(data.session_entries.map((e:any)=>e.entry_type)).toEqual(['NOTE']);
 await server.stop();await server.start();
 const replay=await page.request.post(server.url+'/api/sessions/quick-log',{headers:{...headers,'Idempotency-Key':queued[0].id},data:queued[0].payload});expect(replay.status()).toBe(201);
 const mismatch=await page.request.post(server.url+'/api/sessions/quick-log',{headers:{...headers,'Idempotency-Key':queued[0].id},data:{...queued[0].payload,intention:'Changed'}});expect(mismatch.status()).toBe(409);
 expect(JSON.parse(fs.readFileSync(path.join(server.dataDir,'pist_data.json'),'utf8'))).toEqual(data);
 }finally{await context.setOffline(false);await server.stop();}
});

test('P6: rejected and unauthorized pending reports survive; another owner cannot replay them',async({page})=>{
 const server=await isolatedServer();try{
 await page.goto(server.url);await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByPlaceholder('Username',{exact:true}).fill('queue-owner');await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');await page.getByPlaceholder('Confirm password',{exact:true}).fill('synthetic-password');await page.locator('button[type="submit"]').click();await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 const id='failure-'+crypto.randomUUID();
 await page.evaluate(id=>{const owner=JSON.parse(localStorage.getItem('eow-verified-owner')!).username;localStorage.setItem('eow-pending:'+id,JSON.stringify({id,owner,queuedAt:new Date().toISOString(),payload:{journey_id:'missing',intention:'Retain this report',original_report:'Private pending evidence',duration_minutes:10}}));window.dispatchEvent(new Event('eow:queue'));},id);
 await page.getByRole('button',{name:'Retry pending reports'}).click();await expect(page.getByLabel('Pending reports')).toContainText('1 pending report');
 await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('eow-pending:'+id)!)?.error,id)).toBeTruthy();
 const pending=await page.evaluate(id=>JSON.parse(localStorage.getItem('eow-pending:'+id)!),id);expect(pending.error).toBeTruthy();expect(pending.payload.original_report).toBe('Private pending evidence');
 await page.evaluate(()=>{localStorage.setItem('token','invalid-token');localStorage.setItem('hd_auth_token','invalid-token');});await page.reload();await expect(page.getByPlaceholder('Username',{exact:true})).toBeVisible();expect(await page.evaluate(id=>!!localStorage.getItem('eow-pending:'+id),id)).toBe(true);
 const usersFile=path.join(server.dataDir,'users.json'),original=fs.readFileSync(usersFile);const users=JSON.parse(original.toString());users.users[0].username='different-owner';fs.writeFileSync(usersFile,JSON.stringify(users));
 await page.getByPlaceholder('Username',{exact:true}).fill('different-owner');await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');await page.locator('button[type="submit"]').click();await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retry pending reports'})).toHaveCount(0);expect(await page.evaluate(id=>!!localStorage.getItem('eow-pending:'+id),id)).toBe(true);
 await page.getByRole('button',{name:'Logout',exact:true}).click();fs.writeFileSync(usersFile,original);
 await page.getByPlaceholder('Username',{exact:true}).fill('queue-owner');await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');await page.locator('button[type="submit"]').click();await expect(page.getByRole('button',{name:'Retry pending reports'})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export pending reports'}).click();const artifact=await download;expect(artifact.suggestedFilename()).toBe('pending-reports.json');
 expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('eow-pending:'+id)!).payload.original_report,id)).toBe('Private pending evidence');
 }finally{await server.stop();}
});
