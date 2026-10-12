import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedServer } from './helpers/server.mjs';

for (const mode of ['development', 'production']) {
  test(`${mode}: isolated .env, frontend, auth, persistence and restart`, { timeout: 60000 }, async () => {
    const server = await isolatedServer(mode);
    try {
      const html = await (await fetch(server.url)).text();
      assert.match(html, /<div id="root"><\/div>/);
      assert.equal(html.includes('/@vite/client'), mode === 'development');
      assert.match(server.log, new RegExp(`\\(${mode}\\)`));
      const health = await (await fetch(`${server.url}/api/health`)).json();
      assert.equal(health.journeys_count, 0);
      assert.equal((await fetch(`${server.url}/api/journeys`)).status, 401);
      const signup = await fetch(`${server.url}/api/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'synthetic', password: 'synthetic-password' }),
      });
      assert.equal(signup.status, 201);
      const { token } = await signup.json();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const created = await fetch(`${server.url}/api/journeys`, {
        method: 'POST', headers, body: JSON.stringify({ name: 'P0 restart fixture' }),
      });
      assert.equal(created.status, 201);
      const thing = await created.json();
      assert.equal(fs.existsSync(path.join(server.dataDir, 'users.json')), true);
      const saved = fs.readFileSync(path.join(server.dataDir, 'pist_data.json'));
      await server.stop();
      await server.start();
      const things = await (await fetch(`${server.url}/api/journeys`, { headers })).json();
      assert.deepEqual(things, [thing]);
      assert.deepEqual(fs.readFileSync(path.join(server.dataDir, 'pist_data.json')), saved);
      const auth = await fetch(`${server.url}/api/auth/me`, { headers });
      assert.equal(auth.status, 200);
    } finally { await server.stop(); }
  });
}
