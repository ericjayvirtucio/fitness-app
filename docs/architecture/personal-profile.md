# Personal profile architecture

## Flow and boundaries

The Profile tab is the first complete local vertical slice:

```text
Profile route
  → PersonalProfileScreen
  → GetProfileUseCase / SaveProfileUseCase
  → PersonalProfileRepository
  → PersonalProfileSqliteRepository
  → internal DatabaseConnection
  → Expo SQLite
```

`@fitness/domain` owns the immutable `UserProfile`, supported vocabularies,
canonical measurements, calendar-date checks, and capability ranges. The save use
case parses boundary strings, converts display units, and supplies the current date
explicitly. Presentation displays returned errors and does not duplicate rules.

Goals & Energy now consumes the validated profile through its repository contract
and recalculates on screen focus. This resolves the prior deferral of BMI and TDEE
without adding calculated columns to `personal_profile` or coupling formulas to
its SQLite representation. Unsupported formula coefficients do not invalidate or
rewrite inclusive profile selections.

## Current weight versus recorded history

The profile row holds one mutable current weight and no history. It remains the
only source of current weight for Goals & Energy. Historical body weight lives
in the separate Body Measurement History capability, which never rewrites the
profile except through one deliberate check-in action that updates both records
in a single transaction, and only when that check-in is the newest measurement.

Weight changed on this screen creates no history record, and a check-in edit or
deletion never changes the profile. See
[body measurement history](body-measurement-history.md) and
[ADR 0012](../decisions/0012-body-measurement-history-and-current-weight-authority.md).

## Storage mapping

Migration 2 creates one row in `personal_profile`, enforced by
`singleton_id = 1`. Millimeters and grams map to domain canonical values. Date of
birth is timezone-free `YYYY-MM-DD` text. Enumerated text has database checks and
is revalidated on reads. Corrupt rows become a safe `operation-failed` error.

All values use bound parameters. Save is an upsert inside the existing exclusive
transaction abstraction, and the same repository contract participates in the
body-measurement check-in transaction. There is no delete, generated identifier, timestamp,
sync state, or generic repository.

## Privacy and failures

Profile fields are sensitive. They remain in the app-local database and are never
included in errors or logs. Sprint 5 relies on the operating-system application
sandbox and device encryption; SQLite is not application-level encrypted. Cloud
use, backup/export, stronger at-rest protection, and key recovery require separate
designs. Initialization and operation failures never clear local data.
