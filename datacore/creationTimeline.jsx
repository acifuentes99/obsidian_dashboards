// Note-creation timeline: a line chart of how many notes were created per
// time bucket, with a range selector (presets + custom), a hover tooltip,
// and a click-to-drill-down list underneath. Click a dot to select just that
// bucket; Shift-click another dot to select every bucket between them
// (spreadsheet-style range select) — the drill-down table below merges all
// selected buckets' notes into one list. Its column headers are clickable
// to sort (dc.Table has no built-in sort — see COLUMN_DEFS below).
//
//   const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");
//   <CreationTimeline resources={resources} />
//
// Props:
//   resources – [{ name, path, link, timestamp: Luxon DateTime|null, tags?: string[],
//                  icon?: string }]
//               Items with no timestamp are excluded from the chart entirely.
//               `icon`, if set, is shown as a prefix before the link in the
//               drill-down table's Name column (used by the Note/Tags
//               dashboard for its per-type emoji; Resources never sets it).
//   defaultRangeId – initial RANGE_PRESETS id (default "30d").
//
// Multi-series mode (one line per note type, e.g. the Note/Tags dashboard):
// pass `seriesOrder` (and each resource gets a `.series` id matching one of
// those ids, or is left out of the chart if it has none). Omitting
// `seriesOrder` (as the Resources dashboard does) keeps the original
// single-line chart, byte-for-byte.
//   seriesOrder – [seriesId, ...] fixed left-to-right order (also the color
//                 and legend order — never reassigned by count/rank).
//   seriesLabels – { [seriesId]: "Display label" }, defaults to the id.
// "Select all"/"Select none" above the legend show/hide every line at once
// — handy once seriesOrder gets long (e.g. 17 entries on the Note/Tags
// dashboard) rather than clicking each legend entry individually.

const timeline = await dc.require("Z. Meta/datacore/utils/timeline.js");
const { RANGE_PRESETS } = timeline;

// Fixed categorical order, validated for adjacent-pair CVD/contrast in both
// Obsidian themes (see docs/dashboards/note-tags-creation-timeline.md) —
// never reassigned per filter/series count, only ever consumed in this order.
// A series literally named "other" (the Note/Tags dashboard's catch-all) is
// excluded from this indexing and gets OTHER_COLOR instead — see colorFor().
// This is the dataviz skill's full 8-slot default order (blue, orange, aqua,
// yellow, magenta, green, violet, red); beyond 8 non-"other" series,
// colorFor() generates additional hues that are NOT CVD-validated — see the
// comment there and docs/dashboards/note-tags-creation-timeline.md.
const SERIES_PALETTE = [
    { light: "#2a78d6", dark: "#3987e5" },
    { light: "#eb6834", dark: "#d95926" },
    { light: "#1baf7a", dark: "#199e70" },
    { light: "#eda100", dark: "#c98500" },
    { light: "#e87ba4", dark: "#d55181" },
    { light: "#008300", dark: "#008300" },
    { light: "#4a3aa7", dark: "#9085e9" },
    { light: "#e34948", dark: "#e66767" },
];

// The dataviz skill's palette reserves a "de-emphasis / Other" role,
// distinct from the categorical ramps — a muted gray rather than another
// vivid hue, so a catch-all bucket doesn't visually compete with the real
// categories. Reuses the same muted/axis-label ink already in the palette
// (identical value in both themes there), rather than inventing a new tone.
const OTHER_COLOR = { light: "#898781", dark: "#898781" };

// Drill-down table column defs, keyed by id. `sortValue` drives the
// click-to-sort header (dc.Table has no built-in column sort — see
// docs/dashboards/note-tags-creation-timeline.md — so sorting happens here,
// before the already-sorted array is handed to dc.Table as `rows`).
// `render`, when present, is how the Name column's optional note-type icon
// (only ever set by the Note/Tags dashboard's resources — Resources' chart
// never sets `.icon`, so its Name column renders exactly as before) gets
// prefixed in front of the link without putting JSX in `value` itself (the
// Datacore Table contract: `value` is a plain Literal, `render` is for JSX).
const COLUMN_DEFS = {
    Name: {
        value: (r) => r.name,
        // `r.link` is a Datacore `Link` literal, not a plain string — once
        // it's one child among others in a Fragment we return from `render`,
        // Datacore's own value→element conversion (`useAsElement`) no longer
        // applies to it (that only runs on the top-level renderable when
        // it's *not* already a valid element), so it must be converted
        // explicitly via `dc.Literal`, the public form of the same `Lit`
        // component Table itself uses internally.
        render: (_value, r) => (r.icon ? <>{r.icon} <dc.Literal value={r.link} /></> : r.link),
        sortValue: (r) => (r.name ?? "").toLowerCase(),
    },
    Timestamp: {
        value: (r) => (r.timestamp ? r.timestamp.toFormat("LLL dd yyyy") : "—"),
        sortValue: (r) => r.timestamp?.toMillis() ?? -Infinity,
    },
    Type: {
        value: (r) => r.typeLabel ?? "—",
        sortValue: (r) => (r.typeLabel ?? "").toLowerCase(),
    },
    Tags: {
        value: (r) => ((r.tags ?? []).join(", ") || "—"),
        sortValue: (r) => (r.tags ?? []).join(", ").toLowerCase(),
    },
};

const W = 800, H = 220, PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 28;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

const S = {
    root: { fontFamily: "var(--font-interface)", margin: "0.5rem 0 1.5rem" },
    controls: { display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "0.5rem" },
    btn: (active) => ({
        padding: "0.2rem 0.6rem", fontSize: "0.8rem", cursor: "pointer", borderRadius: "4px",
        border: `1px solid ${active ? "var(--interactive-accent)" : "var(--background-modifier-border)"}`,
        background: active ? "var(--interactive-accent)" : "var(--background-secondary)",
        color: active ? "var(--text-on-accent)" : "var(--text-normal)",
    }),
    dateInput: {
        padding: "0.15rem 0.4rem", fontSize: "0.8rem", background: "var(--background-secondary)",
        border: "1px solid var(--background-modifier-border)", borderRadius: "4px", color: "var(--text-normal)",
    },
    sliderRow: { display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" },
    slider: { flex: 1 },
    sliderLabel: { fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" },
    chartWrap: { position: "relative" },
    tooltip: {
        position: "absolute", zIndex: 1000, pointerEvents: "none", maxWidth: "260px",
        background: "var(--background-primary)", border: "1px solid var(--background-modifier-border)",
        borderRadius: "6px", padding: "0.4rem 0.6rem", fontSize: "0.8rem", boxShadow: "var(--shadow-s)",
    },
    axisLabel: { fontSize: "0.65rem", fill: "var(--text-muted)" },
    listWrap: { marginTop: "0.5rem" },
    legendActions: { display: "flex", gap: "0.4rem", marginBottom: "0.4rem" },
    legend: { display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.4rem" },
    legendItem: (active) => ({
        display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer",
        fontSize: "0.75rem", color: "var(--text-normal)", opacity: active ? 1 : 0.4,
    }),
    legendSwatch: (color, active) => ({
        width: "10px", height: "10px", borderRadius: "2px",
        background: active ? color : "transparent", border: `2px solid ${color}`,
    }),
    sortableHeader: { cursor: "pointer", userSelect: "none" },
};

const DEFAULT_SERIES_ID = "__default__";

return function CreationTimeline({ resources, defaultRangeId = "30d", seriesOrder, seriesLabels }) {
    const isMultiSeries = !!(seriesOrder && seriesOrder.length);

    const [rangeId, setRangeId] = dc.useState(defaultRangeId);
    const [customRange, setCustomRange] = dc.useState(null);
    const [showCustom, setShowCustom] = dc.useState(false);
    const [customStart, setCustomStart] = dc.useState("");
    const [customEnd, setCustomEnd] = dc.useState("");
    // Range selection: click a bucket to set both anchor and head to it;
    // Shift-click another bucket to move just the head, selecting every
    // bucket in between (inclusive, order-independent). Shared by both
    // single- and multi-series modes — selection is always by bucket key,
    // never by series.
    const [anchorKey, setAnchorKey] = dc.useState(null);
    const [headKey, setHeadKey] = dc.useState(null);
    const [hover, setHover] = dc.useState(null); // { key, x, y } — x/y relative to chartWrap
    const [anchorEnd, setAnchorEnd] = dc.useState(null); // Luxon DateTime|null — null = today. Only applies to the day/week-sized presets, not "all"/"custom".
    const chartWrapRef = dc.useRef(null);

    // Multi-series-only state. Declared unconditionally (Rules of Hooks) but
    // unused on the single-series path.
    const [hiddenSeries, setHiddenSeries] = dc.useState(() => new Set());
    const [hoverPoint, setHoverPoint] = dc.useState(null); // { key, seriesId, x, y }

    const isDarkTheme = typeof document !== "undefined" && document.body.classList.contains("theme-dark");
    const colorFor = (seriesId) => {
        if (seriesId === "other") return isDarkTheme ? OTHER_COLOR.dark : OTHER_COLOR.light;
        const nonOtherOrder = seriesOrder.filter((id) => id !== "other");
        const idx = Math.max(0, nonOtherOrder.indexOf(seriesId));
        if (idx < SERIES_PALETTE.length) {
            const slot = SERIES_PALETTE[idx];
            return isDarkTheme ? slot.dark : slot.light;
        }
        // Beyond the 8 CVD-validated categorical slots: generate further
        // hues by golden-angle spacing (137.508° steps), a standard trick
        // for well-spread-but-unvalidated categorical colors. Deterministic
        // by index, so a series' color never shifts when others are
        // hidden/shown. Not guaranteed colorblind-safe at this count — the
        // legend and the drill-down table's Type column (plain text) are
        // what keep identity from depending on color alone this far out.
        const extraIdx = idx - SERIES_PALETTE.length;
        const hue = (extraIdx * 137.508 + 20) % 360;
        return isDarkTheme ? `hsl(${hue.toFixed(1)}, 55%, 68%)` : `hsl(${hue.toFixed(1)}, 60%, 42%)`;
    };
    const labelFor = (seriesId) => seriesLabels?.[seriesId] ?? seriesId;

    const isPannable = rangeId !== "all" && rangeId !== "custom";

    const oldestDated = dc.useMemo(
        () => timeline.resolveRange("all", resources, null, dc.luxon.DateTime.now()).start,
        [resources]
    );

    // position: fixed + clientX/clientY breaks if any ancestor pane sets a
    // CSS transform (common in Obsidian's rendering), since that redefines
    // the containing block for fixed descendants. Anchor to chartWrap
    // (position: relative) instead, which isn't affected by that.
    const relativePos = (e) => {
        const rect = chartWrapRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const effectiveNow = isPannable && anchorEnd ? anchorEnd : dc.luxon.DateTime.now();

    const range = dc.useMemo(
        () => timeline.resolveRange(rangeId, resources, customRange, effectiveNow),
        [rangeId, resources, customRange, effectiveNow]
    );

    const { buckets } = dc.useMemo(
        () => timeline.buildBuckets({
            resources, start: range.start, end: range.end,
            ...(isMultiSeries ? { seriesKey: (r) => r.series ?? DEFAULT_SERIES_ID } : {}),
        }),
        [resources, range, isMultiSeries]
    );

    dc.useEffect(() => { setAnchorKey(null); setHeadKey(null); }, [rangeId, customRange, anchorEnd]);

    const selectedKeys = dc.useMemo(() => {
        if (anchorKey == null) return new Set();
        const ai = buckets.findIndex((b) => b.key === anchorKey);
        if (ai === -1) return new Set();
        const hi = headKey != null ? buckets.findIndex((b) => b.key === headKey) : ai;
        if (hi === -1) return new Set([anchorKey]);
        const [lo, top] = ai <= hi ? [ai, hi] : [hi, ai];
        return new Set(buckets.slice(lo, top + 1).map((b) => b.key));
    }, [anchorKey, headKey, buckets]);

    const handleBucketClick = (key, shiftKey) => {
        if (shiftKey && anchorKey != null) {
            setHeadKey(key);
            return;
        }
        if (anchorKey === key && (headKey === key || headKey == null)) {
            setAnchorKey(null);
            setHeadKey(null);
            return;
        }
        setAnchorKey(key);
        setHeadKey(key);
    };

    const selectedBuckets = dc.useMemo(() => buckets.filter((b) => selectedKeys.has(b.key)), [buckets, selectedKeys]);
    const selectedItemsRaw = dc.useMemo(() => selectedBuckets.flatMap((b) => b.items), [selectedBuckets]);
    const selectedRangeLabel = selectedBuckets.length > 1
        ? `${selectedBuckets[0].label} – ${selectedBuckets[selectedBuckets.length - 1].label}`
        : selectedBuckets[0]?.label;

    // Column-header click-to-sort for the drill-down table — dc.Table has
    // no built-in sort, so the array is sorted here before being handed to
    // it as `rows`. Persists across different bucket selections.
    const [sortBy, setSortBy] = dc.useState(null); // column id | null
    const [sortDir, setSortDir] = dc.useState("asc");
    const toggleSort = (colId) => {
        if (sortBy === colId) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortBy(colId); setSortDir("asc"); }
    };
    const buildColumns = (ids) => ids.map((colId) => {
        const def = COLUMN_DEFS[colId];
        return {
            id: colId,
            title: (
                <span style={S.sortableHeader} onClick={() => toggleSort(colId)}>
                    {colId}{sortBy === colId ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </span>
            ),
            value: def.value,
            ...(def.render ? { render: def.render } : {}),
        };
    });
    const SELECTED_COLS = dc.useMemo(() => buildColumns(["Name", "Timestamp", "Tags"]), [sortBy, sortDir]);
    const MULTI_SELECTED_COLS = dc.useMemo(() => buildColumns(["Name", "Timestamp", "Type", "Tags"]), [sortBy, sortDir]);

    const selectedItems = dc.useMemo(() => {
        if (!sortBy) return selectedItemsRaw;
        const sortValue = COLUMN_DEFS[sortBy]?.sortValue;
        if (!sortValue) return selectedItemsRaw;
        const dirMul = sortDir === "desc" ? -1 : 1;
        return [...selectedItemsRaw].sort((a, b) => {
            const av = sortValue(a), bv = sortValue(b);
            if (av < bv) return -1 * dirMul;
            if (av > bv) return 1 * dirMul;
            return 0;
        });
    }, [selectedItemsRaw, sortBy, sortDir]);

    const maxCount = dc.useMemo(() => Math.max(1, ...buckets.map((b) => b.count)), [buckets]);

    // Multi-series: scale to the tallest single line, not the stacked total —
    // lines overlap on shared axes rather than stacking.
    const seriesMax = dc.useMemo(() => {
        if (!isMultiSeries) return 1;
        return Math.max(1, ...buckets.flatMap((b) => seriesOrder.map((id) => b.series?.[id]?.count ?? 0)));
    }, [isMultiSeries, buckets, seriesOrder]);

    const xForIndex = (i) => (buckets.length > 1 ? PAD_L + (i * INNER_W) / (buckets.length - 1) : PAD_L + INNER_W / 2);
    const bandWidth = buckets.length > 1 ? INNER_W / (buckets.length - 1) : INNER_W;

    const pointsBySeries = dc.useMemo(() => {
        if (!isMultiSeries) return [];
        return seriesOrder.map((id) => buckets.map((b, i) => {
            const s = b.series?.[id];
            const count = s?.count ?? 0;
            return {
                key: b.key, label: b.label, seriesId: id,
                count, items: s?.items ?? [],
                x: xForIndex(i), y: PAD_T + INNER_H - (count / seriesMax) * INNER_H,
            };
        }));
    }, [isMultiSeries, buckets, seriesOrder, seriesMax]);

    const points = dc.useMemo(() => buckets.map((b, i) => {
        const x = xForIndex(i);
        const y = PAD_T + INNER_H - (b.count / maxCount) * INNER_H;
        return { ...b, x, y };
    }), [buckets, maxCount]);

    const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
    const labelEvery = Math.max(1, Math.ceil(points.length / 7));
    const hovered = hover ? points.find((p) => p.key === hover.key) : null;

    const applyCustom = () => {
        if (!customStart || !customEnd) return;
        let s = dc.luxon.DateTime.fromISO(customStart);
        let e = dc.luxon.DateTime.fromISO(customEnd);
        if (e < s) [s, e] = [e, s];
        setCustomRange({ start: s, end: e });
        setRangeId("custom");
    };

    return (
        <div style={S.root}>
            <div style={S.controls}>
                {RANGE_PRESETS.map((p) => (
                    <button key={p.id} style={S.btn(rangeId === p.id)} onClick={() => { setRangeId(p.id); setShowCustom(false); setAnchorEnd(null); }}>
                        {p.label}
                    </button>
                ))}
                <button style={S.btn(rangeId === "custom")} onClick={() => setShowCustom((s) => !s)}>
                    Custom range
                </button>
                {showCustom && (
                    <>
                        <input type="date" style={S.dateInput} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                        <span>–</span>
                        <input type="date" style={S.dateInput} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                        <button style={S.btn(false)} onClick={applyCustom}>Apply</button>
                    </>
                )}
            </div>

            {isPannable && (
                <div style={S.sliderRow}>
                    <input
                        type="range"
                        style={S.slider}
                        min={oldestDated.toMillis()}
                        max={dc.luxon.DateTime.now().startOf("day").toMillis()}
                        step={24 * 60 * 60 * 1000}
                        value={effectiveNow.startOf("day").toMillis()}
                        onChange={(e) => setAnchorEnd(dc.luxon.DateTime.fromMillis(Number(e.target.value)))}
                    />
                    <span style={S.sliderLabel}>
                        {range.start.toFormat("LLL dd yyyy")} – {range.end.toFormat("LLL dd yyyy")}
                    </span>
                    {anchorEnd && (
                        <button style={S.btn(false)} onClick={() => setAnchorEnd(null)}>Today</button>
                    )}
                </div>
            )}

            {isMultiSeries ? (
                <>
                    <div style={S.legendActions}>
                        <button style={S.btn(false)} onClick={() => setHiddenSeries(new Set())}>Select all</button>
                        <button style={S.btn(false)} onClick={() => setHiddenSeries(new Set(seriesOrder))}>Select none</button>
                    </div>
                    <div style={S.legend}>
                        {seriesOrder.map((id) => {
                            const active = !hiddenSeries.has(id);
                            const color = colorFor(id);
                            return (
                                <div
                                    key={id}
                                    data-series-legend={id}
                                    style={S.legendItem(active)}
                                    onClick={() => setHiddenSeries((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(id)) next.delete(id); else next.add(id);
                                        return next;
                                    })}
                                >
                                    <span style={S.legendSwatch(color, active)} />
                                    <span>{labelFor(id)}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={S.chartWrap} ref={chartWrapRef}>
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${H}px`, display: "block" }}>
                            <line x1={PAD_L} y1={PAD_T + INNER_H} x2={W - PAD_R} y2={PAD_T + INNER_H} stroke="var(--background-modifier-border)" />
                            <text x={4} y={PAD_T + 4} style={S.axisLabel}>{seriesMax}</text>
                            <text x={4} y={PAD_T + INNER_H} style={S.axisLabel}>0</text>

                            {buckets.map((b, i) => selectedKeys.has(b.key) && (
                                <rect key={`sel-${b.key}`} x={xForIndex(i) - bandWidth / 2} y={PAD_T} width={bandWidth} height={INNER_H} fill="var(--interactive-accent)" opacity="0.08" />
                            ))}

                            {buckets.map((b, i) => (i % labelEvery === 0 || i === buckets.length - 1) && (
                                <text key={b.key} x={xForIndex(i)} y={H - 6} textAnchor="middle" style={S.axisLabel}>{b.label}</text>
                            ))}

                            {seriesOrder.map((id, si) => {
                                if (hiddenSeries.has(id)) return null;
                                const seriesPoints = pointsBySeries[si];
                                const color = colorFor(id);
                                const path = seriesPoints.map((p) => `${p.x},${p.y}`).join(" ");
                                return (
                                    <g key={id}>
                                        {seriesPoints.length > 1 && (
                                            <polyline points={path} fill="none" stroke={color} strokeWidth="2" />
                                        )}
                                        {seriesPoints.map((p) => {
                                            const isSelected = selectedKeys.has(p.key);
                                            return (
                                                <g key={p.key}>
                                                    <circle cx={p.x} cy={p.y} r={isSelected ? 6 : 3} fill={color} stroke="var(--background-primary)" strokeWidth="1" />
                                                    <circle
                                                        cx={p.x} cy={p.y} r={9} fill="transparent" style={{ cursor: "pointer" }}
                                                        data-key={p.key} data-series={id}
                                                        onMouseEnter={(e) => setHoverPoint({ key: p.key, seriesId: id, ...relativePos(e) })}
                                                        onMouseMove={(e) => setHoverPoint((h) => (h && h.key === p.key && h.seriesId === id ? { ...h, ...relativePos(e) } : h))}
                                                        onMouseLeave={() => setHoverPoint(null)}
                                                        onClick={(e) => handleBucketClick(p.key, e.shiftKey)}
                                                    />
                                                </g>
                                            );
                                        })}
                                    </g>
                                );
                            })}
                        </svg>

                        {hoverPoint && (() => {
                            const si = seriesOrder.indexOf(hoverPoint.seriesId);
                            const p = pointsBySeries[si]?.find((pt) => pt.key === hoverPoint.key);
                            if (!p) return null;
                            return (
                                <div style={{ ...S.tooltip, left: hoverPoint.x + 12, top: hoverPoint.y + 12 }}>
                                    <div style={{ fontWeight: 600 }}>{labelFor(hoverPoint.seriesId)} · {p.label} · {p.count}</div>
                                    {p.items.slice(0, 8).map((r) => <div key={r.path}>* {r.name}</div>)}
                                    {p.items.length > 8 && <div>+{p.items.length - 8} more</div>}
                                </div>
                            );
                        })()}
                    </div>

                    {selectedBuckets.length > 0 && (
                        <div style={S.listWrap}>
                            <strong>{selectedRangeLabel} ({selectedItems.length})</strong>
                            <dc.Table rows={selectedItems} columns={MULTI_SELECTED_COLS} paging={20} />
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div style={S.chartWrap} ref={chartWrapRef}>
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${H}px`, display: "block" }}>
                            <line x1={PAD_L} y1={PAD_T + INNER_H} x2={W - PAD_R} y2={PAD_T + INNER_H} stroke="var(--background-modifier-border)" />
                            <text x={4} y={PAD_T + 4} style={S.axisLabel}>{maxCount}</text>
                            <text x={4} y={PAD_T + INNER_H} style={S.axisLabel}>0</text>

                            {points.length > 1 && (
                                <polyline points={linePath} fill="none" stroke="var(--interactive-accent)" strokeWidth="2" />
                            )}

                            {points.map((p, i) => selectedKeys.has(p.key) && (
                                <rect key={`sel-${p.key}`} x={p.x - bandWidth / 2} y={PAD_T} width={bandWidth} height={INNER_H} fill="var(--interactive-accent)" opacity="0.08" />
                            ))}

                            {points.map((p, i) => (
                                <g key={p.key}>
                                    {(i % labelEvery === 0 || i === points.length - 1) && (
                                        <text x={p.x} y={H - 6} textAnchor="middle" style={S.axisLabel}>{p.label}</text>
                                    )}
                                    <circle
                                        cx={p.x} cy={p.y}
                                        r={selectedKeys.has(p.key) ? 6 : 3.5}
                                        fill={selectedKeys.has(p.key) ? "var(--interactive-accent)" : "var(--text-normal)"}
                                        stroke="var(--background-primary)"
                                        strokeWidth="1"
                                    />
                                    <circle
                                        cx={p.x} cy={p.y} r={10} fill="transparent" style={{ cursor: "pointer" }}
                                        data-key={p.key}
                                        onMouseEnter={(e) => setHover({ key: p.key, ...relativePos(e) })}
                                        onMouseMove={(e) => setHover((h) => (h && h.key === p.key ? { ...h, ...relativePos(e) } : h))}
                                        onMouseLeave={() => setHover(null)}
                                        onClick={(e) => handleBucketClick(p.key, e.shiftKey)}
                                    />
                                </g>
                            ))}
                        </svg>

                        {hovered && (
                            <div style={{ ...S.tooltip, left: hover.x + 12, top: hover.y + 12 }}>
                                <div style={{ fontWeight: 600 }}>{hovered.label} · {hovered.count}</div>
                                {hovered.items.slice(0, 8).map((r) => <div key={r.path}>* {r.name}</div>)}
                                {hovered.items.length > 8 && <div>+{hovered.items.length - 8} more</div>}
                            </div>
                        )}
                    </div>

                    {selectedBuckets.length > 0 && (
                        <div style={S.listWrap}>
                            <strong>{selectedRangeLabel} ({selectedItems.length})</strong>
                            <dc.Table rows={selectedItems} columns={SELECTED_COLS} paging={20} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
