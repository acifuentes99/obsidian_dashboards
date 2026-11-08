// Unit tests for the pure day/week/month bucketing logic behind the
// Resources dashboard's creation timeline (datacore/utils/timeline.js).
// Loaded the same way a `dc.require`d block runs in Obsidian: read the raw
// file and eval it through the same sucrase pass Datacore uses (see
// test/datacore/runBlock.js), against a mock `dc` — no vault, no Obsidian.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const TIMELINE_UTIL_PATH = join(process.cwd(), "datacore", "utils", "timeline.js");

async function loadTimelineUtils() {
    const source = readFileSync(TIMELINE_UTIL_PATH, "utf8");
    return runDatacoreBlock(source, createMockDc({}));
}

function res(name, isoDate) {
    return {
        name,
        path: `A. PARA Notes/Resources/${name}.md`,
        link: name,
        timestamp: isoDate ? DateTime.fromISO(isoDate) : null,
    };
}

describe("timeline utils (datacore/utils/timeline.js)", () => {
    it("buckets resources by day over a 'last week' range and excludes undated ones", async () => {
        const timeline = await loadTimelineUtils();
        const now = DateTime.fromISO("2026-11-08T12:00:00");
        const resources = [
            res("A", "2026-11-08T09:00:00"),
            res("B", "2026-11-08T10:00:00"),
            res("C", "2026-11-06T08:00:00"),
            res("Undated", null),
        ];

        const range = timeline.resolveRange("7d", resources, null, now);
        const { granularity, buckets } = timeline.buildBuckets({ resources, ...range });

        expect(granularity).toBe("day");
        expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(3);

        const nov8 = buckets.find((b) => b.key === "2026-11-08");
        expect(nov8.count).toBe(2);
        expect(nov8.items.map((r) => r.name).sort()).toEqual(["A", "B"]);
    });

    it("steps up to weekly buckets for a 90-day range", async () => {
        const timeline = await loadTimelineUtils();
        const now = DateTime.fromISO("2026-11-08T12:00:00");
        const resources = [res("Recent", "2026-10-01T00:00:00")];

        const range = timeline.resolveRange("90d", resources, null, now);
        const { granularity } = timeline.buildBuckets({ resources, ...range });

        expect(granularity).toBe("week");
    });

    it("'all time' spans from the oldest timestamp and steps to monthly buckets", async () => {
        const timeline = await loadTimelineUtils();
        const now = DateTime.fromISO("2026-11-08T12:00:00");
        const resources = [res("Old", "2020-05-09T00:00:00"), res("Recent", "2026-10-01T00:00:00")];

        const range = timeline.resolveRange("all", resources, null, now);
        expect(range.start.toISODate()).toBe("2020-05-09");

        const { granularity } = timeline.buildBuckets({ resources, ...range });
        expect(granularity).toBe("month");
    });

    it("honors a custom range regardless of which date was picked first", async () => {
        const timeline = await loadTimelineUtils();
        const resources = [res("Mid", "2026-02-15T00:00:00")];
        const customRange = { start: DateTime.fromISO("2026-02-01"), end: DateTime.fromISO("2026-02-28") };

        const range = timeline.resolveRange("custom", resources, customRange);
        const { buckets } = timeline.buildBuckets({ resources, ...range });

        expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(1);
    });
});
