# Current handoff

Updated: 2026-11-23. Read `AGENTS.md` first. This file is current state, not a transcript.

## State

- `main` on GitHub holds the beta and v0.1.1: PR #1 (beta vertical slice, merge `a68fa01`) and PR #2 (sharing fixes, merge commit tagged `v0.1.1-context-beta`) and PR #3 (link redaction hardening, tagged `v0.1.2-context-beta`). Both were merged locally with `--no-ff` under the neutral identity, so GitHub shows them as merged without GitHub-made commits.
- Tags on GitHub: `v0.0.0-foundation` (`d225fa3`), `v0.1.0-context-beta` (`c797c13`), `v0.1.1-context-beta` (PR #2's merge commit), `v0.1.2-context-beta` (PR #3's merge commit).
- IdeaMap now embeds a pinned copy of the importer, workspace, sharing and graph code from `v0.1.2-context-beta` as its "My context" page (IdeaMap's ADR-0016). This repository stays canonical for that code: fix bugs here first, then IdeaMap re-copies a tagged release.
- What v0.1.1 changes:
  - Shared text (public projection title, body and summary; IdeaMap draft) names only selected notes. `[[Target|Alias]]` becomes `Alias`. `[[Target]]`, `[[Target#Heading]]` and local `[text](Target.md)` links keep the target's name only when it resolves to a selected note; otherwise they become `[private note]` (the `privateLabel` option), as do `obsidian:` and `file:` links. Embeds and local Markdown images are removed. Summaries are computed after redaction. Unresolved and ambiguous links count as unselected.
  - Exported tags are only the author's explicit tags (frontmatter `tags` + inline `#tags`), read from the original Markdown. Folder-derived topics stay in the private workspace UI.
  - The 3D graph renders into its own canvas. The shared canvas already holds the 2D context, so WebGL never started there and 3D always fell back to 2D. 2D rendering and reduced-motion behavior are unchanged.
  - IdeaMap draft links use `VITE_IDEAMAP_ORIGIN` (fallback `https://ideamap-nine.vercel.app`), keep `from=context-repo`, drop a first `# Title` line that repeats the title, and cap the full encoded URL at 7,500 characters by trimming the body and appending a truncation notice.
- PR #4 (security & polish, merged 2026-11-23): Worker `/api/auth/*` 16 KB cap now measured on the bytes actually read (chunked bodies without `Content-Length` are also rejected); sharing preview pluralizes "1 note / 1 link"; Google sign-in links to an existing account only when its email is verified (`account.accountLinking.requireLocalEmailVerified`, fails closed — closes the pre-hijacking gap); email verification is opt-in (when `RESEND_API_KEY` + `EMAIL_FROM` are set on the Worker, password sign-up requires verification and sends a Resend email).
- No deployment, account service, cloud note sync or IdeaMap connection is claimed.

## Doing

- Nothing in flight in this repository.
- Keeping the generic Context product separate from Quick Capture, IdeaMap and any personal data.

## Next

1. Read `AGENTS.md`, `MEMORY.md`, this file, `docs/ROADMAP.md`, `CHANGELOG.md` and the latest `docs/WORKLOG.md` entry. Recheck `git status --short --branch`, `git log -5 --oneline` and `git ls-remote origin`.
2. Merge PRs with a local `git merge --no-ff` under the neutral identity and push `main` (GitHub marks the PR merged). A GitHub-made merge commit carries the merging account's name and a GitHub committer, which `scripts/check-privacy.mjs` rejects for every later check.
3. When sharing or graph code changes here, tag a release and tell IdeaMap to re-copy it (IdeaMap ADR-0016).
4. The smallest approved slice: account recovery/operational email, explicit local-vs-account copy, and release/deployment instructions. IdeaMap sync remains a later opt-in integration.

## Open issues

- Before any deployment of the Worker: (1) its 16 KB request cap trusts `Content-Length`, so a chunked body without that header is not capped; enforce the limit on the bytes actually read. (2) Email/password sign-up does not require email verification while Google sign-in can link an existing account by email, which allows account pre-hijacking; require verification, or disable implicit linking for unverified accounts. Both were flagged by an automated security review on 2026-11-16; the Worker is not deployed.
- In the default 3D view the core label ("Example workspace") overlaps the "Learning" topic label. This is existing label-collision behavior, visible now that 3D renders; not fixed.
- The sharing preview reads "1 notes" for a single note (pluralization); not fixed.
- Shared text still keeps Obsidian `%% comments %%` as written, and a note with malformed frontmatter shares that frontmatter as body text. Plain-prose mentions of an unselected note's title (not a link, not a path) are the author's own words and are not redacted; the preview shows them. The context pack is a private artifact that includes every note and its path; it is not redacted.
- `ideaMapOrigin()` reads `import.meta.env` (Vite). Another bundler gets the public fallback unless it passes `origin`.
- Account recovery, operational email and cloud note storage are not complete. No GitHub Issues or milestones exist yet for the workstreams.

## Evidence

- Beta `58ec774`: `npm ci && npm run check` passed on 2026-11-16 — privacy scan (48 source files, built assets, neutral identities on all refs), 10/10 tests, TypeScript and Vite production build.
- `fix/sharing-privacy`: `npm run check` passed on 2026-11-16 — privacy scan (50 source files), 24/24 tests (including nested, escaped, reference, HTML and bare-link bypass cases), TypeScript and Vite production build.
- The new tests fail on the beta code: the 3D test reports that the shared 2D canvas was asked for WebGL; the old projection named an unselected note and exported a folder name as a tag; the old draft rejected a 5,001-character note.
- A Vite build with `VITE_IDEAMAP_ORIGIN` set inlines that origin; without it the public fallback is used.
- Browser check of local `vite preview` builds of `58ec774` and `1a94a83` (127.0.0.1, browser with WebGL2), example workspace: the beta fell back to 2D when 3D was chosen ("Your graph is shown in 2D on this device."). The fix rendered 3D (stage `data-mode=3d`, `data-ready=true`, a separate three.js canvas between the 2D canvas and the node layer, live WebGL2 context, 21 nodes, no fallback message); switching back to 2D left one canvas drawing in 2D, and 3D worked again. The sharing preview of "Neighborhood seed library" showed both unselected links as `[private note]` and tags `Projects · Community`.
- Reduced-motion code paths were not changed. This is local evidence only; nothing was deployed.

## Handoff protocol

When the owner says `handoff`, update this file, `CHANGELOG.md`, `MEMORY.md` and `docs/WORKLOG.md` before stopping. Record the date, branch, commit, worktree status, completed behavior, exact checks, preview/deployment evidence, blockers, next commands and rollback point. Keep confirmed facts separate from proposals and unverified claims. Never include credentials, private note bodies, personal paths, raw usage logs or imported user data.

## Rollback

- v0.1.1 sharing fixes: revert main's merge commit for `fix/sharing-privacy`, or deploy tag `v0.1.0-context-beta` in a separate checkout.
- Functional rollback point: tag `v0.1.0-context-beta` at `c797c13`.
- Foundation rollback point: tag `v0.0.0-foundation` at `d225fa3`.
- Use a reviewed revert or deploy a previous tag in a separate checkout. Never reset a shared branch, force-push or delete user data.
