# Changelog

Versions describe delivered behavior. Planned work lives in `docs/ROADMAP.md`.

## Unreleased

- Nothing yet.

## 2026-11-16 — v0.1.2 · Link redaction hardening

- An escaped bracket counts only after an odd run of backslashes, so `\\[text](path)` (a literal backslash, then a link) is redacted.
- Link reference definitions inside blockquotes and list items are found and redacted with their uses.
- Labels of kept links (web links, images, shared notes) are redacted too, so a private link nested in a web link's label no longer survives.
- `srcset` is checked candidate by candidate; one private image path removes the tag.
- An `<a href>` to a private target that never closes is replaced up to the end of its line.
- An unclosed `[[` stays as text instead of being dropped, so nested Markdown links keep their structure.
- Regression tests for each case (25/25), and a 20,000-case random fuzz run outside the repository found no private name or path in shared output.

## 2026-11-16 — v0.1.1 · Sharing privacy fixes, 3D canvas, draft link cap

Branch `fix/sharing-privacy`; to be tagged `v0.1.1-context-beta` on main's merge commit.

- Shared text no longer names notes outside the selection. In the public projection (title, body, summary) and the IdeaMap draft, `[[Target|Alias]]` becomes `Alias`; `[[Target]]`, `[[Target#Heading]]` and local `[text](Target.md)` links keep the target's name only when it resolves to a selected note and otherwise become `[private note]` (configurable `privateLabel`), as do `obsidian:` and `file:` links. Embeds and local Markdown images are removed, unresolved and ambiguous links count as unselected, and summaries are computed after redaction.
- Exported tags are only the author's explicit tags (frontmatter and inline `#tags`). Folder names no longer leave the workspace as tags; they remain topics inside the private UI.
- The 3D graph now renders. It draws into its own canvas because the shared canvas already holds the 2D context. 2D and reduced-motion behavior are unchanged.
- IdeaMap draft links read `VITE_IDEAMAP_ORIGIN` (fallback `https://ideamap-nine.vercel.app`), keep `from=context-repo`, drop a first heading that repeats the title, and trim long bodies with a truncation notice so the full URL stays within 7,500 characters. Long notes are no longer rejected.
- Private note excerpts show a link's alias instead of alias and target run together, and keep Markdown link text without its URL.
- The sharing preview's projection is computed only while the preview is open, and repeated links between two selected notes are listed once.
- Link redaction fails closed. Only `http`, `https`, `mailto` and `#anchor` destinations stay as written; any other scheme (`obsidian:`, `file:`, app links, protocol-relative) and any local path that is not a selected note becomes `[private note]`, in Markdown links, images, reference definitions and their uses, autolinks, bare URLs and HTML `href`/`src`. Wikilinks are matched with nested brackets (`[[a|[[Private]]]]`), Markdown destinations with escapes and balanced parentheses, and vault paths of unselected notes are replaced wherever they still appear.
- Regression tests: `tests/sharing.test.ts`, `tests/graph-3d.test.ts`.

## 2026-11-14 — v0.1.0 · Context beta vertical slice

- Shipped the browser-first Context beta on `feat/first-context-beta` (`c797c13`, tag `v0.1.0-context-beta`).
- Added resumable onboarding, local Markdown/folder/ZIP import, source preservation, frontmatter/wikilink/tag parsing, note search, backlinks, privacy selection, public projection preview, private export, context-pack budgeting and 2D/optional 3D graph views.
- Added a neutral authentication/Worker boundary without claiming cloud note sync or production account recovery.
- Added privacy regression checks and release-gate documentation that keeps user content out of source control.
- Recorded the repeatable `handoff` protocol in `HANDOFF.md` and `MEMORY.md`.

## 2026-11-13 — v0.0.0 · Foundation

Tag `v0.0.0-foundation` (`d225fa3`).

- New generic context product; no personal knowledge, media or source Git history.
- Durable product memory, agent operating rules and current handoff.
- Audited 2D/3D layered graph rendering foundation.
