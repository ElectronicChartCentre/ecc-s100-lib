# Release Target Maintenance and Troubleshooting

This page covers changes to the release-target package set and common release
workflow failures.

## Adding or Removing Release Targets

Change the release set only by editing `tools/release-targets.mjs`. The helper
script, release-target checks, builds, and pack workflow all use that list.

When adding a package:

- Ensure the package has `check`, `test`, and `build` scripts.
- Ensure the package manifest has a correct `files` list.
- Ensure runtime dependencies are regular `dependencies` or `peerDependencies`,
  not undeclared workspace assumptions.
- Run `npm run pack:release-target:dry-run` and inspect the dry-run file list.
- Update the top-level build/publish guide, package readiness docs, and README
  package list.

When removing a package:

- Remove it from `tools/release-targets.mjs`.
- Remove consumer URL examples that imply it is maintained as a release package.
- Confirm demos or applications that still need it consume it as a local
  workspace/reference package instead.

## Troubleshooting

`npm pack` includes no `dist` files:
Run `npm run build:release-target` first. The package manifests are configured
to ship built output.

Consumer install gets a 404:
Check the GitHub Release tag, asset name, package version, and URL spelling.
The scoped package name is converted to an unscoped tarball name by npm, for
example `@ecc/s100-viewer` becomes `ecc-s100-viewer-<version>.tgz`.

Consumer app still resolves an older tarball:
Refresh the consumer lockfile with `npm install`. If Vite is running, restart
the dev server after dependency updates.

Adapter tarball installs but cannot resolve `@ecc/s100-viewer`:
The adapter package dependency version and the consumer's core package version
are probably out of sync. Keep release-target packages on the same alpha version
unless deliberately testing a mixed-version scenario.

`gh release create` fails:
Run `gh auth status`, verify repository write access, and confirm the tag does
not already exist.
