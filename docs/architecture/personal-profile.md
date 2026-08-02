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

## Storage mapping

Migration 2 creates one row in `personal_profile`, enforced by
`singleton_id = 1`. Millimeters and grams map to domain canonical values. Date of
birth is timezone-free `YYYY-MM-DD` text. Enumerated text has database checks and
is revalidated on reads. Corrupt rows become a safe `operation-failed` error.

All values use bound parameters. Save is an upsert inside the existing exclusive
transaction abstraction. There is no delete, generated identifier, timestamp,
sync state, or generic repository.

## Privacy and failures

Profile fields are sensitive. They remain in the app-local database and are never
included in errors or logs. Sprint 5 relies on the operating-system application
sandbox and device encryption; SQLite is not application-level encrypted. Cloud
use, backup/export, stronger at-rest protection, and key recovery require separate
designs. Initialization and operation failures never clear local data.
