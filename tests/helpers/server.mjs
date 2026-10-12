import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomInt } from 'node:crypto';

export const root = fileURLToPath(new URL('../../', import.meta.url));

export async function isolatedServer(mode = 'production') {
  // Some hosts allocate low ephemeral ports that browsers/fetch deliberately block.
  let port;
  for (let attempt = 0; attempt < 20; attempt++) {
    const listener = net.createServer();
    try {
      listener.listen(randomInt(20000, 60000), '127.0.0.1');
      await once(listener, 'listening');
      port = listener.address().port;
      await new Promise(resolve => listener.close(resolve));
      break;
    } catch (error) { listener.close(); if (error.code !== 'EADDRINUSE') throw error; }
  }
  if (!port) throw new Error('No available test port');
  const directory = path.join(root, '.private', 'test-runs', randomUUID());
  fs.mkdirSync(directory, { recursive: true });
  const dataDir = path.join(directory, 'data');
  const envFile = path.join(directory, '.env');
  // Exercise .env loading without reading the user's .env or credentials.
  fs.writeFileSync(envFile, `PIST_DATA_DIR="${dataDir.replaceAll('\\', '/')}"\nHOST=127.0.0.1\nPORT=${port}\n`);
  const env = { ...process.env, NODE_ENV: mode,
    OLLAMA_URL: 'http://127.0.0.1:1', OLLAMA_MODEL: 'synthetic-test' };
  // Remove case-insensitive Windows aliases so parent overrides cannot defeat isolation.
  for (const key of Object.keys(env)) {
    if (['PIST_DATA_DIR', 'HOST', 'PORT'].includes(key.toUpperCase())) delete env[key];
  }
  const url = `http://127.0.0.1:${port}`;
  let child;
  let log = '';
  const server = {
    url, dataDir, directory,
    get log() { return log; },
    async start() {
      const args = mode === 'production'
        ? [`--env-file=${envFile}`, path.join(root, 'scripts/start-production.mjs')]
        : [`--env-file=${envFile}`, '--import', 'tsx', path.join(root, 'server.ts')];
      child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { log += chunk; });
      child.stderr.on('data', chunk => { log += chunk; });
      let launchError;
      child.on('error', error => { launchError = error; });
      try {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if (launchError) throw launchError;
          if (child.exitCode !== null) throw new Error(`Server exited: ${log}`);
          try {
            const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
            if (res.ok) return server;
          } catch { /* readiness retry */ }
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        throw new Error(`Server did not become ready: ${log}`);
      } catch (error) { await server.stop(); throw error; }
    },
    async stop() {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
      fs.writeFileSync(path.join(directory, 'server.log'), log);
    },
  };
  return server.start();
}
