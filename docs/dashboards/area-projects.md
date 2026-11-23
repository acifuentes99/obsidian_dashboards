# Area Projects

A "Projects" section embeddable in any Area note, showing the projects
related to that area: a status-count badge row, and a table sorted by how
soon each project's `target` date is, with a "days until target" column.

```datacorejsx
const AreaProjects = await dc.require("Z. Meta/datacore/areaProjects.jsx");
return function View() {
    return <AreaProjects />;
}
```

## How a project is "related to" an area

A project belongs to an area via its own `area` frontmatter field (a
`[[Wikilink]]` to the Area note — already in use on at least one real
project note; see the "Obsidian Dashboards 1st iteration Project" note).
`datacore/utils/areaProjects.js`'s `matchesArea` accepts either shape
Datacore might hand back for that field: a plain `[[Wikilink]]` /
`[[Wikilink|Alias]]` string (matched by name, alias ignored) or a
Datacore-parsed `Link` object (matched by `.path`), and either a single
value or an array of them (a project with more than one area).

This was chosen over Datacore's `connected([[...]])` query predicate (used
by `projectNotes.jsx` for a different purpose) because `connected` matches
*any* link relationship with the area note, including a stray mention in a
project's body — `area` is a dedicated field, so matching it directly is
the precise relationship this section means to show.

## Status buckets

Reuses the same five buckets Projects.md shows, via a dedicated
`categorizeProject` in `datacore/utils/areaProjects.js` rather than
Projects.md's inline logic (see the "Project status bucket" glossary entry
for why: priority-ordered and mutually exclusive, which Projects.md's
version isn't quite). The badge row always shows all five counts, in fixed
order (Active, Cold Tasks, Backlog, Archived, Done), each colored with one
of `creationTimeline.jsx`'s 8 dataviz-skill-validated categorical hues (not
re-derived here — see that file and
`docs/dashboards/note-tags-creation-timeline.md` for the palette's
validation).

## Target date and "days until target"

A new optional `target` frontmatter field on project notes (a date) — not
used anywhere else in this repo yet. `daysUntilTarget` (whole days, rounded
up, negative once past) and `formatDaysUntil` turn it into "in Nd" / "Due
today" / "Nd overdue" / "—" (no target set). The table sorts by this
ascending, with no-target projects always last regardless of direction —
done via a key function mapping a missing target to `Infinity`, the same
`DataArray`-style `.sort(key, direction)` Projects.md already uses (not a
native comparator — DataArray's own `.sort()` has a different signature,
and silently misinterprets a comparator function as a key function instead;
see this dashboard's test suite for the regression that caught it).
Overdue rows render in `var(--color-red)`, due within a week in
`var(--color-orange)`, further out or unset left unstyled/muted.

Only `active`/`backlog`/`coldtask` projects show in the table by default —
`done`/`archived` ones are typically no longer working toward their target —
behind a "Show done/archived" toggle.

## Adding this to an Area note

Area notes aren't part of this repo (they live in the vault's `A. PARA
Notes/Areas/`, not one of the three folders this repo mirrors), so this
section can't be baked into a git-tracked template here. Instead,
`quickadd-scripts/insert-area-projects-dashboard.js` is a one-off QuickAdd
command (same shape as `status-date-backfill.js`) that appends the block
above to the active note, if it's tagged `type/area` and doesn't already
have it. Wire it as a macro step after "From Template: Area" so every new
Area note gets it automatically, and run it manually once per existing Area
note to backfill.

## Testing

- `test/datacore/area-projects-utils.test.js` — `categorizeProject`'s
  priority/exclusivity (including the inconsistent-frontmatter case),
  `matchesArea` against every frontmatter shape above, and
  `daysUntilTarget`/`formatDaysUntil` across future/past/today/missing.
- `test/datacore/area-projects.test.js` — filtering to only the current
  area's projects, the five count badges, the done/archived toggle, target-
  date sort order (including the `Infinity`-key regression above), and
  overdue vs. upcoming formatting.
