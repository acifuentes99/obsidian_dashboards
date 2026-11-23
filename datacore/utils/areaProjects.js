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

// The timeline bar's end date — bucket-aware, since a resolved project's
// *actual* end date should win over a `target` it also happens to still
// have set (e.g. set when the project started, left in frontmatter after
// it was later marked done). Only active/backlog projects — which have no
// resolution date at all — fall back to `target`, if any.
function resolveProjectEnd({ bucket, target, doneDate, archivedDate, coldDate }) {
    if (bucket === "done") return doneDate ?? target ?? null;
    if (bucket === "archived") return archivedDate ?? target ?? null;
    if (bucket === "coldtask") return coldDate ?? target ?? null;
    return target ?? null;
}

// Shared by areaProjects.jsx's badges and areaProjectsTimeline.jsx's bars —
// reuses 5 of creationTimeline.jsx's 8 dataviz-skill-validated categorical
// slots (see that file and docs/dashboards/note-tags-creation-timeline.md
// for the palette's source/validation) rather than re-deriving new hues.
const BUCKET_COLOR = {
    active: { light: "#2a78d6", dark: "#3987e5" },
    backlog: { light: "#eda100", dark: "#c98500" },
    coldtask: { light: "#4a3aa7", dark: "#9085e9" },
    archived: { light: "#e34948", dark: "#e66767" },
    done: { light: "#1baf7a", dark: "#199e70" },
};

// --- Timeline (datacore/areaProjectsTimeline.jsx) ---

const timelineUtils = await dc.require("Z. Meta/datacore/utils/timeline.js");

// A curated subset of timeline.js's RANGE_PRESETS ids — project spans run in
// months, not the 7d/14d/30d granularity note-creation timelines use.
// `resolveRange` looks these ids up in timeline.js's own RANGE_PRESETS array
// (not a parameter), so picking ids that exist there is what makes this
// reuse work rather than forking a second copy of that lookup.
const TIMELINE_RANGE_PRESETS = ["90d", "180d", "365d", "730d", "all"]
    .map((id) => timelineUtils.RANGE_PRESETS.find((p) => p.id === id));

// "all" here isn't timeline.js's own "all" (earliest item to *now*) — a
// project's bar can run past today (a future `target`), so the window needs
// to stretch to the furthest of every row's start/end, not stop at now.
function resolveTimelineWindow(rangeId, rows, anchor) {
    const now = anchor ?? dc.luxon.DateTime.now();
    if (rangeId !== "all") return timelineUtils.resolveRange(rangeId, [], null, now);

    const dates = [now];
    rows.forEach((r) => {
        if (r.created) dates.push(r.created);
        dates.push(r.end ?? now);
    });
    const min = dates.reduce((a, b) => (b < a ? b : a));
    const max = dates.reduce((a, b) => (b > a ? b : a));
    return { start: min.startOf("day"), end: max.endOf("day") };
}

function clampMs(ms, loMs, hiMs) {
    return Math.min(Math.max(ms, loMs), hiMs);
}

// Geometry for one project's bar within [windowStart, windowEnd], as
// percentages. `end: null` means "still open" — the bar runs through to
// `now` (not to windowEnd), rendered a little faded to read as "ongoing"
// rather than "finishes exactly here". `clampedLeft`/`clampedRight` mark a
// bar that starts before, or is still running past, the visible window
// (rendered as a small arrow by areaProjectsTimeline.jsx) — distinct from
// `openEnded`, which is about the project itself having no end date at all,
// not about what's currently in view. `null` when `start` is missing (no
// creation date to place the bar) or the window itself is degenerate.
function barGeometry({ start, end, windowStart, windowEnd, now }) {
    if (!start) return null;
    const winStartMs = windowStart.toMillis();
    const winEndMs = windowEnd.toMillis();
    const totalMs = winEndMs - winStartMs;
    if (totalMs <= 0) return null;

    const openEnded = end == null;
    const effectiveEnd = end ?? now;
    const startMs = start.toMillis();
    const endMs = effectiveEnd.toMillis();
    const clampedLeft = startMs < winStartMs;
    const clampedRight = endMs > winEndMs;

    if (endMs < winStartMs || startMs > winEndMs) {
        return { visible: false, clampedLeft, clampedRight, openEnded };
    }

    const leftMs = clampMs(startMs, winStartMs, winEndMs);
    const rightMs = clampMs(endMs, winStartMs, winEndMs);
    return {
        visible: true,
        leftPct: ((leftMs - winStartMs) / totalMs) * 100,
        widthPct: Math.max(0.5, ((rightMs - leftMs) / totalMs) * 100),
        clampedLeft,
        clampedRight,
        openEnded,
    };
}

// `null` when `now` falls outside the window — no line to draw.
function todayMarkerPct(windowStart, windowEnd, now) {
    const winStartMs = windowStart.toMillis();
    const winEndMs = windowEnd.toMillis();
    const nowMs = now.toMillis();
    if (nowMs < winStartMs || nowMs > winEndMs) return null;
    return ((nowMs - winStartMs) / (winEndMs - winStartMs)) * 100;
}

return {
    STATUS_BUCKETS,
    BUCKET_COLOR,
    categorizeProject,
    matchesArea,
    daysUntilTarget,
    formatDaysUntil,
    resolveProjectEnd,
    TIMELINE_RANGE_PRESETS,
    resolveTimelineWindow,
    barGeometry,
    todayMarkerPct,
};
