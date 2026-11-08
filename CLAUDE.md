## Project tracking

This repo's progress is tracked in the vault, not here:

- Project note: `A. PARA Notes/Projects/Obsidian Dashboards 1st iteration Project.md`
- Area note: `A. PARA Notes/Areas/Obsidian Dashboards Area Note.md` (the project's
  `area` frontmatter links here; the Area note can accumulate other, future
  projects in this same space)

At session start, read the project note's `> [!info] About / Definition links`
callout for context. Log session summaries under its `## Notes and Journal`
section (or the linked journal note), per the global session-tracking
convention.

## Datacore

This repo is a git-tracked mirror of two folders from Andrew's Obsidian vault
(`/home/andrew/Documents/GoogleDrive/Notes`, not itself a git repo):

- `C. Dashboards/` → vault `C. Dashboards/`
- `datacore/` → vault `Z. Meta/datacore/`

[Datacore](https://github.com/blacksmithgu/datacore) is an Obsidian plugin (a
performance-focused reimagining of Dataview) that renders `datacorejsx` code
blocks as Preact components (JSX compiles to `h(...)` calls, not React —
see `dc` codeblock API below) with a live-updating query index. Dashboards under
`C. Dashboards/Main/` embed `datacorejsx` blocks directly in the note; reusable
`.jsx` sources (shared components/utilities, loaded via `dc.require("Z. Meta/datacore/...")`
— note the vault-rooted path, even though this repo's local folder is just `datacore/`)
live in `datacore/`.

Local checkout of the Datacore plugin source + docs: `/home/andrew/Downloads/datacore_obsidian/datacore`.
Authoritative API docs: `/home/andrew/Downloads/datacore_obsidian/datacore/docs/docs/` (also published at
https://blacksmithgu.github.io/datacore/). Consult these when unsure about the `dc` API rather than guessing.

### Workflow: edit → sync → test

1. **Edit** dashboards (`C. Dashboards/Main/*.md`, the `datacorejsx` blocks inside them)
   and shared components (`datacore/*.jsx`, `datacore/utils/*.js`) in this repo.
2. **Unit-test without Obsidian**: `npm test` runs Vitest against `test/datacore/`.
   The harness transpiles a block's source with `sucrase` (the same transpiler
   Datacore uses, same `h`/`Fragment` pragma) and renders it with
   `@testing-library/preact` against a hand-written mock `dc`
   (`test/datacore/createMockDc.js`) and mock `app`
   (`test/datacore/createMockApp.js`) fed with fixture pages — no vault, no
   Obsidian. See `test/datacore/projects-dashboard.test.js` for a worked
   example against `C. Dashboards/Main/Projects.md`. This only catches
   component-logic bugs (filtering, sorting, click handlers); it can't
   validate the real query language or live index.
3. **Sync to the vault**: `npm run sync` (`scripts/sync-to-vault.sh`) copies
   `C. Dashboards/` → vault `C. Dashboards/` and `datacore/` → vault
   `Z. Meta/datacore/` via `rsync`. One-way (repo → vault) and additive by
   default — it always shows a dry-run preview and asks for confirmation; pass
   `--delete` to also prune vault files removed from the repo, `--yes` to skip
   the prompt. Override the vault path with `DATACORE_VAULT_ROOT`.
4. **Smoke test in Obsidian**: open the synced note in the app. `datacorejsx`
   blocks only render inside Obsidian's plugin runtime, so this manual step
   is the final check the unit tests can't replace — especially for the real
   query language, the live index, and visual/layout correctness.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (acifuentes99/obsidian_dashboards), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (root `GLOSSARY.md` + `docs/adr/`, created lazily when needed). See `docs/agents/domain.md`.
