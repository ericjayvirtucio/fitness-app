# Specifications

This directory contains reviewed product and technical specifications that are sufficiently concrete to guide implementation. It is not a backlog or a place for unapproved ideas.

## Admission criteria

A specification should define:

- the problem, users, scope, and explicit exclusions;
- terminology, requirements, constraints, and acceptance criteria;
- offline, data, failure, recovery, accessibility, privacy, security, and performance behavior;
- architecture boundaries and affected files or packages;
- alternatives and trade-offs;
- testing, documentation, migration, rollout, observability, and rollback plans as applicable;
- unresolved questions and recorded approval.

Name specifications with a sortable number and concise topic, such as `0001-offline-food-entry.md`. Link architecture-changing decisions to an ADR in `docs/decisions`.

Implementation must not silently expand an approved specification. Material discoveries should update the specification and return to review.
