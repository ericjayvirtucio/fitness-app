# Engineering Constitution

This file is the standing operating agreement for people and automated assistants working in this repository. Product requirements and approved specifications may add constraints but must not silently weaken these rules.

## Required workflow

For any material change:

1. Analyze the problem and existing implementation.
2. Present design options, a recommendation, trade-offs, affected structure, and files.
3. Obtain approval before architectural changes or broad implementation.
4. Implement the smallest complete solution.
5. Self-review as a senior reviewer would.
6. Run proportionate tests and all repository quality checks.
7. Update documentation that the change makes inaccurate or incomplete.
8. Provide a Git-oriented summary of changed files, verification, risks, and suggested next step.

Do not continue into a later product phase without explicit approval.

## Architecture philosophy

- Build an offline-first, modular monorepo organized around cohesive product features.
- Keep business logic pure, deterministic, framework-independent, and covered by tests.
- Share domain rules rather than duplicating them across mobile and API code.
- The backend owns business authority for cloud-participating data; mobile owns the offline experience.
- Prefer SQLite locally before adding cloud synchronization. Design cloud reconciliation explicitly before implementation.
- Treat AI as a fallible fallback. AI output never silently overrides deterministic rules or user-provided facts.
- Validate untrusted input at every trust boundary. Client validation improves experience; server validation enforces authority.
- Make security, accessibility, performance, and observability default design concerns.
- Introduce abstractions only after a real use case demonstrates the boundary.

## Repository organization

- `apps/mobile` contains the Expo application and mobile-specific composition.
- `apps/api` contains the NestJS service and server-specific composition.
- `packages` contains code or configuration with immediate, demonstrated reuse.
- `docs/architecture` describes current architecture.
- `docs/decisions` contains accepted architecture decision records.
- `specs` contains reviewed implementation specifications.
- `infrastructure` contains approved deployment or operational configuration only.
- `.github` contains repository collaboration and automation configuration.

Do not create empty packages, speculative services, a worker application, or catch-all `utils` modules.

## Feature and folder conventions

When features are introduced, organize their internal code by product capability first and technical role second. Keep a feature's domain rules, application orchestration, adapters, and tests visibly related while preventing framework dependencies from entering its domain layer.

Use `index.ts` exports only at deliberate package or feature boundaries. Avoid deep barrel chains and circular dependencies. A package must expose a documented public surface; consumers must not import its internals.

## Coding standards

- TypeScript strictness is mandatory. Do not use `any`, unsafe assertions, `@ts-ignore`, or disabled lint rules without a narrow, documented reason.
- Prefer immutable data and pure functions for business rules.
- Handle error states explicitly; never swallow errors.
- Keep functions and modules focused. Name concepts in product language.
- Validate external data before treating it as a domain type.
- Avoid hidden global state and environment reads outside composition boundaries.
- Comments explain intent, constraints, or non-obvious trade-offs—not syntax.
- Warnings in lint, type checking, builds, or tests are failures unless a reviewed exception exists.

## Naming conventions

- Files and directories: `kebab-case`, except framework-required names and React component files.
- React components, classes, types, and interfaces: `PascalCase`.
- Functions, variables, and properties: `camelCase`.
- Constants: `camelCase` unless they are truly process-wide immutable values, which may use `UPPER_SNAKE_CASE`.
- Boolean names begin with a meaningful predicate such as `is`, `has`, `can`, or `should`.
- Tests use `*.spec.ts` or `*.spec.tsx` and sit near the behavior unless a tool requires another location.
- Database and API naming conventions must be established in their introducing specifications.

Avoid vague names such as `common`, `shared`, `helper`, `manager`, or `data` unless the scope makes the meaning precise.

## Testing philosophy

- Test externally meaningful behavior, domain invariants, boundaries, failures, and recovery—not implementation trivia.
- Pure domain rules use Vitest and remain fast and framework-independent.
- Expo application behavior and focused React Native components use Jest.
- Jest integration tests verify adapters such as SQLite, APIs, and platform services.
- Manual device checks cover a small set of critical user journeys that depend
  on native user-interface or platform behavior.
- Every defect fix includes a regression test when technically feasible.
- Tests must be deterministic, isolated, readable, and safe to run repeatedly.
- Mock only boundaries the test does not own. Do not mock the subject into passing.
- Treat coverage as diagnostic information, not an arbitrary percentage gate.
- Remove a test as duplicate only when it exercises the same boundary, action,
  and meaningful outcome without adding distinct failure diagnosis.

A feature is not complete when its meaningful behavior cannot be verified.
Simulator or emulator automation is not required. Keep deterministic domain,
application, persistence, and focused component tests runnable from the command
line. Use the repository's risk-based manual checklist for native behavior.
`pnpm test:changed` is optional branch feedback; `pnpm test` remains the complete
command-line verification gate.

## Documentation standards

Documentation describes the current truth. Update it in the same change as behavior. Future features should include an implementation guide, tests, architecture updates, troubleshooting guidance, API documentation where applicable, an ADR for architecture changes, and a runbook for operationally important behavior.

Use relative links within the repository. Record durable decisions in ADRs, not transient chat or pull request comments. Remove obsolete guidance instead of layering contradictions.

## Security philosophy

- Never commit secrets, credentials, tokens, private keys, personal data, or production environment values.
- Apply least privilege, secure defaults, input validation, output encoding, and explicit authorization.
- Treat fitness, health-adjacent, identity, and authentication information as sensitive.
- Do not log secrets or sensitive personal data. Redact identifiers where diagnostics do not require them.
- Review dependencies and data flows before adoption. Pin dependencies and commit the lockfile.
- Use maintained cryptographic and authentication libraries; do not design custom cryptography.
- Report suspected vulnerabilities according to `SECURITY.md`.

## Dependencies

A new library requires a concrete use case and review of maintenance, license, security history, bundle or runtime cost, platform support, type quality, and overlap with existing tools. Prefer platform and standard-library capabilities where they are clear and maintainable.

Production dependencies belong to the workspace that executes them. Repository-wide development tools belong at the root. Shared packages must have at least two real consumers or another compelling boundary reason. Remove unused dependencies promptly.

## Git workflow

- Branch from an up-to-date `main` using descriptive prefixes such as `feature/`, `fix/`, `chore/`, or `docs/`.
- Create the working branch before modifying files for a new task.
- Commit completed work in coherent stages as implementation, verification, and documentation progress.
- Keep commits cohesive, reviewable, and free of unrelated formatting or generated changes.
- Never rewrite shared history without explicit coordination.
- Do not commit or push on behalf of the repository owner unless explicitly requested.
- Commit authorship and branch naming must represent the repository owner or human contributor; do not add automated-assistant attribution.
- After implementation, verification, and documentation are complete, stop and request approval before opening a pull request. The repository owner reviews the pull request and merges it into `main` manually.

Use Conventional Commits:

```text
<type>(optional-scope): concise imperative summary
```

Common types are `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, and `chore`. Breaking changes require an explicit footer.

## Pull request expectations

Pull requests explain the problem, solution, scope, trade-offs, testing evidence, documentation impact, security and privacy considerations, accessibility impact, and follow-up work. Keep changes small enough for meaningful review. Resolve feedback with code or reasoned discussion, not mechanical agreement.

CI must pass before merge. Do not merge known correctness, security, data-loss, accessibility, or migration risks without explicit acceptance and a documented mitigation.

## Definition of done

A change is done only when:

- approved scope and acceptance criteria are satisfied;
- architecture boundaries and product principles remain intact;
- types, formatting, linting, tests, and builds pass as applicable;
- failure, offline, accessibility, performance, privacy, and security behavior were considered;
- documentation and examples reflect the result;
- no placeholder code, dead code, unexplained warnings, or speculative dependencies remain;
- the change was self-reviewed and is ready for human review;
- the final summary lists verification, limitations, risks, and manual steps.

## Rules for automated assistants

- Read this file, relevant specifications, and surrounding code before acting.
- Never invent requirements, credentials, test results, or completed actions.
- Preserve unrelated work and do not use destructive Git or filesystem operations without explicit authorization.
- Stop for approval before broad file generation, architecture changes, new external services, schema decisions, or a new product phase.
- Prefer small, reversible changes and explain consequential assumptions.
- Use repository tools and established patterns before introducing alternatives.
- Never identify an automated assistant as an author, co-author, contributor, or branch owner in repository content or Git metadata.
- If requirements conflict or a safe solution is unclear, document the conflict, recommend a path, and request direction.
