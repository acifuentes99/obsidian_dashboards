// Area dashboard "Projects" timeline: one horizontal bar per project, from
// its creation date to its target/done/archived/cold date — or, if none of
// those are set, "ongoing" through today — with a scrollable date window
// and a "today" marker line. Presentational: fed `rows` by
// areaProjects.jsx, which already queries and shapes them (this file does
// no querying of its own). See docs/dashboards/area-projects.md.
//
//   const AreaProjectsTimeline = await dc.require("Z. Meta/datacore/areaProjectsTimeline.jsx");
//   <AreaProjectsTimeline rows={projects} />
//
// Each row: { path, link, name, bucket, created: DateTime|null, end: DateTime|null }
// `end` is the already-resolved target/doneDate/archivedDate/coldDate, or
// `null` for "still open" (the bar then runs through to today). Rows with
// no `created` can't be placed on the axis and are skipped, with a count
// shown below the chart.

const { BUCKET_COLOR, resolveTimelineWindow, barGeometry, todayMarkerPct, TIMELINE_RANGE_PRESETS } =
    await dc.require("Z. Meta/datacore/utils/areaProjects.js");

const S = {
    root: { margin: "0.75rem 0" },
    header: { display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem", flexWrap: "wrap" },
    label: { fontSize: "0.8rem", color: "var(--text-muted)", marginRight: "0.2rem" },
    btn: { fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "4px", cursor: "pointer", border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", color: "var(--text-normal)" },
    btnActive: { background: "var(--interactive-accent)", color: "var(--text-on-accent)", borderColor: "var(--interactive-accent)" },
    rangeLabel: { fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto", whiteSpace: "nowrap" },
    body: { position: "relative" },
    todayLine: { position: "absolute", top: 0, bottom: 0, width: "1px", background: "var(--text-accent)" },
    row: { display: "flex", alignItems: "center", gap: "0.4rem", height: "26px" },
    rowLabel: { width: "160px", flex: "0 0 160px", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    track: { position: "relative", flex: 1, height: "14px", background: "var(--background-modifier-border)", borderRadius: "3px" },
    bar: { position: "absolute", top: 0, height: "100%", borderRadius: "3px" },
    arrow: { fontSize: "0.7rem", color: "var(--text-muted)", flex: "0 0 auto", width: "0.8rem", textAlign: "center" },
    note: { fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" },
};

function colorFor(isDarkTheme, bucketId) {
    const slot = BUCKET_COLOR[bucketId];
    return isDarkTheme ? slot.dark : slot.light;
}

// Hover text for a row's bar: creation date plus whichever resolved date its
// `end` actually is — labeled by bucket (`end` itself doesn't say whether it
// came from `target`, `doneDate`, `archivedDate` or `coldDate`; see
// resolveProjectEnd in utils/areaProjects.js) rather than a generic "End".
const RESOLVED_LABEL = { done: "Done", archived: "Archived", coldtask: "Paused" };

function tooltipFor(r) {
    const createdStr = r.created ? r.created.toFormat("LLL dd yyyy") : "—";
    if (r.end == null) return `Created ${createdStr} · ongoing, no target set`;
    const label = RESOLVED_LABEL[r.bucket] ?? "Target";
    return `Created ${createdStr} · ${label} ${r.end.toFormat("LLL dd yyyy")}`;
}

return function AreaProjectsTimeline({ rows = [] }) {
    const isDarkTheme = typeof document !== "undefined" && document.body.classList.contains("theme-dark");
    const [rangeId, setRangeId] = dc.useState("365d");
    const [anchor, setAnchor] = dc.useState(() => dc.luxon.DateTime.now());

    // `rows` may be a Datacore DataArray (from areaProjects.jsx) or a plain
    // array (tests) — DataArray's own `.sort()` takes a key fn + direction,
    // not a native comparator (see areaProjects.jsx's own note on this exact
    // trap), so normalize to a plain array up front rather than relying on
    // which one `rows` happens to be.
    const withDates = dc.useMemo(() => Array.from(rows).filter((r) => r.created), [rows]);
    const skipped = rows.length - withDates.length;
    const sorted = dc.useMemo(
        () => withDates.slice().sort((a, b) => a.created - b.created),
        [withDates]
    );

    const now = dc.luxon.DateTime.now();
    const window_ = dc.useMemo(() => resolveTimelineWindow(rangeId, withDates, anchor), [rangeId, withDates, anchor]);
    const todayPct = todayMarkerPct(window_.start, window_.end, now);

    const preset = TIMELINE_RANGE_PRESETS.find((p) => p.id === rangeId);
    const isPannable = rangeId !== "all";
    const pan = (dir) => setAnchor((a) => a.plus({ days: dir * (preset?.days ?? 30) }));

    if (sorted.length === 0) {
        return <p style={S.note}>No dated projects to show on the timeline.</p>;
    }

    return (
        <div style={S.root}>
            <div style={S.header}>
                <span style={S.label}>Range:</span>
                {TIMELINE_RANGE_PRESETS.map((p) => (
                    <button
                        key={p.id}
                        style={{ ...S.btn, ...(p.id === rangeId ? S.btnActive : {}) }}
                        onClick={() => setRangeId(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
                <button style={S.btn} disabled={!isPannable} onClick={() => pan(-1)} title="Earlier">◀</button>
                <button style={S.btn} disabled={!isPannable} onClick={() => pan(1)} title="Later">▶</button>
                <button style={S.btn} onClick={() => setAnchor(dc.luxon.DateTime.now())} title="Jump back to today">Today</button>
                <span style={S.rangeLabel}>{window_.start.toFormat("LLL dd yyyy")} – {window_.end.toFormat("LLL dd yyyy")}</span>
            </div>
            <div style={S.body}>
                {todayPct != null && <div style={{ ...S.todayLine, left: `${todayPct}%` }} title="Today" />}
                {sorted.map((r) => {
                    const geom = barGeometry({ start: r.created, end: r.end, windowStart: window_.start, windowEnd: window_.end, now });
                    return (
                        <div style={S.row} key={r.path}>
                            <span style={S.rowLabel} title={r.name}><dc.Literal value={r.link} /></span>
                            <span style={S.arrow}>{geom?.clampedLeft ? "‹" : ""}</span>
                            <div style={S.track}>
                                {geom?.visible && (
                                    <span
                                        style={{
                                            ...S.bar,
                                            left: `${geom.leftPct}%`,
                                            width: `${geom.widthPct}%`,
                                            background: colorFor(isDarkTheme, r.bucket),
                                            opacity: geom.openEnded ? 0.7 : 1,
                                        }}
                                        title={tooltipFor(r)}
                                    />
                                )}
                            </div>
                            <span style={S.arrow}>{geom?.clampedRight ? "›" : ""}</span>
                        </div>
                    );
                })}
            </div>
            {skipped > 0 && (
                <p style={S.note}>{skipped} project(s) with no creation date aren't shown here.</p>
            )}
        </div>
    );
};
