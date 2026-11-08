// Note-creation timeline: a line chart of how many notes were created per
// time bucket, with a range selector (presets + custom), a hover tooltip,
// and a click-to-drill-down list underneath.
//
//   const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");
//   <CreationTimeline resources={resources} />
//
// Props:
//   resources – [{ name, path, link, timestamp: Luxon DateTime|null, tags?: string[] }]
//               Items with no timestamp are excluded from the chart entirely.

const timeline = await dc.require("Z. Meta/datacore/utils/timeline.js");
const { RANGE_PRESETS } = timeline;

const SELECTED_COLS = [
    { id: "Name", value: (r) => r.link },
    { id: "Timestamp", value: (r) => (r.timestamp ? r.timestamp.toFormat("LLL dd yyyy") : "—") },
    { id: "Tags", value: (r) => ((r.tags ?? []).join(", ") || "—") },
];

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
};

return function CreationTimeline({ resources }) {
    const [rangeId, setRangeId] = dc.useState("30d");
    const [customRange, setCustomRange] = dc.useState(null);
    const [showCustom, setShowCustom] = dc.useState(false);
    const [customStart, setCustomStart] = dc.useState("");
    const [customEnd, setCustomEnd] = dc.useState("");
    const [selectedKey, setSelectedKey] = dc.useState(null);
    const [hover, setHover] = dc.useState(null); // { key, x, y } — x/y relative to chartWrap
    const [anchorEnd, setAnchorEnd] = dc.useState(null); // Luxon DateTime|null — null = today. Only applies to the day/week-sized presets, not "all"/"custom".
    const chartWrapRef = dc.useRef(null);

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
        () => timeline.buildBuckets({ resources, start: range.start, end: range.end }),
        [resources, range]
    );

    dc.useEffect(() => { setSelectedKey(null); }, [rangeId, customRange, anchorEnd]);

    const maxCount = dc.useMemo(() => Math.max(1, ...buckets.map((b) => b.count)), [buckets]);

    const points = dc.useMemo(() => buckets.map((b, i) => {
        const x = buckets.length > 1 ? PAD_L + (i * INNER_W) / (buckets.length - 1) : PAD_L + INNER_W / 2;
        const y = PAD_T + INNER_H - (b.count / maxCount) * INNER_H;
        return { ...b, x, y };
    }), [buckets, maxCount]);

    const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
    const labelEvery = Math.max(1, Math.ceil(points.length / 7));
    const selected = points.find((p) => p.key === selectedKey) ?? null;
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

            <div style={S.chartWrap} ref={chartWrapRef}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${H}px`, display: "block" }}>
                    <line x1={PAD_L} y1={PAD_T + INNER_H} x2={W - PAD_R} y2={PAD_T + INNER_H} stroke="var(--background-modifier-border)" />
                    <text x={4} y={PAD_T + 4} style={S.axisLabel}>{maxCount}</text>
                    <text x={4} y={PAD_T + INNER_H} style={S.axisLabel}>0</text>

                    {points.length > 1 && (
                        <polyline points={linePath} fill="none" stroke="var(--interactive-accent)" strokeWidth="2" />
                    )}

                    {points.map((p, i) => (
                        <g key={p.key}>
                            {(i % labelEvery === 0 || i === points.length - 1) && (
                                <text x={p.x} y={H - 6} textAnchor="middle" style={S.axisLabel}>{p.label}</text>
                            )}
                            <circle
                                cx={p.x} cy={p.y}
                                r={p.key === selectedKey ? 6 : 3.5}
                                fill={p.key === selectedKey ? "var(--interactive-accent)" : "var(--text-normal)"}
                                stroke="var(--background-primary)"
                                strokeWidth="1"
                            />
                            <circle
                                cx={p.x} cy={p.y} r={10} fill="transparent" style={{ cursor: "pointer" }}
                                data-key={p.key}
                                onMouseEnter={(e) => setHover({ key: p.key, ...relativePos(e) })}
                                onMouseMove={(e) => setHover((h) => (h && h.key === p.key ? { ...h, ...relativePos(e) } : h))}
                                onMouseLeave={() => setHover(null)}
                                onClick={() => setSelectedKey((k) => (k === p.key ? null : p.key))}
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

            {selected && (
                <div style={S.listWrap}>
                    <strong>{selected.label} ({selected.count})</strong>
                    <dc.Table rows={selected.items} columns={SELECTED_COLS} paging={20} />
                </div>
            )}
        </div>
    );
};
