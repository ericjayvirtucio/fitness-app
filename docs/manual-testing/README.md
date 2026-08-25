# Manual device testing

Use this guide for behavior that depends on a real mobile interface or native
platform. Command-line tests remain the primary check for deterministic domain,
application, persistence, and focused component behavior:

```bash
pnpm test
```

## Test record

Copy this block into the pull request or verification notes:

- [ ] Date and tester recorded
- [ ] Commit or build recorded
- [ ] Device model recorded
- [ ] Platform and OS version recorded
- [ ] Network state recorded when relevant
- [ ] Changed capability checklist completed
- [ ] Critical smoke checklist completed
- [ ] Failures or limitations recorded

## Critical smoke checklist

- [ ] Launch succeeds without a storage or routing error.
- [ ] Each primary tab opens and its main content is readable.
- [ ] The changed workflow succeeds with valid input.
- [ ] Invalid or incomplete input is refused with understandable feedback.
- [ ] Saved changes remain correct after closing and reopening the app.
- [ ] Existing information remains intact after the changed workflow.
- [ ] Essential controls remain reachable with the keyboard open and at a large
      text size.
- [ ] Essential controls have understandable screen-reader names and state.
- [ ] Offline behavior matches the capability's documented contract.

## Selecting additional checks

Run only the historical capability checklist or checklists affected by the
change. Add adjacent checks when a shared navigation, persistence, export,
restore, deletion, date, or calculation boundary changed. A cross-capability
change should exercise every affected capability, but it does not require every
historical sprint checklist.

The files in this directory describe detailed capability behavior. References
inside older checklists to Maestro, `scripts/qa.sh`, sprint suites, or automated
regression suites are historical and are not current commands or release gates.
Record manual results using the test record above.
