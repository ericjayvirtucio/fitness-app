# Safe replacement restore troubleshooting

## Where is the replace option?

Profile → Data controls → Replace local data from an export. Export, restore,
and deletion live in the same place. Data controls is reachable whether or not a
profile exists.

## What is the difference between restoring and replacing?

Restoring brings a file into an app that holds nothing yet, and refuses if
anything is stored. Replacing swaps what is already stored for the file you
choose. Neither combines the two; there is no merge, and adding one would need
its own reviewed design.

## The replace control is greyed out

The control says which decision is still missing.

- No file has been checked yet. The control does not exist at all until a file
  has been read and validated, which is what makes replacing safe.
- The copy decision is unresolved. Either create a copy of your current
  information, or tick the acknowledgement that says you do not want one.
- The replacement acknowledgement has not been ticked.

## Nothing happened when I chose a file

If the picker was dismissed, the screen says no file was selected and nothing
changed. That is a neutral outcome, not a failure.

## The file was refused

Each refusal names its own cause: the file is not a Fitness App export, its
format version is not supported, it is larger than 25 MB, it is not valid JSON,
it contains a record the app cannot accept, or it plans an exercise it does not
contain. Nothing is replaced in any of those cases, because the file is checked
completely before anything destructive is offered.

Only `formatVersion` 1 is supported. Compatibility is never inferred from a file
name, an extension, or the app version.

## Is my current information copied automatically?

No. A copy is recommended and offered, never created silently. If you decline,
the app asks you to acknowledge that separately, and it creates nothing.

## The app says it cannot tell whether my copy was saved

That is accurate. Opening the share sheet hands the file to the operating
system, and the app cannot see which destination you chose, or whether you chose
one at all. It reports that the sheet closed and never that the file was saved.
Check the destination yourself before replacing.

## Where is my recovery copy now?

Inside the app's own cache, until you open Export my data again or the operating
system reclaims that space. It is not deleted by the replacement — that is
deliberate, because it may be your only way back. Save it somewhere you control
if you want to keep it.

## Replacing failed. Did I lose my information?

No. Every failure inside the replacement means the information that was already
on the device is still there, and each message says so. The deletion and the
writes share one database transaction, so either the previous dataset survives
untouched or the complete replacement is written. There is no state in between,
including if the app is force quit or the device loses power partway through.

The one failure that happens earlier is a recovery copy that could not be
created. Nothing has been replaced at that point either.

## The app closed while it was replacing

Relaunch it. SQLite rolls an interrupted transaction back, so the installation
holds either the previous dataset or the complete replacement. Check a tab you
recognise to see which, then retry if you still want to replace.

## Can replacing be undone?

Not in the app. There is no undo and no hidden backup. The way back is the
recovery copy, or any export saved beforehand, restored into an installation
after deleting all local data.

## The file I chose contains no records

The preview says so explicitly. A valid empty export is a complete dataset, and
replacing with it leaves the app with nothing stored, exactly as deleting
everything would. The app does not quietly turn that into a deletion; it is
still the operation you chose, with the same consequences.

## I replaced with an export from this same device

That is supported and does nothing surprising. Identifiers and stored values
round-trip exactly, so the visible result is the data you already had. It is
still a full replacement, and the app does not compare the two datasets to
detect it.

## An old workout is missing after replacing

Everything from the previous dataset is gone, including any workout that was in
progress. The app now holds only what the file contained. If the file itself
carried an active workout, that one is resumable.

## Completed workouts mention exercises I cannot find

Completed workouts keep the name, logging mode, and planned prescription that
were recorded at the time. If the file does not also contain that exercise
definition, the history stays truthful and the definition is simply absent. That
is intended, not a missing record.

## Did anything leave the device?

Nothing the app sent. Both files are read and written on the device, and the app
performs no network call, telemetry, or analytics anywhere in this workflow. If
you sent a copy somewhere through the share sheet, that destination is yours and
may use a network service on its own.

## Nothing appears in the log

Correct. This workflow performs no logging at all, so no record, identifier,
measurement, or file path can leak into one.
