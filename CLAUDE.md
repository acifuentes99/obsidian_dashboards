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

## QuickAdd

Third mirrored folder: `quickadd-scripts/` → vault `Z. Meta/js-scripts/`
(added to the `sync-to-vault.sh` mapping table alongside Datacore's two).

[QuickAdd](https://github.com/chhoumann/quickadd) is an Obsidian plugin for
user-defined macros/commands; its "User Script" macro type runs a plain
Node-style JS file with `{ app, quickAddApi, ... }` injected. Right now this
repo only uses that capability for **trigger scripts**: code that registers
an `app.metadataCache.on("changed", ...)` listener (via a QuickAdd startup
macro) to react when a note's frontmatter property changes — e.g.
`status-date-sync.js` stamps `doneDate`/`coldDate`/`archivedDate` on
`type/project` notes when `status` flips to `done`/`coldtask`/`archive`.
`status-date-backfill.js` is a one-off QuickAdd command (not a trigger) that
applies the same stamping retroactively to existing notes. No Templater
scripts exist in this repo yet.

Same workflow as Datacore: edit the `.js` file here, `npm run sync` to copy
it into the vault's QuickAdd user-scripts folder, then re-run/re-attach the
macro in Obsidian to pick up changes — there's no unit-test harness for
these yet since they depend on live `app` events.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (acifuentes99/obsidian_dashboards), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (root `GLOSSARY.md` + `docs/adr/`, created lazily when needed). See `docs/agents/domain.md`.
