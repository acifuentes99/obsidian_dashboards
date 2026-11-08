// Mirrors Datacore's own codeblock execution exactly (see the plugin source
// at utils/javascript.ts and ui/javascript.tsx): transpile JSX with sucrase
// using the `h`/`Fragment` pragma, then eval with `dc` (plus `h`/`Fragment`)
// as the only injected names. Reusing the same transpiler/pragma means a
// block that passes here runs the same code Obsidian would run.
import { transform } from "sucrase";
import { h, Fragment } from "preact";

function transpile(script) {
    return transform(script, { transforms: ["jsx"], jsxPragma: "h", jsxFragmentPragma: "Fragment" }).code;
}

function evalInContext(script, variables) {
    const keys = Object.keys(variables);
    const values = Object.values(variables);
    return new Function(...keys, script)(...values);
}

async function asyncEvalInContext(script, variables) {
    if (script.includes("await")) {
        return evalInContext("return (async () => { " + script + " })()", variables);
    }
    return evalInContext(script, variables);
}

/**
 * Extracts the raw source of a ```datacorejsx fenced block from markdown text.
 * `which` selects the Nth block (0-indexed) when a note has more than one.
 */
export function extractDatacoreBlock(markdown, which = 0) {
    const matches = [...markdown.matchAll(/```datacorejsx\n([\s\S]*?)\n```/g)];
    if (!matches[which]) throw new Error(`No datacorejsx block at index ${which} found.`);
    return matches[which][1];
}

/**
 * Runs a raw datacorejsx block's source against a (mock) `dc`, returning
 * whatever the block returns — almost always a component function.
 */
export async function runDatacoreBlock(rawSource, dc) {
    const code = transpile(rawSource);
    return asyncEvalInContext(code, { dc, h, Fragment });
}
