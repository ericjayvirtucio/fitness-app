# Offline progress analytics architecture

## Boundary and flow

Progress is a read-only mobile capability composed over existing historical
sources:

```text
ProgressScreen
  -> GetProgressSummaryUseCase
       -> NutritionProgressReader -> nutrition SQLite adapter
       -> HydrationProgressReader -> hydration SQLite adapter
       -> WorkoutProgressReader   -> workout-history SQLite adapter
       -> BodyWeightProgressReader -> body-measurement SQLite adapter
       -> PersonalProfileRepository (display unit preference only)
```

The composition root supplies the readers after local persistence is
initialized. The screen consumes one immutable read model and has no knowledge
of SQL or source repositories.

The profile is read for one thing only: whether to display weight in kilograms
or pounds. No profile value is treated as a historical record, and canonical
grams never change with the preference.

## Time and historical authority

Queries use inclusive `YYYY-MM-DD` ranges and each event's captured local date.
Weeks start Sunday and end Saturday. Months use their actual calendar bounds.
Timezone changes never regroup history.

Nutrition consumption snapshots, hydration entries, completed workout session
snapshots, and body weight check-ins are authoritative. Current catalog
definitions, planner intent, active sessions, the current profile weight,
goals, and hydration target are not.

## What the summary states

Every value the summary computes is a value the screen states, on the screen
that computes it, and every nutrient the application captures is a value the
summary computes. The Nutrition
card renders energy, its average per logged day, the logged day and entry
counts, and a total and an average per logged day for all six stored
nutrients — protein, carbohydrate, fat, fiber, sugar, and sodium — in the order
the nutrition diary uses. That is sixteen metrics. The Hydration card renders
the total fluid, its plain water and other fluid components, an average per
logged day for each of the first two, and the logged day and entry counts. Each
average is labelled by the value it averages, because several averages share one
card.

The Workouts card renders the completed workout, actual set, and performed
exercise counts, the elapsed session time it labels `Workout time`, and one line
for each dimension of work the period recorded: repetitions, performed duration,
performed distance, and recorded load volume. The first four are always present.
Repetitions, performed duration, and performed distance render only when the
period recorded that dimension, because an absent dimension has never been
rendered as zero. Recorded load volume is the one total here that excludes
recorded work, so it is stated as the sentence carrying its coverage rather than
as a labelled value, and it appears in the covered form or in that form with the
number removed for every period holding a set — which makes it the one line
whose presence does not vary with what was recorded. All eight
values, their order, and their wording come from Workout History, which states
the same period through the same formatters inside one labelled card.

`Workout time` is elapsed wall-clock session length and `Performed duration` is
the sum of recorded set durations. The two read alike and are not the same
value; the contrast between the labels is what distinguishes them, and
[Specification 0040](../../specs/0040-the-workouts-card-states-what-it-recorded.md)
records the rename that would remove the ambiguity outright.

A nutrient's period values are carried in the unit that nutrient is recorded in:
grams for five of the six, milligrams for sodium. Nothing converts a unit
between the row and the screen. `formatProgressMass` takes the unit as a
parameter, so one formatting path serves both rather than a second function
differing by one character of output.

An average's denominator is logged days — the days holding at least one entry of
that kind — which is the count the card names on its own `Logged days` line.
Neither average divides by days in the period.

[ADR 0029](../decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md)
records that a value the application asks a person to record and already
aggregates for a day is a value it aggregates for a period, and that no nutrient
is exempt from carrying both a total and an average.
[ADR 0030](../decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md)
records that a value is stated by every screen that computes it rather than by
one screen somewhere, which is why the three workout dimensions Workout History
already rendered are stated here too.
[ADR 0028](../decisions/0028-a-summary-states-every-value-it-computes.md) records
the rule and its boundary with
[ADR 0023](../decisions/0023-displayed-totals-state-their-coverage.md): a value
whose rendered text carries its own coverage needs no separate unconditional
sentence, so the explanation of the word `Incomplete` renders only when that word
is on screen.

## Missing and incomplete data

A logged day contains at least one source entry. Unlogged days do not contribute
zero to averages. Nutrition energy is required and therefore complete, including
a legitimate known zero. Each optional nutrient carries explicit completeness:
if one entry is unknown, its period total and average are not claimed as exact,
and both read `Incomplete` for the same reason. An average that cannot be
computed is omitted rather than rendered as zero.

Hydration history reports intake only. Workout history reports completed actual
performance only and retains logging-mode-specific units.

Body weight reports the first and latest recorded check-ins in the period, the
check-in count, and the difference between them. A period without a check-in is
no data, not a zero weight. A period holding one check-in shows that weight and
states that a recorded change needs at least two check-ins. Days between
check-ins are never interpolated, and the difference is described as recorded
change rather than a trend, rate, or health result.

## Persistence and performance

Range grouping remains inside capability-owned SQLite adapters. Existing indexes
lead with nutrition/hydration local date and workout status/local date, and
migration 11 adds one ordered body-weight index, together covering the maximum
initial one-month window. The body-weight period read is a single statement
holding a count and two bounded boundary sub-selects. Summaries are not
persisted. A schema or index change requires measurement and a separate
migration review.

The completed-workout period statement already sums every dimension the Workouts
card states, so stating three more of them added no query, no projection, and no
plan. The nutrition period statement aggregates six nutrients over the rows it
already scanned. Its only predicate and its only grouping key are `local_calendar_date`,
the leading column of `nutrition_consumption_entry_local_date_occurred_at`, which
serves the range seek, the grouping, and the ordering without a sorter. That
index does not carry the nutrient columns, so a rowid lookup per matching row
already materialised the whole row, and the three nutrients Sprint 39 added come
from bytes already fetched. Widening the projection changed no part of the plan.

## Experience, accessibility, privacy, and failures

Progress is text-first: period controls, compact capability summaries, and daily
breakdowns replace charts. Accessible names combine metric labels with values;
selected state and incompleteness do not rely on color. Content wraps under
Dynamic Type.

Failures use the established persistence error boundary and provide retry.
Refresh on focus reflects newly logged local records. Request ordering prevents
an older period response from replacing a newer selection.

Fitness history is sensitive. The feature performs no network requests,
telemetry, background processing, or logging of record contents.

## Known limitations

Body weight is the only recorded body measurement. There is no historical
profile, goal, calorie-target, or hydration-target versioning, so Progress still
cannot truthfully present those trends or adherence metrics. Weight trends,
rates of change, charts, and cross-period comparison are deliberately deferred.
