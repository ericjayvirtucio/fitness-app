# Specification 0013: Offline workout sessions

- Status: Approved
- Date: 2026-08-06

## Objective and scope

Add one durable device-local active workout, planned and empty start flows,
individual actual-set logging for every Exercise Catalog logging mode, deliberate
completion, and confirmed discard. Sessions remain independent from mutable
Exercise Catalog definitions and recurring Workout Planner intent.

## Domain and historical snapshots

`@fitness/domain` owns immutable sessions, session exercises, actual sets, and a
closed result union. Results reuse canonical `Mass`, `Length`, and `Duration`.
Every session exercise snapshots its display name and logging mode when the
session execution context receives it. Planned starts additionally snapshot the
workout name, weekday, ordered exercises, and planned prescriptions. Source UUIDs
are retained as non-relational provenance; session history never joins mutable
catalog or planner rows for meaning.

Sessions have only active and completed states. Completion requires at least one
actual set and an end timestamp no earlier than the start. Discard atomically
deletes an active aggregate. Completed-session correction and history browsing
are deferred.

## Persistence and behavior

Migration 9 owns session, session-exercise, and actual-set tables. Strict checks
encode snapshot and actual-result unions, owned children cascade only with the
session aggregate, and a partial unique index permits at most one active session.
Every confirmed mutation is immediately transactional and recoverable after app
termination or device restart. Start operations reload their plan/catalog input
inside the transaction before snapshotting it.

Users can start today's plan or an empty workout, resume the existing active
workout, add or remove exercises without changing the plan, and add, edit, or
delete individually ordered sets. Removing performed data and discarding a
session require confirmation. Quick-entry defaults remain unsaved until explicit
confirmation.

## Experience and constraints

Workout makes Resume prominent, shows today's planned target as neutral guidance,
and retains Weekly Plan and Exercise Library access without another tab. Forms
show only fields applicable to the snapshotted logging mode and label external
weight, added weight, and assistance distinctly. Layouts support large Dynamic
Type, keyboard entry, screen readers, contextual set actions, and minimum touch
targets.

All behavior remains offline and inside the application sandbox. There is no
network, telemetry, analytics, AI, new permission, or new dependency. SQL is
bound, stored rows are validated, and failures reveal no workout values.

## Explicit exclusions

History browsing/correction, analytics, volume, records, progression, adherence,
recents, rest timers, advanced set types, HealthKit, Health Connect,
authentication, backend behavior, synchronization, encryption, export, backup,
notifications, subscriptions, and AI are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-06.
