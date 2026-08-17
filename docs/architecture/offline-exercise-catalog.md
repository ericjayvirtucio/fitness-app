# Offline exercise catalog architecture

## Boundary and ownership

The Exercise Catalog is the first Workout capability:

```text
Workout tab → Exercise Library routes → exercise-catalog presentation
  → capability-owned use cases and repository contract
  → ExerciseCatalogSqliteRepository → DatabaseConnection → Expo SQLite
```

`@fitness/domain` owns immutable `ExerciseDefinition` values and the controlled
equipment, primary-muscle, and logging-mode vocabularies. The mobile application
owns catalog lifecycle, favorite state, search normalization, duplicate warnings,
and UUID injection. Raw SQLite rows never leave infrastructure.

Favorite state is catalog metadata rather than exercise-definition semantics.
There is no generic catalog service or repository shared with Nutrition.

The catalog can also be populated in one deliberate act from a code-owned starter
set. That import writes ordinary catalog rows through the same domain
construction and the same repository, so nothing in this document has a special
case for where a definition came from. See the
[starter exercise library architecture](starter-exercise-library.md).

## Definition and logging modes

An exercise has a UUID, trimmed display name, one principal equipment category,
one primary muscle group, one logging mode, and optional trimmed notes. Names are
limited to 80 characters and notes to 500 as input-integrity boundaries.

The initial equipment vocabulary is none, bodyweight, barbell, dumbbell,
kettlebell, machine, cable, resistance band, cardio machine, and other. The
muscle vocabulary is chest, back, shoulders, biceps, triceps, quadriceps,
hamstrings, glutes, calves, core, full body, conditioning, and other. These are
organization labels, not anatomical, coaching, injury, or medical claims.

Logging modes declare future valid session inputs:

| Mode                | Future inputs                  |
| ------------------- | ------------------------------ |
| Reps only           | repetitions                    |
| Weight + reps       | external `Mass`, repetitions   |
| Bodyweight + reps   | repetitions                    |
| Added weight + reps | added `Mass`, repetitions      |
| Assistance + reps   | assistance `Mass`, repetitions |
| Duration            | `Duration`                     |
| Distance            | `Length`                       |
| Distance + duration | `Length`, `Duration`           |

Narrow compatibility rules reject bodyweight modes without bodyweight equipment,
assistance outside machine/band/other, and distance modes outside no equipment,
cardio machine, or other. Sprint 11 stores no actual measurements.

Secondary muscles, movement patterns, laterality, multiple equipment categories,
and a separate exercise type are deferred until a real planning, session, or
analytics use case requires them.

## Identity, search, duplicates, and favorites

Expo Crypto generates RFC 4122 UUIDs at composition and `DomainId` validates
them. Names are not identities. Display names are retained while a stored search
name trims, collapses whitespace, and lowercases text. SQLite `LIKE` wildcard
characters are escaped before bounded substring search.

Search returns favorites first, then normalized name and ID. Normal browsing and
favorites use deterministic name and ID ordering. Exact normalized-name matches
show a warning and require explicit confirmation, but remain legal; similar names
are independent and never merged.

Browsing and searching also accept optional criteria: one equipment value and one
primary muscle group, held as an application-owned `ExerciseCatalogFilter` whose
`null` means "not narrowed on this field". A value outside the domain vocabulary
maps to `null` rather than raising, because only a programming mistake can
produce one and refusing to narrow cannot show the wrong catalog. Ordering
depends on whether a name was supplied, never on whether the list was narrowed.
See [Specification 0029](../../specs/0029-exercise-library-filtering.md).

Favorites and performed recents are shortcuts to the whole catalog, so neither is
read or shown while a search or a filter is narrowing it. A narrowed library
therefore issues fewer queries than an unnarrowed one.

Favorites persist in the exercise row and can change without editing the pure
definition. Performed recents derive the latest completed Workout Session actual
set for each source definition UUID. Creation, editing, Planner selection, and
active sessions are not usage. Current UI resolves only existing Catalog rows;
historical display remains snapshot-only. No usage metadata is persisted.

## Edit, delete, and future references

Edits retain UUID and favorite state while replacing validated definition data.
Deletion requires named destructive confirmation and performs a local hard
delete only when no Workout Plan references the definition. Referenced deletion
is blocked and reports affected days/workouts. Referenced logging modes also
cannot change, preventing silent reinterpretation of planned targets. Renames and
other valid edits appear in current mutable plans. There is no tombstone,
archive, undo, or synchronization behavior.

Workout Sessions copy exercise name and logging mode when an exercise enters the
session, including when one is
[added to a completed workout](completed-workout-exercise-addition.md), which
reads a definition to capture a new snapshot and never to reinterpret an existing
one. Source catalog UUIDs remain non-relational provenance, so session snapshots
do not block deletion or require a mutable catalog join.

## Persistence and performance

Migration 7 creates `exercise_catalog_item`. SQL checks enforce field bounds,
controlled values, booleans, and the narrow logging-mode compatibility rules.
Indexes cover `(normalized_name, id)` and `(is_favorite, normalized_name, id)`.
The catalog table itself stores no seed data, timestamps, use counts, recents,
aggregates, cloud identity, sync clocks, or tombstones. Migration 8 introduces
Planner-owned foreign-key references with restricted catalog deletion.

All values are bound. Reads reconstruct `DomainId`, `ExerciseDefinition`, and
`ExerciseCatalogItem`, including verifying stored normalization. Failures become
stable `PersistenceError` messages. Focused bounded queries avoid per-card and
cross-capability reads. A leading-wildcard scan is acceptable at personal-catalog
scale; no FTS, cache, worker, or global state is used.

Browse and search statements are composed in one private repository method. Each
clause is a code literal contributing exactly one bound parameter, and an absent
criterion contributes no clause, so an unnarrowed read issues the statement the
catalog has always issued. Equipment and primary muscle group are deliberately
unindexed: a filtered browse costs 0.0125 ms at 300 rows and 0.185 ms at 5000
against the existing indexes, both columns are low cardinality, and the existing
`(normalized_name, id)` index already covers the ordering, so a covering
classification index would save microseconds a person cannot perceive.

## Experience, accessibility, and privacy

Workout remains a landing page so Planner and Session can later become peers of
Exercise Library. Nested routes provide browse, create, and edit. Cards show only
name, principal equipment, primary muscle, logging mode, and favorite action.

The library narrows through its search field and two single-choice filters that
sit directly above the lists they narrow, below the starter section, cleared
together by one control. That placement is load-bearing: the filters appear as
soon as the library stops being empty, and above the starter section their
appearance carried the import control and its result off a screen that keeps its
scroll offset. Filter state lives in the screen
and is not persisted. The filters are absent while the library is empty, because
there is nothing to narrow. A narrowed list that matched nothing states what is
narrowed rather than claiming the library is empty, and a list that came back at
its read bound says so instead of silently showing a prefix of the catalog.

Both filters, their summary, and their clear action live in one capability-owned
control, `presentation/ExerciseFilterControls`. It is not a design-system
component: it knows the equipment and muscle-group vocabularies and the sentences
the product says about them, which the design system deliberately does not hold.
Twenty-five options are four fifths of a viewport at default text and nearly two
viewports at the largest accessible size, so the choosing is put away behind one
labelled button and opened deliberately. What is put away is only the choosing —
the chosen values stay on the control's own accessible name, and the summary and
the clear action are rendered outside the region that closes, so an active filter
is never hidden by the control that applied it. The button sits outside that
region too, so it is the same element across an open and a close and focus is not
lost. Expansion belongs to the control and is never persisted; the criteria
belong to the screen. See
[Specification 0030](../../specs/0030-compact-exercise-filtering.md).

The Exercise Picker composes that same control, so the Planner, the active
Session, and completed-workout addition browse, search, and narrow identically.
Filtering is composed rather than offered as a prop, so no consumer can switch it
on or off. Recently performed is suppressed while the picker is narrowed, for the
reason the library suppresses Favorites and Recently performed: narrowing
identifiers resolved from completed history could only be done in presentation
over an unbounded fetch. A narrowed picker therefore issues one read rather than
two, and a narrowed miss states what is narrowed instead of advising somebody
with twenty-six definitions to go and create some.

The experience uses Dynamic Type, keyboard-aware scrolling, native radio-group
semantics, minimum touch targets, textual validation, live error regions,
meaningful favorite labels, and descriptive delete confirmation. Meaning never
depends on color or an icon alone.

Exercise definitions remain private device-local data in the operating-system
application sandbox. Names and notes are not logged. There is no network,
analytics, telemetry, AI, external provider, or new permission. Encryption,
export, backup, restore, reset, retention, and synchronization remain deferred.
