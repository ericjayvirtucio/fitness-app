# Offline data restore troubleshooting

## The app says it already has information

Restoring is supported only on an installation that contains nothing yet. That
is deliberate: combining a saved export with existing records, or replacing them
with it, are separate problems that need their own reviewed designs, and neither
should be invented inside a restore screen. See
[ADR 0014](../decisions/0014-empty-installation-data-restore.md).

"Nothing yet" is not "no profile". Nutrition, hydration, exercise, planner,
workout, and weight records all count, and so do a goal configuration and a
daily fluid target on their own.

If you want to restore anyway, export what is on the device first, then use
Profile → Data controls → Delete all local data. That empties the installation
deliberately, and restoring becomes possible afterwards. Deleting is a separate
action you have to confirm: nothing here removes your records for you, and
restoring never deletes anything. See
[local data erasure troubleshooting](offline-local-data-erasure.md).

## Nothing was changed after a failure

That is the intended outcome. A restore is all-or-nothing: it either writes
every record or none of them. A failure part-way through rolls the whole
transaction back, and so does closing the app mid-restore.

## The file does not appear in the picker

The picker filters on JSON. If a saved export was renamed or stored with a
different type by another app, some providers hide it. Try the location where
you originally saved it, or share it back to Files first.

The file's contents decide whether it can be restored. The name, the extension,
and the type never do.

## "The selected file is not a Fitness App export"

The file is valid JSON but does not carry
`"format": "fitness-app-data-export"`. Only files this application produced can
be restored. Data from another fitness app cannot be converted here.

## "The selected export uses a format version this app version cannot read"

The file declares a format version this build does not support. That is separate
from a malformed file: the contents are recognisable but newer or older than the
version this app understands. Update the application, or use the version 1
export the app can read.

The format version is a promise to whoever reads a saved file. It is deliberately
unrelated to the app version and to the local database version, so neither
number tells you whether a file will restore.

## "The selected file is larger than this app can restore"

Restoring holds the whole document in memory while it is checked, so files above
25 MB are refused before they are read. An export this application produced is
far below that ceiling; a file that large is almost certainly not one of its
exports.

## "The selected export contains a record this app cannot accept"

A record is structurally fine but fails a rule the application enforces
everywhere, for example a weight outside the accepted range, a local date that
disagrees with the instant it was recorded at, or a set result that the
exercise's logging mode could not produce. The message deliberately does not
name the record: a message that quoted your data would put it somewhere it does
not belong.

If the file was edited by hand, restore the original instead.

## "The selected export plans an exercise it does not contain"

A planned day refers to an exercise definition that is not in the file. Planned
days describe what you intend to do next, so their references must resolve.

Completed workouts are different: they keep their own snapshots and may refer to
an exercise that was deleted long ago. That is not an error, and it is why a
restored workout can name an exercise your library does not list.

## An exercise from a restored workout is missing from the library

The exercise was deleted before the export was created. The workout keeps the
name, logging mode, planned target, and every set that was recorded at the time,
because that is what actually happened. Nothing is invented to fill the gap.

## A nutrient is still blank after restoring

It was never recorded. An unknown amount stays unknown rather than becoming
zero, because "not recorded" and "none" are different claims. A nutrient
recorded as zero is restored as zero.

## The daily fluid target looks wrong for old days

The target is current configuration, not history. An export stores one current
target and no past day has a stored target, so restoring cannot attach one to a
day in the past.

## BMI and calorie targets are back without being in the file

They are recomputed, not restored. Every derived figure is a pure function of
the profile and goal values in the file, so the application calculates them
again rather than importing numbers that could have drifted.

## Progress looks empty right after restoring

Progress derives its summaries from the restored records when a screen opens.
Move to another tab and back, or relaunch the app. If a period still looks
empty, check that the restored history actually covers that period.

## Was the file uploaded anywhere?

No. Everything happens on the device. The capability makes no network call, has
no telemetry, and writes no logs, so there is nowhere for the contents to leak
to. The system picker grants access to exactly the one file you chose, and the
application never changes or deletes it.

## Can a restore be undone?

No. Restoring writes into an installation that had nothing, so there is nothing
to return to except clearing the application's data again. This is also why the
application refuses to restore over existing records.

## Can I restore an encrypted or zipped export?

No. Exports are plain JSON and restore accepts nothing else. Encryption and
archive support would each need a separate reviewed design.
