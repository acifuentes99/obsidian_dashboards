---
tags:
  - type/note/default
  - topic/default
  - purpose/default
  - toReview
timestamp: 2025-06-29T06:57:50
showAll: false
noteLimit: 500
obsidianUIMode: preview
cssclasses: no-hover
cssclass: no-hover
---

```datacorejsx
const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");

let somestring = '';

// Every recognized #type/* tag gets its own line — see
// docs/dashboards/note-tags-creation-timeline.md. Order is fixed (also the
// color order via creationTimeline.jsx's colorFor — never reassigned by
// count/visibility) and mirrors getEmojiPrefix()'s own precedence below, so
// a note's chart series always agrees with its emoji. "other" is the
// residual: any #type/* tag not in this list, or no type tag at all.
const SERIES_ORDER = [
    "project", "resource", "area",
    "note-contact", "note-checklist", "note-brainstorm", "note-documentation",
    "note-list", "note-research", "note-study", "note-summary", "note-thoughts",
    "note-articlenote", "note-book", "note-experience", "note-default",
    "other",
];
const SERIES_LABELS = {
    project: "Project",
    resource: "Resource",
    area: "Area",
    "note-contact": "Note (contact)",
    "note-checklist": "Note (checklist)",
    "note-brainstorm": "Note (brainstorm)",
    "note-documentation": "Note (documentation)",
    "note-list": "Note (list)",
    "note-research": "Note (research)",
    "note-study": "Note (study)",
    "note-summary": "Note (summary)",
    "note-thoughts": "Note (thoughts)",
    "note-articlenote": "Note (article note)",
    "note-book": "Note (book)",
    "note-experience": "Note (experience)",
    "note-default": "Note (default)",
    other: "Other",
};

const resolveSeries = (tags) => {
    if (tags.includes('#type/project')) return { series: 'project', typeLabel: 'project' };
    if (tags.includes('#type/resource')) return { series: 'resource', typeLabel: 'resource' };
    if (tags.includes('#type/area')) return { series: 'area', typeLabel: 'area' };
    if (tags.includes('#type/note/contact')) return { series: 'note-contact', typeLabel: 'note/contact' };
    if (tags.includes('#type/note/checklist')) return { series: 'note-checklist', typeLabel: 'note/checklist' };
    if (tags.includes('#type/note/brainstorm')) return { series: 'note-brainstorm', typeLabel: 'note/brainstorm' };
    if (tags.includes('#type/note/documentation')) return { series: 'note-documentation', typeLabel: 'note/documentation' };
    if (tags.includes('#type/note/list')) return { series: 'note-list', typeLabel: 'note/list' };
    if (tags.includes('#type/note/research')) return { series: 'note-research', typeLabel: 'note/research' };
    if (tags.includes('#type/note/study')) return { series: 'note-study', typeLabel: 'note/study' };
    if (tags.includes('#type/note/summary')) return { series: 'note-summary', typeLabel: 'note/summary' };
    if (tags.includes('#type/note/thoughts')) return { series: 'note-thoughts', typeLabel: 'note/thoughts' };
    if (tags.includes('#type/note/articlenote')) return { series: 'note-articlenote', typeLabel: 'note/articlenote' };
    if (tags.includes('#type/note/book')) return { series: 'note-book', typeLabel: 'note/book' };
    if (tags.includes('#type/note/experience')) return { series: 'note-experience', typeLabel: 'note/experience' };
    if (tags.includes('#type/note/default')) return { series: 'note-default', typeLabel: 'note/default' };
    const otherType = tags.find((t) => t.startsWith('#type/'));
    return { series: 'other', typeLabel: otherType ? otherType.replace(/^#type\//, '') : 'untyped' };
};

const getEmojiPrefix = (pFile, hasLinks) => {
        let l = '';
        if (pFile.$tags.includes('#type/project')) {
            l = '🧮🎲';
        }
        else if (pFile.$tags.includes('#type/resource')) {
            l = '🧮📚';
        }
        else if (pFile.$tags.includes('#type/area')) {
            l = '🧮🤩';
        }
        else if (pFile.$tags.includes('#type/note/contact')) {
            l = '💁‍♂️';
        }
        else if (pFile.$tags.includes('#type/note/checklist')) {
            l = '✔️';
        }
        else if (pFile.$tags.includes('#type/note/brainstorm')) {
            l = '🧠';
        }
        else if (pFile.$tags.includes('#type/note/documentation')) {
            l = '💡';
        }
        else if (pFile.$tags.includes('#type/note/list')) {
            l = '🗒';
        }
        else if (pFile.$tags.includes('#type/note/research')) {
            l = '🔍';
        }
        else if (pFile.$tags.includes('#type/note/study')) {
            l = '📐';
        }
        else if (pFile.$tags.includes('#type/note/summary')) {
            l = '🧾';
        }
        else if (pFile.$tags.includes('#type/note/thoughts')) {
            l = '🤔';
        }
        else if (pFile.$tags.includes('#type/note/articlenote')) {
            l = '📝';
        }
        else if (pFile.$tags.includes('#type/note/book')) {
            l = '📗';
        }
        else if (pFile.$tags.includes('#type/note/experience')) {
            l = '🧾';
        }
        else {
            l = '❓';
        }
        //if (pFile.$tags.includes('#type/note')) {
        //if (true) {
        //  l = !!pFile.$parent ? '✅' + l : '❌' + l;
        //}
        return l;
    };

const getTimestamp = (dc, row) => {
	if (!row || !row?.$frontmatter?.timestamp) {
		return null;
	}
	const timestampValue = row.$frontmatter?.timestamp.value;
	if (dc.coerce.date(timestampValue)) {
		return timestampValue;
	}
	let dateString = timestampValue.toString();
	dateString =
		dateString.substring(0,4) + '-' +
		dateString.substring(4,6) + '-' +
		dateString.substring(6,8);
	return dc.coerce.date(dateString);
};
// const COLUMNS = [
//     {
//         id: "link",
//         //value: (row) => '('+row.timestamp.toFormat("ccc, LLL d")+') '+ getEmojiPrefix(row, false) + row.link + ' (' + row.$size + ')'
//         value: (row) => getEmojiPrefix(row, false) + row.link + ' (' + row.$size + ')'
//         },
//     { id: "Date", value: (row) => getTimestamp(dc, row).toFormat("ccc, LLL d") }
// ];

const COLUMNS = [
    {
        id: "link",
        //value: (row) => '('+row.timestamp.toFormat("ccc, LLL d")+') '+ getEmojiPrefix(row, false) + row.link + ' (' + row.$size + ')'
        value: (row) => getEmojiPrefix(row, false) + row.link + ' (' + getTimestamp(dc, row).toFormat("ccc, LLL d")  + ' - ' + row.$size + ')'
        }
];

const getWeekStringByWeek = (weekLuxon) => {
    const weekStr = weekLuxon.toString();
    const monday = dc.luxon.DateTime.fromFormat(weekStr, "kkkk-WW");
    const sunday = monday.minus({ days: 1 });
    const saturday = sunday.plus({ days: 6 });
    const range = `${sunday.toFormat('LLL dd')} - ${saturday.toFormat('LLL dd')}`;
    return weekLuxon + ' (' + range + ')';
};

// All datacore views should return a React component; in practice, this is going to be
return function View() {
	const file = dc.useCurrentFile({ debounce: 10000 });
	const [showAll, setShowAll] = dc.useState(() => !!(file.$frontmatter?.showAll?.value));
	const [noteLimit, setNoteLimit] = dc.useState(() => file.$frontmatter?.noteLimit?.value ?? 1000);

	const applyFrontmatter = () => {
		const tFile = app.vault.getAbstractFileByPath(file.$path);
		if (!tFile) return;
		const meta = app.metadataCache.getFileCache(tFile);
		setNoteLimit(meta?.frontmatter?.noteLimit ?? 1000);
		setShowAll(!!(meta?.frontmatter?.showAll));
	};
	const query = '@page and supertree(!#journal'
		+ ' and !#dashboard'
		+ ' and (path("B. Note Box")'
		+ ' or path("A. PARA Notes")))';
	const dvQuery = dc.useQuery(query, {debounce : 5000});
	//const dvQuery = dc.useFullQuery(query, {debounce : 5000});

	// The query above stays broad (same ~2200-note scan as `results` below) —
	// Datacore can't reliably date-filter on `timestamp` in the query string
	// itself, since that frontmatter field's format is inconsistent across
	// the vault. The chart's own range selector (default 6 months) windows
	// this same array in JS before bucketing, same approach as Resources.md.
	const chartResources = dc.useMemo(() => dvQuery.map((p) => {
		const tags = p.$tags ?? [];
		const { series, typeLabel } = resolveSeries(tags);
		return {
			name: p.$name,
			path: p.$path,
			link: p.$link,
			timestamp: getTimestamp(dc, p),
			series,
			typeLabel,
			icon: getEmojiPrefix(p, false),
			tags: tags.map((t) => t.replace(/^#/, '')),
		};
	}), [dvQuery]);

	const results = dc.useArray(dvQuery, array => {
		const sorted = array
			.map(result => ({...result,
				timestamp: getTimestamp(dc, result),
				parent: result.$parent,
				link: result.$link}))
			.filter(result => !!result?.timestamp)
			.sort(result => result?.timestamp, "desc");
		return (showAll ? sorted : sorted.limit(noteLimit))
			.groupBy(result => getWeekStringByWeek(result.timestamp.toFormat("y-WW")))
			.sort(result => result.key, "desc");
	}, [showAll, noteLimit]);

	const btnStyle = {
		fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "4px", cursor: "pointer",
		border: "1px solid var(--background-modifier-border)",
		background: "var(--background-secondary)", color: "var(--text-normal)",
	};
	return (
		<div>
			<h1>Note Creation Timeline</h1>
			<CreationTimeline resources={chartResources} seriesOrder={SERIES_ORDER} seriesLabels={SERIES_LABELS} defaultRangeId="180d" />

			<p>{somestring}</p>
			<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.5rem 0" }}>
				<button style={btnStyle} onClick={() => setShowAll(v => !v)}>
					{showAll ? `Apply limit (${noteLimit})` : "Show all notes"}
				</button>
				{!showAll && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>showing {noteLimit} most recent</span>}
				<button style={{ ...btnStyle, marginLeft: "auto" }} onClick={applyFrontmatter}>
					Recalculate
				</button>
			</div>
			<dc.List class="no-hover" type="block" rows={results} renderer={(row) => getEmojiPrefix(row, false) + row.link + ' (' + row.$size + ')'} paging={50} />
		</div>
	);
}
```

# How to Use
* The timeline counts notes by creation date (`timestamp`), one line per type (every `#type/*` tag gets its own line, plus "Other" for anything unrecognized or untagged) — click a legend entry to show/hide that line. "Select all"/"Select none" above the legend toggle every line at once — handy for isolating just one or two types out of the 17.
* Click a point to drill into that bucket's notes below (every type, not just the clicked line); Shift-click a second point to select every bucket in between (e.g. a whole week) and merge their notes into that table. Click the same single point again to clear the selection.
* The drill-down table's Name column shows each note's type emoji (same icons as the list below). Click a column header to sort the table by it; click again to reverse.
* Notes with no `timestamp`, or outside the selected range, aren't counted. Defaults to the last 6 months — switch presets or use a custom range for more.
