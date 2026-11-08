# Calendar component — debug checkpoint

**Date:** 2026-08-23  
**Status:** Unresolved — `Note and Tags By Recent Datacore Version.md` throws `SyntaxError: Unexpected end of input` after adding the Calendar component.

---

## The error

```
SyntaxError: Unexpected end of input
    at new Function (<anonymous>)
    at evalInContext (plugin:datacore:34070:10)
    at asyncEvalInContext (plugin:datacore:34074:12)
    at renderer (plugin:datacore:34270:22)
```

`new Function` receives the JSX-transformed source of the `datacorejsx` block.
"Unexpected end of input" at that point means the **transformed code is syntactically
incomplete** — the JSX transformer produced truncated output.

---

## Files involved

| File | Role | Status |
|------|------|--------|
| `Z. Meta/datacore/calendar.jsx` | Reusable Calendar component | ✅ Working (used by Subheadings and Daily Note Calendar) |
| `C. Dashboards/Main/Daily Note Calendar.md` | 3-month calendar, daily notes | ✅ Working |
| `C. Dashboards/Main/Daily Note Subheadings By Week.md` | Calendar + table, h3/h4 sections | ✅ Working |
| `C. Dashboards/Main/Note and Tags By Recent Datacore Version.md` | Calendar added — broken | ❌ Broken |
| `C. Dashboards/Main/Note and Tags By Recent Datacore Version (original).md` | Backup of pre-calendar original | ❓ User reports also broken (see below) |

---

## What was changed in `Note and Tags By Recent Datacore Version.md`

Two additions only (rest of file is original):

1. Added at top of block:
   ```js
   const Calendar = await dc.require("Z. Meta/datacore/calendar.jsx");
   ```

2. Changed the return from:
   ```jsx
   return <div><p>{somestring}</p><dc.List ... /></div>;
   ```
   to (current state):
   ```jsx
   return <div><Calendar pages={dvQuery} getDate={(p) => getTimestamp(dc, p)} getFile={(p) => p.$path || ""} getLabel={(p) => p.$name || ""} /><p>{somestring}</p><dc.List ... /></div>;
   ```

---

## What was already tried (all failed)

1. **Block-body arrow function** in JSX prop — changed `(p) => { const dt = ...; return dt ?? null; }` to `(p) => getTimestamp(dc, p)` → no effect
2. **`??` operator** in JSX props — changed to `||` → no effect
3. **Object spread in calendar.jsx** — `{{ ...S.header, justifyContent: "center" }}` → replaced with explicit flat object → no effect (but this fix stays since it's cleaner)
4. **Multi-line return** — went back to original single-line return style → no effect
5. **JSX in comment** — `//return <div>...<dc.Table .../></div>;` was on line 142 inside View; replaced with plain text comment → unknown if this fixed it (tried simultaneously with other changes, couldn't isolate)

---

## Unique characteristics of this file vs the working dashboards

This is what makes `Note and Tags` different from `Daily Note Subheadings By Week.md` (which works):

| Feature | Note & Tags | Subheadings | Daily Note Calendar |
|---------|------------|-------------|---------------------|
| Backslash line-continuation in query string | ✅ Yes | ❌ No | ❌ No |
| `dc.useCurrentFile` hook | ✅ Yes | ❌ No | ❌ No |
| Commented-out JSX in `//` comments | ✅ Yes (line 142) | ❌ No | ❌ No |
| `dc.useArray` without deps array | ✅ Yes | ❌ No (has deps) | N/A |
| `renderer` prop on `dc.List` | ✅ Yes | ❌ No (uses dc.Table) | ❌ No |
| `supertree()` in query | ✅ Yes | ❌ No | ❌ No |
| Mixed tab/space indentation | ✅ Yes | ❌ No | ❌ No |

**The top two suspects remaining:**

### Suspect A — Backslash line-continuation string (highest priority)
Lines 119–123 (current numbering) use `\` line continuation:
```js
const query = '@page and supertree(!#journal \
    and !#dashboard \
    and (path("B. Note Box") \
    or path("A. PARA Notes"))) \
    ';
```
If Datacore's JSX transformer scans the file in a way that interacts with the `\` characters,
the JSX it produces could be truncated. This was NOT tried in isolation.

**Proposed fix to try first:** Replace with string concatenation:
```js
const query = '@page and supertree(!#journal'
    + ' and !#dashboard'
    + ' and (path("B. Note Box")'
    + ' or path("A. PARA Notes")))';
```

### Suspect B — Commented-out JSX (second priority)
Line 142 had `//return <div>...<dc.Table .../></div>;` — JSX inside a `//` comment.
If Datacore's transformer is not a full parser and scans for `<` without properly
skipping `//` comments, it could process the commented JSX and produce corrupt output.
This was addressed (comment was replaced with plain text) but was combined with other
changes, so it was never tested in isolation.

**Current state:** Comment is already neutralized. This fix should stay regardless.

### Suspect C — `dc.useCurrentFile` interaction
`dc.useCurrentFile` is used inside View. Not used in any working calendar dashboard.
Low probability but worth noting.

---

## Mystery: the user reports the original file also doesn't work

The user said: *"I restored that file, and also dont work"* — meaning even the
pre-calendar version of Note and Tags throws the same error after restoring.

**Possible explanations:**
1. The manual restoration introduced a typo/mistake
2. Something in `calendar.jsx`'s changes (controlled mode, `navigate` function, `{!controlled && (...)}` patterns) corrupted the Datacore runtime globally — unlikely but possible if Datacore doesn't sandbox `dc.require` results properly
3. A Datacore plugin update changed how it processes certain syntax (the filename says "Recent Datacore Version", suggesting version sensitivity)
4. The original file was already fragile/version-specific and the restoration exposed it

**To test:** Open `Note and Tags By Recent Datacore Version (original).md` (the backup). Does IT throw the same error? If yes, the issue is broader than the Calendar changes.

---

## Recommended next-session steps

1. **Test the backup file** (`(original).md`) in Obsidian. If it also errors, the issue is NOT the Calendar addition and is something pre-existing (Datacore version mismatch, etc.).

2. **If backup works but main doesn't:** The issue is in the Calendar addition. Try converting the query to string concatenation (Suspect A) as the ONLY change and reload.

3. **If neither works:** Check Datacore plugin version and whether `supertree()` is still a valid query function. Look at the Datacore changelog.

4. **Isolation test:** Create a minimal new dashboard that only has:
   ```js
   const Calendar = await dc.require("Z. Meta/datacore/calendar.jsx");
   return function View() {
       const pages = dc.useQuery('@page and path("B. Note Box")', { debounce: 5000 });
       return <div><Calendar pages={pages} getDate={(p) => { const ts = p.$frontmatter?.timestamp?.value; return ts ? dc.luxon.DateTime.fromISO(ts) : null; }} getFile={(p) => p.$path || ""} /></div>;
   };
   ```
   If THIS works, the issue is specific to the original file's quirks. Then add back the query string, then the useCurrentFile hook, etc., until the error appears.

5. **calendar.jsx alternative — simplify controlled mode:** If step 4 fails even with a minimal file, `calendar.jsx` itself might have a JSX parsing issue. Try reverting it to the simpler uncontrolled-only version (remove `externalViewDate`, `onViewDateChange`, `navigate`, and the `{controlled && ...}` branches). This would break `Daily Note Calendar.md`'s 3-month layout but would confirm whether calendar.jsx is the culprit.

---

## Current file states (as of end of session)

### `Z. Meta/datacore/calendar.jsx`
- Uncontrolled mode: has own prev/next/today buttons
- Controlled mode: parent passes `viewDate` prop, nav hidden
- Hover preview: `app.workspace.trigger("hover-link", ...)` on dot `mouseenter`
- Regex: `/\.md(?=#|$)/` strips `.md` before optional `#Heading`
- No object spread in JSX (was simplified from `{{ ...S.header }}` to explicit object)

### `Note and Tags By Recent Datacore Version.md` (calendar version)
- Has `const Calendar = await dc.require(...)` at top
- Single-line return (matching original style)
- JSX comment on line 142 is neutralized (plain text, no `<>` tags)
- Still erroring

### `Note and Tags By Recent Datacore Version (original).md` (backup)
- Exact original code, no Calendar
- Original single-line return and original JSX comment preserved
- Use this as the ground-truth reference
