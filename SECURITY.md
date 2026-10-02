# Security policy

resell.sh is a learning project and is **not production-hardened for real money**. Security reports are still very
welcome: they make the project a better teaching example.

## Supported versions

Only the latest release ([GitHub Releases](https://github.com/AlexGalhardo/nuxtjs-marketplace/releases)) receives
security fixes. Older versions are not patched.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:

1. Go to the repository's [Security tab](https://github.com/AlexGalhardo/nuxtjs-marketplace/security).
2. Click **Report a vulnerability** (GitHub private vulnerability reporting / security advisories).
3. Describe the issue, the affected route or file, steps to reproduce, and the impact you expect.

You can expect an acknowledgement within a few days. Once a fix is released, the advisory is published and you are
credited unless you prefer otherwise.

## Scope

In scope: the code in this repository (the Nuxt app, the API, the Docker images and the setup scripts).

Out of scope: risks already accepted and documented in
[docs/security.md](docs/security.md#residual-risks-accepted-for-v1) (for example no MFA, no stock reservation), issues
in third-party services (Stripe, Resend, GitHub), and attacks that need a compromised machine or stolen secrets.

Test only against your own local instance with Stripe test-mode keys. Never test against someone else's deployment.

## How the project approaches security

The baseline is OWASP Top 10:2025: the control matrix is in [PLAN.md §5.1](PLAN.md) and the controls in place are in
[docs/security.md](docs/security.md). Security fixes are recorded under `### Security` in [CHANGELOG.md](CHANGELOG.md).
