# Specification 0030: Compact, reusable exercise filtering

- Status: Approved
- Date: 2026-08-17

## Objective and scope

Make the filtering [Specification 0029](0029-exercise-library-filtering.md)
shipped compact enough to live on a screen a person scrolls, and available
wherever a person chooses an exercise.

Version 1 puts the two existing filters, their summary, and their clear action
into one control that every surface shares; puts the choosing away by default
while leaving the chosen values, the match count, and the clear action on screen;
and composes that control into `ExercisePicker`, so the Workout Planner, the
active Workout Session, and completed-workout addition narrow the catalog exactly
as the Exercise Library does.

Nothing below presentation changes. The criteria type, the repository contract,
the query shape, the read bounds, the ordering, and every sentence a person
already reads are untouched.

Multiple selection, sorting, saved or persisted filter state, tags, secondary
muscles, paging, a raised read bound, and any schema change remain excluded.

## The problem

Two `SelectionField` radio groups render twenty-five options — ten equipment
values plus "Any equipment", thirteen muscle groups plus "Any muscle group" — and
they appear as soon as the library holds a single definition.

Measured against the repository's own tokens, at a 342 px content width:

| Surface              | Default text | Largest accessible text |
| -------------------- | ------------ | ----------------------- |
| Equipment group      | 280 px       | 634 px                  |
| Muscle group         | 280 px       | 700 px                  |
| Both, unnarrowed     | **576 px**   | **1350 px**             |
| Both, while narrowed | 702 px       | —                       |

A usable scroll viewport is roughly 700–740 px on a 6.1-inch device and 560–600
px on the smallest supported one. The block is therefore about four fifths of a
viewport at default text and nearly two viewports at the largest accessible size.

Everything above the first exercise card sums to 1063 px: header 81, gap 32,
search field 72, gap 32, starter section 158, gap 32, filters 576, gap 32, and
the "All exercises" heading 48. The filters are 54% of it, and the total does not
change with the size of the catalog, because Favorites and Recently performed
render only when they hold something. **The cost is identical for a person with
one definition and a person with twenty-six**, which makes it worst for the
person who has just created their first.

The first exercise card is consequently never on screen at first paint. Without
the block the stack is 531 px and it is.

An active filter is also poorly discoverable on return. Filter state survives
pushing the editor and coming back, the screen keeps its scroll offset, and the
summary that explains a short list sits roughly a thousand pixels down.

The pickers have none of this. With twenty-six definitions the fallback list is
about 3070 px — more than four viewports, alphabetical — and "what can I do with
a dumbbell" cannot be asked at all. The QA harness already records the
consequence: reach a definition through `exercise-picker-search`, because the
fallback list will not show it.

This is a refinement. Sprint 29's filtering works, is accessible, and is honest.
The fix is bounded, and it removes a class of test fragility as well as a class
of scrolling.

## Ownership and flow

```text
ExerciseLibraryScreen / ExercisePicker
  -> ExerciseFilterControls        (exercise-catalog/presentation)
  -> ExerciseCatalogFilter                       unchanged
  -> BrowseExercisesUseCase                      unchanged
  -> ExerciseCatalogRepository.listMatching      unchanged
```

## Where the control lives

`apps/mobile/src/features/exercise-catalog/presentation/ExerciseFilterControls.tsx`.

Not the design system. The control knows the equipment and muscle-group
vocabularies, the `ExerciseCatalogFilter` type, and six product sentences, and
the design system's own guide forbids business rules and feature-specific copy
inside it. Four consumers demonstrate reuse of _this_ component, not of a generic
one.

No design-system component is added either. The disclosure is an `AppButton` and
a conditional render; this is the first collapsible in the repository, and one
use case is not the repeated, reviewed need the design system requires. A second
one justifies promoting the mechanic, and only then.

`ExercisePicker` lives in `workout-planner` and imports this control across a
capability boundary. That direction already exists in both senses: the picker
imports `exercise-catalog/application`, and `workout-history` imports the picker.

## The control

```ts
ExerciseFilterControls({
  filter: ExerciseCatalogFilter;
  hasQuery: boolean;
  matchCount: number;
  onChange: (filter: ExerciseCatalogFilter) => void;
  testIDPrefix: string;
});
```

Expansion belongs to the control; the criteria belong to the screen. A screen
needs to know what is narrowed, never whether the options happen to be shown.

`testIDPrefix` is `exercise-library` or `exercise-picker`, and derives
`<prefix>-filters-toggle`, `<prefix>-equipment-filter`, `<prefix>-muscle-filter`,
and `<prefix>-filter-summary`. The library's three published identifiers are
therefore unchanged. Two prefixes are deliberate rather than incidental: both
surfaces can exist in one run, and an automation step must never be ambiguous
about which screen it meant.

### What collapses, and what does not

Only the choosing. The summary and "Clear filters" are rendered **outside** the
collapsed region, so an active filter is never hidden by the control that applied
it, and every existing assertion on the summary and the clear action still holds.

The toggle is rendered outside that region too, rather than inside it. It is
therefore the same node before and after a press, and focus stays where the
person left it.

| State                | Height, default text |
| -------------------- | -------------------- |
| Collapsed, no filter | 44 px                |
| Collapsed, filtered  | ~170 px              |
| Expanded, no filter  | 636 px               |

Collapsing removes 532 px of the 576, which is 92% at default text and 96% at the
largest accessible size.

### Collapsed by default

Collapsed is the point of the change; expanded fixes nothing. The discoverability
cost is one tap and is bounded by what the collapsed state is: a full-width
labelled button reading "Filters", in exactly the position the block occupied,
directly above the lists it narrows — not an icon and not a chevron alone.

### Placement is unchanged

Still below the starter section, still directly above the lists. Collapsing
shrinks the insertion an import makes above the control the person just pressed,
but expanding restores every one of those chips in that same place, so the reason
Sprint 27 and Sprint 29 both paid a device QA run to establish that position still
holds. The presentation test that asserts the order still asserts it.

## Wording

Two new literals. No existing string changes.

```text
Filters
Filters: {A}
Filters: {A} and {B}
Show filters. No filters applied.
Hide filters. No filters applied.
Show filters. Filtered by {A}. 3 exercises.
Hide filters. Filtered by {A} and {B}. 1 exercise.
```

The accessible name is the act pressing performs, then the sentence the summary
already states, so a person who cannot see the control hears both what it does
and what is currently narrowed. Expanding announces nothing extra:
`accessibilityState.expanded` is announced natively, and a live region there
would speak over the summary's.

`{A}` and `{B}` are the labels already defined for the chosen values.

## The pickers

All three, or none. `ExercisePicker` composes the control as a child it owns and
gains no prop, so no consumer can switch filtering on or off and the rule cannot
be violated by convention. `PlannedWorkoutEditorScreen`, `WorkoutSessionScreen`,
and `CompletedWorkoutExerciseAdditionScreen` are unchanged, and so is every
composition root: `browseExercises` is already a `BrowseExercisesUseCase`, and the
criteria parameter already exists and already defaults to no filter.

### Recents-first under a filter

A filter suppresses recents, exactly as it suppresses Favorites and Recently
performed in the library.

| Picker state                    | Read                                   |
| ------------------------------- | -------------------------------------- |
| Nothing narrowed, recents exist | `listRecentlyPerformed(10)`, unchanged |
| Nothing narrowed, no recents    | `listAll()`, unchanged                 |
| Nothing narrowed, a query       | `search(query)`, unchanged             |
| Filtered, no query              | `listAll(filter)`                      |
| Filtered and searched           | `search(query, filter)`                |

Filtering the recents themselves would mean narrowing identifiers resolved from
completed history, which needs either a repository-contract change or the
fetch-then-filter this capability refuses. Showing unnarrowed recents above a
narrowed list is the self-contradicting screen Specification 0029 already
rejected. Suppression needs neither, issues one read rather than two, and is a
rule the product already has.

### An empty picker

The picker's empty state says to create exercises in the Exercise Library, which
is untrue when a filter is what emptied the list. While narrowed, the summary
already states the miss and no empty state renders. The control itself is absent
while the catalog is genuinely empty, for the same reason it is absent on an
empty library.

## Filter state and lifetime

- **Library** — unchanged. Screen-local, survives a push and a return, survives
  backgrounding, cleared by a relaunch.
- **Picker** — picker-local. Every consumer unmounts the picker on dismissal, so
  reopening one is a fresh choice, exactly as the query is already.
- Expansion is never persisted anywhere and never leaves the control.

## Stale responses

The picker debounced its reads but did not order them: a slow response could
still land after a newer one. Adding a second input to the same effect makes that
reachable, so the picker now issues every read under a monotonically increasing
request number and discards a response that is no longer current, including its
failure. A read error consequently cannot outlive the read that caused it. The
library's guard is unchanged.

## Errors

Filtering remains a read and introduces no error text.

| Situation                                         | Outcome                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| Storage unavailable during a filtered picker read | The picker's existing "Exercises could not be loaded." |
| A superseded response, in either surface          | Discarded, failure path included                       |
| A filtered picker miss                            | The summary's own sentence, no empty state             |
| A picker filtered, dismissed, and reopened        | Unmounted, so a fresh unnarrowed choice                |
| The catalog changing under a filtered picker      | The next read applies the active criteria              |
| A collapsed control across a focus reload         | The library re-reads under the active criteria         |

No sentence carries SQL, a table name, an identifier, a path, or a stack trace.

## Derived behavior

Nothing derived is persisted, and no filter or expansion writes anything.

- History, Progress, Personal Records, and the Planner's stored data are
  unaffected.
- Export, restore, erasure, and replacement are unaffected: none reads the browse
  path, and the schema is untouched.
- The starter import is unaffected. Its refresh already applies the active
  criteria, and a collapsed control makes the insertion it causes smaller.
- The exercise editor is unaffected.
- No definition changes identity, ordering, or favorite state.

## Migration, dependencies, and performance

No migration, no index, no column, no dependency. The schema stays at
`user_version` 11 with eleven migrations.

Reads are unchanged, so Specification 0029's measurements still stand: 0.0125 ms
at 300 rows. A narrowed picker issues one query instead of two, and a collapsed
control removes roughly twenty-five mounted pressables per surface from the
default tree.

## Security, privacy, and accessibility

No network, telemetry, analytics, AI, permission, or dependency. Every value is
bound. Nothing about a filter or an expansion is logged.

The toggle carries a button role, a name stating both its action and the active
filter, `accessibilityState.expanded`, and the minimum touch target. Focus is not
lost across expansion, because the toggle is never unmounted. Every option keeps
its radio role, its label, its selected state, and its touch target. The summary
remains a polite live region, so an active filter is announced while the options
are away. Focus order is search, toggle, options while expanded, summary, clear,
lists. Selection is never conveyed by colour alone, and every label scales.

## Verification

Application, persistence, and real-SQLite tests are unchanged and prove by
running unmodified that nothing below presentation moved.

Control tests assert that the options are away by default, that expanding reveals
both groups with their roles, names, and selected states, that the collapsed
control states an active filter and keeps the summary and the clear action, that
a narrowed miss is distinguished from a search that also narrowed, and that the
toggle is the same element across expansion.

Library tests assert the section order still holds, that every Sprint 29
behaviour still passes unchanged, that an empty library renders neither the
control nor the options, and that an active filter stays visible and stated while
the options are away.

Picker tests assert that an unnarrowed picker calls the catalog exactly as it did
before, that choosing re-queries and re-renders, that a filter and a search
compose, that recents are suppressed while narrowed and restored when cleared,
that a filtered miss is distinguishable from an empty catalog, and that a
superseded response never overwrites a newer one. The Planner and
completed-addition screens each assert that the picker they render offers the
control; the active Session screen has no unit spec, and is covered end to end.

End-to-end coverage adds a Sprint 30 suite and regression scenario 23.

## Explicit exclusions

Multiple selection, sorting, saved or persisted filters, filter state in SQLite,
free-text tags, user-defined categories, secondary muscles, bulk edit or delete,
paging or raised bounds, an exact catalog count, new personal record categories,
charts, Progress redesign, adherence, streaks, localization, onboarding, starter
Workout Plans, starter content changes, export format changes, cloud
synchronization, authentication, backend endpoints, AI, notifications, dependency
upgrades, and repository-wide refactoring.
