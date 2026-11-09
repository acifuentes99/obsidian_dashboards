---
tags:
  - type/dashboard
obsidianUIMode: preview
sticker: 1f4be
cssclasses:
  - dashboard
---
![[Dashboards Navigation]]
`button-lqz2`

```datacorejsx
const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");
const { buildResourceTree, filterResourceTree } = await dc.require("Z. Meta/datacore/utils/resourceTree.js");

const getTimestamp = (row) => {
    const v = row.$frontmatter?.timestamp?.value;
    if (!v) return null;
    const d = dc.coerce.date(v);
    if (d) return d;
    const s = v.toString();
    return dc.coerce.date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
};

const fmtDate = ts => ts ? ts.toFormat("LLL dd yyyy") : "—";

return function View() {
    const allResources = dc.useQuery(
        '@page and #type/resource and !path("T. Templates")',
        { debounce: 2500 }
    );

    const resources = dc.useMemo(() => {
        return allResources.map(page => {
            const tags = page.$tags ?? [];
            const isArchived = tags.includes('#archive');
            const category = page.$frontmatter?.category?.value ?? 'Otros';
            const timestamp = getTimestamp(page);
            const outlinks = page.$links ?? [];
            const displayTags = tags
                .filter(t => t !== '#type/resource' && t !== '#archive')
                .map(t => t.replace(/^#/, ''));
            return {
                name: page.$name,
                path: page.$path,
                link: page.$link,
                category,
                timestamp,
                isArchived,
                outlinks,
                outlinksCount: outlinks.length,
                tags: displayTags,
            };
        });
    }, [allResources]);

    const recentResources = dc.useMemo(() => {
        return [...resources]
            .sort((a, b) => (b.timestamp?.valueOf() ?? 0) - (a.timestamp?.valueOf() ?? 0))
            .slice(0, 20);
    }, [resources]);

    const resourceTree = dc.useMemo(() => buildResourceTree(resources), [resources]);

    const [searchTerm, setSearchTerm] = dc.useState('');

    const filteredTree = dc.useMemo(
        () => filterResourceTree(resourceTree, searchTerm),
        [resourceTree, searchTerm]
    );

    const activeResources = dc.useMemo(() => resources.filter(r => !r.isArchived), [resources]);
    const archivedList = dc.useMemo(() => resources.filter(r => r.isArchived), [resources]);

    const nameToPath = dc.useMemo(() => {
        const m = new Map();
        resources.forEach(r => m.set(r.name, r.path));
        return m;
    }, [resources]);

    const mkLink = (name) => {
        const path = nameToPath.get(name) ?? `Resources/${name}.md`;
        return (
            <a data-href={path} href={path} className="internal-link" target="_blank" rel="noopener">
                {name}
            </a>
        );
    };

    const inputStyle = {
        width: "100%", marginBottom: "0.5rem", padding: "4px 8px",
        background: "var(--background-secondary)", border: "1px solid var(--background-modifier-border)",
        borderRadius: "4px", color: "var(--text-normal)"
    };
    const nowrap = { whiteSpace: "nowrap" };

    const RECENT_COLS = [
        { id: "File Name", value: r => r.link },
        { id: "Timestamp", value: r => fmtDate(r.timestamp), render: v => <span style={nowrap}>{v}</span>, width: "minimum" },
    ];

    const RESOURCE_COLS = [
        { id: "Name", value: r => r.link },
        { id: "Notes", value: r => r.outlinksCount, render: v => <span style={nowrap}>{v}</span>, width: "minimum" },
    ];

    return (
        <div>
            <h1>Resource Creation Timeline</h1>
            <CreationTimeline resources={resources} />

            <h1>Recent Resources</h1>
            <dc.Table rows={recentResources} columns={RECENT_COLS} paging={20} />

            <h1>List of resources, and their subresources</h1>
            <input
                type="text"
                placeholder="Filter..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={inputStyle}
            />
            {Object.entries(filteredTree.cats)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, roots]) => (
                    <div key={cat}>
                        <h2>{cat}</h2>
                        <ul>
                            {[...roots].sort().map(root => (
                                <li key={root}>
                                    {mkLink(root)}
                                    {filteredTree.graph[root]?.length > 0 && (
                                        <ul>
                                            {[...filteredTree.graph[root]].sort().map(child => (
                                                <li key={child}>{mkLink(child)}</li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

            <h1>Active Resources ({activeResources.length})</h1>
            <dc.Table rows={activeResources} columns={RESOURCE_COLS} paging={50} />

            <h1>Archived Resources ({archivedList.length})</h1>
            <dc.Table rows={archivedList} columns={RESOURCE_COLS} paging={50} />
        </div>
    );
};
```

# How to Use
* Resources with sub-resources are shown nested under their parent in the tree
* Archived = resource has `#archive` tag
* The timeline at the top counts resources by creation date (`timestamp`) over the selected range — hover a point for names, click it to show a table (name, timestamp, tags) below. Shift-click a second point to select every bucket in between (e.g. a whole week) and merge their notes into that table. Click a column header to sort the table by it; click again to reverse. Resources with no `timestamp` aren't counted.
* For presets other than "All time"/custom, drag the slider above the chart to pan that window back through past years (e.g. see "Last month" for any month, not just the current one). Click "Today" to snap back.
