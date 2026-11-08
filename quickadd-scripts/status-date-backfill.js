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

module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const today = todayStamp();
    let updated = 0;

    for (const file of app.vault.getMarkdownFiles()) {
        if (!isProjectNote(app, file)) continue;

        const fm = app.metadataCache.getFileCache(file)?.frontmatter;
        const field = STATUS_FIELD[fm?.status];
        if (!field || fm[field]) continue;

        await app.fileManager.processFrontMatter(file, (fm) => {
            fm[field] = today;
        });
        updated++;
    }

    quickAddApi.notice(`Backfilled status dates on ${updated} project note(s).`);
};
