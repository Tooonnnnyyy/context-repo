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

### 2026-11-22 — security & polish (neutral identity)
- Fixed Worker 16 KB cap to enforce on actual body bytes (chunked-body bypass closed); still not deployed.
- Fixed sharing preview pluralization ("1 notes" → "1 note").
- `npm run check` green: privacy 48 files, 10/10 tests, Vite build. No deployment.

### 2026-11-22 — google auth + email verification (neutral identity)
- account.accountLinking.requireLocalEmailVerified (fails closed): Google links only verified local emails.
- Email verification opt-in via RESEND_API_KEY + EMAIL_FROM (Resend REST); sendOnSignUp; no key = current behavior.
- Fixed two latent type errors in worker auth config (removed non-existent `scopes` and `autoSignInAfterVerification`).
- `npm run check` green: privacy 48 files, 10/10 tests, build. Worker not deployed.
