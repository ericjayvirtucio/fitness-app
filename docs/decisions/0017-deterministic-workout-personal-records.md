# ADR 0017: Derive workout personal records per logging mode at read time

**Status:** Accepted

## Context

[ADR 0008](0008-historical-workout-session-snapshots.md) made completed Workout
Sessions carry their own exercise name, logging mode, planned target, and actual
set snapshots. [ADR 0010](0010-derived-workout-history-progress.md) built a
read-only `workout-history` capability over those snapshots and deliberately
deferred personal-record claims, because comparison semantics across eight
logging modes had not been reviewed.

The stored facts are sufficient. Every actual set holds a canonical value, every
value is strictly positive by domain invariant and by database constraint, and
every set is reachable from a stable source exercise identifier. What was missing
is a decision about which comparisons are truthful.

Three properties of the merged model shape that decision. Five result variants
serve eight logging modes, so three modes with opposite meanings — external load,
added bodyweight load, and assistance — share one `ResistanceRepetitionResult`
shape; the result variant alone cannot carry record semantics. An exercise
definition's logging mode can be changed while it is not Planner-referenced, so
one identifier can own history recorded under different meanings. And the only
route into per-exercise history resolves identifiers through the mutable Exercise
Catalog, so a deleted definition's history is already unreachable in practice.

## Decision

Derive personal records at read time inside `workout-history`, from completed
session actual sets only, through a `WorkoutPersonalRecordsReader` alongside the
existing repository and export reader.

Record identity is the captured `source_exercise_definition_id` **partitioned by
the captured `logging_mode_snapshot`**. Two logging modes may share one category
only when they produce the identical domain result variant and neither records a
load value, which permits exactly one merge — `repetitions` with
`bodyweight-and-repetitions` — and forbids every other.

Version 1 claims seven categories: most repetitions in a set for the two
unloaded repetition modes, heaviest load, heaviest added load, longest duration,
longest distance, and longest distance and longest duration for
distance-and-duration. Each orders descending on exactly one canonical dimension.

`assistance-and-repetitions` gets no category. Assistance inverts load semantics
and trades against repetitions, so neither dimension orders alone and combining
them would be the score abstraction this architecture refuses. The screen states
that reason rather than presenting a value, and an unsupported mode is never
rendered as zero.

Repetitions under load, single-set load volume, pace, and estimated one-repetition
maximum are excluded. The first rewards the lightest warm-up set. The second is
deterministic but is not an ordering of performance. The third is deterministic
yet misleading across unconstrained distances and needs distance bands. The
fourth is not a recorded fact.

Ties resolve through one total order — value descending, then captured local
date, start instant, exercise position, set position, and set identifier
ascending — so equal values report the earliest completed occurrence. Ordering
compares exact stored canonical numbers rather than the domain's epsilon
equality, because a total order is what makes the selection reproducible.

Persist nothing. One compound statement returns one row per category through
`ORDER BY ... LIMIT 1` branches generated from a single descriptor table, so the
comparison rule exists once. The existing migration 9 and 10 indexes already
serve the access path; no migration, index, table, trigger, or background
recomputation is added.

Finally, the Workout History exercise list stops resolving identifiers through
the Exercise Catalog and derives its labels from completed snapshots, so records
for a deleted definition stay discoverable under the name history captured. The
Workout Session exercise picker keeps its Catalog-resolved recents, because
selecting an exercise to perform genuinely needs a current definition.

## Consequences

- Personal records are always consistent with stored history and can never go
  stale, be migrated, or need reconciliation.
- A logging-mode change produces separate record groups instead of a false
  comparison between loaded and unloaded work.
- Assistance users see an explanation rather than a claim. That is a visible gap,
  and it is the honest one.
- Export format version 1 is unchanged, restore and replacement need no record
  migration, and erasure leaves nothing behind.
- This amends ADR 0010 in one place: the performed-exercise list is no longer
  resolved through mutable Catalog rows, which brings that list into line with
  ADR 0010's own rule that history never rejoins the Catalog for display.
- Completed history still cannot be corrected or deleted. A mis-logged set now
  becomes a durable record claim, which raises the value of a later reviewed
  correction capability. The "recorded" vocabulary keeps the claim truthful in
  the meantime.
- Adding a category later is one descriptor row, one statement branch, and its
  tests, with no schema change.

## Alternatives considered

- **Persist records in a table maintained on completion.** Rejected. It
  reintroduces the staleness, reconciliation, and migration problems ADR 0010
  removed, in exchange for a query that is already bounded by an existing index.
- **Compute maxima in JavaScript over lifetime history.** Rejected. It violates
  the bounded-query rule and grows without limit.
- **`MAX()` per category plus a second query for the occurrence.** Rejected. It
  doubles the round trips and leaves tie resolution undefined between the two.
- **Key records by exercise identifier alone.** Rejected. It would compare
  loaded and unloaded repetitions for the same exercise after a mode change.
- **Include pace, load volume, or repetitions under load.** Rejected as
  misleading superlatives, not as impossible calculations. Each is recorded here
  so a later sprint can revisit it with the reasoning intact.
- **Put comparison rules in `@fitness/domain`.** Rejected. There is one
  consumer, and the rule is fully expressed by a descriptor table that generates
  the SQL; moving it would satisfy appearances and the two-consumer rule would
  still say no.
- **A new top-level Personal Records route or a generic analytics package.**
  Rejected. The content belongs to one exercise, and the per-exercise history
  screen is already that exercise's home.
- **Surface records in cross-capability Progress.** Rejected. Progress answers
  what happened in a chosen day, week, or month; lifetime records answer a
  different question and would blur both.
