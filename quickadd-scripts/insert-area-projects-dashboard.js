// One-off QuickAdd command (like status-date-backfill.js) that appends the
// "## Projects" dashboard section (datacore/areaProjects.jsx) to the active
// note, if it's an Area note that doesn't already have it. Wire this as a
// step after "From Template: Area" in the New Area macro so every newly
// created Area note gets it automatically; run it manually on an existing
// Area note to backfill.

const BLOCK_MARKER = "Z. Meta/datacore/areaProjects.jsx";

function isAreaNote(app, file) {
    const tags = app.metadataCache.getFileCache(file)?.frontmatter?.tags;
    const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
    return tagList.includes("type/area");
}

const DASHBOARD_BLOCK = `## Projects

\`\`\`datacorejsx
const AreaProjects = await dc.require("${BLOCK_MARKER}");
return function View() {
    return <AreaProjects />;
}
\`\`\`
`;

module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const file = app.workspace.getActiveFile();

    if (!file) {
        quickAddApi.notice("No active note.");
        return;
    }
    if (!isAreaNote(app, file)) {
        quickAddApi.notice("Not an area note (missing type/area tag) — skipped.");
        return;
    }

    const content = await app.vault.read(file);
    if (content.includes(BLOCK_MARKER)) {
        quickAddApi.notice("Projects dashboard already present — skipped.");
        return;
    }

    const separator = content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
    await app.vault.process(file, (text) => text + separator + DASHBOARD_BLOCK);
    quickAddApi.notice("Projects dashboard added.");
};
