import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedServer } from '../helpers/server.mjs';
test('actual Ollama: English and Persian editable capture, confirmation, and unavailable fallback', async ({page})=>{
 test.skip(process.env.RUN_OLLAMA_TESTS !== '1','Actual local model check is opt-in; run with RUN_OLLAMA_TESTS=1');test.setTimeout(300000);
 const server=await isolatedServer();
 try{
  await page.route('**/*', route => route.request().url().startsWith(server.url) ? route.continue() : route.abort());
  await page.goto(server.url);
  await page.getByRole('button',{name:'Sign up',exact:true}).click();
  await page.getByPlaceholder('Username',{exact:true}).fill('live-model-browser');
  await page.getByPlaceholder('Password',{exact:true}).fill('synthetic-password');
  await page.getByPlaceholder('Confirm password',{exact:true}).fill('synthetic-password');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
  const token=await page.evaluate(()=>localStorage.getItem('token'));
  const post=async(route:string,body:any)=>{const r=await page.request.post(server.url+route,{headers:{Authorization:'Bearer '+token},data:body});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
  const j=await post('/api/journeys',{name:'Model browser test'});
  await post('/api/ai/settings',{url:'http://127.0.0.1:11434',model:'llama3.2:3b'});
  await page.reload();
  await expect(page.getByText('Ollama [llama3.2:3b]',{exact:true})).toBeVisible();
  for(const report of ['I spent 20 minutes studying storage. My energy was low.','۲۰ دقیقه درباره ذخیره‌سازی مطالعه کردم. انرژی من کم بود.']){
   const form=page.locator('form').filter({has:page.getByLabel('Original report',{exact:true})});
   await form.getByLabel('Capture Thing').selectOption(j.id);
   await form.getByLabel('Original report').fill(report);
   const file=path.join(server.dataDir,'pist_data.json'),before=fs.readFileSync(file);
   const response=page.waitForResponse(r=>r.url().endsWith('/ai/parse-log'),{timeout:150000});
   await form.getByRole('button',{name:'Suggest with local AI'}).click();
   const p=await (await response).json();expect(p.provider).toBe('ollama');
   console.log(JSON.stringify({language:/[\u0600-\u06ff]/.test(report)?'Persian':'English',duration:p.duration_minutes,energy:p.condition.energy}));
   await expect(form.getByRole('status')).toContainText('llama3.2:3b');
   await expect(form.getByLabel('Reported duration (minutes)')).toHaveValue('20');
   await expect(form.getByLabel('Reported energy',{exact:true})).toHaveValue('LOW');
   expect(fs.readFileSync(file)).toEqual(before);
   await expect(form.getByRole('checkbox')).not.toBeChecked();
   await form.getByLabel('Reconstructed intention').fill('User-reviewed intention');
   const saved=page.waitForResponse(r=>r.url().endsWith('/sessions/quick-log'));
   await form.getByRole('button',{name:'Log Completed Work'}).click();
   const result=await (await saved).json();expect(result.report.original_text).toBe(report);expect(result.report.proposal).toEqual(p);expect(result.session.intention).toBe('User-reviewed intention');expect(result.entries.map((e:any)=>e.entry_type)).toEqual(['NOTE']);
  }
  await post('/api/ai/settings',{url:'http://127.0.0.1:1',model:'llama3.2:3b'});
  const form=page.locator('form').filter({has:page.getByLabel('Original report',{exact:true})});
  await form.getByLabel('Original report').fill('درباره ذخیره‌سازی مطالعه کردم');
  await form.getByRole('button',{name:'Suggest with local AI'}).click();
  await expect(form.getByRole('status')).toContainText('local_heuristic');
  await expect(form.getByLabel('Reported duration (minutes)')).toHaveValue('');
  await form.getByLabel('Reported duration (minutes)').fill('10');
  await form.getByLabel('Reconstructed intention').fill('Manual fallback');
  const saved=page.waitForResponse(r=>r.url().endsWith('/sessions/quick-log'));
  await form.getByRole('button',{name:'Log Completed Work'}).click();expect((await saved).status()).toBe(201);
 }finally{await server.stop();}
});
