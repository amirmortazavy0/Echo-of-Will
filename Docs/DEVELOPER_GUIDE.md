# Echo of Will — Developer Guide

Updated 2026-10-12. P0–P3 implementation handoff. The authoritative vault is E:\Obsidian Vaults\Echo of Will; repository source and executed tests establish actual implementation. Read its Work Mode Master Prompt, Glossary, Domain Model, Architecture Decisions, Data Model Spec, Event Schema and Development Roadmap before domain changes. Repository Docs contains this engineering guide; removed duplicate vault folders are not recreated.

## Scope and runtime

See [README](../README.md) for setup and checks. The inspected stack is React/TypeScript, Express and local JSON. Journey remains the wire/storage compatibility name for Thing. Do not physically rename historical records or events as a cleanup.

The scope is one authenticated local owner, loopback-only access, private records and optional local Ollama. Cloud AI and synchronization have been removed. A blank model selects manual mode; local AI failure never enables an external provider. The signing key is generated locally and persists across restarts. Multiple legacy users require deliberate owner selection, with their credential records preserved.

## P1–P3 contracts

- Review and query summaries describe recorded intentions, transitions, reflections and qualified elapsed bounds. They do not infer drift or motivation. User-authored end reasons remain evidence.
- Storage reads are side-effect free. Valid canonical data wins even when empty; validated backup precedes explicit legacy migration. Unknown fields survive, duplicate identities/conflicting aliases fail visibly, and damaged originals remain available. Writes use a lock, revision hash, durable temporary files and atomic rename; history and state commit together.
- New records and Condition snapshots carry stable local owner_id and PRIVATE visibility. Legacy custody defaults are identified by migration_provenance; old event actors are preserved. Migration uses a reviewed source hash, preserved sources and lineage. Original datasets have not been migrated.
- Commands validate references, same-Thing membership, parent cycles without a depth cap, enums, bounded finite numbers and timestamps before mutation. Invalid requests leave storage unchanged. Overlapping reports and out-of-order captures are retained with conflict records.
- Session intention and Thing creation snapshot are immutable. Revisions, corrections, estimates, closures and retrospective amendments append supporting history. New ABANDONED writes are rejected; historical values remain readable.
- Repeating the same closure is a no-op; differing closure returns conflict. POST /api/sessions/:id/amend appends a reasoned amendment for note/reflection/quality/ended_at without changing the original closed Session. Historical entries/revisions require amendment_reason and a claimed timestamp within original bounds.
- Sticky Conditions select by effective entry time, persistent append order for ties, then ID. Revisions and linked switches carry the same snapshot. Missing first-entry dimensions remain UNKNOWN with provenance. Condition changes are entries; snapshots are not independent entities.
- Corrections allow note/node_id/entry_type/logged_at, preserve raw original and previous effective values, and have deterministic sequence ordering and actor attribution. Structured revision/discovery/switch records cannot be casually retyped. Shared effective projections for every view/export remain P5.

intention_provenance distinguishes declared_at_capture, reconstructed and legacy_unknown. Thing creation_snapshot retains initial wording; unknown legacy creation wording is not invented. These fields do not complete P4's original-report/confirmation provenance contract.

## Verification and remaining gates

npm run test:e2e exercises real-browser owner setup, descriptive Review, Thing creation, manual capture, FAIR closure, retrospective capture, reload and restart. npm run test:qa then checks types, regression/recovery fixtures, both builds, startup/API integration and private baseline hashes. See vault 04 - Development/P1–P3 Verification.md for final results.

P4 owns unified mounted capture and complete source/provenance semantics. P5 owns shared corrected views, consistent intervals and complete authenticated exports. P6 owns disconnected-device queue/replay. P7 owns controlled real-data migration and observed use. This repair does not close those release gates.

## Preservation and rollback

Initial source commit: 5f10089806ff3636f117602b2f2e49860da8a13c; repair branch: codex/p0-repeatable-baseline. .private/p0-baseline retains original source bundle and snapshots. .private/p1-p3-baseline preserves the dataset state at the start of this follow-up, including user changes since P0. Neither is public material.

Run node scripts/verify-baseline.mjs to verify snapshots and current repair dataset bytes. Restore into a separate private directory and pair code with its matching snapshot. Preserve subsequent captures separately for reconciliation. Never overwrite new records with an older snapshot. Existing user deletions of duplicate Docs material remain untouched.
