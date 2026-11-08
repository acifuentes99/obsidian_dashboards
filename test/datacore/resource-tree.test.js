// Unit tests for the pure resource-tree/category/filter logic behind the
// Resources dashboard's "List of resources, and their subresources" section
// (datacore/utils/resourceTree.js). Loaded the same way a `dc.require`d
// block runs in Obsidian: read the raw file and eval it through the same
// sucrase pass Datacore uses (see test/datacore/runBlock.js), against a
// mock `dc` — no vault, no Obsidian.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDatacoreBlock } from "./runBlock.js";
import { createMockDc } from "./createMockDc.js";

const RESOURCE_TREE_UTIL_PATH = join(process.cwd(), "datacore", "utils", "resourceTree.js");

async function loadResourceTree() {
    const source = readFileSync(RESOURCE_TREE_UTIL_PATH, "utf8");
    return runDatacoreBlock(source, createMockDc({}));
}

function res(name, { category = "Otros", outlinks = [] } = {}) {
    return {
        name,
        path: `A. PARA Notes/Resources/${name}.md`,
        category,
        outlinks,
    };
}

function linkTo(name) {
    return { path: `A. PARA Notes/Resources/${name}.md` };
}

describe("resource tree utils (datacore/utils/resourceTree.js)", () => {
    it("nests a child under its parent when the parent links to it", async () => {
        const { buildResourceTree } = await loadResourceTree();
        const resources = [
            res("Parent", { outlinks: [linkTo("Child")] }),
            res("Child", { outlinks: [] }),
        ];

        const { graph } = buildResourceTree(resources);

        expect(graph.Parent).toEqual(["Child"]);
        expect(graph.Child).toBeUndefined();
    });

    it("treats a resource with no incoming links as a root", async () => {
        const { buildResourceTree } = await loadResourceTree();
        const resources = [res("Standalone", { outlinks: [] })];

        const { graph } = buildResourceTree(resources);

        expect(graph.Standalone).toEqual([]);
    });

    it("ignores outlinks to pages outside the resource set", async () => {
        const { buildResourceTree } = await loadResourceTree();
        const resources = [res("A", { outlinks: [linkTo("NotAResource")] })];

        const { graph } = buildResourceTree(resources);

        expect(graph.A).toEqual([]);
    });

    it("groups roots by category, defaulting missing category to 'Otros'", async () => {
        const { buildResourceTree } = await loadResourceTree();
        const resources = [
            res("Dated", { category: "Books" }),
            res("Undated", { category: undefined }),
        ];

        const { categoryGroups } = buildResourceTree(resources);

        expect(categoryGroups.Books).toEqual(["Dated"]);
        expect(categoryGroups.Otros).toEqual(["Undated"]);
    });

    it("a parent-name match keeps all of its children", async () => {
        const { buildResourceTree, filterResourceTree } = await loadResourceTree();
        const resources = [
            res("Cooking", { outlinks: [linkTo("Pasta Recipe")] }),
            res("Pasta Recipe", { outlinks: [] }),
        ];
        const tree = buildResourceTree(resources);

        const { graph } = filterResourceTree(tree, "cooking");

        expect(graph.Cooking).toEqual(["Pasta Recipe"]);
    });

    it("a child-name match keeps the parent with only the matching children", async () => {
        const { buildResourceTree, filterResourceTree } = await loadResourceTree();
        const resources = [
            res("Cooking", { outlinks: [linkTo("Pasta Recipe"), linkTo("Rice Recipe")] }),
            res("Pasta Recipe", { outlinks: [] }),
            res("Rice Recipe", { outlinks: [] }),
        ];
        const tree = buildResourceTree(resources);

        const { graph } = filterResourceTree(tree, "pasta");

        expect(graph.Cooking).toEqual(["Pasta Recipe"]);
    });

    it("drops categories left with no visible roots after filtering", async () => {
        const { buildResourceTree, filterResourceTree } = await loadResourceTree();
        const resources = [res("Unrelated", { category: "Books" })];
        const tree = buildResourceTree(resources);

        const { cats } = filterResourceTree(tree, "nomatch");

        expect(cats).toEqual({});
    });
});
