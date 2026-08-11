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

## Missing and incomplete data

A logged day contains at least one source entry. Unlogged days do not contribute
zero to averages. Nutrition energy is required and therefore complete, including
a legitimate known zero. Each optional nutrient carries explicit completeness:
if one entry is unknown, its period total and average are not claimed as exact.

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
holding a count and two bounded boundary sub-selects. Summaries are not persisted. A schema or
index change requires measurement and a separate migration review.

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
