// Example of the "non-Obsidian" test lane proposed in docs/agents/ (see
// CLAUDE.md § Datacore): extract the real datacorejsx block straight out of
// the dashboard note, run it through the same sucrase pass Datacore uses,
// and render it against a mock `dc` + fixture pages instead of a live vault.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h } from "preact";
import { render, screen, fireEvent, within } from "@testing-library/preact";
import { beforeEach, describe, expect, it } from "vitest";
import { extractDatacoreBlock, runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";
import { createMockApp } from "./createMockApp.js";

const NOTE_PATH = join(process.cwd(), "C. Dashboards", "Main", "Projects.md");

function makePage({ link, path, status, tags = [], projectType, timestamp }) {
    return {
        $link: link,
        $path: path,
        $name: link,
        $tags: tags,
        $frontmatter: {
            status: { value: status },
            projectType: { value: projectType },
            timestamp: { value: timestamp },
        },
    };
}

const pages = [
    makePage({ link: "Proj Active", path: "A. PARA Notes/Projects/Proj Active.md", status: "active", projectType: "work", timestamp: "2026-01-05" }),
    makePage({ link: "Proj Cold", path: "A. PARA Notes/Projects/Proj Cold.md", status: "coldtask", projectType: "work", timestamp: "2026-01-04" }),
    makePage({ link: "Proj Backlog", path: "A. PARA Notes/Projects/Proj Backlog.md", status: undefined, projectType: "personal", timestamp: "2026-01-03" }),
    makePage({ link: "Proj Archived", path: "A. PARA Notes/Projects/Proj Archived.md", status: "archive", projectType: "work", timestamp: "2026-01-02" }),
    makePage({ link: "Proj Done", path: "A. PARA Notes/Projects/Proj Done.md", status: undefined, tags: ["#done"], projectType: "work", timestamp: "2026-01-01" }),
];

async function renderProjectsDashboard() {
    const markdown = readFileSync(NOTE_PATH, "utf8");
    const block = extractDatacoreBlock(markdown);

    const app = createMockApp({
        files: { "A. PARA Notes/Projects/Proj Active.md": "---\nstatus: active\n---\nBody" },
    });
    globalThis.app = app;

    const dc = createMockDc({ pages });
    const View = await runDatacoreBlock(block, dc);

    const result = render(h(View));
    return { ...result, app };
}

describe("Projects dashboard (C. Dashboards/Main/Projects.md)", () => {
    beforeEach(() => {
        delete globalThis.app;
    });

    it("buckets pages into the right sections", async () => {
        await renderProjectsDashboard();

        expect(screen.getByText("Active (1)")).toBeTruthy();
        expect(screen.getByText("Cold Tasks (1)")).toBeTruthy();
        expect(screen.getByText("Backlog (1)")).toBeTruthy();
        expect(screen.getByText("Archived (1)")).toBeTruthy();
        expect(screen.getByText("Done (1)")).toBeTruthy();
        expect(screen.getByText("Proj Active")).toBeTruthy();
    });

    it("filters a section's rows via its search box", async () => {
        await renderProjectsDashboard();

        const activeHeading = screen.getByText("Active (1)");
        const activeSection = activeHeading.closest("div");
        const filterInput = within(activeSection).getByPlaceholderText("Filter...");

        // Plain preact (not preact/compat) maps `onChange` to the native
        // `change` event, not `input` — fire what the component actually
        // listens for.
        fireEvent.change(filterInput, { target: { value: "nonexistent" } });

        expect(within(activeSection).getByText("Active (0)")).toBeTruthy();
        expect(within(activeSection).getByText("No items.")).toBeTruthy();
    });

    it("moves a project to backlog without touching Obsidian", async () => {
        const { app } = await renderProjectsDashboard();

        fireEvent.click(screen.getByText("To Backlog"));

        // Flush the microtask queue so the `await app.vault.process(...)` inside
        // `updateStatus` resolves before we assert.
        await Promise.resolve();

        expect(app.__files["A. PARA Notes/Projects/Proj Active.md"]).toContain("status: backlog");
    });
});
