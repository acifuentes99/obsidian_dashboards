// Pure parent/child linking, category grouping, and search filtering for
// the Resources dashboard's resource tree.
//
//   const resourceTree = await dc.require("Z. Meta/datacore/utils/resourceTree.js");
//
// Input shape expected by buildResourceTree:
//   resources: [{ name, path, category, outlinks: [{ path }] }]
// A resource is a root when no other resource in the same list links to it.

function buildResourceTree(resources) {
    const resourcePathSet = new Set(resources.map((r) => r.path));

    // parentByChild[name] = names of resources that link TO this resource
    const parentByChild = {};
    resources.forEach((r) => { parentByChild[r.name] = []; });

    resources.forEach((r) => {
        r.outlinks.forEach((link) => {
            if (!resourcePathSet.has(link.path)) return;
            const targetName = link.path.split("/").pop().replace(/\.md$/, "");
            if (parentByChild[targetName] !== undefined) {
                parentByChild[targetName].push(r.name);
            }
        });
    });

    // graph[parent] = [children] — only root resources (no resource links to them)
    const graph = {};
    const currentChildren = new Set();

    Object.keys(parentByChild).forEach((name) => {
        if (!graph[name]) graph[name] = [];
        parentByChild[name].forEach((parent) => {
            currentChildren.add(name);
            if (!graph[parent]) graph[parent] = [name];
            else if (!graph[parent].includes(name)) graph[parent].push(name);
        });
    });
    currentChildren.forEach((name) => { delete graph[name]; });

    const categoryByName = {};
    resources.forEach((r) => { categoryByName[r.name] = r.category; });

    const categoryGroups = {};
    Object.keys(graph).forEach((name) => {
        const cat = categoryByName[name] ?? "Otros";
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push(name);
    });

    return { graph, categoryGroups };
}

function filterResourceTree({ graph, categoryGroups }, searchTerm) {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return { graph, cats: categoryGroups };

    const filteredGraph = {};
    Object.entries(graph).forEach(([parent, children]) => {
        if (parent.toLowerCase().includes(q)) {
            filteredGraph[parent] = children;
        } else {
            const matching = children.filter((c) => c.toLowerCase().includes(q));
            if (matching.length > 0) filteredGraph[parent] = matching;
        }
    });

    const cats = {};
    Object.entries(categoryGroups).forEach(([cat, roots]) => {
        const visible = roots.filter((r) => filteredGraph[r] != null || r.toLowerCase().includes(q));
        if (visible.length > 0) cats[cat] = visible;
    });

    return { graph: filteredGraph, cats };
}

return { buildResourceTree, filterResourceTree };
