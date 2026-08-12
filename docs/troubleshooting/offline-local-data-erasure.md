# Offline local data erasure troubleshooting

## Where is the delete option?

Profile → Data controls → Delete all local data. Export and restore live in the
same place. Data controls is reachable whether or not a profile exists.

## The delete control is greyed out

Two reasons, and the control says which one applies.

- The acknowledgement above it has not been ticked. Deleting everything takes a
  deliberate act, so the control stays disabled until then.
- This installation is not storing anything yet, so there is nothing to delete.

## What exactly is deleted?

Everything this app has stored on the device: profile details, goal settings,
nutrition entries and saved nutrition items, fluid entries and the daily target,
exercises, the weekly plan, any workout in progress, completed workouts and
their sets, weight check-ins, and any export file the app is still holding.

## What is not deleted?

- Export files already saved somewhere else, such as Files or Drive. The app
  cannot reach them, and it does not try.
- The app itself. It stays installed and is usable immediately.
- Anything in the cloud. There is no account and nothing is stored online, so
  there is nothing there to delete.

## Can deleting be undone?

Not in the app. There is no recovery copy, no undo, and no hidden backup. The
only way back is a file exported beforehand, which is why the screen offers
"Export my data first".

## Is the deleted information unrecoverable?

The app does not claim that. After a successful deletion it holds no
information, the database contains no records, its write-ahead log is truncated,
and the database file is rebuilt so free pages are released to the filesystem.
What a device's storage hardware, filesystem snapshots, or an operating-system
backup retain is outside the app's control; protection there comes from the
device encryption iOS and Android provide.

## "Your information could not be deleted. Nothing was changed."

Deleting is all or nothing, so a failure leaves everything exactly as it was.
Close anything else writing at the same time, such as a form left mid-save on
another tab, and try again. If it repeats, relaunch the app first: a failure at
this point is a storage failure, not a data problem.

## "Deleting could not be confirmed, so nothing was deleted."

The app checked every capability after deleting and something still reported
records, so it undid the deletion rather than report a success it could not
stand behind. Nothing was removed. Try again, and if it repeats, report it — the
check exists precisely so a partial deletion never reaches you as a success.

## "This app could not check its local storage, so nothing was deleted."

Storage could not be read at all, so the screen refuses before offering to
delete anything. Relaunch the app. If the problem persists, local storage itself
is failing and the startup screen will normally say so too.

## "An export file this app created is still on this device."

The records were deleted successfully. Only the export file the app had created
for you could not be removed at that moment. Open Export my data once and it
will be cleared, because that screen removes any held export when it opens.

## The app was closed while deleting

Nothing is left half-finished. The deletion happens in one transaction, so
either it committed before the app closed and the installation is empty, or it
did not and everything is still present. Reopen the app and check the Profile
tab.

## An old screen still shows deleted information

Every screen reloads when you return to it, and finishing the deletion returns
you to a first-run Profile. If a screen still shows old information, leave the
tab and come back. If it survives a relaunch, the records were not deleted, and
the completion panel would not have appeared.

## Progress still shows numbers

Progress is calculated from records; it stores nothing of its own. After a
deletion it shows "no records in this period". If it still shows figures after
returning to the tab and relaunching, the deletion did not happen.

## Restoring says the app already has information

Something was created after the deletion — even one entry counts. Delete again,
or restore before adding anything.

## Deleting seems slow on a long history

It is bounded by the size of the database file rather than by how many records
it holds, so it stays roughly the same on a large history. The phases shown —
deleting, then verifying, then cleaning up — are the actual steps and none of
them can be skipped.

## Can I delete only one kind of information?

Not from this screen. Individual entries, workouts, exercises, and check-ins can
be deleted from their own screens. Deleting a date range or a single capability
in one action is not supported.
