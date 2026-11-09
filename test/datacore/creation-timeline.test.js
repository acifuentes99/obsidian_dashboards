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

    it("clicking a column header sorts the drill-down table, and clicking it again reverses the direction", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            res("Charlie", "A. PARA Notes/Resources/Charlie.md", 1),
            res("Alpha", "A. PARA Notes/Resources/Alpha.md", 1),
            res("Bravo", "A. PARA Notes/Resources/Bravo.md", 1),
        ];

        const { container } = render(h(CreationTimeline, { resources }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();
        fireEvent.click(container.querySelector(`circle[data-key="${bucketKey}"]`));

        const nameHeader = [...container.querySelectorAll("th")].find((th) => th.textContent.startsWith("Name"));
        fireEvent.click(nameHeader.querySelector("span"));

        let names = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(names).toEqual(["Alpha", "Bravo", "Charlie"]);
        expect(nameHeader.textContent).toBe("Name ▲");

        fireEvent.click(nameHeader.querySelector("span"));
        names = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(names).toEqual(["Charlie", "Bravo", "Alpha"]);
        expect(nameHeader.textContent).toBe("Name ▼");
    });

    it("Shift-clicking a second point selects every bucket in between and merges their notes into one table", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            res("Day1", "A. PARA Notes/Resources/Day1.md", 1),
            res("Day2", "A. PARA Notes/Resources/Day2.md", 2),
            res("Day3", "A. PARA Notes/Resources/Day3.md", 3),
        ];

        const { container } = render(h(CreationTimeline, { resources }));
        const keyFor = (daysAgo) => DateTime.now().minus({ days: daysAgo }).startOf("day").toISODate();

        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(1)}"]`));
        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(3)}"]`), { shiftKey: true });

        const rows = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(rows.sort()).toEqual(["Day1", "Day2", "Day3"]);
    });

    it("a plain click after a range reduces the selection back to a single bucket", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            res("Day1", "A. PARA Notes/Resources/Day1.md", 1),
            res("Day2", "A. PARA Notes/Resources/Day2.md", 2),
            res("Day3", "A. PARA Notes/Resources/Day3.md", 3),
        ];

        const { container } = render(h(CreationTimeline, { resources }));
        const keyFor = (daysAgo) => DateTime.now().minus({ days: daysAgo }).startOf("day").toISODate();

        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(1)}"]`));
        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(3)}"]`), { shiftKey: true });
        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(2)}"]`));

        const rows = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(rows).toEqual(["Day2"]);
    });
});

function seriesRes(name, path, daysAgo, series, typeLabel) {
    return { name, path, link: name, timestamp: DateTime.now().minus({ days: daysAgo }), series, typeLabel, tags: [] };
}

const SERIES_ORDER = ["project", "resource", "other"];
const SERIES_LABELS = { project: "Project", resource: "Resource", other: "Other" };

describe("CreationTimeline component — multi-series mode", () => {
    it("renders a legend entry per series, using the given labels", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project")];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));

        const legendText = [...container.querySelectorAll("[data-series-legend]")].map((d) => d.textContent);
        expect(legendText).toEqual(["Project", "Resource", "Other"]);
    });

    it("gives the 'other' series a muted gray swatch, distinct from the vivid categorical colors used for real series", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("O1", "B. Note Box/O1.md", 1, "other", "note/book"),
        ];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));

        const legendEntries = [...container.querySelectorAll("[data-series-legend]")];
        const swatchFor = (label) => legendEntries.find((d) => d.textContent === label)?.querySelector("span");

        // jsdom normalizes hex to rgb() in computed inline styles.
        expect(swatchFor("Other").style.border).toContain("rgb(137, 135, 129)"); // #898781
        expect(swatchFor("Project").style.border).toContain("rgb(42, 120, 214)"); // #2a78d6
        expect(swatchFor("Other").style.border).not.toBe(swatchFor("Project").style.border);
    });

    it("clicking a point drills into every series' notes for that bucket, not just the clicked line", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("R1", "A. PARA Notes/Resources/R1.md", 1, "resource", "resource"),
        ];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();

        fireEvent.click(container.querySelector(`circle[data-key="${bucketKey}"][data-series="project"]`));

        const table = container.querySelector("table");
        expect(table).toBeTruthy();
        expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Name", "Timestamp", "Type", "Tags"]);
        const rows = [...table.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(rows.sort()).toEqual(["P1", "R1"]);
    });

    it("clicking either series' point for the same bucket shows the identical combined table", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("R1", "A. PARA Notes/Resources/R1.md", 1, "resource", "resource"),
        ];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();

        fireEvent.click(container.querySelector(`circle[data-key="${bucketKey}"][data-series="resource"]`));

        const rows = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(rows.sort()).toEqual(["P1", "R1"]);
    });

    it("Shift-clicking a second bucket (any series) extends the selection and merges all series across the range", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("R2", "A. PARA Notes/Resources/R2.md", 2, "resource", "resource"),
        ];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));
        const keyFor = (daysAgo) => DateTime.now().minus({ days: daysAgo }).startOf("day").toISODate();

        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(1)}"][data-series="project"]`));
        fireEvent.click(container.querySelector(`circle[data-key="${keyFor(2)}"][data-series="resource"]`), { shiftKey: true });

        const rows = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(rows.sort()).toEqual(["P1", "R2"]);
    });

    it("clicking a legend entry hides that series' circles", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("R1", "A. PARA Notes/Resources/R1.md", 1, "resource", "resource"),
        ];

        const { container } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();

        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="project"]`)).toBeTruthy();

        fireEvent.click(container.querySelector('[data-series-legend="project"]'));

        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="project"]`)).toBeFalsy();
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="resource"]`)).toBeTruthy();
    });

    it("'Select none' then 'Select all' toggles every series' circles off then back on", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [
            seriesRes("P1", "A. PARA Notes/Projects/P1.md", 1, "project", "project"),
            seriesRes("R1", "A. PARA Notes/Resources/R1.md", 1, "resource", "resource"),
        ];

        const { container, getByText } = render(h(CreationTimeline, { resources, seriesOrder: SERIES_ORDER, seriesLabels: SERIES_LABELS }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();

        fireEvent.click(getByText("Select none"));
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="project"]`)).toBeFalsy();
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="resource"]`)).toBeFalsy();
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="other"]`)).toBeFalsy();

        fireEvent.click(getByText("Select all"));
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="project"]`)).toBeTruthy();
        expect(container.querySelector(`circle[data-key="${bucketKey}"][data-series="resource"]`)).toBeTruthy();
    });

    it("omitting seriesOrder keeps the original single-line chart (no legend, plain data-key)", async () => {
        const CreationTimeline = await loadCreationTimeline();
        const resources = [res("GPT", "A. PARA Notes/Resources/GPT.md", 1)];

        const { container } = render(h(CreationTimeline, { resources }));
        const bucketKey = DateTime.now().minus({ days: 1 }).startOf("day").toISODate();

        expect(container.querySelector(`circle[data-key="${bucketKey}"]`)).toBeTruthy();
        expect(container.querySelector(`circle[data-key="${bucketKey}"]`).getAttribute("data-series")).toBeNull();
    });
});
