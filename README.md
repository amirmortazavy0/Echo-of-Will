# Echo of Will

Local evidence recorder built with React 19, TypeScript, Express and JSON. P0–P3 establish repeatable checks, a local owner boundary, safe storage and historical mutation rules. Capture provenance, consistent time interpretation, exports and disconnected-device operation remain P4–P7 work.

## Run locally

Use Node 22.20+ (22.x) and npm 10.x. Copy .env.example to .env and choose a fresh synthetic PIST_DATA_DIR when reviewing changes.

~~~powershell
npm ci
npm run build
npm start
~~~

The server defaults to 127.0.0.1:3000 and rejects non-loopback listeners and cross-origin requests. Create the one local owner on first use. Its signing key is generated and persisted privately in the selected data directory; no manually deployed signing secret is required. Existing multiple-account files require explicit PIST_OWNER_USERNAME selection. This is a solo recorder, not multi-account isolation or a LAN deployment.

Ollama is optional. Leave OLLAMA_MODEL blank for manual mode. When configured, only a loopback Ollama endpoint is accepted; failure falls back locally. There are no cloud AI or synchronization dependencies, credentials, clients or endpoints.

start.bat and start.sh launch an existing build without reinstalling dependencies. Rebuild after code changes. npm run dev uses Vite middleware; npm start serves production. Both load .env, with inherited environment variables taking precedence. npm run preview serves only the frontend.

## Storage and deliberate migration

PIST_DATA_DIR selects the data directory; the default is backend/data. Canonical state is pist_data.json, with pist_data.json.bak as recovery candidate. Credentials and the owner signing key are private local files. Reads never import legacy data or rewrite files. Valid canonical data, including empty or audit-only data, wins; validated backup is considered before legacy candidates. Writes reject stale snapshots and preserve damaged originals. A stale .write.lock requires inspecting the writer before manual recovery.

Legacy schemas are readable but cannot accept new writes until explicit migration is reviewed. Work on copies first, with the application stopped and PIST_DATA_DIR set to the intended isolated destination:

~~~powershell
npm run storage:migrate -- --source "path/to/selected-copy.json"
~~~

The dry run reports source hash, counts, defaults, defects and competing candidates. Apply only after reviewing those results, adding --apply --sha256 <reviewed-source-hash>. Replacing a different or damaged canonical file also requires --canonical-sha256 <reviewed-canonical-hash>. Sources and lineage are retained; repeat application is safe. No real dataset was migrated during P0–P3.

Runtime data, credentials, exports and .private snapshots are excluded from Git. Earlier Git history still contains historical private material; do not publish it.

## Verification

~~~powershell
npm run typecheck
npm run test:regression
npm run build
npm run test:e2e
npm run test:qa
~~~

Browser tests use installed Edge on Windows (or PLAYWRIGHT_CHANNEL); Chromium is the default elsewhere. Tests use isolated synthetic storage and loopback ports. QA runs type checking, regression/recovery tests, builds, development/production startup, API integration/restart tests and private baseline hash verification. The final handoff runs E2E before QA.

Baseline verification requires the private manifest. On a new checkout, preserve a baseline with node scripts/snapshot-baseline.mjs while the application is stopped. Never commit .private or use startup as a migration experiment.

See [Developer Guide](Docs/DEVELOPER_GUIDE.md). The authoritative roadmap and domain documents live in the external Echo of Will Obsidian vault, not duplicated repository Docs folders.
