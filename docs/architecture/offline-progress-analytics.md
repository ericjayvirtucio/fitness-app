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
```

The composition root supplies the three readers after local persistence is
initialized. The screen consumes one immutable read model and has no knowledge
of SQL or source repositories.

## Time and historical authority

Queries use inclusive `YYYY-MM-DD` ranges and each event's captured local date.
Weeks start Sunday and end Saturday. Months use their actual calendar bounds.
Timezone changes never regroup history.

Nutrition consumption snapshots, hydration entries, and completed workout
session snapshots are authoritative. Current catalog definitions, planner
intent, active sessions, profile values, goals, and hydration target are not.

## Missing and incomplete data

A logged day contains at least one source entry. Unlogged days do not contribute
zero to averages. Nutrition energy is required and therefore complete, including
a legitimate known zero. Each optional nutrient carries explicit completeness:
if one entry is unknown, its period total and average are not claimed as exact.

Hydration history reports intake only. Workout history reports completed actual
performance only and retains logging-mode-specific units.

## Persistence and performance

Range grouping remains inside capability-owned SQLite adapters. Existing indexes
lead with nutrition/hydration local date and workout status/local date, covering
the maximum initial one-month window. Summaries are not persisted. A schema or
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

There is no historical weight, profile, goal, calorie-target, or hydration-target
versioning. Progress therefore cannot truthfully present those trends or
adherence metrics. Charts and cross-period changes are deliberately deferred.
