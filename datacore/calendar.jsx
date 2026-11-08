// Reusable monthly calendar component for Datacore dashboards.
//
// Uncontrolled (self-contained, includes prev/next/today buttons):
//   const Calendar = await dc.require("Z. Meta/datacore/calendar.jsx");
//   <Calendar pages={pages} getDate={fn} getFile={fn} getLabel={fn} />
//
// Controlled (parent owns navigation — nav buttons are hidden):
//   const [view, setView] = dc.useState(dc.luxon.DateTime.now().startOf("month"));
//   <Calendar pages={pages} getDate={fn} getFile={fn}
//             viewDate={view} onViewDateChange={setView} />
//
// Props:
//   pages             – array of datacore results to render as dots
//   getDate           – (item) => Luxon DateTime | null   (required)
//   getFile           – (item) => string vault path, may include "#Heading"  (required)
//   getLabel          – (item) => string tooltip text     (optional)
//   viewDate          – Luxon DateTime (controlled mode: parent owns the month)
//   onViewDateChange  – (DateTime) => void  (called when nav clicked in controlled mode)

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const S = {
    root:     { fontFamily: "var(--font-interface)", maxWidth: "560px" },
    header:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" },
    title:    { fontSize: "1rem", fontWeight: 600, color: "var(--text-normal)" },
    btn: {
        cursor: "pointer",
        padding: "0.15rem 0.55rem",
        borderRadius: "4px",
        border: "1px solid var(--background-modifier-border)",
        background: "var(--background-secondary)",
        color: "var(--text-normal)",
        fontSize: "0.85rem",
        lineHeight: "1.5",
    },
    grid:      { display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: "2px" },
    hdrCell:   { padding: "2px 4px", textAlign: "center", fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)" },
    wkCell:    { padding: "5px 2px 0", textAlign: "center", fontSize: "0.62rem", color: "var(--text-faint)" },
    dayCell:   { padding: "3px 4px", minHeight: "44px", borderRadius: "3px", background: "var(--background-secondary)" },
    todayCell: { padding: "3px 4px", minHeight: "44px", borderRadius: "3px", background: "var(--background-secondary)", outline: "1px solid var(--color-accent)" },
    emptyCell: { minHeight: "44px" },
    dayNum:    { fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: "1.2" },
    todayNum:  { fontSize: "0.7rem", color: "var(--color-accent)", fontWeight: 700, lineHeight: "1.2" },
    dots:      { display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "3px" },
    dot:       { width: "7px", height: "7px", borderRadius: "50%", background: "var(--color-accent)", cursor: "pointer", flexShrink: 0 },
    footer:    { marginTop: "0.5rem", textAlign: "center" },
};

return function Calendar({ pages = [], getDate, getFile, getLabel, viewDate: externalViewDate, onViewDateChange }) {
    // Always initialise internal state (hooks must be unconditional).
    const [internalDate, setInternalDate] = dc.useState(() => dc.luxon.DateTime.now().startOf("month"));
    const rootRef = dc.useRef(null);

    const controlled = externalViewDate != null;
    const viewDate   = controlled ? externalViewDate : internalDate;

    const navigate = (fn) => {
        const next = fn(viewDate);
        if (controlled) { if (onViewDateChange) onViewDateChange(next); }
        else setInternalDate(next);
    };

    const today = dc.luxon.DateTime.now();
    const year  = viewDate.year;
    const month = viewDate.month;

    // dateKey ("yyyy-MM-dd") -> [{file, label}]
    const dateMap = dc.useMemo(() => {
        const map = {};
        for (const item of pages) {
            const dt = getDate ? getDate(item) : null;
            if (!dt || !dt.isValid) continue;
            const key = dt.toFormat("yyyy-MM-dd");
            if (!map[key]) map[key] = [];
            map[key].push({
                file:  getFile  ? getFile(item)  : (item.$path ?? ""),
                label: getLabel ? getLabel(item) : (item.$name ?? item.$path ?? ""),
            });
        }
        return map;
    }, [pages]);

    // Array of { weekNum, days[] } covering the full view of the month
    const weeks = dc.useMemo(() => {
        const first = dc.luxon.DateTime.fromObject({ year, month, day: 1 });
        const pad   = first.weekday - 1; // Mon-first: Mon=0 pad, Sun=6 pad
        const total = Math.ceil((pad + first.daysInMonth) / 7) * 7;
        const rows  = [];
        let cur = first.minus({ days: pad });
        for (let r = 0; r < total / 7; r++) {
            const weekNum = cur.weekNumber;
            const days = [];
            for (let c = 0; c < 7; c++) { days.push(cur); cur = cur.plus({ days: 1 }); }
            rows.push({ weekNum, days });
        }
        return rows;
    }, [year, month]);

    // Trigger Obsidian's built-in hover preview popup.
    // `file` may be "path/note.md" or "path/note.md#Heading" — strip .md before the #.
    const triggerHover = (e, file) => {
        if (!file) return;
        const nativeEvt = e.nativeEvent ?? e;
        const targetEl  = nativeEvt.target;
        app.workspace.trigger("hover-link", {
            event:       nativeEvt,
            source:      "preview",
            hoverParent: rootRef.current ?? targetEl.parentElement ?? targetEl,
            targetEl:    targetEl,
            linktext:    file.replace(/\.md(?=#|$)/, ""),
            sourcePath:  file,
        });
    };

    // Build flat array of cells for the CSS grid (header row + data rows)
    const cells = [];

    // Header row: "Wk" label + weekday names
    cells.push(<div key="h-wk" style={S.hdrCell}>Wk</div>);
    WEEKDAYS.forEach(d => cells.push(<div key={`h-${d}`} style={S.hdrCell}>{d}</div>));

    // One row per week
    weeks.forEach(({ weekNum, days }, rowIdx) => {
        cells.push(<div key={`wk-${rowIdx}`} style={S.wkCell}>{weekNum}</div>);

        days.forEach(day => {
            const dkey    = day.toFormat("yyyy-MM-dd");
            const inMonth = day.month === month;
            const isToday = day.hasSame(today, "day");
            const entries = dateMap[dkey] ?? [];

            if (!inMonth) {
                cells.push(<div key={dkey} style={S.emptyCell} />);
                return;
            }

            cells.push(
                <div key={dkey} style={isToday ? S.todayCell : S.dayCell}>
                    <div style={isToday ? S.todayNum : S.dayNum}>{day.day}</div>
                    <div style={S.dots}>
                        {entries.map((entry, i) => (
                            <div
                                key={i}
                                style={S.dot}
                                title={entry.label}
                                onMouseEnter={(e) => triggerHover(e, entry.file)}
                            />
                        ))}
                    </div>
                </div>
            );
        });
    });

    return (
        <div ref={rootRef} style={S.root}>
            {!controlled && (
                <div style={S.header}>
                    <button style={S.btn} onClick={() => navigate(d => d.minus({ months: 1 }))}>‹</button>
                    <span style={S.title}>{viewDate.toFormat("LLLL yyyy")}</span>
                    <button style={S.btn} onClick={() => navigate(d => d.plus({ months: 1 }))}>›</button>
                </div>
            )}
            {controlled && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.6rem" }}>
                    <span style={S.title}>{viewDate.toFormat("LLLL yyyy")}</span>
                </div>
            )}
            <div style={S.grid}>{cells}</div>
            {!controlled && (
                <div style={S.footer}>
                    <button style={S.btn} onClick={() => navigate(() => dc.luxon.DateTime.now().startOf("month"))}>Today</button>
                </div>
            )}
        </div>
    );
};
