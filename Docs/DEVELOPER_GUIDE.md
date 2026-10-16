# Echo of Will — Developer Guide

Updated 2026-10-16. P0–P5, P8 and local Ollama implementation handoff. The authoritative vault is E:\Obsidian Vaults\Echo of Will; repository source and executed tests establish actual implementation. Read its Work Mode Master Prompt, Glossary, Domain Model, Architecture Decisions, Data Model Spec, Event Schema and Development Roadmap before domain changes. Repository Docs contains this engineering guide; removed duplicate vault folders are not recreated.

## Scope and runtime

See [README](../README.md) for setup and checks. The inspected stack is React/TypeScript, Express and local JSON. Journey remains the wire/storage compatibility name for Thing. Do not physically rename historical records or events as a cleanup.

The scope is one authenticated local owner, loopback-only access, private records and optional local Ollama. Cloud AI and synchronization have been removed. A blank model selects manual mode; local AI failure never enables an external provider. The signing key is generated locally and persists across restarts. Multiple legacy users require deliberate owner selection, with their credential records preserved.

## P1–P3 contracts

- Review and query summaries describe recorded intentions, transitions, reflections and qualified elapsed bounds. They do not infer drift or motivation. User-authored end reasons remain evidence.
- Storage reads are side-effect free. Valid canonical data wins even when empty; validated backup precedes explicit legacy migration. Unknown fields survive, duplicate identities/conflicting aliases fail visibly, and damaged originals remain available. Writes use a lock, revision hash, durable temporary files and atomic rename; history and state commit together.
- New records and Condition snapshots carry stable local owner_id and PRIVATE visibility. Legacy custody defaults are identified by migration_provenance; old event actors are preserved. Migration uses a reviewed source hash, preserved sources and lineage. Original bytes are preserved; the canonical dataset has now undergone the reviewed P7 migration.
- Commands validate references, same-Thing membership, parent cycles without a depth cap, enums, bounded finite numbers and timestamps before mutation. Invalid requests leave storage unchanged. Overlapping reports and out-of-order captures are retained with conflict records.
- Session intention and Thing creation snapshot are immutable. Revisions, corrections, estimates, closures and retrospective amendments append supporting history. New ABANDONED writes are rejected; historical values remain readable.
- Repeating the same closure is a no-op; differing closure returns conflict. POST /api/sessions/:id/amend appends a reasoned amendment for note/reflection/quality/ended_at without changing the original closed Session. Historical entries/revisions require amendment_reason and a claimed timestamp within original bounds.
- Sticky Conditions select by effective entry time, persistent append order for ties, then ID. Revisions and linked switches carry the same snapshot. Missing first-entry dimensions remain UNKNOWN with provenance. Condition changes are entries; snapshots are not independent entities.
- Corrections allow note/node_id/entry_type/logged_at, preserve raw original and previous effective values, and have deterministic sequence ordering and actor attribution. Structured revision/discovery/switch records cannot be casually retyped. P5 now shares effective projections across the mounted views and export.

intention_provenance distinguishes declared_at_capture, reconstructed and legacy_unknown. Thing creation_snapshot retains initial wording; unknown legacy creation wording is not invented. P4 adds the source report/confirmation contract described below.

## Verification and remaining gates

npm run test:e2e exercises real-browser owner setup, descriptive Review, Thing creation, manual capture, FAIR closure, retrospective capture, reload and restart. npm run test:qa then checks types, regression/recovery fixtures, both builds, startup/API integration and private baseline hashes. See vault 04 - Development/P1–P3 Verification.md for final results.

P4 and P5 are implemented and verified below. P6 owns disconnected-device queue/replay. P7 owns controlled real-data migration and observed use. This repair does not close those release gates.

## Preservation and rollback

Initial source commit: 5f10089806ff3636f117602b2f2e49860da8a13c; repair branch: codex/p0-repeatable-baseline. .private/p0-baseline retains original source bundle and snapshots. .private/p1-p3-baseline preserves the dataset state at the start of this follow-up, including user changes since P0. Neither is public material.

Run node scripts/verify-baseline.mjs to verify snapshots and current repair dataset bytes. Restore into a separate private directory and pair code with its matching snapshot. Preserve subsequent captures separately for reconciliation. Never overwrite new records with an older snapshot. Existing user deletions of duplicate Docs material remain untouched.

## P4/P5 capture and interpretation

The mounted ActiveSessionModal now supports Discovery details and parent lineage, Node destinations, linked cross-Thing transitions, appended intention revisions, and corrections. CaptureForm is shared by the mounted report screen and retrospective dialog. Manual capture does not require AI; local suggestions remain editable proposals. Rejected submissions keep their unsaved text.

capture_reports preserves original text, receipt/confirmation time, claimed bounds, provider/proposal, uncertainty, and reviewed accepted entries. Entries link back through source_report_id and carry captured_at/time_provenance. Retrospective intentions are reconstructed. A NOTE does not manufacture activity boundaries. Only explicit boundaries_confirmed creates estimated start/pause entries.

src/domain/evidence.ts owns effective correction/amendment projection and interval interpretation. Original data is not mutated. Only explicit start/switch/arrival entries open activity; pause/completion/switch-request/departure close it. Notes, discoveries, revisions and Condition changes do not infer continuous work or switch Nodes. Valid bounds partition into supported activity and unclassified intervals without scaling or redistribution. Ties use persistent append order. Invalid times remain evidence with issues; open intervals are provisional. Overlapping Session reports are not deduplicated into unique wall-clock totals.

Board, summaries, history, Review, query answers and export share this interpretation. Raw APIs remain available; frontend reads request effective views, and the Session evidence endpoint exposes original reports, revisions, corrections, amendments and conflicts.

Each export creates a unique snapshot beneath the selected data directory's exports folder, containing canonical.json, effective.json, summaries.json, Markdown, and a scope/omissions/hash manifest. Every Session has one canonical document under its Thing, including no-Node Sessions; Node files reference those documents. Credentials and signing keys are excluded. Browser downloads use an authenticated request and blob. No old export folder is merged into a new ZIP.

## P8 — Username branding (complete)

Visible login, signed-in header, initial badge, loading, query/help and installation labels now use the selected local owner’s username. Before setup or when owner selection is ambiguous, the neutral fallback is “Your workspace”. The loopback-only /auth/branding endpoint returns only username/null, never credentials or an account list. Authenticated identity takes precedence. Branding and the dynamic PWA manifest are not cached; owner changes are picked up on reload. Echo of Will remains the project/documentation identity. Historical evidence, credential records, storage keys and compatibility export filenames are unchanged. Existing installed shortcuts may require reinstalling to refresh their OS-managed name.

P8 was prioritized before P6/P7 and completed on 2026-10-13. Three isolated browser workflows passed, followed by full QA (type checking, 23 regression/recovery tests, both builds, 2 startup/restart checks, 2 API scenarios and original-data baseline hashes).

## Final verification — 2026-10-13

After the complete build, E2E passed 2 browser workflows. QA then passed type checking, 23 regression/recovery tests, both builds, 2 startup/restart checks, 2 API scenarios and baseline hashes. That P4/P5 run used the local heuristic fallback; subsequent actual-model checks and remaining quality limits are recorded below. See the vault's 04 - Development/P4–P5 Verification.md.

.private/p4-p5-baseline preserves this batch's starting datasets. Older P0 and P1–P3 snapshots remain intact; original datasets match the current batch baseline. No real-data migration was performed. P8 subsequently changed presentation only.


## Verified local Ollama integration — 2026-10-13

The installed llama3.2:3b model is configured at http://127.0.0.1:11434 through the existing OLLAMA_MODEL and OLLAMA_URL startup variables. OLLAMA_TIMEOUT_MS defaults to 120000 (bounded to 1000–300000 ms) and covers response headers and body. The runtime settings dialog changes URL/model until restart; a blank model selects manual mode. Startup .env remains authoritative unless inherited environment variables override it.

The authenticated parse endpoint sends only the submitted report, selected Thing name/id and a bounded catalog of that Thing's Node names/ids to the local model. It checks the installed local model catalog before inference and excludes remote/cloud model entries. Loopback HTTP only, redirect rejection, input/context/output limits and no external fallback preserve the local-only boundary. No model is downloaded automatically.

Schema-constrained output is independently validated for types, allowed fields/enums, finite bounded duration, and selected-Thing/Node references. Unknown duration is null and becomes a required empty review field; unknown Conditions remain UNKNOWN. Report-specific language instructions support English and Persian. Persian/Arabic numerals are normalized only in the inference request; the preserved original report is unchanged. The editable proposal identifies provider and model; invalid, unavailable or timed-out inference returns an explained conservative local fallback. The fallback preserves the report, can extract explicitly numbered English/Persian minute/hour durations, and otherwise leaves uncertainty visible.

Capture remains a proposal → review → confirmation workflow. Requesting a suggestion performs no evidence write. The form shows suggested intention, duration, Node and Condition for editing; semantic entries remain explicitly reviewed. Editing a report after a suggestion clears its derived review fields to avoid stale attribution. Confirmation stores original report, full proposal (including provider/model or fallback reason), accepted edits and existing capture provenance. Activity boundaries remain unchecked until explicitly confirmed. No original intention or evidence is overwritten and no migration is performed.

Query chat remains the existing deterministic descriptive interpreter; this integration does not turn it into general LLM conversation or add RAG, cloud processing, autonomous actions, drift classification or P6/P7 functionality.

Verification on 2026-10-13: actual local inference passed English, Persian and unspecified-detail examples; observed direct inference took approximately 12–15 seconds after prompt repairs (the first English run took about 22 seconds). The actual-model authenticated integration scenario passed both languages, no-write suggestions, reviewed provenance, unclassified intervals, missing/unavailable model fallback and restart preservation. Existing API integration: 2 passed. Full browser E2E with RUN_OLLAMA_TESTS=1: 4 passed, including real bilingual inference and manual fallback with non-application browser requests blocked. Regression: 26 passed. Final QA passed type checking, all 26 regressions, production builds, 2 startup/restart tests, 2 API integration scenarios and original-data baseline hashes.

Initial testing exposed translated/transliterated intention text, an omitted explicit duration and an ambiguous Condition selector label. Language-specific instructions, inference-only numeral normalization and an explicit accessible label addressed these defects; all reported final tests were rerun successfully. Schema validation checks structural validity, not semantic truth: the 3B model can still give awkward Persian wording, omit a detail or provide an imperfect interpretation. User review remains necessary. This is a bounded fixture verification, not a general language-quality benchmark. Internet-disconnected OS operation was not separately toggled; model requests use loopback and external browser requests were blocked during the live browser test.

Reproduce with npm run test:ollama, npm run test:integration, RUN_OLLAMA_TESTS=1 with npm run test:e2e, npm run test:regression and npm run test:qa. See the authoritative vault’s 04 - Development/Ollama Integration Verification.md. Earlier P4/P5 verification described the heuristic-only evidence available at that time.


## P6 desktop offline and P7 migration — 2026-10-16

P6 is verified for the current loopback desktop deployment: a previously signed-in browser can reload the cached app shell, see its last verified owner-scoped read snapshot, and save reviewed reports while disconnected from the backend. The UI identifies snapshots and pending acceptance. Internet status is not used as backend readiness. Backend/API authentication and AI responses are network-only; successful record reads are cached explicitly by verified username. Network failure does not discard the token; confirmed authentication rejection requires sign-in again.

Reports are stored durably in separate localStorage keys before send success is reported, with stable command UUID, selected owner, original report, reviewed semantics, original activity bounds and client confirmation time. Authenticated replay uses the same Idempotency-Key and byte-stable payload. Server command_receipts binds owner, payload digest and accepted response in the same JSON write as the capture; identical retries after restart return that acceptance, while changed payload/owner fails. Browser tab replay uses Web Locks where available; server receipts protect repeated delivery. Queue failures remain visible and exportable; no other owner's queue is replayed. Older ownerless/corrupt pending records are retained for explicit recovery, never silently assigned or erased.

The offline entry point is the reviewed report form. Live tracking commands, creation of new context, server exports and AI inference need the backend. Offline reports can retain NOTE, reviewed Discovery and intention revision semantics, then reconcile through the existing capture validator. This does not provide an offline replica of every live command. Phone/LAN hosting is not enabled: AD-015's loopback boundary is retained, and physical phone/secure-origin deployment verification remains a separate release gate. Clearing browser storage can remove unsent reports; export pending reports before clearing it.

P7 controlled migration was explicitly authorized by the user's follow-up. The selected source is backend/data/pist_data.json (SHA-256 4ff1cb9dafa5420e2301342c5346cc75969267cb449b8de4788d9ee5c5394bfe): one Thing, two Nodes, one Session, one Entry and 13 audit/event records. Older human_drift candidates lack the event history and were not selected. Preview found no relationship/time defects or unknown top-level fields. The migration was rehearsed on a private copy, verified field by field, checked for idempotent reapplication and exercised through a synthetic confirmed capture on that copy before applying to the stopped live backend.

The live schema-2 migration is additive. Original bytes and the prior backup, plus source/configuration for rollback, are preserved privately under .private/p6-p7/rollback; the built-in migration-source snapshot retains the source hash. No original actor, intention or reported history was rewritten. Custody/defaulted fields are labeled as migration provenance; unknown historical intention/Condition remains unknown. No synthetic test Session was inserted into the real dataset. Baseline verification now verifies the reviewed transition, immutable snapshots, lineage and original evidence while allowing legitimate new captures.

P7 technical migration and handoff are verified; ordinary-work observation remains OPEN. The proposed week of real use cannot be replaced by automated tests or elapsed calendar time. Record failures, missing/duplicate evidence, provenance clarity, discrepancies and friction in the authoritative Vault’s 04 - Development/Controlled Usage Log.md. Completion requires actual observations and review. P6 phone deployment and a universal offline live-command workflow are not claimed.

Combined acceptance: all 6 E2E workflows passed, including English/Persian llama3.2:3b inference, live/retrospective semantics, correction and switching, export, branding, disconnected reload/reconnect, persistent exactly-once retry after restart, rejected/auth-failed record retention and owner isolation. Full QA passed type checking, 26 regressions, production builds, 2 startup/restart checks, 2 API integration scenarios and baseline preservation. Private real-data-copy migration/capture checks passed. The final live-backend probe verified schema 2, authenticated readiness and actual local inference without changing real data bytes. A temporary authenticated browser also showed the correct owner and Ollama [llama3.2:3b] without creating records. These checks establish the declared desktop scope, not an ordinary-use or physical-phone certification.

Current verification: the authoritative Vault’s 04 - Development/P6–P7 Verification.md. Earlier no-migration statements describe the historical pre-P7 batches.
