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

Favorites persist in the exercise row and can change without editing the pure
definition. Recents are deliberately absent because creation and editing are not
exercise usage. Planner or Session must provide a real usage event first.

## Edit, delete, and future references

Edits retain UUID and favorite state while replacing validated definition data.
Deletion requires named destructive confirmation and performs a local hard
delete. There is no tombstone, archive, undo, or synchronization behavior.

Future Workout Plans may reference a catalog UUID, but their missing/deleted
reference behavior must be designed before implementation. Completed Workout
Session records must copy enough exercise name and logging context to remain
historically stable. Session history must never rely on joining mutable catalog
definitions for historical truth.

## Persistence and performance

Migration 7 creates `exercise_catalog_item`. SQL checks enforce field bounds,
controlled values, booleans, and the narrow logging-mode compatibility rules.
Indexes cover `(normalized_name, id)` and `(is_favorite, normalized_name, id)`.
No seed data, timestamps, use counts, recents, aggregates, foreign keys, cloud
identity, sync clocks, or tombstones are stored.

All values are bound. Reads reconstruct `DomainId`, `ExerciseDefinition`, and
`ExerciseCatalogItem`, including verifying stored normalization. Failures become
stable `PersistenceError` messages. Focused bounded queries avoid per-card and
cross-capability reads. A leading-wildcard scan is acceptable at personal-catalog
scale; no FTS, cache, worker, or global state is used.

## Experience, accessibility, and privacy

Workout remains a landing page so Planner and Session can later become peers of
Exercise Library. Nested routes provide browse, create, and edit. Cards show only
name, principal equipment, primary muscle, logging mode, and favorite action.

The experience uses Dynamic Type, keyboard-aware scrolling, native radio-group
semantics, minimum touch targets, textual validation, live error regions,
meaningful favorite labels, and descriptive delete confirmation. Meaning never
depends on color or an icon alone.

Exercise definitions remain private device-local data in the operating-system
application sandbox. Names and notes are not logged. There is no network,
analytics, telemetry, AI, external provider, or new permission. Encryption,
export, backup, restore, reset, retention, and synchronization remain deferred.
