// Interaction tests for the Area dashboard's "Projects" timeline
// (datacore/areaProjectsTimeline.jsx). Loaded the same way
// creation-timeline.test.js loads creationTimeline.jsx — this component
// itself does `await dc.require("Z. Meta/datacore/utils/areaProjects.js")`,
// so the mock `dc` here also needs a working `dc.require`.
//
// Dates throughout are computed relative to the real `DateTime.now()` at
// test-run time (not a fixed calendar date) since the component calls
// `dc.luxon.DateTime.now()` directly rather than taking "now" as a prop.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h } from "preact";
import { render, fireEvent } from "@testing-library/preact";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const COMPONENT_PATH = join(process.cwd(), "datacore", "areaProjectsTimeline.jsx");

function vaultPathToLocal(vaultPath) {
    return join(process.cwd(), vaultPath.replace(/^Z\. Meta\/datacore\//, "datacore/"));
}

async function loadAreaProjectsTimeline() {
    const dc = createMockDc({});
    dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);
    return runDatacoreBlock(readFileSync(COMPONENT_PATH, "utf8"), dc);
}

function row({ name, bucket = "active", created, end }) {
    return { path: `A. PARA Notes/Projects/${name}.md`, link: name, name, bucket, created, end };
}

function rowTitles(container) {
    return [...container.querySelectorAll("span[title]")].map((el) => el.title);
}

describe("AreaProjectsTimeline component (datacore/areaProjectsTimeline.jsx)", () => {
    it("shows a fallback message when no rows have a creation date", async () => {
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        const { getByText } = render(h(AreaProjectsTimeline, { rows: [row({ name: "No Date", created: null, end: null })] }));
        expect(getByText("No dated projects to show on the timeline.")).toBeTruthy();
    });

    it("renders dated rows sorted chronologically and notes how many were skipped", async () => {
        const now = DateTime.now();
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        const rows = [
            row({ name: "Later", created: now.minus({ days: 10 }), end: null }),
            row({ name: "Earlier", created: now.minus({ days: 60 }), end: null }),
            row({ name: "No Date", created: null, end: null }),
        ];
        const { container, getByText } = render(h(AreaProjectsTimeline, { rows }));

        const titles = rowTitles(container).filter((t) => t === "Later" || t === "Earlier");
        expect(titles).toEqual(["Earlier", "Later"]);
        expect(getByText("1 project(s) with no creation date aren't shown here.")).toBeTruthy();
    });

    it("draws a today marker when today falls inside the window, and none when panned away from it", async () => {
        const now = DateTime.now();
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        const rows = [row({ name: "Proj", created: now.minus({ days: 10 }), end: null })];
        const { container, getByText } = render(h(AreaProjectsTimeline, { rows }));

        expect(container.querySelector('[title="Today"]')).toBeTruthy();

        // Pan back by the active preset's span (365d, the default) — today
        // is no longer inside the resulting window.
        fireEvent.click(getByText("◀"));
        expect(container.querySelector('[title="Today"]')).toBeFalsy();

        fireEvent.click(getByText("Today"));
        expect(container.querySelector('[title="Today"]')).toBeTruthy();
    });

    it("disables panning on the 'all' range and switches the window label when a preset is clicked", async () => {
        const now = DateTime.now();
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        const rows = [row({ name: "Proj", created: now.minus({ days: 10 }), end: null })];
        const { getByText } = render(h(AreaProjectsTimeline, { rows }));

        const before = getByText(/–/).textContent;
        fireEvent.click(getByText("Last 3 months"));
        const after = getByText(/–/).textContent;
        expect(after).not.toBe(before);

        fireEvent.click(getByText("All time"));
        expect(getByText("◀").disabled).toBe(true);
        expect(getByText("▶").disabled).toBe(true);
    });

    it("flags a bar that's entirely before the visible window with a leading arrow, not a trailing one", async () => {
        const now = DateTime.now();
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        // Entirely in the past relative to a "Last 3 months" window ending today:
        // started before it (clampedLeft) but also ended before it started
        // (not clampedRight, which only fires when the bar runs past the
        // window's *end*).
        const rows = [row({ name: "OldProj", created: now.minus({ years: 5 }), end: now.minus({ years: 4 }) })];
        const { container, getByText } = render(h(AreaProjectsTimeline, { rows }));

        fireEvent.click(getByText("Last 3 months"));
        const arrows = [...container.querySelectorAll("span")].map((s) => s.textContent).filter((t) => t === "‹" || t === "›");
        expect(arrows).toEqual(["‹"]);
    });

    it("marks an open-ended bar (no resolved end) distinctly from a closed one", async () => {
        const now = DateTime.now();
        const AreaProjectsTimeline = await loadAreaProjectsTimeline();
        const rows = [
            row({ name: "Open", created: now.minus({ days: 10 }), end: null }),
            row({ name: "Closed", created: now.minus({ days: 20 }), end: now.minus({ days: 5 }) }),
        ];
        const { container } = render(h(AreaProjectsTimeline, { rows }));

        expect(container.querySelector('[title="Ongoing, no target set"]')).toBeTruthy();
    });
});
