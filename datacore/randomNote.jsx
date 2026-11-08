// Random-note explorer button.
// Picks a random "interesting" content note (excludes dashboards, templates,
// meta, journal, media) and reveals it as a suggestion you can open.
// Used from: C. Dashboards/Index.md

// Folders whose notes are NOT interesting "things to check out".
const EXCLUDE_DIRS = [
    "C. Dashboards",
    "T. Templates",
    "Z. Meta",
    "Y. Journal",
    "W. Media",
    "X. Plugins/customjs",
];

function isInteresting(path) {
    if (!path || !path.endsWith(".md")) return false;
    for (const dir of EXCLUDE_DIRS) {
        if (path === dir || path.startsWith(dir + "/")) return false;
    }
    return true;
}

return function RandomNote() {
    const pages = dc.useQuery("@page");

    const pool = dc.useMemo(
        () => pages.filter((p) => isInteresting(p.$path)),
        [pages]
    );

    const [pick, setPick] = dc.useState(null);

    const roll = dc.useCallback(() => {
        if (!pool.length) return;
        const next = pool[Math.floor(Math.random() * pool.length)];
        setPick(next);
    }, [pool]);

    const open = dc.useCallback(() => {
        if (!pick) return;
        const file = app.vault.getAbstractFileByPath(pick.$path);
        if (file) app.workspace.getLeaf(false).openFile(file);
    }, [pick]);

    const folder = pick
        ? (pick.$path.includes("/")
            ? pick.$path.slice(0, pick.$path.lastIndexOf("/"))
            : "/")
        : "";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <dc.Button onClick={roll}>
                    🎲 {pick ? "Roll again" : "Surprise me"}
                </dc.Button>
                {pick && <dc.Button onClick={open}>Open →</dc.Button>}
                <span style={{ color: "var(--text-muted)", fontSize: "0.85em" }}>
                    {pool.length} notes in the pool
                </span>
            </div>
            {pick && (
                <dc.Markdown
                    content={`**[[${pick.$path}|${pick.$name}]]**  \n<small>${folder}</small>`}
                />
            )}
        </div>
    );
};
