# Specification 0029: Exercise Library filtering

- Status: Approved
- Date: 2026-08-16

## Objective and scope

Let a person narrow the Exercise Library by equipment and by primary muscle
group, composing with the name search the library already has, so a catalog of
twenty-six starter definitions — or two hundred hand-authored ones — can be
reduced to what they are looking for without scrolling or guessing a name.

Version 1 adds two single-choice filters to the Exercise Library screen, one
control that clears both, one line stating what is narrowed and how many matched,
and one sentence stating when a list came back at the bound it is read under.
Every narrowed read is one bounded, parameter-bound query on the path browsing
and searching already used.

Multiple selection per filter, filtering inside the exercise pickers, sorting,
saved filters, persisted filter state, tags, secondary muscles, any schema change,
and any change to what a definition is or how it is authored are excluded.

## The problem

Equipment and primary muscle group are captured on every definition, constrained
by `CHECK` in migration 7, labelled in `presentation/exercise-options.ts`, and
shown on every catalog card. Nothing reads them.

The library's only narrowing tool is `search`, a literal substring match over the
normalized name. It requires knowing the name.

Since [Specification 0027](0027-starter-exercise-library.md) a fresh installation
normally holds twenty-six definitions after one press. Finding a dumbbell chest
exercise in that catalog means reading twenty-six cards — roughly five viewport
heights — to arrive at the answer that there is not one. Absence is not something
scrolling answers well.

This is an ergonomics problem, not an integrity one. Nothing is lost, nothing is
wrong, and nothing about a definition is at risk. The cost of fixing it is
bounded because the data is already stored and already constrained.

### The one defect the review surfaced

`listAll` is read under a limit of 100 and `search` under 50. Past those bounds
both silently show a prefix of the catalog. At three hundred definitions the
library shows the alphabetically first hundred and says nothing.

Filtering reduces most result sets below the bound but does not repair the
silence, so this specification also states the truncation:

- browsing: "Showing the first 100 exercises. Narrow the list to see the rest."
- searching: "Showing the first 50 matches. Narrow the list to see the rest."

The sentence appears only when a list came back at exactly its bound. Raising the
bounds, paging, and an exact catalog count remain out of scope; the honest
statement costs one comparison and one string, and a person who sees it has an
action available.

## Ownership and flow

The workflow belongs to `exercise-catalog`.

```text
ExerciseLibraryScreen (two filters, existing search, clear, summary)
  -> BrowseExercisesUseCase.listAll(filter) / .search(query, filter)
  -> ExerciseCatalogRepository.listAll(limit, filter) / .search(q, limit, filter)
  -> ExerciseCatalogSqliteRepository.listMatching  (one bounded statement)
  -> the section the library already renders
```

## The criteria

`application/exercise-catalog-filter.ts` owns `ExerciseCatalogFilter`:

```ts
Readonly<{
  equipment: ExerciseEquipment | null;
  primaryMuscleGroup: ExerciseMuscleGroup | null;
}>;
```

`null` means "not narrowed on this field". The criteria are an application read
intent, not a domain concept: `@fitness/domain` owns the vocabularies, and one
arrangement of them carries no invariant of its own. `packages/domain` is
unchanged, exactly as it was for the starter content in Specification 0027.

`toEquipmentFilter` and `toMuscleGroupFilter` map anything outside the domain
vocabularies to `null`. A value outside the vocabulary can only come from a
programming mistake — the controls emit members of the domain tuples and the
parameter is typed — so it is prevented rather than reported, and the outcome
that cannot show a person the wrong catalog is chosen: refuse to narrow.

## Single selection

Each filter holds one value. Multiple selection would turn `equipment = ?` into a
variadic `IN` list whose shape depends on the data, replace the radio semantics
the design system already provides with checkbox semantics it does not, and make
the empty-result wording an arbitrary-length enumeration. For a person holding
twenty-six definitions, "what can I do with a dumbbell" is the real question.
Multiple selection stays a clean later extension, because only the criteria type
would change.

## Repository contract

`listAll` and `search` each take the criteria as an optional third concern:

```ts
listAll(limit: number, filter?: ExerciseCatalogFilter);
search(normalizedQuery: string, limit: number, filter?: ExerciseCatalogFilter);
```

No member is added or removed, so the fakes that implement this interface in
other capabilities are untouched. Drift is prevented in the implementation
instead: both delegate to one private `listMatching`, the only place the catalog's
browse and search statements are composed.

`BrowseExercisesUseCase` takes the criteria before the bound —
`listAll(filter?, limit = 100)`, `search(query, filter?, limit = 50)` — so a
caller that narrows never restates a limit the use case owns. The bounds are
exported as `exerciseBrowseLimit` and `exerciseSearchLimit`, because the library
states when a list came back at one of them.

`listFavorites`, `getByIds`, `findByNormalizedName`, and the performed-recents
reader are unchanged.

## Query shape

```sql
SELECT <columns> FROM exercise_catalog_item
[WHERE <fragments joined by AND>]
ORDER BY <ordering>
LIMIT ?
```

Each fragment is a code literal contributing exactly one bound parameter:
`normalized_name LIKE ? ESCAPE '\'` for a query, `equipment = ?`, and
`primary_muscle_group = ?`. An absent criterion contributes no clause and no
placeholder, so an unnarrowed read issues the statement this repository has
always issued. No filter value is interpolated, and no identifier is dynamic.

Ordering depends only on whether a name was supplied, never on narrowing:
`normalized_name ASC, id ASC` while browsing, `is_favorite DESC, normalized_name
ASC, id ASC` while searching. A filter never reorders the catalog and never
changes a definition's identity or favorite state.

## Favorites and Recently performed under a filter

Both are hidden while a filter is active, and neither is read.

This is the behavior the library already has: a non-blank query hides both today.
Narrowing collapses the screen to one answer list, and two unnarrowed sections
above a narrowed one is a screen that contradicts itself. Filtering them instead
would need either a second narrowed favorites query or a narrowed recents read,
which resolves identifiers derived from completed sessions and could only be
narrowed by filtering in presentation — the fetch-then-filter this specification
refuses.

A narrowed library therefore issues fewer queries than an unnarrowed one.

## Filter state

Screen-local. It survives pushing the editor and returning, because the screen
stays mounted and the focus reload reads under whichever criteria are current. It
survives backgrounding. It is cleared by a relaunch, because nothing is
persisted, and there is no route parameter, no store, and no row.

## Stale responses

A filter tap, a keystroke, and a focus reload can be in flight together. Every
read is issued under a monotonically increasing request number; a response whose
number is no longer current is discarded without touching the screen, including
its failure path. The existing 200 ms debounce still covers keystrokes.

## Errors

Filtering is a read and introduces no error text.

| Situation                                | Outcome                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| A value outside the vocabulary           | Cannot reach the repository; mapped to "not narrowed"                         |
| A filter and a search matching nothing   | An empty result stating both, never a fallback to everything                  |
| A filter over an empty catalog           | The filtered sentence; clearing reveals "No exercises yet"                    |
| A filter applied after a starter import  | The import refreshes the lists under the active criteria                      |
| A definition deleted from another screen | The focus reload re-reads under the active criteria; the row is simply absent |
| Storage unavailable                      | The library's existing error state, unchanged                                 |
| A superseded response                    | Discarded                                                                     |

No sentence carries SQL, a table name, an identifier, a path, or a stack trace.

## User-facing behavior

Order on the screen: header, search field, filters, empty state, starter section,
Favorites, Recently performed, the results section, "Create exercise".

The filter controls are rendered only when the "No exercises yet" empty state is
not. An empty library has nothing to narrow, and a first-run screen is not made
taller by controls that cannot do anything yet — which also leaves the height of
the empty library, and every flow that meets it, exactly as it was.

| Control      | Visible label                                              | Semantics                                                          |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Equipment    | "Filter by equipment", "Any equipment" then ten values     | Radio group; each option a radio with a label and a selected state |
| Muscle group | "Filter by muscle group", "Any muscle group" then thirteen | Same                                                               |
| Summary      | see below                                                  | Polite live region, shown only while narrowed                      |
| Clear        | "Clear filters"                                            | Button, shown only while narrowed, clears both in one action       |

The "any" option is a sentinel rather than an unselected group, so every state —
including "not filtered" — is a visible choice with a selected state.

Section headings state what the section holds: "All exercises" unnarrowed,
"Filtered exercises" while filtered with no query, "Search results" whenever a
query is present. No heading claims more than its list contains.

### Wording

```text
Filter by equipment
Any equipment
Filter by muscle group
Any muscle group
Clear filters
Filtered exercises
Filtered by {A}. {n} exercises.
Filtered by {A} and {B}. 1 exercise.
Filtered by {A} and {B}. No exercises match these filters.
Filtered by {A}. No exercises match this search and these filters.
Showing the first 100 exercises. Narrow the list to see the rest.
Showing the first 50 matches. Narrow the list to see the rest.
```

`{A}` and `{B}` are the labels already defined for the chosen values. No existing
string changes.

The summary carries both what is narrowed and what came back, so it is one
element and one announcement: a person who cannot see the list hears the result
of every change, and the empty case is a statement about the filter rather than
about the library.

### Three different kinds of nothing

| State                               | What the person sees                                      |
| ----------------------------------- | --------------------------------------------------------- |
| Empty library, nothing narrowed     | "No exercises yet" and "Create first exercise", as before |
| A query with no filter and no match | "No search results." under "Search results", as before    |
| Anything narrowed with no match     | The summary's own sentence, and no results section at all |

The narrowed case renders no list section, so nothing appears under a heading
promising results it does not have, and nothing anywhere says the library is
empty while a filter is applied.

## The pickers

`ExercisePicker` is shared by the Workout Planner, the active Workout Session,
and the addition of an exercise to a completed workout, and requires that the
catalog it browses and the way it is searched stay identical between them. That
rule is honoured by including all three or none. Version 1 includes none.

The picker's default is recents-first, which is a different job: at the moment of
choosing, a person usually knows what they are about to do, and the picker
already carries `exercise-picker-search` for the rest. Filtering there would move
three screens, two of them mid-task, in a sprint whose subject is a fourth.

The criteria parameter is optional and defaults to no filter, so the picker's
call path is unchanged, and a test asserts it. Picker filtering is the natural
follow-up, and it would apply to all three at once.

## Derived behavior

Nothing derived is persisted, and a filter writes nothing.

- The Workout Planner, the active Workout Session, History, Progress, and
  Personal Records are unaffected.
- Export, restore, erasure, and replacement are unaffected: none of them reads
  the browse path, and the schema is untouched.
- The starter import is unaffected. Its refresh applies the active criteria, for
  the same reason it already refreshes an active search.
- The exercise editor is unaffected.
- No definition changes identity, ordering, or favorite state because of a
  filter.

## Migration, performance, and dependencies

No migration. The schema stays at `user_version` 11 with eleven migrations, and
no column, index, trigger, or dependency is added.

An index on the two classification columns was measured and rejected. Against
migration 7's columns and both existing indexes, a filtered browse costs 0.0125 ms
at 300 rows and 0.185 ms at 5000; a covering
`(equipment, primary_muscle_group, normalized_name, id)` index would save 10 µs
and 177 µs respectively. Without it the planner already reports
`SCAN exercise_catalog_item USING INDEX exercise_catalog_item_normalized_name`,
so the ordering is covered and no sort step runs. A 16.7 ms frame is 1300 times
the 300-row cost. Both columns are low cardinality — ten and thirteen values —
so the index buys little even in principle. Realistic catalogs are twenty-six
after an import and, at the tail, a few hundred.

## Security, privacy, and accessibility

No network, telemetry, analytics, AI, permission, or dependency. Every value is
bound. Nothing about a filter is logged, and filter state exists only in memory.

Each filter is a radio group with an accessible name, and each option is a radio
carrying its label and its selected state, meeting the design system's minimum
touch target. Focus order follows the visual order: search, equipment, muscle
group, summary, clear, lists. The summary is a polite live region, so a result
change is perceivable without sight. Selection is never conveyed by colour alone,
and every label scales with Dynamic Type.

## Verification

Application tests assert that an unnarrowed browse behaves exactly as before and
passes no filter, that each filter narrows, that both together require both, that
a filter composes with a search, that a filter matching nothing returns empty
rather than everything, that every narrowed read stays bounded, that a blank
query still never reaches storage, and that a value outside the vocabulary cannot
reach the repository.

Persistence tests assert the exact unnarrowed statements, that each active
criterion contributes one clause and one bound parameter, that no filter value
appears in any statement, and that narrowing is one read with no write.

Real-SQLite tests run against the repository's own migrations and assert the
rows each filter returns, that both compose, that a filter and a search compose,
that nothing matched returns nothing, that narrowed ordering matches unnarrowed
ordering in both browse and search forms, that a narrowed read stays bounded, and
that no row, no other table, and no `user_version` changes.

Presentation tests assert the controls' roles, names, and selected states, that
they are absent on an empty library, that choosing re-queries and re-renders,
that both filters compose, that a filter composes with a search, that the empty
narrowed sentence is distinct from the empty library and names the search when
one is present, that Favorites and Recently performed are hidden while narrowed
and restored when cleared, that one action clears both, that a superseded read
never overwrites a newer one, and that a list at its bound says so.

End-to-end coverage adds a Sprint 29 suite and regression scenario 22.

## Explicit exclusions

Multiple selection, picker filtering, sorting, saved or persisted filters, filter
state in SQLite, free-text tags, user-defined categories, secondary muscles,
bulk edit or delete, paging or raised bounds, an exact catalog count, new personal
record categories, charts, Progress redesign, adherence, streaks, localization,
onboarding, starter Workout Plans, starter content changes, export format changes,
cloud synchronization, authentication, backend endpoints, AI, notifications,
dependency upgrades, and repository-wide refactoring.
