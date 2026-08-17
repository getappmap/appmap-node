# Deferred dependency upgrades

Maintainer reference for the accepted `yarn npm audit -AR` findings and the
version floors that unblock them. Written 2026-08-17.

`yarn npm audit -AR` should exit clean. It does so because every finding below
is listed by advisory ID in `npmAuditIgnoreAdvisories` in `.yarnrc.yml`, with a
one-line rationale next to each group. **That file is the source of truth for
what is suppressed**; this document explains *why* and what it would take to
stop suppressing it.

Advisory IDs and counts go stale quickly. The durable content here is the
"blocked on" grouping, not the tallies.

It also records two decisions that are easy to "helpfully" undo later — see
[Dependabot](#dependabot) and
[Why `yarn npm audit` is not in CI](#why-yarn-npm-audit-is-not-in-ci).

## Nothing we publish is affected

```
$ yarn npm audit -R --environment production
➤ YN0001: No audit suggestions
```

Every accepted finding lives in `devDependencies` or in a private, test-only
workspace under `test/`. None reach the published `dist/`, and none affect
consumers of `appmap-node`.

## Suppress by advisory ID, not by package

`.yarnrc.yml` deliberately uses `npmAuditIgnoreAdvisories` (advisory IDs)
rather than `npmAuditExcludePackages` (package names).

Excluding a package masks its *future* advisories too. For `next` and `vite`
that would be actively harmful: it would hide genuinely actionable alerts
against `test/next16` (on the current Next 16.x line) and against the
vitest 3/4 chains (vite 7/8). Suppressing by ID keeps every new advisory
visible, at the cost of a longer list.

This is verifiable — remove any single ID from the list and exactly that
finding reappears.

## Retiring the suppressions

The list is long (31 entries), so it is grouped into blocks that are deleted
**wholesale**, never audited entry by entry. Each block in `.yarnrc.yml`
carries a `REMOVE WHEN:` line naming its trigger. The mapping:

| Do this | Delete these blocks | Entries freed |
| --- | --- | --- |
| Drop support for vitest < 3 | vitest, vite, esbuild | 5 |
| Move `test/next` off the Next 14 line | next | 21 |
| Raise `engines.node` to 20 | serialize-javascript | 2 |
| Raise `engines.node` to 20.17 | `glob (deprecation)`, and drop or retarget the `node-gyp` pin in `resolutions` | 1 |
| Bump mocha past 10.x | `inflight (deprecation)` | 1 |
| — (unfixable) | `prebuild-install (deprecation)` | 0 |

**26 of the 31 entries go away with just the first two rows.** After any of
these, re-run `yarn npm audit -AR`: if it still exits clean with the block
deleted, the entries were dead and the deletion is correct. If something
reappears, the suppression was still load-bearing and the reason will be in the
block comment.

## Blocked on dropping Node < 20

- **`serialize-javascript` 6.0.2 via mocha** — GHSA-5c6j-r48x-rmvq (high, RCE
  via `RegExp.flags` / `Date.prototype.toISOString`) and GHSA-qj8w-gfj5-8c6v
  (moderate, CPU-exhaustion DoS). Fixed in 7.0.5.

  No released mocha allows the fix: 10.8.2 **and** the latest 11.8.0 both pin
  `serialize-javascript: ^6.0.2`; only `mocha@12.0.0-rc.6` moves to `^7.0.2`.
  A `resolutions` override is blocked too, because **serialize-javascript 7.x
  declares `engines.node: >=20.0.0`** while we declare `>=18` and CI covers
  Node 18.

  Exposure is nil: mocha only requires it from `lib/nodejs/worker.js` and
  `lib/nodejs/buffered-worker-pool.js` — parallel mode only — and `test/mocha`
  has no `.mocharc` and never runs `--parallel`.

- **`glob` 10.5.0 (deprecation).** We pin `node-gyp` to `^11.5.0` in
  `resolutions`, which already cleared six findings. node-gyp **12.x** drops
  `make-fetch-happen`/`cacache` entirely and would clear this last one too, but
  declares `engines.node: ^20.17.0 || >=22.9.0`. node-gyp 11.5.0 declares
  `^18.17.0 || >=20.5.0`, which matches our floor.

- **`sqlite3`.** 6.x moves to node-gyp 12.x but declares
  `engines.node: >=20.17.0`.

## Blocked on dropping Next < 15

- **`next` 14.2.35 in `test/next`** — 21 advisories (high/moderate/low). Every
  fix landed in 15.5.x or later; the highest floor required is **15.5.16**.

  **14.2.35 is the last stable 14.x** — only canaries beyond it — so there is
  no headroom whatsoever within the major. It is the major bump or nothing.

  This workspace exists to cover the Next 14 instrumentation path
  (`loadConfig` + injected webpack loader). `test/next16` already covers the
  current line. Options: accept, drop Next 14 coverage, or add a
  `test/next15`.

## Blocked on dropping vitest < 3

- **`vitest` 0.34.6 / 1.6.1 / 2.1.9** (`test/vitest`, `test/vitest1`,
  `test/vitest2`) — GHSA-5xrq-8626-4rwp, **critical**, arbitrary file read and
  execution while the Vitest UI server is listening.

  **No fix exists on these lines.** Upstream fixed it in 3.2.6 and 4.1.0 only;
  each of 0.34.6, 1.6.1 and 2.1.9 is the final release of its major.
  `test/vitest3` and `test/vitest4` are already on fixed versions. Exposure is
  nil — the advisory requires the Vitest **UI** server to be listening, which
  these tests never start.

- **`vite` 5.4.21 and `esbuild` 0.21.5** — 4 advisories, strictly downstream of
  the above. `vitest` 1.6.1 pins `vite: ^5.0.0` and 0.34.6 pins
  `^3.1.0 || ^4.0.0 || ^5.0.0-0`, while the vite fixes land in 6.4.3+.
  **5.4.21 is the last 5.x** and it pins `esbuild: ^0.21.3`. Resolves itself
  when vitest < 3 goes.

## Unfixable at any version floor

- **`prebuild-install` 7.1.3 (deprecation)** — unmaintained with no successor
  ("contact the author of the relevant native module"). 7.1.3 is the latest
  release and sqlite3 6.x depends on it too, so bumping sqlite3 will not help.

- **`inflight` 1.0.6 (deprecation)** via mocha's `glob` 8.1.0 — mocha 11 moves
  to `glob ^10.4.5`, which would drop `inflight` but only swaps it for the
  `glob` 10.5.0 notice above. Not worth a mocha major on its own.

## Active `resolutions` overrides

Two entries in the root `package.json` exist purely to fix advisories that
could not be reached by bumping:

- **`node-gyp: ^11.5.0`** — three different *optional* node-gyp entries (8.4.1
  via sqlite3, 9.4.0 via `fsevents`/`node-addon-api` declaring
  `node-gyp: latest`, 12.4.0 via npm's own tree) were dragging in a large
  deprecated subtree. `yarn npm audit -AR` reports optional lockfile entries
  even though nothing links them — sqlite3 and fsevents both ship prebuilt
  binaries, so node-gyp never runs here. Consolidating cleared `npmlog`,
  `gauge`, `are-we-there-yet`, `rimraf`, `@npmcli/move-file` and
  `@tootallnate/once`.

- **`postcss: ^8.5.26`** — `next@14.2.35` depends on `"postcss": "8.4.31"`, an
  *exact* pin, so the resolver has no range to move within. The override also
  pulls `nanoid` 3.3.18, clearing two high-severity advisories. Note that
  neither Next test app contains any CSS or postcss config, so postcss is
  loaded by the build pipeline without being meaningfully exercised.

Both should be re-evaluated when the version floors move — the node-gyp pin in
particular becomes unnecessary once Node 18 is dropped.

## Dependabot

**Dependabot, not `yarn npm audit`, is the security signal for this repo.** It
runs unprompted and opens bump PRs when a fix exists. The yarn audit
suppressions above exist only so that an ad-hoc `yarn npm audit -AR` is
readable; they are not a second security process.

### Manual alert dismissal is the chosen approach

Dismiss accepted alerts in the Security tab (or via the REST API) with reason
`not_used` — accurate here, since the vulnerable code paths are never exercised
by hello-world test fixtures.

This is deliberately preferred over any in-repo config, because **dismissals
are self-cleaning**: they resolve on their own when the dependency moves, and
they live in GitHub's alert state rather than rotting in a file that someone has
to remember to prune. It is also already the established workflow here — the
`vite`, `vitest` and `serialize-javascript` alerts absent from the alert list as
of 2026-08-17 were absent because they had been manually dismissed earlier, and
they stayed quiet.

### Do not move test deps to `devDependencies` for this

The tempting fix is an auto-triage rule scoped to development dependencies, and
making it match by moving the private test fixtures' deps from `dependencies` to
`devDependencies`. **This was investigated and rejected.** Alert attribution as
of 2026-08-17:

| Manifest | Alerts | Packages |
| --- | --- | --- |
| `yarn.lock` | 24 | body-parser, esbuild, nanoid, next, postcss, sharp |
| `test/next/package.json` | 7 | next |

A lockfile carries no dev/runtime partition, so everything attributed there is
classified `runtime` regardless of how the manifests are written — and those 24
are transitive deps that will *always* be lockfile-attributed. The flip could
only affect the 7 direct `next` alerts, which are exactly the ones that
disappear when `test/next` moves off Next 14 anyway. Roughly 13 manifests
touched for a partial win on the subset already scheduled for deletion.

### Reference

- `ignore` rules in `.github/dependabot.yml` suppress Dependabot's *pull
  requests* only; they do **not** dismiss alerts in the Security tab. There is
  no `dependabot.yml` in this repo, and adding one would newly enable
  version-update PRs.
- Dismissing alerts requires the Security tab, the REST API, or auto-triage
  rules (repo/org Settings → Code security).
- Dependabot reports no deprecation notices at all; those are a yarn feature.
  So `glob`, `inflight` and `prebuild-install` will never appear as alerts.

## Why `yarn npm audit` is not in CI

Deliberate — please do not add it without revisiting this.

It would largely duplicate Dependabot, which already covers the same advisories
and additionally opens fix PRs. Worse, as a build gate it would fail CI on
findings we have explicitly decided to accept, turning every accepted risk into
either a red build or another suppression edit. The only things yarn audit adds
over Dependabot are deprecation notices and optional-lockfile entries — real,
but not worth gating on.

Run it ad hoc instead, and expect it to exit clean:

```
yarn npm audit -AR                             # accepted findings suppressed
yarn npm audit -R --environment production      # what we actually publish
```
