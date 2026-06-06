# Security Policy

Pensiv plugins are **executable code** that runs inside the Pensiv app under a
declared-permission model. We take the integrity of this repo — the SDK, the
build pipeline, the scaffold, and the example corpus — seriously, because it is
the supply chain for what other people install.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report privately through GitHub's **"Report a vulnerability"** button under the
repository's **Security** tab (Private Vulnerability Reporting), or email
**team@pensiv.so** with the subject line **`[Security concern]`** so it's routed
and triaged quickly.

Include, where possible:

- the affected package/plugin and version,
- a description and impact (e.g. permission bypass, code execution, data
  exfiltration),
- reproduction steps or a proof of concept.

We aim to acknowledge within **3 business days** and to provide a remediation
timeline after triage. Please give us a reasonable window to ship a fix before
any public disclosure.

## Scope

In scope:

- `@pensiv/plugin-sdk`, `@pensiv/build-config`, `@pensiv/plugin-ui`,
  `create-pensiv-plugin`
- the build/packaging scripts (`scripts/`)
- the permission contract as documented in [AGENTS.md](AGENTS.md)

Out of scope:

- vulnerabilities in third-party dependencies (report those upstream; we track
  them via Dependabot)
- the closed-source Pensiv app host itself (report via the app's own channel)

## Supported versions

This is pre-1.0 ecosystem tooling; security fixes land on `main` and the latest
published release of each package.
