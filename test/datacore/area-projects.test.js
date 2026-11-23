// Interaction tests for the Area dashboard's "Projects" section
// (datacore/areaProjects.jsx). Loaded the same way creation-timeline.test.js
// loads creationTimeline.jsx — this component itself does
// `await dc.require("Z. Meta/datacore/utils/areaProjects.js")`, so the mock
// `dc` here also needs a working `dc.require` that resolves vault-rooted
// paths back to this repo's local files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h } from "preact";
import { render, fireEvent, within } from "@testing-library/preact";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const COMPONENT_PATH = join(process.cwd(), "datacore", "areaProjects.jsx");

function vaultPathToLocal(vaultPath) {
    return join(process.cwd(), vaultPath.replace(/^Z\. Meta\/datacore\//, "datacore/"));
}

async function loadAreaProjects(pages) {
    const dc = createMockDc({ pages });
    // Self-referential on purpose: by the time this runs, `dc` (the outer
    // const) already has `.require` attached below.
    dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);
    return runDatacoreBlock(readFileSync(COMPONENT_PATH, "utf8"), dc);
}

const AREA_FILE = { $path: "A. PARA Notes/Areas/Obsidian Dashboards Area Note.md", $name: "Obsidian Dashboards Area Note" };

function project({ name, status, tags = [], target, timestamp, area = "[[Obsidian Dashboards Area Note]]" }) {
    const frontmatter = { status: { value: status }, area: { value: area }, target: { value: target } };
    // Only set when given, matching a real page's $frontmatter (no entry at
    // all for a field the note's frontmatter doesn't have) — commons.js's
    // getTimestamp distinguishes "no timestamp key" (returns null) from "a
    // timestamp key with an uncoercible value" (throws), so wrapping a
    // never-provided timestamp in a `{ value: undefined }` entry here would
    // hit the latter by mistake.
    if (timestamp !== undefined) frontmatter.timestamp = { value: timestamp };
    return {
        $link: name,
        $path: `A. PARA Notes/Projects/${name}.md`,
        $name: name,
        $tags: tags,
        $frontmatter: frontmatter,
    };
}

describe("AreaProjects component (datacore/areaProjects.jsx)", () => {
    it("only counts/lists projects whose area frontmatter points at this Area note", async () => {
        const AreaProjects = await loadAreaProjects([
            project({ name: "In Area", status: "active" }),
            project({ name: "Other Area", status: "active", area: "[[Some Other Area]]" }),
        ]);

        const { getByText, queryByText } = render(h(AreaProjects, { area: AREA_FILE }));

        expect(getByText("Active: 1")).toBeTruthy();
        expect(getByText("In Area")).toBeTruthy();
        expect(queryByText("Other Area")).toBeFalsy();
    });

    it("shows a status-bucket count badge for each bucket", async () => {
        const AreaProjects = await loadAreaProjects([
            project({ name: "P Active", status: "active" }),
            project({ name: "P Backlog", status: undefined }),
            project({ name: "P Cold", status: "coldtask" }),
            project({ name: "P Archived", status: "archive" }),
            project({ name: "P Done", status: undefined, tags: ["#done"] }),
        ]);

        const { getByText } = render(h(AreaProjects, { area: AREA_FILE }));

        expect(getByText("Active: 1")).toBeTruthy();
        expect(getByText("Backlog: 1")).toBeTruthy();
        expect(getByText("Cold Tasks: 1")).toBeTruthy();
        expect(getByText("Archived: 1")).toBeTruthy();
        expect(getByText("Done: 1")).toBeTruthy();
    });

    it("hides done/archived projects from the table by default, revealed by the toggle", async () => {
        const AreaProjects = await loadAreaProjects([
            project({ name: "P Active", status: "active" }),
            project({ name: "P Done", status: undefined, tags: ["#done"] }),
        ]);

        const { getByText, queryByText } = render(h(AreaProjects, { area: AREA_FILE }));

        expect(getByText("P Active")).toBeTruthy();
        expect(queryByText("P Done")).toBeFalsy();

        fireEvent.click(getByText("Show done/archived"));

        expect(getByText("P Active")).toBeTruthy();
        expect(getByText("P Done")).toBeTruthy();
    });

    it("sorts the table by soonest target first, with no-target projects last", async () => {
        const now = DateTime.fromISO("2026-11-23");
        const AreaProjects = await loadAreaProjects([
            project({ name: "No Target", status: "active" }),
            project({ name: "Far Target", status: "active", target: now.plus({ days: 30 }).toISODate() }),
            project({ name: "Near Target", status: "active", target: now.plus({ days: 2 }).toISODate() }),
        ]);

        const { container } = render(h(AreaProjects, { area: AREA_FILE }));

        const names = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
        expect(names).toEqual(["Near Target", "Far Target", "No Target"]);
    });

    it("formats an overdue target distinctly from an upcoming one", async () => {
        const now = DateTime.fromISO("2026-11-23");
        const AreaProjects = await loadAreaProjects([
            project({ name: "Overdue", status: "active", target: now.minus({ days: 5 }).toISODate() }),
            project({ name: "Upcoming", status: "active", target: now.plus({ days: 5 }).toISODate() }),
        ]);

        const { getByText } = render(h(AreaProjects, { area: AREA_FILE }));

        expect(getByText("5d overdue")).toBeTruthy();
        expect(getByText("in 5d")).toBeTruthy();
    });

    it("shows the project's creation date, or an em dash when it has none, and handles the bare-integer timestamp format", async () => {
        // Datacore-recognized date frontmatter arrives as an actual Luxon
        // DateTime (see note-tags-dashboard.test.js's makePage for the same
        // convention) — commons.js's getTimestamp only re-parses a raw
        // string/number itself for the legacy bare-integer format below.
        const AreaProjects = await loadAreaProjects([
            project({ name: "ISO Date", status: "active", timestamp: DateTime.fromISO("2026-01-05") }),
            project({ name: "Integer Date", status: "active", timestamp: 202601060930 }),
            project({ name: "No Date", status: "active" }),
        ]);

        const { getByText, getAllByText } = render(h(AreaProjects, { area: AREA_FILE }));

        expect(getByText("Jan 05 2026")).toBeTruthy();
        expect(getByText("Jan 06 2026")).toBeTruthy();
        expect(getAllByText("—").length).toBeGreaterThan(0);
    });

    it("falls back to the current note when no area prop is passed", async () => {
        // A dc whose useCurrentFile() already resolves to the Area note, so
        // the component can find it without an explicit `area` prop.
        const dc = createMockDc({ pages: [project({ name: "In Area", status: "active" })], currentFile: AREA_FILE });
        dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);
        const Component = await runDatacoreBlock(readFileSync(COMPONENT_PATH, "utf8"), dc);

        const { getByText } = render(h(Component));
        expect(getByText("In Area")).toBeTruthy();
    });
});
