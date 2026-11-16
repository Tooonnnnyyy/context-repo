# Current handoff

Updated: 2026-11-16. Read `AGENTS.md` first. This file is current state, not a transcript.

## State

- `origin/main` on GitHub is still the foundation commit `d225fa3` (tag `v0.0.0-foundation`). Nothing from the beta is on GitHub yet.
- The beta vertical slice is local branch `feat/first-context-beta` at `58ec774` (functional commit `c797c13`, tag `v0.1.0-context-beta`). Pushing it and fixing its privacy leaks through merged PRs was requested through a relayed task, but the push was not permitted in the session that did the work (it needs the owner's approval in that session), so the branch, the tag and both PRs are still pending.
- Sharing fixes for v0.1.1 are on local branch `fix/sharing-privacy`, based on `58ec774`: code and tests in `1a94a83` and `be1fafd`, docs and the version bump (`0.1.1`) in the commit after them. Tag `v0.1.1-context-beta` does not exist yet; it belongs on main's merge commit for this branch.
- What v0.1.1 changes:
  - Shared text (public projection title, body and summary; IdeaMap draft) names only selected notes. `[[Target|Alias]]` becomes `Alias`. `[[Target]]`, `[[Target#Heading]]` and local `[text](Target.md)` links keep the target's name only when it resolves to a selected note; otherwise they become `[private note]` (the `privateLabel` option), as do `obsidian:` and `file:` links. Embeds and local Markdown images are removed. Summaries are computed after redaction. Unresolved and ambiguous links count as unselected.
  - Exported tags are only the author's explicit tags (frontmatter `tags` + inline `#tags`), read from the original Markdown. Folder-derived topics stay in the private workspace UI.
  - The 3D graph renders into its own canvas. The shared canvas already holds the 2D context, so WebGL never started there and 3D always fell back to 2D. 2D rendering and reduced-motion behavior are unchanged.
  - IdeaMap draft links use `VITE_IDEAMAP_ORIGIN` (fallback `https://ideamap-nine.vercel.app`), keep `from=context-repo`, drop a first `# Title` line that repeats the title, and cap the full encoded URL at 7,500 characters by trimming the body and appending a truncation notice.
- No deployment, account service, cloud note sync or IdeaMap connection is claimed.

## Doing

- Waiting for the owner to approve, in the session that runs them, the pushes, the two PRs and the v0.1.1 tag.
- Keeping the generic Context product separate from Quick Capture, IdeaMap and any personal data.

## Next

1. Read `AGENTS.md`, `MEMORY.md`, this file, `docs/ROADMAP.md`, `CHANGELOG.md` and the latest `docs/WORKLOG.md` entry. Recheck `git status --short --branch`, `git log -5 --oneline` and `git ls-remote origin`.
2. With the owner's approval: `git push origin feat/first-context-beta` and `git push origin v0.1.0-context-beta`; open PR "feat: Context beta vertical slice" into `main` with the beta check results.
3. Merge it with a merge commit made under the neutral identity, not GitHub's merge button: `git switch -c main origin/main`, `git merge --no-ff feat/first-context-beta`, inspect `git log --format='%an <%ae> | %cn <%ce>' -3`, then `git push origin main`. GitHub marks the PR merged once its head is on main. A GitHub-made merge commit carries the merging account's name and a GitHub committer, which `scripts/check-privacy.mjs` rejects for every later check.
4. `git push origin fix/sharing-privacy`; open PR "fix: keep private titles and folder names out of shared notes; 3D canvas; draft link cap"; run `npm run check`; merge it the same way; then `git tag -a v0.1.1-context-beta -m 'Sharing privacy fixes, 3D canvas, draft link cap'` on that merge commit and `git push origin v0.1.1-context-beta`.
5. After that, the smallest approved slice: account recovery/operational email, explicit local-vs-account copy, and release/deployment instructions. IdeaMap sync remains a later opt-in integration.

## Open issues

- Pushes, PRs, merges and the v0.1.1 tag are pending (see State).
- In the default 3D view the core label ("Example workspace") overlaps the "Learning" topic label. This is existing label-collision behavior, visible now that 3D renders; not fixed.
- The sharing preview reads "1 notes" for a single note (pluralization); not fixed.
- Shared text still keeps relative links to non-note files (for example `[file](docs/a.pdf)`), raw HTML links and Obsidian `%% comments %%` as written, and a note with malformed frontmatter shares that frontmatter as body text. The context pack is a private artifact that includes every note and its path; it is not redacted.
- `ideaMapOrigin()` reads `import.meta.env` (Vite). Another bundler gets the public fallback unless it passes `origin`.
- Account recovery, operational email and cloud note storage are not complete. No GitHub Issues or milestones exist yet for the workstreams.

## Evidence

- Beta `58ec774`: `npm ci && npm run check` passed on 2026-11-16 — privacy scan (48 source files, built assets, neutral identities on all refs), 10/10 tests, TypeScript and Vite production build.
- `fix/sharing-privacy`: `npm run check` passed on 2026-11-16 — privacy scan (50 source files), 22/22 tests, TypeScript and Vite production build.
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
