# ADR 0005: Capability-owned application slices

- Status: Accepted
- Date: 2026-08-02

## Context

The personal profile is the first business capability to connect mobile UI, use
cases, domain rules, repository contracts, and SQLite. The repository needs a
repeatable dependency direction without introducing a generic framework.

## Decision

Organize mobile business behavior by product capability, with application,
infrastructure, and presentation roles inside that capability. Keep routes thin.
Use cases own orchestration and capability-specific repository contracts;
infrastructure implements them and composition wires concrete dependencies.

Reuse `TransactionRunner<TContext>` with a context containing only repositories
needed by the operation. SQLite creates that context from its transaction-scoped
connection. Consume `@fitness/domain` through its source public boundary during
monorepo development while retaining its independent CommonJS declaration build.

Do not introduce command buses, mediators, generic CRUD repositories, service
locators, global state, or an application workspace package.

## Consequences

- UI and application code cannot observe SQLite or storage representations.
- Transactions expose capability repositories rather than database connections.
- Small composition and mapping code remains explicit until a second capability
  demonstrates a sound abstraction.
- Consumer type checks see current domain types without stale generated artifacts.

## Alternatives considered

Screen-to-repository calls bypass application orchestration. A shared application
package has only one consumer. Generic repositories obscure product operations. A
command or mediator framework adds indirection without a demonstrated need.
