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

async function loadAreaProjectsUtils() {
    const source = readFileSync(UTIL_PATH, "utf8");
    return runDatacoreBlock(source, createMockDc({}));
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
