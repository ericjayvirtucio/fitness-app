# Specification 0046: Recording optional reps in reserve

- Status: Approved
- Date: 2026-08-26

## Objective and scope

Let a person optionally record how many additional repetitions they believed
they could have performed at the end of a repetition-based set — "reps in
reserve," abbreviated RIR — and have that observation persist wherever the
recorded set itself persists: active-session reload, application restart,
workout completion, history viewing, supported correction, export, restore,
and safe replacement.

This is Phase 4's (Training Depth) second shipped capability, following
[Specification 0045](0045-foreground-rest-timing.md) (foreground rest
timing). It closes the provisional outcome recorded in
[the product roadmap](../docs/product-roadmap.md#training-depth-direction-provisional):
a person can record what a session's effort behaved like, beyond a bare log of
mechanical results. [ADR 0034](../docs/decisions/0034-reps-in-reserve-is-a-recorded-observation.md)
records why this is a recorded fact — the person's own report — rather than
the kind of derived estimate [ADR 0017](../docs/decisions/0017-deterministic-workout-personal-records.md)
already excludes.

Version 1 adds one optional field to `WorkoutSet`, one nullable constrained
SQLite column, one export-format version increment, and matching form,
display, and correction support. It adds no new package, screen, tab, or
dependency.

## Terminology

- **Reps in reserve (RIR)** — a person's subjective estimate of how many
  additional repetitions they believed they could have completed at the end
  of a set. It is presented as a self-report, never as a fact the application
  measured, verified, or computed.
- **RIR 0** — the person recorded that they believed no additional repetition
  remained. This is a valid, meaningful recorded value, distinct from no
  estimate at all.
- **No RIR** — the person did not record an estimate. Represented as `null`
  throughout the domain, database, and export contract. It never becomes,
  displays as, or is treated as zero.
- **Repetition-based result** — a `WorkoutResult` whose `kind` is
  `'repetitions'` or `'resistance-and-repetitions'`. Every `ExerciseLoggingMode`
  that records repetitions (`repetitions`, `bodyweight-and-repetitions`,
  `external-load-and-repetitions`, `bodyweight-plus-load-and-repetitions`,
  `assistance-and-repetitions`) produces one of these two kinds
  (`packages/domain/src/workout/workout-session.ts`'s `isResultCompatible`),
  so checking a result's kind is equivalent to checking the exercise's logging
  mode without `WorkoutSet` needing to hold a reference to its exercise.

## Eligibility

RIR may be recorded only on a set whose result is repetition-based. Duration,
distance, and distance-and-duration results always carry `repsInReserve:
null`, enforced by the domain constructor (`WorkoutSet.create` in
`packages/domain/src/workout/workout-session.ts`) and mirrored by a database
`CHECK` constraint. The active-session and correction forms render the field
only when the exercise's logging mode is repetition-based, using the same
`loggingMode.includes('repetitions')` test the existing repetitions field
already uses in `WorkoutSetForm.tsx`.

## Domain

`WorkoutSet` gains a fourth field, `repsInReserve: number | null`, validated
by `WorkoutSet.create`:

- `null` is always valid, regardless of result kind.
- A non-null value must be an integer from 0 through 10 inclusive
  (`workoutSessionPolicy.maximumRepsInReserve`), and is valid **only** when
  the result is repetition-based; a non-null value on a duration, distance, or
  distance-and-duration result is rejected.
- Every other `WorkoutSet` invariant (frozen, immutable, reconstructed rather
  than mutated) is unchanged.

No change reaches `WorkoutResult`. RIR describes the person's perceived effort
for a set, not the mechanically recorded result, so it stays a sibling field
on `WorkoutSet` rather than a sixth `WorkoutResult` variant field — consistent
with `WorkoutSet` already holding `id` and `position` alongside `result`
without those becoming part of the result union.

## Persistence and migration

Migration 13 (`apps/mobile/src/infrastructure/persistence/migrations.ts`)
adds one column:

```sql
ALTER TABLE workout_set ADD COLUMN reps_in_reserve INTEGER CHECK (
  reps_in_reserve IS NULL OR (
    reps_in_reserve BETWEEN 0 AND 10 AND
    result_kind IN ('repetitions', 'resistance-and-repetitions')
  )
)
```

Existing rows have no value for the new column and are read back as `NULL`
without a data migration — SQLite fills an added column with `NULL` on every
pre-existing row, which already satisfies the `CHECK`. No table is rebuilt:
unlike migration 12's `planned_workout` rebuild (needed only because SQLite
cannot drop an inline column constraint), this is a straightforward additive
column with no existing constraint to remove.

Every read, write, and correction path that already rewrites `workout_set`
rows picks up the column automatically, because this schema's convention is
whole-aggregate rewrite rather than per-column `UPDATE`:

- `WorkoutSessionSqliteRepository.insert` (used by session start, restore, and
  safe replacement) and `.correctCompleted` (used by set correction, exercise
  removal, and exercise addition) both delete and fully reinsert every child
  row of the exercises they touch, via `insertChildren`/`setParameters` in
  `workout-session-sqlite-repository.ts`.
- `WorkoutSessionMutationUseCases.addSet`/`.updateSet`/`.deleteSet` in
  `workout-session-use-cases.ts` rebuild the in-memory aggregate and persist
  it through `WorkoutSessionRepository.replace`, which follows the same
  delete-and-reinsert pattern.

No column was added to `workout_session` or `workout_session_exercise`, and no
synchronization-readiness metadata changes: `workout_set` is a child row with
no independent sync identity ([ADR 0032](../docs/decisions/0032-schema-synchronization-readiness.md)),
exactly as it already was for every other set field. A write that changes RIR
still advances its parent `workout_session` row's `revision` and
`updated_at_epoch_ms` and queues one outbox entry, through the same
`queueRevision` call every other set mutation already goes through — nothing
new is added there.

## Active-session recording

`WorkoutSetForm.tsx` gains one field, rendered only when `hasRepetitions` is
true (the same condition already gating the repetitions field):

- Label: "Reps in reserve (optional)".
- Helper text: "Your own estimate of how many more repetitions you believed
  you could have done, from 0 to 10. Optional — leave blank if you did not
  estimate. Not a target or a recommendation."
- `keyboardType="number-pad"`, matching the repetitions field.
- Blank input saves as `null`. A typed integer 0–10 saves as that integer.
  Anything else (a fraction, a negative number, a value above 10, or
  non-numeric text) blocks submission with the form's existing "Enter valid
  values for this set." error, leaving every entered value — including RIR —
  on screen exactly as the existing validation failure path already does for
  the other fields.
- Editing a set pre-fills the field from `WorkoutSet.repsInReserve` via a new
  `initialRepsInReserve` prop; blank and `0` are distinguished because the
  prop is `number | null` and the rendered text state is built from it
  explicitly (`String(0)` renders `"0"`, not blank).
- `onSave` now receives `(result, repsInReserve)`. `WorkoutSessionScreen.saveSet`
  forwards both to `WorkoutSessionMutationUseCases.addSet`/`.updateSet`, which
  now take a fourth `repsInReserve: number | null` parameter and pass it
  straight into `WorkoutSet.create`.
- A rejected save (domain validation failure or persistence throw) never
  reaches `setEditor(undefined)` or `setIsRestAvailable(true)`, unchanged from
  Specification 0045's "safe offer point": RIR cannot cause a rest-timer offer
  to appear after a failed save, because it goes through the identical
  success/failure branch already governing the mechanical result.
- Deleting a set preserves the survivors' `repsInReserve` values across
  renumbering (`deleteSet`'s reindexing step now copies `set.repsInReserve`
  into each rebuilt `WorkoutSet`).

The same form is reused, unchanged in this respect, by
`CompletedWorkoutExerciseAdditionScreen.tsx` (adding a missing exercise and
its first set to completed history) and
`CompletedWorkoutSetCorrectionScreen.tsx` (correcting or adding a set in
completed history), so RIR is recordable from all three set-entry points
without three separate implementations.

## Display

`formatWorkoutResult` (`workout-result-formatting.ts`) gains an optional
fourth parameter, `repsInReserve?: number | null`. When non-null, it appends
`" · RIR {n}"` to the existing result sentence — e.g. `"8 reps · RIR 2"` — so
the labelled row stays one accessibility element, matching this codebase's
established pattern of composing a full sentence rather than adding a second
announced fragment (the same pattern `WorkoutSessionScreen.tsx` already uses
for "Set N: <result>" and `CompletedWorkoutScreen.tsx` for "Performed set N:
<result>"). When `repsInReserve` is `null` or omitted, the sentence is
unchanged from today. `0` renders as `"RIR 0"`, never as an absent suffix —
the formatting function distinguishes `null`/`undefined` from `0` explicitly
rather than through a truthiness check.

Both the active-session screen and the completed-history screen pass
`set.repsInReserve` into this call. No other reader displays an individual
set's mechanical result today, so no other display surface changes.

## Correction

`CorrectCompletedWorkoutSetUseCase` (`correct-completed-workout-set-use-case.ts`)
gains `repsInReserve` on both `editSet` and `addSet` inputs, passed straight
into the rebuilt `WorkoutSet`. `deleteSet` needs no new input: it only removes
a set.

`RecordedSetFingerprint` — the snapshot a screen compares against the
currently stored set before writing, so a screen left open through another
correction cannot silently clobber a set that changed underneath it — gains a
`repsInReserve` field, and `fingerprintRecordedSet` now takes the whole
`WorkoutSet` (previously just its `result`) so it can read both. This closes
exactly the gap the prompt's prerequisite review raised: RIR is now part of
"what a set records," so a stale screen's fingerprint must include it or a
correction could overwrite a RIR value changed by a different correction in
between. Editing only the mechanical result while RIR changed elsewhere (or
the reverse) is therefore refused as `'changed'`, identically to how a changed
repetition count already is.

`renumber` (used by `deleteSet`) preserves each surviving set's
`repsInReserve` across the position shift, the same way it already preserves
`result`.

## Export and restore (format version 2)

The public export contract (`data-export/application/data-export-contract.ts`)
becomes version 2: `dataExportFormatVersion` is `2`, and `ExportedWorkoutSet`
gains `repsInReserve: number | null`. Every other section of the contract is
unchanged.

`data-export-mapping.ts`'s `toExportedWorkoutSession` now copies
`set.repsInReserve` alongside `id`, `position`, and `result`. Output stays
deterministic — no new nondeterminism is introduced, since the value is
copied straight from the stored aggregate in the same read pass as everything
else.

Restore's version-dispatch boundary (`parse-data-export.ts`) — already
designed, per its own comment, so "a future version 2 adds a branch here
rather than a migration framework" — gains that branch:

```ts
if (formatVersion === 1)
  return ok(parseDataExportV1(document, currentLocalCalendarDate));
if (formatVersion === dataRestorePolicy.currentFormatVersion)
  return ok(parseDataExportV2(document, currentLocalCalendarDate));
throw new DataRestoreError('unsupported-format-version');
```

`dataRestorePolicy.supportedFormatVersion` (a single value equal to the
current export version) is renamed `currentFormatVersion` to state plainly
that it names the newest version, not the only supported one; version 1 is
supported by the explicit `=== 1` branch above it, independent of that
constant.

`parse-data-export-v1.ts` is renamed `parse-data-export-versions.ts` and now
hosts both `parseDataExportV1` and `parseDataExportV2`, because the two
differ in exactly one place. Every section reader (profile, nutrition,
hydration, exercise catalog, planner, body measurements) is shared unchanged;
only the set-reading path takes a `readSetRepsInReserve: (source: JsonObject)
=> number | null` function, supplied as `() => null` by the version 1 entry
point and as a real `asNullable(member(source, 'repsInReserve'), asInteger)`
reader by the version 2 entry point. This is a parameter for one field, not a
generalized migration framework, and it keeps the two version parsers from
drifting out of sync on everything they still share.

Validation order for a version 2 `repsInReserve` matches every other field in
this parser: `asNullable`/`asInteger` reject a non-null, non-integer, or
non-finite value structurally before domain construction; `WorkoutSet.create`
then rejects an out-of-range value or a value on an ineligible result kind,
exactly as it does for a hand-constructed domain call. Both checks complete
before the write transaction opens, so an invalid version 2 `repsInReserve`
never reaches SQL, matching the existing all-or-nothing restore guarantee.

A version 1 file's sets are always restored with `repsInReserve: null`,
regardless of any `repsInReserve` key that might be present in the source
JSON (a version 1 file produced by this application never has one, but a
hand-edited or foreign file might) — version 1's reader function is `() =>
null` unconditionally, so it cannot be tricked into reading a field version 1
never promised.

Safe replacement (`safe-replacement-restore.md`) and empty-installation
restore both call the shared `writeRestoreData`, which writes every session
through `WorkoutSessionRepository.insert` — the same method the persistence
section above already covers — so both inherit version 2 support with no
additional write-path change.

## Failure and recovery

A rejected active-session or correction save leaves the previously stored set
exactly as it was: `updateSet`/`editSet` build the corrected `WorkoutSet`
before any write, and a domain validation failure (invalid RIR, or RIR on an
ineligible result) is returned as an error before `replace`/`correctCompleted`
is ever called. A persistence-layer throw (a `run` failure mid-transaction)
rolls back the whole exclusive transaction, exactly as it already does for
every other set write; no interaction here creates a new partial-write path.
Restore and replacement remain all-or-nothing: an invalid `repsInReserve`
anywhere in the file fails parsing before the transaction opens, so it can
never produce a half-written dataset.

## Offline behavior

Everything above runs entirely on-device. No network call, telemetry, or
external service is introduced or required.

## Accessibility

- The field's visible label states it is optional.
- The helper text states the accepted range (0–10) and explicitly disclaims
  it as "not a target or a recommendation," satisfying the requirement that
  the application not imply coaching or medical authority.
- `TextField`'s existing `helperText`/`accessibilityHint`/`aria-describedby`
  wiring (`design-system/components/TextField.tsx`) announces the helper text
  to a screen reader without any new accessibility plumbing.
- `0` and blank are distinct both in stored data and in the rendered text
  input state, so a screen reader reading the field's value never confuses
  "recorded as zero" with "not recorded."
- The displayed `"· RIR n"` suffix is plain text within the same labelled
  sentence as the mechanical result, so it inherits that row's existing
  accessibility behavior (one accessible element, Dynamic Type support) rather
  than needing new large-type or screen-reader handling.
- No color, motion, sound, or haptic feedback is added anywhere in this
  capability.

## Privacy and security

Reps in reserve is workout-adjacent personal information and is handled under
the same rules as every other recorded set value: no logging, no analytics,
no telemetry, no network transmission, and no special-cased export or
diagnostic path. It carries no additional sensitivity beyond a repetition
count or resistance value already stored, and receives the same protection.

## Performance

No new query, index, or bounded-read change. Every read that already returns
a set's `result` now returns one additional nullable integer per row, which
is not measurable against this application's existing per-set payload.

## Observability

None introduced. This capability adds no diagnostic, log, or metric surface.

## Testing

- **Domain** (`packages/domain/src/workout/workout-session.spec.ts`): absence
  is valid; `0` and `10` (the bounds) are valid; a representative interior
  value is valid; negative, above-range, fractional, and non-numeric values
  are rejected; a non-null value on a duration result is rejected while `null`
  on the same result is accepted; reconstruction through `WorkoutSet.create({
...set })` preserves the value.
- **Active-session application** (`workout-session-use-cases.spec.ts`):
  `addSet`/`updateSet` accept and persist a `repsInReserve` argument;
  `deleteSet` preserves survivors' values across renumbering.
- **Persistence** (`workout-session-sqlite-repository.spec.ts`,
  `workout-session-completion.spec.ts`,
  `workout-session-export-sqlite-reader.spec.ts`): the insert statement binds
  the new column; a stored row round-trips through the row mapper with its
  recorded value; every existing fixture row without the column continues to
  map with `repsInReserve: null` (pre-migration-13 row shape).
- **Correction** (`correct-completed-workout-set-use-case.spec.ts`,
  `completed-workout-correction-sqlite.spec.ts`): editing RIR alone succeeds;
  editing the mechanical result preserves RIR unless explicitly changed;
  clearing RIR (passing `null`) succeeds; a stale fingerprint whose RIR no
  longer matches is refused as `'changed'`; a corrected value round-trips
  through the real SQLite engine.
- **Export/restore** (`data-export-serializer.spec.ts`,
  `parse-data-export.spec.ts`): a version 2 export includes `repsInReserve`
  for a repetition-based set; `formatVersion` is `2`; a version 1 document is
  still accepted with `repsInReserve` forced to `null` even if a stray key is
  present; a version 2 document accepts absent, zero, and nonzero RIR; a
  version 2 document with a negative, above-range, fractional, wrong-typed, or
  ineligible-result RIR is rejected before domain construction or is rejected
  by domain construction, matching the two-layer validation described above;
  an unsupported version (neither 1 nor the current version) is rejected.
- **Presentation** (`WorkoutSessionScreen.spec.tsx`,
  `CompletedWorkoutScreen.spec.tsx`, `CompletedWorkoutSetCorrectionScreen.spec.tsx`,
  `CompletedWorkoutExerciseAdditionScreen.spec.tsx`,
  `workout-result-formatting.spec.ts`): the field renders only for eligible
  logging modes; a blank field saves as absent; a valid value saves and is
  reflected in the recorded-set sentence; an invalid value blocks submission
  without losing other entered values; the rest-timer offer still appears
  only after a successful save.
- **Manual, physical device**:
  `docs/manual-testing/sprint-47-record-reps-in-reserve.md`, covering the
  matrix in "Manual QA" below.
- Not proposed: Maestro, simulator, emulator, or an automated UI
  sprint/regression suite, per [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).

## Documentation

- This specification.
- [ADR 0034](../docs/decisions/0034-reps-in-reserve-is-a-recorded-observation.md).
- `docs/architecture/offline-workout-sessions.md` — RIR added to the domain
  and persistence description.
- `docs/architecture/offline-workout-history.md` — correction and display
  updated to mention RIR.
- `docs/architecture/offline-data-export.md` — contract bumped to version 2,
  `ExportedWorkoutSet.repsInReserve` documented.
- `docs/architecture/offline-data-restore.md` — "What restore accepts" updated
  to describe both version 1 and version 2, and the parser file rename.
- `docs/architecture/schema-synchronization-readiness.md` — not materially
  changed; `workout_set` was already, and remains, outside the
  synchronization-metadata table list, and this specification adds no
  exception.
- `README.md`'s current-status paragraph.
- `docs/product-roadmap.md` — Sprint 47 entry, Phase 4 exit-criterion
  evaluation (see below).
- `PRODUCT.md` — corrects the stale "None is yet approved as scope" sentence
  under the Training Depth phase entry, which Sprint 46 already made
  inaccurate.
- `specs/0012-offline-workout-planner.md`, `specs/0032-recorded-result-meaning.md`,
  and `specs/0035-owner-named-workouts.md` — each amended with a pointer to
  this specification, following the same pattern Specification 0045 used to
  amend Specification 0013, rather than rewriting their own history.
- `docs/manual-testing/sprint-47-record-reps-in-reserve.md` (new).

## Rollout and rollback

Ships as a normal migration-carrying release. Migration 13 is additive and
forward-only, consistent with every prior migration in this schema; there is
no rollback path for a shipped migration, matching existing project practice.
An installation that never opens the app after this release is unaffected
until it does. A person who never enters a RIR value experiences no visible
change beyond one new optional field on the set form.

## Explicit exclusions

Rate of perceived exertion (RPE); fractional RIR; negative RIR; RIR above 10;
automatic, inferred, or AI-generated RIR; recommended or target RIR; coaching,
medical, or rehabilitation guidance derived from RIR; RIR-based personal
records, comparisons, averages, trends, or summaries; RIR on
`ExerciseDefinition`, `PlannedExercise`, or `PlannedPrescription`; a default
RIR preference; copying a previous set's RIR automatically; RIR fields on
duration, distance, or distance-and-duration results; grouped sets,
supersets, or circuits; progression schemes; estimated one-repetition
maximum; achievements, streaks, telemetry, or analytics; a generic
subjective-effort framework; a new package, tab, or external dependency;
Maestro; simulator or emulator automation; automated UI regression suites.

## Phase 4 exit-criterion evaluation

Phase 4 exits when "a person can see more than a bare log of sets: at
minimum, a way to observe how a session's effort or pacing behaved without
the application asserting a fact it did not record." Optional RIR recording
is exactly such an observation — a person-reported description of how a set's
effort behaved, attached to the set it describes, asserting nothing the
person did not tell the application. On that basis this specification, once
implemented and merged, satisfies Phase 4's exit criterion. `docs/product-roadmap.md`
records this conclusion and marks Phase 4 complete in the same change that
records Sprint 47, rather than leaving the roadmap and the shipped behavior in
disagreement.

## Acceptance criteria

- A repetition-based set can be saved with no RIR, RIR 0, or RIR 1 through 10,
  from every entry point that records or corrects a set.
- A non-repetition-based set never offers or accepts an RIR value.
- Every stored RIR value survives active-session reload, application
  restart, workout completion, history viewing, correction of an unrelated
  field, export, erasure, restore, and safe replacement.
- An omitted RIR is `null` everywhere, never `0`.
- A pre-migration-13 row loads with `repsInReserve: null`.
- A rejected save or a rejected restore never partially writes a workout
  result or an RIR value.
- A version 1 export still restores completely, with every set's RIR `null`.
- A version 2 export round-trips absent, zero, and nonzero RIR exactly.
- The RIR field's label and helper text state it is optional and describe its
  0–10 range without medical or coaching language.

## Unresolved questions

None. This specification settles the domain placement, persistence shape,
export-version strategy, correction-conflict behavior, and Phase 4
exit-criterion question the prerequisite review was asked to verify.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-26.
