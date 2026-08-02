# ADR 0006: Goals and energy domain dependency

- Status: Accepted
- Date: 2026-08-02

## Context

Goals & Energy is the first domain capability derived from another capability's
facts. Its formulas need the personal profile's supported biological-sex and
activity-level vocabulary as well as shared canonical measurements. Duplicating
those options would allow the profile and calculations to drift, while moving
every profile attribute into the shared kernel would weaken capability ownership.

## Decision

Add a one-way domain dependency from `goals-energy` to `personal-profile` for the
existing option types and use the shared kernel for `Mass`, `Length`, `Energy`,
`Result`, and domain errors:

```text
goals-energy → personal-profile → shared kernel
             └──────────────────→ shared kernel
```

The dependency must remain acyclic. Personal Profile does not import Goals &
Energy, and persistence representations do not enter either domain capability.
Calculated values remain derived and are not added to `UserProfile`.

## Consequences

- Profile options retain one canonical definition.
- Goals & Energy can validate every formula input without framework or storage
  coupling.
- The dependency is more explicit than passing duplicated strings or primitive
  coefficients from application code.
- Personal-profile option changes now require review of downstream calculations.
- This decision does not authorize arbitrary capability coupling; future imports
  still require a demonstrated invariant and architecture review.

## Alternatives considered

Duplicating option unions in Goals & Energy was rejected because validation could
drift. Promoting biological sex and activity level into the shared kernel was
rejected because they remain profile facts with only one supplying capability.
Passing preselected equation coefficients and multipliers from the application
was rejected because it would move deterministic fitness rules outside the domain.
Adding calculations to Personal Profile was rejected because goals and energy are
a separate product capability.
