# Product memory

## Purpose

Context helps anyone turn their own notes into a connected personal context base. This is the organize/retrieve step after Quick Capture and before selective sharing to IdeaMap. It is both a usable web product and a reusable GitHub template.

## Durable decisions — 2026-11-13

- Repository: `context-repo`; UI name: **Context**.
- Start with fresh Git history. Reuse only audited rendering algorithms; no original owner's content, assets, rules, identity or context. All demo notes are newly written fictional examples.
- Web first. Consistent quiet neutral surfaces, warm coral primary actions, shared typography/spacing/components. Reuse the layered graph engine with 2D and optional lazy-loaded 3D.
- First use: account or explicit local workspace → space name → source/import → inspect result → privacy → workspace. Onboarding is resumable and can be reopened.
- Obsidian import is a local browser operation. Support Markdown/folders/ZIP, frontmatter, wikilinks and tags. Preserve original Markdown and show unresolved links. Do not mutate the source vault.
- Account data and private note storage are distinct. Authentication uses a maintained auth library on a dedicated database; note bodies are local to a browser/account workspace in v0.1. No claim of cloud note sync.
- Privacy is per note, defaults private even if an imported note says public. Public projection is an explicit allowlist and omits private metadata. IdeaMap drafts require another deliberate click; saving/publication remains at IdeaMap.
- No automatic LLM calls or embedding bill. v0.1 organization comes from existing folders, tags and explicit links. AI filing with user-controlled providers is a future connector.
- User content never belongs in source control. Template export produces a separate private-ready context folder; publication remains a separate owner decision.
- Public release is authorized for this generic product, not for any adjacent personal repository. Deployment, CI, source and browser evidence are separate.

## Decision — 2026-11-16

- IdeaMap embeds Context's importer, workspace, sharing transform and graph engine as its own "My context" page (owner's choice, IdeaMap ADR-0016). This repository stays canonical for that code and keeps its standalone app; IdeaMap copies tagged releases and must not fork the logic.
- Shared-text redaction fails closed: only `http`, `https`, `mailto` and `#anchor` destinations are kept as written.

## Record decisions here

Keep product decisions and why they matter. Put session state in `HANDOFF.md`, delivered changes in `CHANGELOG.md`, future work in `docs/ROADMAP.md`, and dated execution evidence in `docs/WORKLOG.md`.

## Handoff operating decision — 2026-11-14

- The owner's word `handoff` is a durable stop-point request: consolidate the current evidence into `HANDOFF.md`, `CHANGELOG.md`, `docs/WORKLOG.md` and a private cross-repository handoff artifact when needed.
- A handoff must include confirmed branch/commit/worktree state, completed behavior, exact validation commands and results, preview/deployment boundary, blockers, next executable commands and rollback point.
- A handoff is not a transcript and must not contain credentials, private note bodies, personal filesystem paths, raw usage records or imported user data. Separate repository facts from proposals and unverified claims.

## Sharing and merging — 2026-11-16

- Shared text names only notes the owner selected. Links to anything else become `[private note]`, aliases are kept, embeds are removed, and excerpts are computed after redaction. Unresolved or ambiguous links count as unselected.
- Exported tags are only tags the author wrote (frontmatter and inline). Folder names organize the private workspace and never leave it.
- Merge commits on shared branches are made locally under the neutral identity and pushed. GitHub's merge button adds the merging account's name and a GitHub committer, which the all-ref identity check rejects.
