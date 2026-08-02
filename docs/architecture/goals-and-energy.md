# Goals and energy architecture

## Flow and boundaries

Goals & Energy is an offline mobile capability derived from Personal Profile:

```text
Goals & Energy route
  → GoalsEnergyScreen
  → GetEnergySummaryUseCase / SaveGoalUseCase
  → PersonalProfileRepository + GoalRepository
  → validated domain calculations + SQLite adapters
```

`@fitness/domain` owns age, BMI, Mifflin-St Jeor, activity-factor,
goal-configuration, and calorie-target rules. Its one-way dependency on the
personal-profile option vocabulary is recorded in
[ADR 0006](../decisions/0006-goals-energy-domain-dependency.md). Presentation
owns only input strings, display rounding, labels, and interaction state.

The screen reloads through router focus events. Returning after a profile edit
therefore reads the latest profile and recalculates every estimate. UI does not
read SQLite and database rows never escape infrastructure.

## Formulas, sources, and rationale

BMI is `kilograms / meters²`. The unrounded result selects CDC adult categories:
underweight below 18.5, healthy weight below 25, overweight below 30, and obesity
at 30 or above. BMI is a screening classification rather than a diagnosis and
cannot distinguish fat, muscle, or bone. See the
[CDC BMI guidance](https://www.cdc.gov/bmi/faq/index.html).

Resting energy uses Mifflin-St Jeor with actual weight:

```text
Male:   10 × kg + 6.25 × cm - 5 × age + 5
Female: 10 × kg + 6.25 × cm - 5 × age - 161
```

The [original study](https://pubmed.ncbi.nlm.nih.gov/2305711/) included healthy
female and male subjects aged 19–78. The product requires ages 20–78 so its
eligibility aligns with CDC adult BMI interpretation while remaining within the
reported study population. The
[Academy evidence analysis](https://www.andeal.org/template.cfm?key=4341&template=guide_summary)
supports this equation when measured resting metabolism is unavailable. The UI
uses the familiar label “Estimated BMR” but explains that this is a prediction of
resting energy.

Maintenance is resting energy multiplied by `1.2`, `1.4`, `1.6`, `1.9`, or `2.2`
for the five profile activity levels. These are explicit representative product
values within the Academy's published PAL ranges. They are estimates, not exact
measurements of individual activity expenditure.

## Age and time

Age compares the timezone-free birth and as-of calendar year, month, and day. It
does not divide timestamp durations. A February 29 birthday advances on March 1
in a non-leap year. Mobile composition supplies the current device-local calendar
date through an injected clock; age is never stored.

## Goal policy and precision

Maintain uses zero adjustment. Lose and gain accept whole adjustments from
100–500 kcal/day; the UI suggests 50-kcal increments. A target rejects an
adjustment over 25% of raw maintenance or a result below 1,000 kcal/day. The
minimum follows the [NIDDK Body Weight Planner](https://www.niddk.nih.gov/bwp.)
guardrail. These limits do not predict or guarantee a rate of weight change.

Domain calculations retain full floating-point precision. Categories and target
validation use raw results. Presentation centralizes BMI formatting at one
decimal and positive energy formatting at the nearest whole kilocalorie.

## Persistence and privacy

Migration 3 adds the singleton `goal_configuration` table. `goal_type` and
`adjustment_kilocalories` are the only persisted fields. Age, BMI, category,
resting energy, maintenance, and target are always recalculated. Bound SQL values,
database checks, domain validation on reads, and safe `PersistenceError`
translation preserve the existing persistence boundary.

Profile and goal values are sensitive and remain on device. They are never logged,
sent over a network, or included in user-facing technical errors. Application
SQLite encryption, export, recovery, deletion, history, and cloud reconciliation
remain intentionally deferred.

## Known limitations

- Adult calculations are restricted to ages 20–78.
- Mifflin-St Jeor supplies only female and male coefficients; the app does not
  guess for other profile options.
- BMI does not measure body composition or diagnose health.
- Activity selection and calorie estimates can differ materially from actual
  energy expenditure.
- Pregnancy, breastfeeding, medical conditions, older-adult equations, target
  weight, and historical correctness are not modeled.
