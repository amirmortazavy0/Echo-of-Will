# Echo of Will

Local evidence recorder built with React 19, TypeScript, Express and JSON. P0–P5 establish repeatable checks, a local owner boundary, safe storage, preserved capture reports, historical mutation rules, shared time interpretation and complete authenticated exports. P8 username branding is complete. P6 desktop reviewed-report offline delivery and P7 technical migration/handoff are verified; ordinary-use observation and broader device/live-command coverage remain open.

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

## P4/P5 handoff

Manual and local-assisted reports share an editable review form. The live dialog supports Discovery, revisions, Node/Thing switches and corrections. Original reports and intentions are retained; unconfirmed reported bounds remain unclassified. Exports are fresh complete snapshots with original and effective JSON, one Session document per Thing and a manifest.

Final verification on 2026-10-13: 2 E2E browser workflows passed, then full QA passed. No real-data migration was performed. P8 subsequently completed username-based branding before P6/P7.


## Verified local Ollama capture

Use OLLAMA_MODEL=llama3.2:3b and OLLAMA_URL=http://127.0.0.1:11434 in .env (this workstation is configured). OLLAMA_TIMEOUT_MS=120000 allows CPU inference and cold loading. Leave the model blank for manual mode. Settings-dialog changes last until restart.

In Quick Log choose a Thing, enter an English or Persian report, and select Suggest with local AI. Review all fields, then explicitly save. Suggestions do not write records; unknown duration must be supplied. Local errors fall back without cloud access. Queries remain deterministic.

Actual local-model API test: npm run test:ollama. Include the real-model browser workflow by setting RUN_OLLAMA_TESTS=1 before npm run test:e2e. The model must already be installed. See Docs/DEVELOPER_GUIDE.md for verified scope.


## P6 desktop offline and P7 migration — 2026-10-16

P6 is verified for the current loopback desktop deployment: a previously signed-in browser can reload the cached app shell, see its last verified owner-scoped read snapshot, and save reviewed reports while disconnected from the backend. The UI identifies snapshots and pending acceptance. Internet status is not used as backend readiness. Backend/API authentication and AI responses are network-only; successful record reads are cached explicitly by verified username. Network failure does not discard the token; confirmed authentication rejection requires sign-in again.

Reports are stored durably in separate localStorage keys before send success is reported, with stable command UUID, selected owner, original report, reviewed semantics, original activity bounds and client confirmation time. Authenticated replay uses the same Idempotency-Key and byte-stable payload. Server command_receipts binds owner, payload digest and accepted response in the same JSON write as the capture; identical retries after restart return that acceptance, while changed payload/owner fails. Browser tab replay uses Web Locks where available; server receipts protect repeated delivery. Queue failures remain visible and exportable; no other owner's queue is replayed. Older ownerless/corrupt pending records are retained for explicit recovery, never silently assigned or erased.

The offline entry point is the reviewed report form. Live tracking commands, creation of new context, server exports and AI inference need the backend. Offline reports can retain NOTE, reviewed Discovery and intention revision semantics, then reconcile through the existing capture validator. This does not provide an offline replica of every live command. Phone/LAN hosting is not enabled: AD-015's loopback boundary is retained, and physical phone/secure-origin deployment verification remains a separate release gate. Clearing browser storage can remove unsent reports; export pending reports before clearing it.

P7 controlled migration was explicitly authorized by the user's follow-up. The selected source is backend/data/pist_data.json (SHA-256 4ff1cb9dafa5420e2301342c5346cc75969267cb449b8de4788d9ee5c5394bfe): one Thing, two Nodes, one Session, one Entry and 13 audit/event records. Older human_drift candidates lack the event history and were not selected. Preview found no relationship/time defects or unknown top-level fields. The migration was rehearsed on a private copy, verified field by field, checked for idempotent reapplication and exercised through a synthetic confirmed capture on that copy before applying to the stopped live backend.

The live schema-2 migration is additive. Original bytes and the prior backup, plus source/configuration for rollback, are preserved privately under .private/p6-p7/rollback; the built-in migration-source snapshot retains the source hash. No original actor, intention or reported history was rewritten. Custody/defaulted fields are labeled as migration provenance; unknown historical intention/Condition remains unknown. No synthetic test Session was inserted into the real dataset. Baseline verification now verifies the reviewed transition, immutable snapshots, lineage and original evidence while allowing legitimate new captures.

P7 technical migration and handoff are verified; ordinary-work observation remains OPEN. The proposed week of real use cannot be replaced by automated tests or elapsed calendar time. Record failures, missing/duplicate evidence, provenance clarity, discrepancies and friction in the authoritative Vault’s 04 - Development/Controlled Usage Log.md. Completion requires actual observations and review. P6 phone deployment and a universal offline live-command workflow are not claimed.

Combined acceptance: all 6 E2E workflows passed, including English/Persian llama3.2:3b inference, live/retrospective semantics, correction and switching, export, branding, disconnected reload/reconnect, persistent exactly-once retry after restart, rejected/auth-failed record retention and owner isolation. Full QA passed type checking, 26 regressions, production builds, 2 startup/restart checks, 2 API integration scenarios and baseline preservation. Private real-data-copy migration/capture checks passed. The final live-backend probe verified schema 2, authenticated readiness and actual local inference without changing real data bytes. A temporary authenticated browser also showed the correct owner and Ollama [llama3.2:3b] without creating records. These checks establish the declared desktop scope, not an ordinary-use or physical-phone certification.

Current verification: the authoritative Vault’s 04 - Development/P6–P7 Verification.md. Earlier no-migration statements describe the historical pre-P7 batches.
