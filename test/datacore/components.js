// Minimal stand-ins for dc.Table / dc.List (src/api/ui/views/table.tsx,
// list.tsx) — just enough DOM output to assert against in tests, not a
// faithful recreation of paging/sorting UI.
import { h } from "preact";

export function Table({ rows = [], columns = [], paging, class: className }) {
    const visibleRows = typeof paging === "number" ? rows.slice(0, paging) : rows;
    return h("table", { className }, [
        h("thead", { key: "thead" }, h("tr", null, columns.map((col) => {
            const title = typeof col.title === "function" ? col.title() : (col.title ?? col.id);
            return h("th", { key: col.id }, title);
        }))),
        h(
            "tbody",
            { key: "tbody" },
            visibleRows.map((row, i) =>
                h(
                    "tr",
                    { key: i },
                    columns.map((col) => {
                        const value = col.value(row);
                        const content = col.render ? col.render(value, row) : value;
                        return h("td", { key: col.id }, content);
                    })
                )
            )
        ),
    ]);
}

export function List({ rows = [], renderer, paging }) {
    // Datacore's real dc.List flattens groupBy() output (rows shaped like
    // { key, rows: [...] }) rather than rendering the group wrapper itself.
    const flat = rows.flatMap((row) => (Array.isArray(row?.rows) ? row.rows : [row]));
    const visible = typeof paging === "number" ? flat.slice(0, paging) : flat;
    return h(
        "ul",
        null,
        visible.map((row, i) => h("li", { key: i }, renderer ? renderer(row) : String(row)))
    );
}
