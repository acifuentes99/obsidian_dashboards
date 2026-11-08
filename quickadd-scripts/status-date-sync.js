const STATUS_FIELD = {
    done: "doneDate",
    coldtask: "coldDate",
    archive: "archivedDate",
};

function isProjectNote(app, file) {
    if (file.path.startsWith("T. Templates")) return false;
    const tags = app.metadataCache.getFileCache(file)?.frontmatter?.tags;
    const tagList = Array.isArray(tags) ? tags : tags ? [tags] : [];
    return tagList.includes("type/project");
}

function todayStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function applyStatusDate(app, file, oldStatus, newStatus) {
    const oldField = STATUS_FIELD[oldStatus];
    const newField = STATUS_FIELD[newStatus];
    if (oldField === newField) return;

    await app.fileManager.processFrontMatter(file, (fm) => {
        if (oldField) delete fm[oldField];
        if (newField) fm[newField] = todayStamp();
    });
}

module.exports = async (params) => {
    const { app } = params;

    if (app.__statusDateSyncRegistered) return;
    app.__statusDateSyncRegistered = true;

    const lastStatus = new Map();
    for (const file of app.vault.getMarkdownFiles()) {
        if (!isProjectNote(app, file)) continue;
        const status = app.metadataCache.getFileCache(file)?.frontmatter?.status;
        lastStatus.set(file.path, status);
    }

    app.metadataCache.on("changed", (file) => {
        if (!isProjectNote(app, file)) return;

        const status = app.metadataCache.getFileCache(file)?.frontmatter?.status;
        const previous = lastStatus.get(file.path);
        if (status === previous) return;

        lastStatus.set(file.path, status);
        applyStatusDate(app, file, previous, status);
    });
};
