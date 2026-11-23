// Pure logic behind the Area dashboard's "Projects" section
// (datacore/areaProjects.jsx): which status bucket a project falls into,
// whether a project's `area` frontmatter points at a given Area note, and
// the day-count countdown to a project's `target` frontmatter date.
//
//   const areaProjects = await dc.require("Z. Meta/datacore/utils/areaProjects.js");
//
// Project status buckets, fixed order (also the badge color order in
// areaProjects.jsx — never reassigned by count). Priority-ordered and
// mutually exclusive: a project with both `status: coldtask` and an
// `#archive` tag (inconsistent data, but possible) resolves to "archived",
// not both — unlike Projects.md's older inline categorization, which can
// double-count a project like that into two of its sections.
const STATUS_BUCKETS = [
    { id: "active", label: "Active" },
    { id: "coldtask", label: "Cold Tasks" },
    { id: "backlog", label: "Backlog" },
    { id: "archived", label: "Archived" },
    { id: "done", label: "Done" },
];

function categorizeProject({ status, tags = [] } = {}) {
    if (tags.includes("#done") || status === "done") return "done";
    if (tags.includes("#archive") || status === "archive") return "archived";
    if (status === "coldtask") return "coldtask";
    if (!status || status === "backlog") return "backlog";
    return "active";
}

// `[[Name]]` / `[[Name|Alias]]` wikilink text -> the target's bare name.
function wikilinkName(text) {
    const m = String(text).match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    return m ? m[1] : text;
}

function baseName(path) {
    return String(path).split("/").pop().replace(/\.md$/, "");
}

// A single `area` frontmatter entry can be a plain `[[Wikilink]]` string
// (frontmatter YAML as typed by a human/template) or a Datacore-parsed Link
// object (`{ path, display, ... }`) — handle both without assuming which.
function matchesOne(entry, areaFile) {
    if (entry == null) return false;
    if (typeof entry === "object") {
        if (entry.path) return entry.path === areaFile.$path;
        entry = entry.display ?? entry.name ?? entry.toString();
    }
    const name = wikilinkName(entry).trim().toLowerCase();
    return name === String(areaFile.$name ?? "").toLowerCase()
        || name === baseName(areaFile.$path ?? "").toLowerCase();
}

function matchesArea(areaValue, areaFile) {
    if (areaValue == null || !areaFile) return false;
    const entries = Array.isArray(areaValue) ? areaValue : [areaValue];
    return entries.some((entry) => matchesOne(entry, areaFile));
}

// Whole days from `now` to `targetValue` (frontmatter date), rounded up —
// "in 1d" for anything later today through 24h out, negative once the day
// is past. `null` when there's no (coercible) target date at all.
function daysUntilTarget(targetValue, now) {
    const target = dc.coerce.date(targetValue);
    if (!target) return null;
    const reference = now ?? dc.luxon.DateTime.now();
    return Math.ceil(target.startOf("day").diff(reference.startOf("day"), "days").days);
}

function formatDaysUntil(days) {
    if (days == null) return "—";
    if (days === 0) return "Due today";
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return `in ${days}d`;
}

return { STATUS_BUCKETS, categorizeProject, matchesArea, daysUntilTarget, formatDaysUntil };
