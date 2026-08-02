# Offline nutrition logging troubleshooting

## Entries do not load

Use the visible retry action once. If it fails again, inspect the controlled
development error cause without logging SQL, UUIDs, descriptions, dates, or
nutrition values. Confirm migration 4 completed and the installed app is not older
than the database. Never delete the database as an automatic recovery step.

## An entry will not save

Confirm description and energy are present, reference and consumed amounts are
positive, and both use the selected grams or milliliters dimension. Optional
nutrients must be blank or finite nonnegative numbers. Use `YYYY-MM-DD` and
24-hour `HH:MM`; future consumption is not accepted.

## A daily nutrient says Incomplete

At least one entry on that day has unknown information for the nutrient. Edit the
entry only when the missing value is known. Do not enter zero merely to obtain a
numeric total; zero means the nutrient is known to be absent.

## An entry appears on an unexpected day

The diary uses the local calendar date captured with the entry, not the device's
current timezone. Open the entry and review its date and time. Editing and saving
the occurrence recaptures the current platform timezone offset for that wall time.

## Native UUID generation fails

Confirm `expo-crypto` matches the installed Expo SDK with
`pnpm --filter @fitness/mobile exec expo install --check`. Rebuild the native app
after adding or changing native modules; do not replace secure UUID generation
with `Math.random` or a custom generator.
