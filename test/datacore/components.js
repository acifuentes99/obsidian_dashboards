// Minimal stand-ins for dc.Table / dc.List (src/api/ui/views/table.tsx,
// list.tsx) — just enough DOM output to assert against in tests, not a
// faithful recreation of paging/sorting UI.
import { h } from "preact";

export function Table({ rows = [], columns = [], paging, class: className }) {
    const visibleRows = typeof paging === "number" ? rows.slice(0, paging) : rows;
    return h("table", { className }, [
        h("thead", { key: "thead" }, h("tr", null, columns.map((col) => h("th", { key: col.id }, col.id)))),
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

export function List({ rows = [], renderer }) {
    return h(
        "ul",
        null,
        rows.map((row, i) => h("li", { key: i }, renderer ? renderer(row) : String(row)))
    );
}
