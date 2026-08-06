# ADR 0008: Historical workout session snapshots

- Status: Accepted
- Date: 2026-08-06

## Context

Workout execution must survive restarts and remain understandable after mutable
Exercise Catalog definitions and recurring plans change or are deleted.

## Decision

Model Workout Session as an independent aggregate with active and completed
states. Snapshot exercise name, logging mode, planned prescription, workout name,
weekday, and child ordering when they enter the session. Retain source UUIDs only
as non-relational provenance. Session rows have no foreign keys to Catalog or
Planner.

Persist each performed set independently through a constrained result union.
Allow at most one active session through application validation and a SQLite
partial unique index. Every confirmed aggregate mutation is transactional and
immediately durable. Discard deletes the active aggregate; completion requires at
least one set and creates immutable history.

## Consequences

Catalog and Planner changes cannot rewrite workout history. Snapshots duplicate a
small amount of meaningful text and planned data while excluding notes, favorite
and search metadata, equipment, and muscle classification. Aggregate replacement
makes each small session mutation straightforward and atomic but rewrites that
session's children. Completed correction and history browsing need a later
lifecycle design.

## Alternatives considered

Joining mutable source rows, foreign-keying history to Catalog or Planner, copying
complete Exercise Definitions, retaining discarded sessions, supporting multiple
active sessions, and storing all modes in an unconstrained nullable domain object
were rejected as historically unsafe or disproportionate.
