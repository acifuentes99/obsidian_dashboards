// Interaction tests for the Resources dashboard's creation-timeline chart
// (datacore/creationTimeline.jsx). Loaded the same way the pure-logic tests
// load datacore/utils/timeline.js (see timeline-utils.test.js) — read the
// raw file and eval it through the same sucrase pass Datacore uses — but
// this component itself does `await dc.require("Z. Meta/datacore/utils/timeline.js")`,
// so the mock `dc` here also needs a working `dc.require` that resolves
// vault-rooted paths back to this repo's local files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h } from "preact";
import { render, fireEvent } from "@testing-library/preact";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const CHART_PATH = join(process.cwd(), "datacore", "creationTimeline.jsx");

function vaultPathToLocal(vaultPath) {
    return join(process.cwd(), vaultPath.replace(/^Z\. Meta\/datacore\//, "datacore/"));
}

async function loadCreationTimeline() {
    const dc = createMockDc({});
    // Self-referential on purpose: by the time this runs, `dc` (the outer
    // const) already has `.require` attached below.
    dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);
    return runDatacoreBlock(readFileSync(CHART_PATH, "utf8"), dc);
}

function res(name, path, daysAgo, tags = []) {
    return { name, path, link: name, timestamp: DateTime.now().minus({ days: daysAgo }), tags };
}

describe("CreationTimeline component (datacore/creationTimeline.jsx)", () => {
    it("clicking a bucket's point shows a table with Name, Timestamp and Tags columns", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            res("GPT", "A. PARA Notes/Resources/GPT.md", 1, ["topic/default", "toReview"]),
            res("Leadership", "A. PARA Notes/Resources/Leadership.md", 1, ["topic/leadership"]),
        ];

        const { container } = render(h(CreationTimeline, { resources }));

        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();
        const hit = container.querySelector(`circle[data-key="${bucketKey}"]`);
        expect(hit).toBeTruthy();

        fireEvent.click(hit);

        const table = container.querySelector("table");
        expect(table).toBeTruthy();
        expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Name", "Timestamp", "Tags"]);

        const rows = [...table.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r[0] === "GPT")?.[2]).toBe("topic/default, toReview");
        expect(rows.find((r) => r[0] === "Leadership")?.[2]).toBe("topic/leadership");
        // Timestamp column isn't empty for either row.
        expect(rows.every((r) => r[1] && r[1] !== "—")).toBe(true);
    });

    it("clicking the same point again clears the selection", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [res("GPT", "A. PARA Notes/Resources/GPT.md", 1)];

        const { container } = render(h(CreationTimeline, { resources }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();
        const hit = container.querySelector(`circle[data-key="${bucketKey}"]`);

        fireEvent.click(hit);
        expect(container.querySelector("table")).toBeTruthy();

        fireEvent.click(hit);
        expect(container.querySelector("table")).toBeFalsy();
    });

    it("a resource with no tags shows an em dash in the Tags column", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [res("Untagged", "A. PARA Notes/Resources/Untagged.md", 1)];

        const { container } = render(h(CreationTimeline, { resources }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();
        fireEvent.click(container.querySelector(`circle[data-key="${bucketKey}"]`));

        const row = container.querySelector("tbody tr");
        expect(row.querySelectorAll("td")[2].textContent).toBe("—");
    });
});
