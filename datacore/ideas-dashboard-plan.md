> **Status (2026-08-20): parked, nothing to build right now.**
> On revisiting this, we clarified that an "idea" is simply a **daily-note subheading** —
> everything captured in daily notes — and that the existing
> `C. Dashboards/Main/Daily Note Subheadings By Week.md` dashboard **already fulfills the
> current idea workflow**. There are no stages (seed/growing/evergreen) in use yet, so the
> pipeline/inbox/stale/random/orphan pieces below are **deferred**, not cancelled. They'll be
> reconsidered after a calm weekend session to redefine what "ideas" should mean in this vault.
> Companion note: `B. Note Box/Inbox/Idea workflow — proposal to redefine.md`.

---

I don't have the specifics of that exact session pulled up, but I do know you've built Datacore components before (rolling calendar, weekly notes view, daily note section extraction) — so this fits your existing pattern.

The core idea: treat "daily ideas" and "self-contained notes" as two ends of one pipeline — capture → develop → promote.

**Dashboard pieces:**

- **Inbox query** — Datacore pull of everything tagged `#idea` with `status: seed`, so loose thoughts from daily notes don't stay buried there.
- **Capture template (QuickAdd)** — a hotkey that spins up a *new standalone note* (not a daily-note bullet) with frontmatter (`status`, `source`, `created`). Starting ideas as their own file is what actually makes them self-contained later.
- **Pipeline view** — seed → growing → evergreen columns with counts, so you can see where ideas stall.
- **Stale idea surfacer** — anything untouched 14+ days, so nothing dies quietly.
- **Random resurfacer** — one older idea pulled up daily, good for prompting merges/links.
- **Orphan finder** — idea notes with zero backlinks, a decent signal a note isn't self-contained yet.

Want me to draft the actual Datacore JSX for the inbox + pipeline view first? That's usually the highest-leverage piece to start with.
