// Covers the multi-series creation-timeline chart added to the Note/Tags
// dashboard (see docs/dashboards/note-tags-creation-timeline.md): the
// dashboard-local `resolveSeries` type -> series mapping, exercised the same
// way projects-dashboard.test.js covers Projects.md — extract the real
// datacorejsx block and run it against mock `dc`/`app` + fixture pages.
// `Calendar`/`CreationTimeline` are dc.require'd by the block itself, so the
// mock `dc` here needs a working `dc.require` (see creation-timeline.test.js).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h } from "preact";
import { render, fireEvent } from "@testing-library/preact";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";
import { extractDatacoreBlock, runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";
import { createMockApp } from "./createMockApp.js";

const NOTE_PATH = join(process.cwd(), "C. Dashboards", "Main", "Note and Tags By Recent Datacore Version.md");

function vaultPathToLocal(vaultPath) {
    return join(process.cwd(), vaultPath.replace(/^Z\. Meta\/datacore\//, "datacore/"));
}

function makePage({ name, path, tags = [], daysAgo }) {
    return {
        $name: name,
        $path: path,
        $link: name,
        $tags: tags,
        $frontmatter: { timestamp: { value: DateTime.now().minus({ days: daysAgo }) } },
    };
}

const pages = [
    makePage({ name: "Proj", path: "A. PARA Notes/Projects/Proj.md", tags: ["#type/project"], daysAgo: 1 }),
    makePage({ name: "Res", path: "A. PARA Notes/Resources/Res.md", tags: ["#type/resource"], daysAgo: 1 }),
    makePage({ name: "Ar", path: "A. PARA Notes/Areas/Ar.md", tags: ["#type/area"], daysAgo: 1 }),
    makePage({ name: "NDef", path: "B. Note Box/NDef.md", tags: ["#type/note/default"], daysAgo: 1 }),
    makePage({ name: "NThought", path: "B. Note Box/NThought.md", tags: ["#type/note/thoughts"], daysAgo: 1 }),
    makePage({ name: "Book", path: "B. Note Box/Book.md", tags: ["#type/note/book"], daysAgo: 1 }),
    makePage({ name: "Untagged", path: "B. Note Box/Untagged.md", tags: [], daysAgo: 1 }),
];

async function renderDashboard() {
    const markdown = readFileSync(NOTE_PATH, "utf8");
    const block = extractDatacoreBlock(markdown);

    globalThis.app = createMockApp({});

    const dc = createMockDc({ pages });
    dc.require = async (vaultPath) => runDatacoreBlock(readFileSync(vaultPathToLocal(vaultPath), "utf8"), dc);

    const View = await runDatacoreBlock(block, dc);
    return render(h(View));
}

// Same granularity rule as timeline.js's granularityForSpan: the dashboard's
// chart defaults to "180d", which steps to weekly buckets.
const bucketKeyFor = (daysAgo) => DateTime.now().minus({ days: daysAgo }).startOf("week").toISODate();

describe("Note and Tags dashboard's creation-timeline chart", () => {
    beforeEach(() => {
        delete globalThis.app;
    });

    it("shows a legend entry for every recognized #type/* tag, each with its own line, plus Other", async () => {
        const { container } = await renderDashboard();
        const legendEntries = [...container.querySelectorAll("[data-series-legend]")];
        const legendText = legendEntries.map((d) => d.textContent);
        expect(legendText).toEqual([
            "Project", "Resource", "Area",
            "Note (contact)", "Note (checklist)", "Note (brainstorm)", "Note (documentation)",
            "Note (list)", "Note (research)", "Note (study)", "Note (summary)", "Note (thoughts)",
            "Note (article note)", "Note (book)", "Note (experience)", "Note (default)",
            "Other",
        ]);

        // Each legend entry's swatch resolves to a distinct color — no two
        // of the 17 lines share a color, including the generated tail past
        // the 8 CVD-validated slots.
        const colors = legendEntries.map((d) => d.querySelector("span").style.border);
        expect(new Set(colors).size).toBe(colors.length);
    });

    it("clicking any one series' point drills into every note in that bucket, with resolveSeries' type and the emoji icon on each row", async () => {
        const { container } = await renderDashboard();
        // Clicking drills into the whole bucket regardless of which line's
        // point was clicked — pick an arbitrary one.
        const hit = container.querySelector(`circle[data-key="${bucketKeyFor(1)}"][data-series="project"]`);
        fireEvent.click(hit);

        const rows = [...container.querySelectorAll("tbody tr")].map((tr) => {
            const cells = tr.querySelectorAll("td");
            return { name: cells[0].textContent, type: cells[2].textContent };
        });
        expect(rows).toEqual(expect.arrayContaining([
            { name: "🧮🎲 Proj", type: "project" },
            { name: "🧮📚 Res", type: "resource" },
            { name: "🧮🤩 Ar", type: "area" },
            { name: "❓ NDef", type: "note/default" },
            { name: "🤔 NThought", type: "note/thoughts" },
            { name: "📗 Book", type: "note/book" },
            { name: "❓ Untagged", type: "untyped" },
        ]));
        expect(rows).toHaveLength(7);
    });

    it("clicking the Name column header sorts the drill-down table by the note's name (icon prefix ignored)", async () => {
        const { container } = await renderDashboard();
        const hit = container.querySelector(`circle[data-key="${bucketKeyFor(1)}"][data-series="project"]`);
        fireEvent.click(hit);

        const nameHeader = [...container.querySelectorAll("th")].find((th) => th.textContent.startsWith("Name"));
        fireEvent.click(nameHeader.querySelector("span"));

        const names = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        // Alphabetical by the underlying note name (Ar, Book, NDef, NThought,
        // Proj, Res, Untagged) — each row's icon prefix is decorative only
        // and isn't what's sorted on.
        expect(names).toEqual([
            "🧮🤩 Ar", "📗 Book", "❓ NDef", "🤔 NThought", "🧮🎲 Proj", "🧮📚 Res", "❓ Untagged",
        ]);
        expect(nameHeader.textContent).toBe("Name ▲");

        fireEvent.click(nameHeader.querySelector("span"));
        const namesDesc = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[0].textContent);
        expect(namesDesc).toEqual([
            "🧮🤩 Ar", "📗 Book", "❓ NDef", "🤔 NThought", "🧮🎲 Proj", "🧮📚 Res", "❓ Untagged",
        ].reverse());
        expect(nameHeader.textContent).toBe("Name ▼");
    });
});
