# Desktop test profiles

Both profiles are required for a deployment:

- `npm run desktop:test` at the repository root runs the complete local suite
  with `local-egress`. Forge supplies real deny-all outbound bindings. This
  preserves the existing refusal, no-cache, backoff and rate-limit assertions.
- `ferrite test --remote` from this app directory runs the shared suite against
  the hosted SDK. That SDK has no `TestHarness::with_egress` constructor, so
  shared fixtures have no outbound bindings. The app must report missing
  capability (503) where it distinguishes that from a declared binding refusing
  a call (502). Tests keep input validation, storage, isolation and failure
  behavior in both profiles. No fake capability or network response is injected.

`cargo test` and local `ferrite test` exercise the shared profile. They do not
replace `npm run desktop:test` before deployment. The sole test requiring the
local profile outright is Maps' cross-session outbound request rate limit: it
must have a declared capability before it can attempt a request and acquire the
rate-limit lease. Its assertions are unchanged and remain mandatory locally.

`egress_profile` records fixture expectations, not application implementation:
missing capability is 503; attempted delivery refused by the deny-all policy is
502. Apps with one generic upstream-failure response retain their existing 502
assertions under both fixtures. The hosted passing verdict remains required for
the exact deployed revision; this split does not waive that gate or claim hosted
SDK parity for outbound-policy enforcement.

All integration suites are modules of `tests/contracts.rs`. This links the
embedded desktop assets and SDK once rather than once per test file, keeping
hosted builds within their workspace limit. `npm run desktop:test` first checks
that every test module is listed, so adding a test file cannot silently omit it.
The consolidation preserves all 1,042 local test identities.

Deployment consumes `ferrite.json` separately from source. Manifest-dependent
unit tests therefore read `tests/fixtures/ferrite.json`, generated from the
canonical manifest by `scripts/pack-site.mjs`. The integration contract requires
byte equality with the real manifest on both SDKs. After editing the manifest
without repacking the site, run `node scripts/sync-test-manifest.mjs` from this
app directory. A stale snapshot fails the test; it is never an independent spec.

`npm run desktop:test` also checks that source-side literal asset includes survive
the deployment projection, which removes `ferrite.json` and `.ferrite/` metadata.
This catches the packaging refusal before a hosted test run; hosted admission
remains the authoritative full Rust gate.

A test environment declares the `site` blob only when its test reads the
published desktop: the publication tests in `desktop.rs`, the site serving
tests in `site_serve.rs` and Console's publication log in `system_apps.rs`. An
app booted with that blob publishes the whole packed site into it, about 70 MB
of decoding and writes, and on a current-thread test that work shares the
test's one thread. Every other boot leaves the blob out; the app's publication
then finds no binding and tries again with a backoff of up to 30 s, which costs
next to nothing.
