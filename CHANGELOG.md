# Changelog

Versions describe delivered behavior. Planned work lives in `docs/ROADMAP.md`.

## 2026-11-14 — Context beta vertical slice

- Shipped the browser-first Context beta on `feat/first-context-beta` (`c797c13`, tag `v0.1.0-context-beta`).
- Added resumable onboarding, local Markdown/folder/ZIP import, source preservation, frontmatter/wikilink/tag parsing, note search, backlinks, privacy selection, public projection preview, private export, context-pack budgeting and 2D/optional 3D graph views.
- Added a neutral authentication/Worker boundary without claiming cloud note sync or production account recovery.
- Added privacy regression checks and release-gate documentation that keeps user content out of source control.
- Recorded the repeatable `handoff` protocol in `HANDOFF.md` and `MEMORY.md`.

## Unreleased

- New generic context product; no personal knowledge, media or source Git history.
- Durable product memory, agent operating rules and current handoff.
- Audited 2D/3D layered graph rendering foundation.

## 2026-11-22 — security & polish
- Worker `/api/auth/*` request cap now measured on the bytes actually read, so a chunked body without `Content-Length` is also rejected over 16 KB (was header-trusting only).
- Sharing preview pluralizes correctly ("1 note", "1 link").
