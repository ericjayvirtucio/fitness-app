# Contributing

## Before starting

Read `AGENTS.md`, `PRODUCT.md`, relevant architecture documentation, and any approved specification. Material or architectural work requires design review before implementation.

## Local setup

```bash
corepack enable
pnpm install --frozen-lockfile
```

Use the Node and pnpm versions declared in the root `package.json`. Do not bypass engine or peer-dependency failures without investigating compatibility.

## Development workflow

1. Create a focused branch from `main`, for example `chore/phase-0-engineering-foundation`.
2. Implement one cohesive, approved change.
3. Add or update meaningful tests when behavior exists.
4. Update affected documentation in the same change.
5. Run the quality suite.
6. Self-review the diff before opening a pull request.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Run `pnpm test` for the terminal-based Jest and Vitest suites. They do not start
a simulator or emulator, and the mobile suite runs serially to limit memory use.
During development, `pnpm test:changed` runs only workspaces affected relative to
`main`; it is quick feedback and does not replace the complete pre-review run.

Changes to mobile navigation, native behavior, accessibility, persistence
composition, or a user workflow also require the risk-based checks in the
[manual testing guide](docs/manual-testing/README.md) on an available physical
device. Test the changed capability and the short critical smoke checklist;
do not repeat every historical sprint checklist for each change.

Use Vitest for pure domain rules and Jest for Expo application behavior, focused
React Native components, and SQLite integration. Add tests for meaningful
boundaries, failures, transactions, recovery, and confirmed defect regressions.
Coverage reports guide investigation; no arbitrary percentage is a completion
gate.

Husky runs lint-staged before a commit. Hooks are a fast feedback mechanism, not a replacement for the complete checks.

## Commits

Use Conventional Commits with an imperative summary:

```text
chore: establish monorepo quality foundation
feat(nutrition): record an offline food entry
fix(sync): retain local changes after a retry
```

Keep commits cohesive. Do not add automated-assistant authorship or co-authorship to commits or repository content.

## Pull requests

Complete the pull request template. Include concrete verification evidence and disclose limitations. Link the approved specification or architecture decision when applicable. Avoid mixing refactors, dependency upgrades, and features unless they are inseparable.

## Dependencies and generated files

Explain why each new dependency is necessary and commit `pnpm-lock.yaml` with dependency changes. Do not hand-edit the lockfile. Generated native Expo projects are not committed unless an approved native requirement makes them source artifacts.

## Reporting problems

Use the issue templates for defects and product proposals. Report vulnerabilities privately according to `SECURITY.md` rather than opening a public issue.
