# Versioning and Verification

This page covers the version bump and the checks that should pass before
publishing release tarballs.

## Prerequisites

- Node.js and npm compatible with the current workspace lockfile.
- A clean or intentionally staged git worktree on the branch being released.
- `gh` authenticated with permission to create releases in
  `ElectronicChartCentre/ecc-s100-lib`.
- No secrets, local `.env` files, or generated service data staged for the
  package release commit.

Check GitHub authentication before publishing:

```sh
gh auth status
```

## Version Bump

Keep the release-target packages on the same version for a coherent alpha
release. Update these manifests:

```text
packages/s100-viewer/package.json
packages/s100-viewer-adapter-nasa-ammos/package.json
packages/s100-viewer-adapter-cesium/package.json
```

Also update internal `@ecc/s100-viewer` dependency versions in adapter manifests
so the packed adapters resolve the matching core package version:

```json
{
  "dependencies": {
    "@ecc/s100-viewer": "0.1.0-alpha.13"
  }
}
```

Workspace examples may also carry version pins for documentation and demo
clarity. Keep them aligned when making a release whose demos are meant to
advertise the current package version.

After changing package manifests, refresh the lockfile:

```sh
npm install --package-lock-only --ignore-scripts
```

Review the diff before continuing:

```sh
git diff -- package.json package-lock.json packages examples
```

## Required Checks

Run the boundary and bundle-shape checks first. These catch release-shape
regressions that ordinary type checks may miss:

```sh
npm run maintainability:check
```

Run the release-target checks:

```sh
npm run check:release-target
npm run test:release-target
npm run build:release-target
npm run pack:release-target:dry-run
```

The dry-run pack step verifies what npm would include without creating the final
tarballs. The release packages should contain built `dist` output plus package
metadata such as `README.md` and `LICENSE`; they should not include source-only
workspace internals or local environment files.

## Demo Checks

When a release changes feature behavior, also run the relevant demos:

```sh
npm run check:demo:engine-switcher
npm run build:demo:engine-switcher
npm run check:demo:rtz-route
npm run build:demo:rtz-route
npm run check:demo:parametric-vessel
npm run build:demo:parametric-vessel
npm run check:demo:getting-started
npm run build:demo:getting-started
npm run check:demo:reference
npm run build:demo:reference
```

The demo set is intentionally broader than the published tarball set because it
exercises the maintained APIs across application-like workflows.
