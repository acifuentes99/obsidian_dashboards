// Reusable progress bar of checked tasks for a note.
//
//   const ProgressBar = await dc.require("Z. Meta/datacore/progressBar.jsx");
//   <ProgressBar />                          // current note
//   <ProgressBar path="Folder/Note.md" />    // another note
//
// Props:
//   path   – vault path of the note to count tasks in (optional, defaults to current note)
//   label  – text shown above the bar (optional, default "Progress")

const S = {
    root:  { fontFamily: "var(--font-interface)", maxWidth: "560px", margin: "0.5rem 0" },
    head:  { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem", fontSize: "0.85rem" },
    label: { fontWeight: 600, color: "var(--text-normal)" },
    stat:  { color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" },
    btn:   { marginLeft: "0.6rem", padding: "0.1rem 0.5rem", fontSize: "0.75rem", cursor: "pointer", borderRadius: "4px", border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", color: "var(--text-normal)" },
    track: { height: "10px", borderRadius: "5px", background: "var(--background-modifier-border)", overflow: "hidden" },
};

const TASK_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[(.)\]/;

const countTasks = (text) => {
    let done = 0, total = 0, fence = null;
    for (const line of text.split("\n")) {
        const f = line.match(/^\s*(```|~~~)/);
        if (f) { fence = fence === f[1] ? null : (fence ?? f[1]); continue; }
        if (fence) continue;
        const m = line.match(TASK_RE);
        if (!m) continue;
        total++;
        if (m[1].toLowerCase() === "x") done++;
    }
    return { done, total };
};

return function ProgressBar({ path: pathProp, label = "Progress" }) {
    const current = dc.useCurrentFile();
    const path = pathProp ?? current?.$path ?? "";
    const [tick, setTick] = dc.useState(0);
    const [counts, setCounts] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;
        (async () => {
            const file = app.vault.getAbstractFileByPath(path);
            if (!file) { if (!cancelled) setCounts({ done: 0, total: 0 }); return; }
            const text = await app.vault.read(file);
            if (!cancelled) setCounts(countTasks(text));
        })();
        return () => { cancelled = true; };
    }, [path, tick]);

    const { done, total } = counts ?? { done: 0, total: 0 };
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const fill = {
        width: `${pct}%`,
        height: "100%",
        background: pct === 100 ? "var(--color-green)" : "var(--color-accent)",
        transition: "width 0.3s ease",
    };

    return (
        <div style={S.root}>
            <div style={S.head}>
                <span style={S.label}>{label}</span>
                <span style={S.stat}>
                    {counts ? `${done} / ${total} · ${pct}%` : "…"}
                    <button style={S.btn} onClick={() => setTick((n) => n + 1)} title="Recount tasks">↻ Refresh</button>
                </span>
            </div>
            <div style={S.track} title={`${done} of ${total} tasks done`}>
                <div style={fill} />
            </div>
        </div>
    );
};
