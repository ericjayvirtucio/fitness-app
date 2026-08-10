# Offline Progress analytics troubleshooting

## Summaries do not match the diary or history

Confirm the selected period and captured local date. Progress averages Nutrition
and Hydration over logged days only. An active or planned workout does not count;
finish the session first. An unknown macro makes that period macro incomplete
rather than zero.

If a timezone changed, do not recalculate the event from UTC. The captured local
date remains historical authority.

## Historical targets are absent

This is intentional. Profile, goal, calorie target, and hydration target are
mutable singletons without version history. Progress does not apply their current
values to past records.

## Progress cannot load

Use the on-screen retry. If the problem continues in development, inspect local
persistence initialization and schema version using the local-persistence guide.
Do not log database rows or sensitive fitness values.

## QA report is missing or malformed

Run through `scripts/qa.sh`, not Maestro directly. Inspect `cli.log` and raw
`junit.xml` in the printed artifact directory. No JUnit testcases, malformed XML,
or a missing report produces a nonzero reporting-integrity status. A Maestro
failure remains the final runner failure even if report formatting also fails.
