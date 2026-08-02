# Specification 0006: Goals and energy

- Status: Approved
- Date: 2026-08-02

## Objective and scope

Deliver an offline Goals & Energy capability derived from the personal profile.
An eligible adult can view BMI and its screening category, estimated resting
energy, estimated maintenance calories, and a daily calorie target based on a
locally saved lose, maintain, or gain goal.

The capability adds no nutrition logging, workout behavior, history, networking,
authentication, synchronization, analytics, AI, or medical recommendations.

## Formulas and evidence

BMI uses weight in kilograms divided by squared height in meters. Adult categories
use the CDC thresholds: underweight below 18.5, healthy weight from 18.5 to below
25, overweight from 25 to below 30, and obesity at 30 or above. Category selection
uses the unrounded value. BMI is presented only as a screening classification; it
does not directly measure body fat or distinguish fat from muscle and bone.

Resting energy uses the Mifflin-St Jeor equation with actual weight:

```text
Male:   10 × kg + 6.25 × cm - 5 × age + 5
Female: 10 × kg + 6.25 × cm - 5 × age - 161
```

The original study derived the equation from 498 healthy female and male subjects
aged 19–78. The product applies it only to adults aged 20–78 so the same age policy
also supports CDC adult BMI categories. The Academy of Nutrition and Dietetics
recommends Mifflin-St Jeor when measured resting metabolic rate is unavailable.
The UI calls the result estimated BMR for familiar product language while
explaining that the equation predicts resting energy rather than measuring it.

Estimated maintenance calories multiply resting energy by these explicit product
activity factors:

| Profile activity level | Factor |
| ---------------------- | -----: |
| Sedentary              |    1.2 |
| Lightly active         |    1.4 |
| Moderately active      |    1.6 |
| Very active            |    1.9 |
| Extremely active       |    2.2 |

These representative values sit within the Academy's published physical-activity
level ranges. The existing five profile choices do not map exactly to the four
published ranges, so the values are documented product assumptions rather than
precise physiological constants.

Sources:

- [CDC BMI frequently asked questions](https://www.cdc.gov/bmi/faq/index.html)
- [Mifflin et al., A new predictive equation for resting energy expenditure in healthy individuals](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [Academy of Nutrition and Dietetics Evidence Analysis Library: Assess Energy Needs](https://www.andeal.org/template.cfm?key=4341&template=guide_summary)
- [NIDDK Body Weight Planner](https://www.niddk.nih.gov/bwp.)

## Domain and eligibility

`@fitness/domain` owns immutable BMI, energy-estimate, activity-factor, goal, and
daily-target rules. Goals & Energy depends one way on the personal-profile option
vocabulary and on shared canonical `Mass`, `Length`, and `Energy` values. Domain
operations are synchronous, deterministic, constant-time, and framework-free.

Age is derived from date of birth and an explicit timezone-free `YYYY-MM-DD`
as-of date. It subtracts one year until the birthday month and day have been
reached. A February 29 birthday advances on March 1 in a non-leap year. Age is
never persisted.

Adult calculations require age 20–78. BMI requires valid positive height and
weight. Mifflin-St Jeor additionally requires `female` or `male` because its
published equations provide no coefficient for `intersex` or
`prefer-not-to-say`. The application never guesses a coefficient. Unsupported
profiles receive an explicit, safe outcome and retain their stored values.

## Goal and target policy

Supported goal types are `lose-weight`, `maintain-weight`, and `gain-weight`.
Maintain uses a zero adjustment. Lose and gain accept a whole-number adjustment
of 100–500 kcal/day, offered by the UI in 50-kcal increments. The adjustment may
not exceed 25% of the raw maintenance estimate. A derived target must be at least
1,000 kcal/day, matching the lower guardrail used by the NIDDK Body Weight
Planner. These are conservative product constraints, not individual nutrition
advice or guaranteed weight-change projections.

Raw calculations retain JavaScript double precision. BMI displays with one
decimal place; energy estimates and targets display as whole kilocalories.
Rounding occurs only in one presentation formatter after all domain comparisons
and arithmetic.

## Application and persistence

`GetEnergySummaryUseCase` loads the profile and goal, supplies the current local
calendar date, and orchestrates pure calculations. `GetGoalUseCase` and
`SaveGoalUseCase` expose the minimum goal read/write behavior through a
capability-owned `GoalRepository`.

Migration 3 creates one `goal_configuration` row constrained by
`singleton_id = 1`. Only goal type and adjustment magnitude are stored. Age,
BMI, category, resting energy, maintenance energy, and daily target are derived
on every load and are not persisted. The repository uses bound values and
revalidates rows through domain construction. One upsert is atomic and does not
require an additional application transaction.

No goal history, active-target snapshot, timestamps, cloud identifiers,
tombstones, or reconciliation fields are introduced.

## Experience, failure, and accessibility

Profile exposes a route to a separate Goals & Energy screen. The screen reloads
on focus so profile edits update all derived values. It distinguishes stored
profile facts, calculated estimates, and user-selected goal settings. Missing or
unsupported profile input shows a safe explanation and a route back to Profile;
no defaults are invented and profile editing is not duplicated.

Loading, read failure, validation, save failure, and success have visible text and
appropriate live-region behavior. Existing design-system controls preserve
Dynamic Type, native focus order, radio semantics, 44-point touch targets,
contrast, keyboard behavior, and screen-reader labels. Meaning never relies on
color alone.

Profile and goal values remain sensitive local information. They are not logged,
included in technical errors, transmitted, or analyzed. The operating-system app
sandbox and device protection remain the approved confidentiality boundary;
application-level SQLite encryption remains deferred.

## Verification

Domain tests cover BMI values and boundaries, age and leap-day boundaries,
Mifflin-St Jeor vectors and eligibility, activity factors, maintenance estimates,
goal validation, target guardrails, and raw precision. Application tests cover
complete, missing, unsupported, and corrupt profile behavior plus repository
interaction. Persistence tests cover migration 3, bound upsert values, read/write
mapping, corrupt rows, and safe failures. UI tests cover loading, profile-required,
unsupported calculation, summary, goal selection, validation, save feedback,
failure, refresh, and accessibility behavior.

Completion requires every repository quality check and sprint-specific manual QA
on available iOS and Android targets. Manual QA results must be confirmed by the
repository owner before merge readiness is assessed.

## Alternatives and trade-offs

Persisting derived values was rejected because profile edits would make them
stale. A sixth tab was rejected because the established shell has five primary
destinations. A free-form target, projected rate, percentage-only goal, and
coefficient fallback were rejected as unnecessary or misleading scope. The
common five-factor `1.2/1.375/1.55/1.725/1.9` convention was not selected because
the approved factors are more directly explainable against published PAL ranges.

Strict study-bounded eligibility excludes some otherwise valid profiles, but it
avoids silently extrapolating the formula. A singleton goal is sufficient for the
current single local profile but deliberately does not pre-design cloud or
multi-profile identity.

## Explicit exclusions

Food, beverages, hydration, macros, recipes, workout planning or logging, target
weight, body-fat targets, weight or measurement history, charts, analytics,
notifications, authentication, backend APIs, cloud sync, AI, health-platform
integrations, subscriptions, photos, barcode scanning, export, deletion, reset,
recovery, and application-level database encryption are excluded.

The repository owner approved the Stage 1 design with staged implementation
commits and durable formula sources on 2026-08-02.
