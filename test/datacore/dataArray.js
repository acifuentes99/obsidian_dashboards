// Minimal stand-in for Datacore's DataArray (src/api/data-array.ts), covering
// just the chainable subset dashboards actually use: filter/map (native,
// inherited via Array's Symbol.species), plus a key-function `.sort()` and
// `.groupBy()` that match DataArray's signature instead of native Array's.
function compareDefault(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a?.toMillis === "function" && typeof b?.toMillis === "function") {
        return a.toMillis() - b.toMillis();
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

export class DCArray extends Array {
    /** DataArray-style sort: `.sort(row => row.key, "asc" | "desc")`, not a comparator. */
    sort(key, direction = "asc") {
        if (!key) return super.sort();
        const dir = direction === "desc" ? -1 : 1;
        const decorated = Array.from(this, (value, index) => ({ value, key: key(value, index, this) }));
        decorated.sort((a, b) => dir * compareDefault(a.key, b.key));
        for (let i = 0; i < this.length; i++) this[i] = decorated[i].value;
        return this;
    }

    where(predicate) {
        return this.filter(predicate);
    }

    /** DataArray-style limit: first `n` rows, as a new array (non-mutating). */
    limit(n) {
        return DCArray.from(this.slice(0, n));
    }

    groupBy(key) {
        if (this.length === 0) return DCArray.from([]);
        const sorted = DCArray.from(this).sort(key, "asc");
        const groups = [];
        for (const row of sorted) {
            const rowKey = key(row);
            const last = groups[groups.length - 1];
            if (last && compareDefault(last.key, rowKey) === 0) last.rows.push(row);
            else groups.push({ key: rowKey, rows: [row] });
        }
        return DCArray.from(groups);
    }
}
