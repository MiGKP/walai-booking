# Dependency security update

> Historical intermediate result: the later [latest stable dependency update](./2026-10-10-latest-dependencies.md) supersedes the package versions, audit counts, and verification totals in this report.

Date: 2026-10-10 (Asia/Bangkok)
Baseline: `53f508b14887acfd12c8c70ba61deb6668b71b07` on `main`.

## Scope and audit results

Updated local npm manifests and lockfiles. No database migrations, booking data changes, commits, pushes, or deployments were performed for this update.

Counts below are npm audit dependency reports, including packages affected through transitive dependencies. They are not counts of independently reproduced attacks.

| Package | Before, all dependencies | After, all dependencies | After, production dependencies |
| --- | ---: | ---: | ---: |
| Backend | 27 (9 moderate, 17 high, 1 critical) | 0 | 0 |
| Frontend | 25 (1 low, 4 moderate, 18 high, 2 critical) | 7 high | 0 |

Commands: `npm audit --json` and `npm audit --omit=dev --json`, executed separately in each package.

## Changes

- Updated Express within version 4 and resolved `proxy-addr` 2.0.8, patched query/body parsers, and other compatible transitive updates in the lockfile. See [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- Updated Multer to 2.4.0 with matching type definitions. The existing memory storage, file filter, size limit, and HTTP error handling remain in use.
- Updated Nodemailer to 10.0.16 and switched to its built-in named TypeScript types. Removed obsolete external Nodemailer types.
- Removed unused backend `uuid` and its types after checking repository imports.
- Replaced backend nodemon with Node's native watch mode while retaining ts-node: `node --watch -r ts-node/register src/index.ts`. Removed unused frontend nodemon.
- Replaced the Prisma 8 release candidate with pinned stable 6.19.3, compatible with the existing schema's datasource URL format. Scoped the `deepmerge-ts` override to `@prisma/config` at version 8; verified Prisma config loading and schema validation without connecting to a database.
- Updated Next.js to 16.4.0, Axios to 1.20.0, NextAuth to 4.24.15, PostCSS to 8.5.23, and patched transitive image/CSS/request dependencies.
- Overrode `postcss-selector-parser` to 7.1.6 to address its parser advisory; verified the frontend build with Tailwind 3.
- Kept ESLint's original Next config 16.1.6 and React Hooks plugin 7.0.1. Updating the lint rule set to 7.1 introduced 21 errors in previously unchanged application code; adopting that rule set is separate from this security update. No lint rule or TypeScript check was disabled. Patched compatible lint transitive dependencies remain updated.

## Remaining frontend reports

All seven remaining reports stem from **one unpatched `braces` issue** through build/lint tools: `braces`, `chokidar`, `micromatch`, `fast-glob`, `tailwindcss`, `@next/eslint-plugin-next`, and `eslint-config-next`.

The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version; the npm registry's latest `braces` is 3.0.3 and is affected. `npm audit fix --force` suggests a Tailwind major migration and an ESLint downgrade, which do not constitute a verified compatible fix for this project.

These packages process checked-in source files and fixed configuration during build/lint. The application does not expose their pattern parsers as customer API endpoints. This reduces runtime exposure but does not make the build environment risk-free. Build only reviewed source/configuration; do not pass untrusted patterns to these tools. Recheck the advisory for an upstream patch. A Tailwind/toolchain migration needs separate implementation and UI validation.

No advisory was suppressed, and no audit threshold was weakened.

## Verification

- Backend TypeScript build passed.
- Backend regression: **117 passed**, including valid PNG upload, invalid type/oversize rejection, duplicate slip field rejection, and OTP message construction through the application's SMTP path with an in-memory transport. No real email was sent.
- Frontend production build passed on Next.js 16.4.0, including TypeScript checks and all 61 routes.
- Frontend regression: **64 passed**.
- Frontend lint: **0 errors, 75 existing warnings** with the original rule baseline.
- Prisma schema validation and explicit config loading passed with a dummy database URL. No introspection, migration, or database write was run.
- Native Node watch probe started and restarted after a temporary TypeScript fixture changed; the probe was then stopped and the fixture removed.
- npm installs use the checked-in lockfiles; no `--force` audit fix was used.

These are local verification results. Production continues running the previous deployed commit until this update is committed and deployed.
