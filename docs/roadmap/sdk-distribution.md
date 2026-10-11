# SDK distribution decision (P0.10, 2026-10-11)

**Decision:** publish `@seismo/sdk` to the public npm registry from CI on tag `sdk-v*`, with provenance. If the `@seismo` scope is taken (open question Q10), use `@<our-scope>/seismo-sdk`; only the package name changes.

**Fallback (works today, no account needed):** `npm pack` in `sdk-node/` and attach the tarball to a GitHub Release; the demo shop installs it by URL:
`npm i https://github.com/NetPranav/Hackwave3.0/releases/download/sdk-v0.1.0/seismo-sdk-0.1.0.tgz`

**Not used:** GitHub Packages (installing needs auth even for public packages).

**Until the scope is confirmed:** the shop depends on the tarball. Switching to npm later is a one-line change in the shop's `package.json`.
