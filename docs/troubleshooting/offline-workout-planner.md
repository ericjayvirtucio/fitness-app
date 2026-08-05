# Offline workout planner troubleshooting

## The weekly plan cannot load

Use the in-app retry once. If startup persistence also fails, follow the local
database troubleshooting guidance. Inspect only controlled development errors;
do not log workout names, targets, identifiers, SQL, or bound values. Never clear
the database as an automatic recovery action.

## A workout does not save

Confirm its name is nonblank and every planned target uses positive, finite
values within the documented technical limits. Confirm referenced Exercise
Definitions still exist and retain the expected logging modes. A failed
aggregate replacement should leave the prior workout intact.

## An exercise cannot be deleted or change logging mode

Open the affected weekdays named in the error, remove or replace each planned
occurrence, save those workouts, and retry the catalog mutation. Do not bypass
the foreign key or trigger, cascade Planner rows, or edit migration 8.

## Targets display in unexpected units

Check the Personal Profile preferred unit system. Without a saved profile the
Planner defaults to metric presentation. Stored resistance and distance remain
canonical grams and millimeters; do not rewrite rows to change display units.

## Order does not persist

Use Move up or Move down and save the workout. Cancelling intentionally discards
the draft. If a save reports failure, the previous stored ordering remains
authoritative.

## Upgrade to schema 8 fails

Do not edit migrations 1–8 or automatically delete user data. Reproduce the
version-7 upgrade on disposable data, correct the application with a compatible
forward build, and retain generic user-facing errors.
