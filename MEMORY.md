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

## Record decisions here

Keep product decisions and why they matter. Put session state in `HANDOFF.md`, delivered changes in `CHANGELOG.md`, future work in `docs/ROADMAP.md`, and dated execution evidence in `docs/WORKLOG.md`.
