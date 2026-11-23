// Unit tests for the pure status/area-matching/countdown logic behind the
// Area dashboard's "Projects" section (datacore/utils/areaProjects.js).
// Loaded the same way a `dc.require`d util runs in Obsidian: read the raw
// file and eval it through the same sucrase pass Datacore uses (see
// test/datacore/runBlock.js), against a mock `dc` — no vault, no Obsidian.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const UTIL_PATH = join(process.cwd(), "datacore", "utils", "areaProjects.js");

function vaultPathToLocal(vaultPath) {
    return join(process.cwd(), vaultPath.replace(/^Z\. Meta\/datacore\//, "datacore/"));
}

// This module itself does `await dc.require("Z. Meta/datacore/utils/timeline.js")`
// for the timeline functions below, so the mock `dc` needs a working
// `dc.require` too (same pattern as creation-timeline.test.js).
async function loadAreaProjectsUtils() {
    const dc = createMockDc({});
    dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);
    return runDatacoreBlock(readFileSync(UTIL_PATH, "utf8"), dc);
}

describe("categorizeProject (datacore/utils/areaProjects.js)", () => {
    it("buckets by status, with #done/#archive tags acting as a fallback", async () => {
        const { categorizeProject } = await loadAreaProjectsUtils();

        expect(categorizeProject({ status: "active" })).toBe("active");
        expect(categorizeProject({ status: undefined })).toBe("backlog");
        expect(categorizeProject({ status: "backlog" })).toBe("backlog");
        expect(categorizeProject({ status: "coldtask" })).toBe("coldtask");
        expect(categorizeProject({ status: "archive" })).toBe("archived");
        expect(categorizeProject({ status: "done" })).toBe("done");
        expect(categorizeProject({ status: undefined, tags: ["#done"] })).toBe("done");
        expect(categorizeProject({ status: undefined, tags: ["#archive"] })).toBe("archived");
    });

    it("is mutually exclusive: done beats archive, archive beats coldtask", async () => {
        const { categorizeProject } = await loadAreaProjectsUtils();

        // Inconsistent data (both a terminal tag and a non-terminal status) —
        // the project should land in exactly one bucket, not several.
        expect(categorizeProject({ status: "coldtask", tags: ["#archive"] })).toBe("archived");
        expect(categorizeProject({ status: "archive", tags: ["#done"] })).toBe("done");
    });
});

describe("matchesArea (datacore/utils/areaProjects.js)", () => {
    const areaFile = { $path: "A. PARA Notes/Areas/Obsidian Dashboards Area Note.md", $name: "Obsidian Dashboards Area Note" };

    it("matches a plain [[Wikilink]] frontmatter string by name", async () => {
        const { matchesArea } = await loadAreaProjectsUtils();
        expect(matchesArea("[[Obsidian Dashboards Area Note]]", areaFile)).toBe(true);
    });

    it("matches a [[Wikilink|Alias]] by its target name, not the alias", async () => {
        const { matchesArea } = await loadAreaProjectsUtils();
        expect(matchesArea("[[Obsidian Dashboards Area Note|Dashboards]]", areaFile)).toBe(true);
    });

    it("matches a Datacore-parsed Link object by path", async () => {
        const { matchesArea } = await loadAreaProjectsUtils();
        expect(matchesArea({ path: areaFile.$path, display: "Obsidian Dashboards Area Note" }, areaFile)).toBe(true);
    });

    it("matches any entry in an array of areas", async () => {
        const { matchesArea } = await loadAreaProjectsUtils();
        expect(matchesArea(["[[Some Other Area]]", "[[Obsidian Dashboards Area Note]]"], areaFile)).toBe(true);
    });

    it("returns false for an unrelated area, missing value, or missing area file", async () => {
        const { matchesArea } = await loadAreaProjectsUtils();
        expect(matchesArea("[[Some Other Area]]", areaFile)).toBe(false);
        expect(matchesArea(undefined, areaFile)).toBe(false);
        expect(matchesArea("[[Obsidian Dashboards Area Note]]", null)).toBe(false);
    });
});

describe("daysUntilTarget / formatDaysUntil (datacore/utils/areaProjects.js)", () => {
    it("returns null, and formats as an em dash, when there's no target", async () => {
        const { daysUntilTarget, formatDaysUntil } = await loadAreaProjectsUtils();
        expect(daysUntilTarget(undefined)).toBeNull();
        expect(formatDaysUntil(daysUntilTarget(undefined))).toBe("—");
    });

    it("counts whole days forward and formats as 'in Nd'", async () => {
        const { daysUntilTarget, formatDaysUntil } = await loadAreaProjectsUtils();
        const now = DateTime.fromISO("2026-11-23");
        const days = daysUntilTarget("2026-12-03", now);
        expect(days).toBe(10);
        expect(formatDaysUntil(days)).toBe("in 10d");
    });

    it("counts negative days past the target and formats as overdue", async () => {
        const { daysUntilTarget, formatDaysUntil } = await loadAreaProjectsUtils();
        const now = DateTime.fromISO("2026-11-23");
        const days = daysUntilTarget("2026-11-20", now);
        expect(days).toBe(-3);
        expect(formatDaysUntil(days)).toBe("3d overdue");
    });

    it("formats the target date itself as 'Due today'", async () => {
        const { daysUntilTarget, formatDaysUntil } = await loadAreaProjectsUtils();
        const now = DateTime.fromISO("2026-11-23T18:00:00");
        const days = daysUntilTarget("2026-11-23", now);
        expect(days).toBe(0);
        expect(formatDaysUntil(days)).toBe("Due today");
    });
});

describe("resolveProjectEnd (datacore/utils/areaProjects.js)", () => {
    const doneDate = DateTime.fromISO("2026-03-01");
    const target = DateTime.fromISO("2026-06-01");
    const archivedDate = DateTime.fromISO("2026-04-01");
    const coldDate = DateTime.fromISO("2026-05-01");

    it("prefers the project's actual resolution date over a target it still happens to have", async () => {
        const { resolveProjectEnd } = await loadAreaProjectsUtils();
        // A target set when the project started, left in frontmatter after
        // it was later marked done — the bar should end where it actually
        // finished, not where it was originally aimed at.
        expect(resolveProjectEnd({ bucket: "done", target, doneDate, archivedDate, coldDate })).toBe(doneDate);
        expect(resolveProjectEnd({ bucket: "archived", target, doneDate, archivedDate, coldDate })).toBe(archivedDate);
        expect(resolveProjectEnd({ bucket: "coldtask", target, doneDate, archivedDate, coldDate })).toBe(coldDate);
    });

    it("falls back to target when the resolved bucket has no date of its own", async () => {
        const { resolveProjectEnd } = await loadAreaProjectsUtils();
        expect(resolveProjectEnd({ bucket: "done", target, doneDate: null })).toBe(target);
        expect(resolveProjectEnd({ bucket: "archived", target, archivedDate: null })).toBe(target);
        expect(resolveProjectEnd({ bucket: "coldtask", target, coldDate: null })).toBe(target);
    });

    it("uses target for active/backlog projects, which have no resolution date at all", async () => {
        const { resolveProjectEnd } = await loadAreaProjectsUtils();
        expect(resolveProjectEnd({ bucket: "active", target, doneDate, archivedDate, coldDate })).toBe(target);
        expect(resolveProjectEnd({ bucket: "backlog", target: null })).toBeNull();
    });
});

describe("barGeometry (datacore/utils/areaProjects.js)", () => {
    const windowStart = DateTime.fromISO("2026-01-01");
    const windowEnd = DateTime.fromISO("2026-01-31");
    const now = DateTime.fromISO("2026-01-15");

    it("returns null when there's no start date to place the bar at", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        expect(barGeometry({ start: null, end: null, windowStart, windowEnd, now })).toBeNull();
    });

    it("positions a fully-contained, closed bar by percentage of the window", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        const geom = barGeometry({
            start: DateTime.fromISO("2026-01-11"), // 10 days in of a 30-day window
            end: DateTime.fromISO("2026-01-21"),   // 20 days in
            windowStart, windowEnd, now,
        });
        expect(geom.visible).toBe(true);
        expect(geom.leftPct).toBeCloseTo((10 / 30) * 100, 1);
        expect(geom.widthPct).toBeCloseTo((10 / 30) * 100, 1);
        expect(geom.clampedLeft).toBe(false);
        expect(geom.clampedRight).toBe(false);
        expect(geom.openEnded).toBe(false);
    });

    it("clamps a bar that started before the window, flagging clampedLeft", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        const geom = barGeometry({
            start: DateTime.fromISO("2025-06-01"),
            end: DateTime.fromISO("2026-01-11"),
            windowStart, windowEnd, now,
        });
        expect(geom.visible).toBe(true);
        expect(geom.leftPct).toBe(0);
        expect(geom.clampedLeft).toBe(true);
        expect(geom.clampedRight).toBe(false);
    });

    it("clamps a bar that ends after the window, flagging clampedRight", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        const geom = barGeometry({
            start: DateTime.fromISO("2026-01-21"),
            end: DateTime.fromISO("2026-06-01"),
            windowStart, windowEnd, now,
        });
        expect(geom.visible).toBe(true);
        expect(geom.clampedRight).toBe(true);
    });

    it("is invisible when entirely before or entirely after the window", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        const before = barGeometry({ start: DateTime.fromISO("2025-01-01"), end: DateTime.fromISO("2025-02-01"), windowStart, windowEnd, now });
        const after = barGeometry({ start: DateTime.fromISO("2026-06-01"), end: DateTime.fromISO("2026-07-01"), windowStart, windowEnd, now });
        expect(before.visible).toBe(false);
        expect(after.visible).toBe(false);
    });

    it("treats a null end as open-ended, running through to 'now' instead of the window end", async () => {
        const { barGeometry } = await loadAreaProjectsUtils();
        const geom = barGeometry({ start: DateTime.fromISO("2026-01-01"), end: null, windowStart, windowEnd, now });
        expect(geom.openEnded).toBe(true);
        // now = Jan 15, 14 days into the 30-day window — not clamped to the
        // window's right edge (Jan 31), since it stops at "now" instead.
        expect(geom.clampedRight).toBe(false);
        expect(geom.widthPct).toBeCloseTo((14 / 30) * 100, 1);
    });
});

describe("todayMarkerPct (datacore/utils/areaProjects.js)", () => {
    const windowStart = DateTime.fromISO("2026-01-01");
    const windowEnd = DateTime.fromISO("2026-01-31");

    it("positions today by percentage of the window when inside it", async () => {
        const { todayMarkerPct } = await loadAreaProjectsUtils();
        const pct = todayMarkerPct(windowStart, windowEnd, DateTime.fromISO("2026-01-16"));
        expect(pct).toBeCloseTo(50, 0);
    });

    it("returns null when today falls outside the window", async () => {
        const { todayMarkerPct } = await loadAreaProjectsUtils();
        expect(todayMarkerPct(windowStart, windowEnd, DateTime.fromISO("2025-01-01"))).toBeNull();
        expect(todayMarkerPct(windowStart, windowEnd, DateTime.fromISO("2027-01-01"))).toBeNull();
    });
});

describe("resolveTimelineWindow (datacore/utils/areaProjects.js)", () => {
    it("anchors a day-based preset's window on the given anchor date", async () => {
        const { resolveTimelineWindow } = await loadAreaProjectsUtils();
        const anchor = DateTime.fromISO("2026-11-23");
        const { start, end } = resolveTimelineWindow("90d", [], anchor);
        expect(end.toISODate()).toBe(anchor.toISODate());
        expect(start.toISODate()).toBe(anchor.minus({ days: 90 }).toISODate());
    });

    it("'all' spans from the earliest created date to the furthest end date or target, not just to now", async () => {
        const { resolveTimelineWindow } = await loadAreaProjectsUtils();
        const now = DateTime.fromISO("2026-06-01");
        const rows = [
            { created: DateTime.fromISO("2024-01-01"), end: DateTime.fromISO("2024-06-01") },
            { created: DateTime.fromISO("2026-01-01"), end: DateTime.fromISO("2027-01-01") }, // future target
        ];
        const { start, end } = resolveTimelineWindow("all", rows, now);
        expect(start.toISODate()).toBe("2024-01-01");
        expect(end.toISODate()).toBe("2027-01-01"); // reaches past "now", unlike timeline.js's own "all"
    });
});
