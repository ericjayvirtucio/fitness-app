# Body measurement history troubleshooting

## The Profile weight and the newest check-in disagree

Only two actions change the profile weight: saving the Profile form, and
creating a check-in with "Also update my profile weight" enabled while that
check-in is the most recent measurement. A backdated check-in never changes the
profile weight, and editing or deleting a check-in never changes it either.

If they still disagree, the last profile save happened after the last
qualifying check-in. That is the expected outcome, not a synchronization
failure. There is no second current-weight source to reconcile.

## A check-in is missing from history

Profile weight edits do not create history. Only the body measurement screens
record check-ins. History is never reconstructed from previous profile values,
so a weight changed on the Profile form leaves an intentional gap.

## A check-in shows the wrong day

The captured local calendar date is historical authority. A recorded check-in
keeps the date, time, and UTC offset it was saved with, so changing the device
time zone must not move it. If a date looks wrong, inspect the entry itself and
correct it by editing the check-in rather than expecting the device clock to
reinterpret it.

## The weight will not save

Weight must be between 2 and 500 kilograms and the occurrence time cannot be in
the future. Date must be `YYYY-MM-DD` and time must be 24-hour `HH:MM`. The
entered number is interpreted in the profile's preferred unit, so an imperial
profile enters pounds and metric enters kilograms. Stored values are always
canonical grams.

## Progress shows no body weight

An empty period is no data, not a zero weight. A period holding one check-in
shows that recorded weight and states that a recorded change needs at least two
check-ins. Progress never interpolates missing days and never applies the
current profile weight to a past period.

## Displayed units changed but the history looks different

Changing the profile unit preference changes presentation only. Canonical grams
are unchanged, so 82.4 kg and 181.7 lb are the same stored record.

## A saved check-in cannot be read back

A stored row that fails domain revalidation raises a safe `operation-failed`
persistence error that never contains the measurement value. Inspect local
persistence initialization and schema version with the local-persistence guide.
Do not log database rows or measurement values.

## A manual device check fails

Record the device, platform version, build, steps, and visible result using the
[manual testing guide](../manual-testing/README.md). Keep the prefilled local
date so the check does not accidentally record a future measurement.
