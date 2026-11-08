// A hand-written test double for the `dc` codeblock API (see
// docs/agents/domain.md-adjacent reference: Datacore's docs/docs/code-views/local-api.md).
// It only implements what the dashboards under `C. Dashboards/Main/` actually
// use. Add to it as new blocks exercise more of the real API — don't try to
// reimplement the whole query/expression language here; feed pre-filtered
// fixture data into `pages` instead.
import { useState, useMemo, useCallback, useEffect, useRef, useReducer, useContext } from "preact/hooks";
import { createContext } from "preact";
import { DateTime, Duration } from "luxon";
import { DCArray } from "./dataArray.js";
import { Table, List } from "./components.js";

function coerceDate(value) {
    if (value == null) return undefined;
    if (DateTime.isDateTime(value)) return value;
    if (value instanceof Date) return DateTime.fromJSDate(value);
    const dt = DateTime.fromISO(String(value));
    return dt.isValid ? dt : undefined;
}

export function createMockDc(overrides = {}) {
    const pages = overrides.pages ?? [];
    const currentFile = overrides.currentFile ?? { $frontmatter: {} };

    return {
        // Query hooks — real Datacore runs the query language against the vault
        // index; the mock just hands back pre-filtered fixture data.
        useQuery: () => pages,
        useFullQuery: () => ({ query: null, results: pages, duration: 0, revision: 0 }),
        useCurrentFile: () => currentFile,
        useCurrentPath: () => currentFile.$path,
        useIndexUpdates: () => 0,

        // Common React/Preact hooks, forwarded as-is.
        useState,
        useReducer,
        useMemo,
        useCallback,
        useEffect,
        useRef,
        useContext,
        createContext,

        useArray: (arr, fn, deps = [arr]) => useMemo(() => fn(DCArray.from(arr ?? [])), deps),

        // Direct queries — not implemented; fail loudly rather than returning
        // silently wrong data if a block starts relying on these.
        query: () => {
            throw new Error("dc.query is not mocked — pass fixture data via createMockDc({ pages }) instead.");
        },
        tryQuery: () => {
            throw new Error("dc.tryQuery is not mocked — pass fixture data via createMockDc({ pages }) instead.");
        },

        coerce: {
            string: (v) => String(v),
            boolean: (v) => (v === true || v === "true" ? true : v === false || v === "false" ? false : undefined),
            number: (v) => {
                const n = Number(v);
                return Number.isNaN(n) ? undefined : n;
            },
            date: coerceDate,
            duration: (v) => {
                const d = Duration.fromISO(String(v));
                return d.isValid ? d : undefined;
            },
            array: (v) => (Array.isArray(v) ? v : [v]),
        },

        Table,
        List,

        ...overrides.extend,
    };
}
