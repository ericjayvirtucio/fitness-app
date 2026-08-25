# ADR 0033: Risk-based manual device testing

- Status: Accepted
- Date: 2026-08-25

## Context

The Maestro mobile end-to-end harness required an iOS Simulator or Android
Emulator, substantial memory, long native builds, and ongoing flow maintenance.
Those costs made it unsuitable for the available development hardware and slowed
feedback enough that it was not a dependable everyday quality check.

The repository already has deterministic domain, application, persistence, and
focused component tests that run from the command line without a virtual device.
Native presentation, accessibility, and platform integration still need
verification in the application a person actually uses.

## Decision

Remove the Maestro harness, simulator suites, regression suites, and their shell
wrapper. Keep Jest and Vitest as the command-line test entry point through
`pnpm test`; workspaces and test files run serially to limit memory consumption.

Verify native user-interface and platform behavior manually on an available
physical device. For each change, run the critical smoke checklist plus the
affected capability sections. Use broader checks when a change crosses
navigation, persistence, data-lifecycle, or capability boundaries. Record the
device, platform version, build or commit, date, results, and defects.

Historical sprint checklists remain useful capability references, but they are
not cumulative release gates and their former Maestro commands are obsolete.

## Consequences

Development no longer requires simulator automation, Maestro, native E2E report
generation, or maintenance of duplicated YAML journeys. Terminal tests retain
fast coverage of deterministic rules and storage boundaries.

Manual device checks require discipline and do not provide automatic replay,
timing, or machine-generated failure artifacts. Reviewers must evaluate the
selected checklist scope and evidence. Cross-platform defects may remain unseen
when only one physical platform is available, so that limitation must be stated
in verification notes.

## Alternatives considered

Removing every automated test was rejected because manual interaction is poor at
exercising calculation boundaries, transactions, migrations, and deterministic
failure cases. Retaining Maestro only for occasional use was rejected because it
would preserve its dependency and maintenance burden without making it a
reliable gate. Moving native automation to hosted infrastructure remains a
possible future decision if its recurring cost and maintenance are justified.
