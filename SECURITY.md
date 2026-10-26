# Security policy

## Supported versions

Only the latest deployed version of Buzzkill, built from the `main` branch, is supported.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this
repository, or go directly to
<https://github.com/nazimajumaniyazova/buzzkill/security/advisories/new>. Describe the problem,
how to reproduce it and the impact you expect. You will get a first answer within 7 days.

## Scope

The game is a static web application with an optional online leaderboard. Reports that matter:
script injection through nicknames or other user-provided data, bypasses of the leaderboard
verification, leaked secrets, and dependency vulnerabilities that are actually reachable from
the game.
