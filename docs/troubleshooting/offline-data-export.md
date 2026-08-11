# Offline data export troubleshooting

## The export does not appear anywhere after sharing

The application hands the file to the platform's share and save controls and
then stops. It never chooses a destination, never uploads anything, and never
learns whether the file was saved. If nothing arrived where you expected, open
share options again from the "Export ready" panel and pick a destination
explicitly.

The message after the sheet closes is deliberately neutral for this reason: on
iOS a dismissed sheet and a completed save look identical to the application, so
claiming success would sometimes be a lie.

## The export is gone from the app

The application keeps at most one export, in its cache directory, and removes it
the next time the export screen opens, before the next export, and when you
discard one. The system may also reclaim the cache on its own. This is intended:
a file holding your profile, measurements, and history should not sit in the
application sandbox indefinitely.

Whatever you saved elsewhere is untouched. The application only controls its own
temporary copy.

## Export failed and nothing was created

Export is all-or-nothing. If any part of your information cannot be read, or the
file cannot be written, the whole export is abandoned and no partial file is
produced. A partial export that looked complete would be worse than none.

Retry once. If it fails again, check available storage, and confirm the app
opens normally elsewhere so the local database itself is healthy. The message
never contains stored values, file paths, or database details, so nothing in it
identifies the record involved.

## The device cannot open share options

Sharing needs the platform's share service. If it is unavailable, the export is
reported as failed and the temporary file is removed, because a file that cannot
leave the sandbox has no user-reachable path. This is expected on unsupported
platforms such as the web build.

## Export takes a while on a large history

Everything is read in one consistent pass over every capability, page by page,
and turned into text as it goes. On a long history that takes a few seconds, and
other writing is blocked while it runs. The busy state is indeterminate on
purpose: producing a percentage would require counting every table first, which
would roughly double the work.

Use "Cancel export" to stop. Cancellation is checked between pages and between
sections, and any file already written is removed.

## Some values look unfamiliar in the file

Everything is exported in canonical units, with the unit in the field name:
grams, millimeters, milliliters, kilojoules, milligrams for sodium, seconds for
durations, and epoch milliseconds for instants. These are the values the
application stores. Your metric or imperial preference is exported as a setting;
it never changes a stored value.

Times appear as three fields: the instant, the local calendar date that was
captured at the time, and the UTC offset that was in effect. Changing the device
time zone later does not move a recorded day.

## A nutrient is `null`

`null` means the value was never recorded, and `0` means a recorded zero. They
are deliberately different, and an unknown value is never converted to zero.

## An exercise in a workout is missing from `exerciseCatalog`

Completed workouts keep the exercise name and logging mode that were recorded at
the time. If the definition was later deleted or renamed, the workout still
describes what was performed and the catalog reflects what exists now. The
absence is the truthful record; the application does not reconstruct a deleted
definition.

## The planner and the workout history disagree

They answer different questions. `workoutPlanner` is recurring future intent and
`workoutSessions.completedSessions` is what was actually performed. Neither is
derived from the other, and a planned exercise that was never performed appears
in exactly one of them.

## The profile weight differs from the newest weight check-in

They are separate answers with separate owners: `profile.weightGrams` is the
current weight and `bodyMeasurements.weightCheckIns` is recorded history.
Neither is generated from the other. See
[body measurement history troubleshooting](body-measurement-history.md).

## BMI or a calorie target is missing from the file

Derived values are not exported. BMI, resting energy, maintenance energy, the
daily calorie target, and consumed nutrition amounts are all computed from
values already in the file, so exporting them would duplicate state that can
drift and would invite reading a current calculation as history. The formulas
are documented in [Goals & Energy](../architecture/goals-and-energy.md).

## Can the file be imported back?

Yes, into an installation that holds no information yet. Profile has a "Restore
my data" screen that reads a `formatVersion` 1 export back in, entirely offline.
It refuses when the app already contains records, and it never merges or
replaces. See
[offline data restore troubleshooting](offline-data-restore.md).

An export is still a copy you control, not an automatic backup: nothing creates
it for you and nothing recovers it from a cloud service.

## Is the file protected?

No. The export is not encrypted. Once it leaves the application it is an
ordinary file wherever you put it, subject only to that destination's
protection. Treat it like any document containing your date of birth and health
information.
