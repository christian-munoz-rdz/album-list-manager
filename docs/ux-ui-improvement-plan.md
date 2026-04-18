# UX/UI improvement plan (5 steps)

Persistent checklist derived from the Listen Later codebase audit. Each step is intended to be shippable on its own.

## Step 1 — Correct misleading semantics (accessibility)

- **Navbar:** Remove incorrect `role="tablist"` / `role="tab"` / `aria-selected` on navigation links; use plain `nav` + `Link` with `aria-current="page"` on the active route.
- **Chart album UI:** Fix `role="checkbox"` on composite chart cards that also contain links and buttons; align grid behavior with the list-row pattern (explicit, correctly labeled selection control).

**Goal:** Screen readers and keyboard users get accurate roles and relationships (WCAG 4.1.2, 1.3.1).

## Step 2 — Trust on failure (functional UX)

- **List reorder:** Add `onError` (or equivalent) to the reorder mutation: revert optimistic local order and show a clear error or retry path.

**Goal:** Server failures don’t leave the UI silently out of sync with the backend.

## Step 3 — Broad keyboard polish + tokens (quick wins)

- **Focus visibility:** Add consistent `focus-visible` rings on Login/Register inputs, `ListCard`, and the public toggle in Create List modal (match existing patterns elsewhere in the app).
- **Tokens:** Replace hardcoded `#1DB954` with `bg-spotify-green` (or project token) where duplicated.

**Goal:** Keyboard users see focus; theme stays consistent.

## Step 4 — Touch and discoverability

- **Chart grid “Add”:** Don’t rely on hover alone to reveal primary actions; show add affordances on coarse pointers / touch (e.g. always visible or `@media (hover: hover)`).

**Goal:** Mobile and tablet users can discover actions without hover.

## Step 5 — IA and deeper consistency (iterate as needed)

- **Routing:** Replace silent catch-all redirect to dashboard with a dedicated not-found route (or equivalent) where appropriate.
- **Shared list:** Fix “go home” / logged-out paths so anonymous users aren’t pushed into the wrong shell.
- **Optional follow-ups:** Segmented control primitive (Navbar + Search + Charts), shared modal/dialog pattern (focus trap, Escape, `aria-modal`), ShufflePicker improvements.

**Goal:** Navigation matches mental models; larger refactors land after P0–P1 fixes.

---

## Scope note

“Solved” here means **meaningfully improved**; some items (full modal system, every edge case) may warrant later iterations.

## How to use

Complete steps in order, or parallelize Step 3 with Step 1–2 if different owners — but **do Step 1 before heavy visual polish** on the same surfaces.
