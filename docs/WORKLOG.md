# Worklog

## 2026-11-13 · Bootstrap

- Scope authorized: independent public Context product/template with no personal content from its source; consistent UI, signup onboarding, safe handoff and rollback.
- Created a fresh Git repository; preserved the source checkout and recorded a baseline outside this repository.
- Audited and genericized four graph rendering modules only. Nothing else was copied from the personal data tree.
- Established durable documentation and an incremental release plan.
- Validation: initial file inventory inspected. Functional, privacy, CI and deployment checks pending.
- Doing: app shell, local importer, public-projection boundary and real-account deployment.

## 2026-11-14 · Beta checkpoint and handoff protocol

- Confirmed the vertical slice at local branch `feat/first-context-beta`, commit `c797c13`, tag `v0.1.0-context-beta`; worktree was clean before documentation changes.
- Confirmed the product boundary: generic Context beta only; no personal notes, vault data, source history, assets or credentials entered this repository.
- Updated `HANDOFF.md`, `CHANGELOG.md` and `MEMORY.md` with the resumable handoff protocol and the next executable path.
- Validation: `npm run check` passed — privacy scan, 10 tests, TypeScript build and Vite production build. This is local evidence only; no live deployment or production account behavior was claimed.
- Next: owner review, then an explicitly approved release/preview decision; keep IdeaMap sync and personal product-line integrations in later milestones.

## 2026-11-16 · Sharing privacy fixes (v0.1.1)

- Requested scope (relayed task): push the beta and fix its privacy leaks, the 3D bug and the long-note draft cap through merged PRs. No deployment.
- Worked in a separate clone; the original checkout was left untouched. Confirmed `origin/main` = `d225fa3` and remote tag `v0.0.0-foundation` → `d225fa3`.
- Beta `58ec774`: `npm ci && npm run check` passed — privacy scan (48 files), 10/10 tests, TypeScript and Vite build.
- Pushing the beta branch was not permitted in this session, so no branch, tag or PR reached GitHub. The work continued locally on `fix/sharing-privacy` (based on `58ec774`).
- Fixed: shared text redacts links to unselected notes (`[private note]`), removes embeds and recomputes summaries after redaction; exported tags are explicit tags only; the 3D view renders into its own canvas; IdeaMap draft links read `VITE_IDEAMAP_ORIGIN`, drop a repeated title heading and cap the full URL at 7,500 characters.
- Validation: `npm run check` passed — privacy scan (50 files), 22/22 tests, TypeScript and Vite build. The new tests fail on the beta code. A local `vite preview` comparison in a WebGL2 browser showed the beta falling back to 2D and the fix rendering 3D, returning to 2D and rendering 3D again; the sharing preview showed redacted links and explicit tags.
- Seen, not fixed: the 3D core label overlaps the "Learning" topic label; the preview reads "1 notes".
- Next: owner approval for the pushes, PRs (merge commits under the neutral identity) and tag `v0.1.1-context-beta`; commands are in `HANDOFF.md`.

## 2026-11-16 · v0.1.1 merged

- With the owner's approval in the session that ran it: pushed `feat/first-context-beta` and tag `v0.1.0-context-beta`, merged PR #1 (beta) and PR #2 (v0.1.1) into `main` with local `--no-ff` merges under the neutral identity, tagged `v0.1.1-context-beta`.
- Before merging, link redaction was made fail-closed after an automated security review found bypasses (any URL scheme treated as external; nested wikilink aliases; escaped or parenthesised destinations; reference and HTML links). 24/24 tests, privacy scan and build pass.
- IdeaMap embeds a pinned copy of this code as its "My context" page; this repository stays canonical.
