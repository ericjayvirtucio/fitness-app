# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for `ericjayvirtucio/fitness-app`. If private reporting is unavailable, contact the repository owner privately through a verified channel listed on the owner's GitHub profile.

Include the affected component and version, reproduction steps or proof of concept, likely impact, and any known mitigation. Do not include real user data. Allow reasonable time for investigation and remediation before disclosure.

## Supported versions

The project is pre-release. Security fixes are applied to the latest code on `main`; no released version support commitment exists yet. A version support table will be added before the first public release.

## Secure development requirements

- Never commit secrets or real personal information. `.env.example` contains names and safe examples only.
- Treat nutrition, workout, body measurement, account, and device data as sensitive.
- Validate data at trust boundaries and enforce authorization on the server.
- Use least-privilege credentials and separate development, test, staging, and production access.
- Do not log secrets, access tokens, raw health-adjacent records, or unnecessary identifiers.
- Keep dependencies pinned, review lockfile changes, and address relevant advisories promptly.
- Do not build custom cryptography or store plaintext credentials.

Security response procedures, severity targets, and operational contacts must be defined before a production service is launched.
