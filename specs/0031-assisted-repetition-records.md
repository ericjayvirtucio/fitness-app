# Specification 0031: Assisted and load-bearing repetition records

- Status: Approved
- Date: 2026-08-17

## Objective and scope

Make a personal record available for every way this application records a set,
without ever comparing unlike work.

[Specification 0022](0022-deterministic-workout-personal-records.md) shipped seven
record categories covering seven of the eight logging modes the domain defines.
`assistance-and-repetitions` received none, and the per-exercise history screen
explained the gap with a sentence that overstated its own reason. Version 1 adds
one category, `least-assistance`, ordered ascending on the resistance dimension,
and removes that sentence.

Ordering direction becomes an explicit field on the descriptor table, because the
dimension alone cannot decide it: `heaviest-load` and `least-assistance` both
order on resistance and order oppositely.

Nothing below presentation and the descriptor table changes. Record identity,
tie-breaking, evidence, the reader contract, the use case, the composition roots,
`@fitness/domain`, the schema, and every existing category are untouched.

Repetitions under load, one-repetition-maximum estimation, cross-exercise or
cross-mode ranking, pace, load-volume records, record history, charts, and
persisted record tables remain excluded.

## The gap this closes

An assisted set is already stored. `workout_set.result_kind` has five values and
no assistance variant; assisted work persists as `resistance-and-repetitions`
with the assistance amount in `resistance_grams`, on the same row shape every
other resistance record reads. The starter exercise set ships `Assisted Pull-up`,
so a fresh installation can produce exactly the history this feature reads.

The claim was declined, not missing. Assistance was excluded because its ordering
inverts and every branch of the records query ordered descending — a design
decision, which the screen presented as an impossibility:

> Personal records are not available for assisted work, because less assistance
> and more repetitions cannot be compared as one value.

The second clause is true and stays true. The first does not follow from it.
`external-load-and-repetitions` also carries two dimensions that cannot collapse
into one value, and receives `heaviest-load` by claiming one dimension and
staying silent about the other. That sentence is removed rather than reworded,
because the record card's own label now states what is claimed.

## Record categories

`least-assistance` joins the seven categories Specification 0022 defined, which
are unchanged in category, dimension, eligible modes, label, and ordering.

| Category                         | Eligible logging modes                      | Compared value  | Order      |
| -------------------------------- | ------------------------------------------- | --------------- | ---------- |
| `most-repetitions`               | `repetitions`, `bodyweight-and-repetitions` | repetitions     | descending |
| `heaviest-load`                  | `external-load-and-repetitions`             | canonical grams | descending |
| `heaviest-added-load`            | `bodyweight-plus-load-and-repetitions`      | canonical grams | descending |
| `longest-duration`               | `duration`                                  | seconds         | descending |
| `longest-distance`               | `distance`                                  | millimetres     | descending |
| `longest-distance-with-duration` | `distance-and-duration`                     | millimetres     | descending |
| `longest-duration-with-distance` | `distance-and-duration`                     | seconds         | descending |
| `least-assistance`               | `assistance-and-repetitions`                | canonical grams | ascending  |

Every logging mode the domain defines now has at least one category.

## What a least-assistance record claims

It claims the smallest assistance amount recorded on a single completed actual
set of one exercise under the `assistance-and-repetitions` logging mode, and the
completed workout and set that prove it.

It refuses to claim anything about repetitions, volume, effort, strength,
progression, physiology, or nearness to unassisted work. It compares nothing
across exercises and nothing across logging modes. The label carries the
direction in its first word — `Least recorded assistance in a set` — so a person
who reads only the label is not told a heavier number is better.

Assistance and repetitions still do not collapse into one value. This category
orders one dimension and stays silent about the other, exactly as
`heaviest-load` does.

## Zero assistance

`workout_set.resistance_grams` is constrained to be greater than zero, matched by
the domain's `Mass` invariant and by the `resistance-and-repetitions` row shape,
which requires the column to be present. A repetition performed with no
assistance is therefore not an assisted set holding zero — it is unassisted work,
recorded under `bodyweight-and-repetitions` or `repetitions`, which have their own
record group.

This is correct, not a defect, and no constraint is relaxed or widened. A person
does not beat this record down to zero within the mode; they leave the mode, and
the assisted record stands as history under its own group.

## Ordering direction

`PersonalRecordDescriptor` gains a required `direction` of `ascending` or
`descending`. It sits beside `dimension` because it is a comparison rule rather
than a query plan: the dimension cannot determine it, and Specification 0022's
rule that comparison rules exist once rather than in SQL and again in TypeScript
would be broken by any home outside the descriptor table.

Column names, join shapes, index selection, and the tie-break chain stay in
infrastructure. Making the field required means adding a descriptor without
deciding its direction is a type error rather than a silent descending default.

## Ties and determinism

Each category resolves through one total order: the compared value in its
declared direction, then captured local date, start instant, exercise position,
set position, and set identifier ascending. Equal values therefore report the
earliest completed occurrence under an ascending order exactly as under a
descending one, and a later equal performance moves neither the date nor the
evidence link.

Ordering compares exact stored canonical numbers rather than the domain's epsilon
equality. A stored value of zero or below is corruption rather than a record and
fails safely — the case an ascending order would otherwise surface first.

## Read side and queries

Unchanged in shape. One compound statement returns one row per category through
`ORDER BY ... LIMIT 1` branches generated from the descriptor table; the only
addition is the direction token in each branch's leading order term. Branch count
rises from seven to eight and remains fixed by the descriptor table, never by how
much history exists. A second statement still reports which logging modes appear
in that exercise's completed history.

Access stays served by `workout_session_exercise_source_history` and
`workout_set_order` from migrations 10 and 9. No migration, index, column,
constraint, persisted record, trigger, or background recomputation is introduced,
and lifetime history never enters application memory. The schema stays at user
version 11.

## Undescribed logging modes

`unsupportedLoggingModes` and the sentence "Personal records are not available
for this way of recording yet." are kept although no mode currently reaches them.
`exerciseLoggingModes` lives in `@fitness/domain` and the descriptor table lives
in `workout-history`, so a mode can be added to the vocabulary before a
descriptor decides what may truthfully be claimed about it. Until one does, the
reader reports the mode and the screen explains it, rather than dropping it
silently or rendering it as a zero. A presentation test renders that state from a
read model so the sentence stays exercised.

## Experience and accessibility

The assisted record renders as an ordinary record card in the existing
personal-records section: its label, its value in the preferred units, when it
was first recorded, the completed workout, and the set, opening that workout as
evidence. No control, disclosure, icon, badge, colour, or chart is added.

Accessible labels repeat what is visible with units written as words — "22.5
kilograms", never "kg" — in both unit systems. The card keeps its role, its
accessible name, its working evidence link, its Dynamic Type behaviour, and the
minimum touch target. Wording describes recorded application data and never
physiological truth, strength, effort, or advice.

## Error model

Records are derived and never written; the error model is settled by
Specification 0022 and unchanged. An exercise with assisted sets and nothing else
shows one card. An exercise whose definition was deleted from the Catalog keeps
its captured names and stays reachable. An exercise recorded under two modes
reports one group per mode. A correction, removal, addition, or deletion is
followed by a read that derives the new truth, with nothing to invalidate. A
storage failure during a records read is scoped to the section with a retry and
leaves performed history visible. Diagnostics expose no SQL, table, column,
identifier, path, name, value, date, or record.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. SQL parameters stay bound; the ordering direction is a compile-time
constant from a closed union in a frozen table, never a bound value and never
anything a person typed. Stored values are revalidated before use and corrupt
rows fail safely.

The records read stays two bounded statements in one round trip, returning at
most eight rows from the first and at most one row per recorded logging mode from
the second.

## Data lifecycle

Export format version 1 is unchanged and no derived value is exported. Restore,
replacement restore, and local erasure need no record migration. Correction,
removal, addition, the starter import, the Exercise Catalog, its filtering, all
three exercise pickers, the Workout Planner, the active Workout Session, Workout
History, and Progress are unaffected.

## Verification and completion

Unit tests assert the descriptor table against the domain's own logging-mode
vocabulary rather than a hard-coded list, prove every pre-existing descriptor
unchanged, and prove exactly one category orders ascending. Persistence tests run
on a real SQLite engine with assisted history written through the repository the
application writes sessions with, and cover the smallest-value selection, ties
under an ascending order, mode partitioning, the single bounded round trip, the
branch count following the descriptor table, the query plan, and that a read
writes nothing and changes no schema version. Presentation tests cover the card,
its accessible name, its evidence link, both unit systems, an exercise with no
assisted sets, an exercise recorded under two modes, and the undescribed-mode
sentence.

End-to-end coverage adds a Sprint 31 suite of six scenarios and regression
scenario 24. The assisted definition is authored through the public exercise
editor rather than imported from the starter set, so the fixture keeps a
synthetic name distinct from the starter `Assisted Pull-up`, the exercise picker
stays short enough to reach without typing, and the equipment restriction on the
mode is exercised. Merge readiness requires:

```bash
./scripts/qa.sh sprint 31 --platform ios
./scripts/qa.sh regression --platform ios
```

Both unit systems, Dynamic Type, VoiceOver, TalkBack, keyboard navigation, touch
targets on a physical device, the starter `Assisted Pull-up`, the equipment
restriction, correction upward and downward, removal, deletion, and an exercise
recorded under two modes over time remain targeted manual QA.

## Explicit exclusions

Repetitions under load, estimated one-repetition maximum, strength scoring,
cross-exercise or cross-mode ranking, pace, load-volume or work-capacity records,
per-session or per-week records, record history, trends, previous-best
comparisons, achievements, badges, gamification, streaks, adherence, medical
interpretation, coaching, progression advice, charts, Progress redesign,
persisted record tables, starter Workout Plans, starter content changes,
export-format changes, localization, onboarding, cloud synchronization,
authentication, backend endpoints, AI, notifications, dependency upgrades, and
repository-wide refactoring are excluded. No migration, column, index, or
constraint changes.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/assisted-repetition-records` on 2026-08-17.
