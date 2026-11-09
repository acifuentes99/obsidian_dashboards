# Obsidian Dashboards

Git-tracked source for a set of [Datacore](https://github.com/blacksmithgu/datacore)
dashboards and [QuickAdd](https://github.com/chhoumann/quickadd) scripts used in an
Obsidian vault. The vault itself is not a git repo — this repo mirrors just the
three folders below, and `npm run sync` copies them over.

| This repo          | Vault path                 |
| ------------------- | --------------------------- |
| `C. Dashboards/`   | `C. Dashboards/`            |
| `datacore/`         | `Z. Meta/datacore/`         |
| `quickadd-scripts/` | `Z. Meta/js-scripts/`       |

## Requirements

- An Obsidian vault with the **Datacore** and **QuickAdd** community plugins
  installed and enabled.
- Node.js (for running tests and the sync script). Check `package.json` for
  the dependency versions in use.

## Install (first time)

1. Clone this repo somewhere outside the vault:

   ```
   git clone https://github.com/acifuentes99/obsidian_dashboards.git
   cd obsidian_dashboards
   npm install
   ```

2. Copy the dashboards and scripts into your vault:

   ```
   npm run sync
   ```

   This runs `scripts/sync-to-vault.sh`, which `rsync`s the three folders
   above into your vault. It defaults to the vault at
   `/home/andrew/Documents/GoogleDrive/Notes`; point it elsewhere with:

   ```
   DATACORE_VAULT_ROOT="/path/to/your/vault" npm run sync
   ```

   It always shows a dry-run preview first and asks for confirmation. It's
   additive by default (only adds/updates files); pass `--delete` to also
   remove vault files that no longer exist in the repo, and `--yes` to skip
   the confirmation prompt:

   ```
   npm run sync -- --delete --yes
   ```

3. In Obsidian, open one of the synced notes under `C. Dashboards/Main/`
   (e.g. `Projects.md`) to confirm the `datacorejsx` blocks render.

4. For the QuickAdd trigger scripts to run, open QuickAdd's settings, add/edit
   the relevant macro(s) as **User Script** actions pointing at the synced
   files under `Z. Meta/js-scripts/`, and make sure the trigger macros
   (`status-date-sync.js`) are attached to a startup macro so they register
   their `metadataCache` listener on vault load.

## Updating after a pull

Whenever this repo changes, re-sync to pick up the changes in the vault:

```
git pull
npm run sync
```

## Development

- `npm test` — runs the Vitest suite against `test/datacore/`, which
  exercises dashboard component logic (filtering, sorting, click handlers)
  against a mocked `dc`/`app`, without needing Obsidian or a real vault.
- `npm run test:watch` — same, in watch mode.

See `CLAUDE.md` for the full edit → sync → test workflow and the Datacore/
QuickAdd architecture notes, and `docs/` for per-dashboard behavior docs.
