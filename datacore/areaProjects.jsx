// Area dashboard "Projects" section: every project whose `area` frontmatter
// points at this Area note, a status-count badge row, and a table sorted by
// `target` frontmatter date (soonest first) with a "days until target"
// column. See docs/dashboards/area-projects.md.
//
// Paste the whole block below into an Area note (or let
// insert-area-projects-dashboard.js do it) — datacorejsx blocks must
// `return` a component, so a bare `<AreaProjects />` expression with no
// `return` silently renders nothing. Worse, don't end a block with a
// same-line trailing `//` comment: Datacore appends its own closing syntax
// right after your code with no newline in between, so a trailing comment
// swallows it too, producing a "Unexpected end of input" SyntaxError
// instead of just rendering nothing.
//
//   const AreaProjects = await dc.require("Z. Meta/datacore/areaProjects.jsx");
//   return function View() {
//       return <AreaProjects />;   // pass area={someFile} to target another note
//   }

const { STATUS_BUCKETS, BUCKET_COLOR, categorizeProject, matchesArea, daysUntilTarget, formatDaysUntil } =
    await dc.require("Z. Meta/datacore/utils/areaProjects.js");
// `timestamp` frontmatter is inconsistently typed across the vault (ISO vs.
// a bare YYYYMMDDHHmm integer, see docs/dashboards/note-tags-creation-timeline.md)
// — reuse commons.js's existing coercion rather than a 4th copy of it
// (Projects.md, the Note/Tags dashboard, and commons.js itself already have one).
const { getTimestamp } = await dc.require("Z. Meta/datacore/utils/commons.js");
const AreaProjectsTimeline = await dc.require("Z. Meta/datacore/areaProjectsTimeline.jsx");

const BUCKET_LABEL = Object.fromEntries(STATUS_BUCKETS.map((b) => [b.id, b.label]));

const S = {
    stats: { display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0.5rem 0" },
    badge: { padding: "0.15rem 0.6rem", borderRadius: "999px", fontSize: "0.8rem", color: "#fff", whiteSpace: "nowrap" },
    nowrap: { whiteSpace: "nowrap" },
    btn: { fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "4px", cursor: "pointer", border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", color: "var(--text-normal)", marginTop: "0.5rem" },
};

function targetStyle(days) {
    if (days == null) return { ...S.nowrap, color: "var(--text-muted)" };
    if (days < 0) return { ...S.nowrap, color: "var(--color-red)", fontWeight: 600 };
    if (days <= 7) return { ...S.nowrap, color: "var(--color-orange)" };
    return S.nowrap;
}

const fmtDate = (ts) => (ts ? ts.toFormat("LLL dd yyyy") : "—");

return function AreaProjects({ area: areaProp } = {}) {
    const isDarkTheme = typeof document !== "undefined" && document.body.classList.contains("theme-dark");
    const colorFor = (bucketId) => {
        const slot = BUCKET_COLOR[bucketId];
        return isDarkTheme ? slot.dark : slot.light;
    };

    const currentFile = dc.useCurrentFile({ debounce: 10000 });
    const areaFile = areaProp ?? currentFile;
    const [showResolved, setShowResolved] = dc.useState(false);

    const allProjects = dc.useQuery("@page and #type/project", { debounce: 2500 });

    const projects = dc.useArray(allProjects, (arr) =>
        arr
            .filter((p) => matchesArea(p.$frontmatter?.area?.value, areaFile))
            .map((p) => {
                const status = p.$frontmatter?.status?.value;
                const tags = p.$tags ?? [];
                const bucket = categorizeProject({ status, tags });
                const target = dc.coerce.date(p.$frontmatter?.target?.value);
                const daysUntil = daysUntilTarget(p.$frontmatter?.target?.value);
                const created = getTimestamp(dc, p);
                // The timeline's bar end: whichever resolved date applies —
                // `target` for anything still open, else whenever the project
                // actually finished/stopped. `null` (none set) means "still
                // open", which areaProjectsTimeline.jsx draws through to today.
                const doneDate = dc.coerce.date(p.$frontmatter?.doneDate?.value);
                const archivedDate = dc.coerce.date(p.$frontmatter?.archivedDate?.value);
                const coldDate = dc.coerce.date(p.$frontmatter?.coldDate?.value);
                const end = target ?? doneDate ?? archivedDate ?? coldDate ?? null;
                return { link: p.$link, path: p.$path, name: p.$name ?? p.$path, bucket, daysUntil, created, end };
            }),
        [areaFile?.$path]
    );

    const counts = dc.useMemo(() => {
        const c = Object.fromEntries(STATUS_BUCKETS.map((b) => [b.id, 0]));
        projects.forEach((p) => { c[p.bucket] = (c[p.bucket] ?? 0) + 1; });
        return c;
    }, [projects]);

    // `projects` is a DataArray (see dc.useArray above), whose `.sort()` takes
    // a key function + "asc"/"desc" (DataArray's own API — not a native
    // comparator; see Projects.md for the same convention). `?? Infinity`
    // pushes no-target projects to the end regardless of direction.
    const rows = dc.useMemo(
        () => projects
            .filter((p) => showResolved || (p.bucket !== "done" && p.bucket !== "archived"))
            .sort((p) => p.daysUntil ?? Infinity, "asc"),
        [projects, showResolved]
    );

    const COLUMNS = [
        { id: "Project", value: (r) => r.link },
        { id: "Status", value: (r) => BUCKET_LABEL[r.bucket], render: (v) => <span style={S.nowrap}>{v}</span> },
        { id: "Created", value: (r) => fmtDate(r.created), render: (v) => <span style={S.nowrap}>{v}</span> },
        { id: "Target", value: (r) => formatDaysUntil(r.daysUntil), render: (v, r) => <span style={targetStyle(r.daysUntil)}>{v}</span> },
    ];

    return (
        <div>
            <div style={S.stats}>
                {STATUS_BUCKETS.map((b) => (
                    <span key={b.id} style={{ ...S.badge, background: colorFor(b.id) }}>
                        {b.label}: {counts[b.id] ?? 0}
                    </span>
                ))}
            </div>
            <AreaProjectsTimeline rows={projects} />
            {rows.length === 0
                ? <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No related projects.</p>
                : <dc.Table class="no-hover" rows={rows} columns={COLUMNS} paging={20} />}
            <button style={S.btn} onClick={() => setShowResolved((v) => !v)}>
                {showResolved ? "Hide done/archived" : "Show done/archived"}
            </button>
        </div>
    );
};
