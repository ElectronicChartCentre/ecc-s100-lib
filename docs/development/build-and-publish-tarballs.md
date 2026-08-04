# Build and Publish Release Tarballs

This is the short release operator checklist for publishing installable
`ecc-s100-lib` package tarballs to GitHub Releases.

Run commands from the `ecc-s100-lib` repository root.

## Essential Workflow

1. Pick the next version.

   Use one version across the release-target packages, for example
   `0.1.0-alpha.13`.

2. Update package versions and internal adapter dependencies.

   Update:

   ```text
   packages/s100-viewer/package.json
   packages/s100-viewer-adapter-nasa-ammos/package.json
   packages/s100-viewer-adapter-cesium/package.json
   ```

   Adapter manifests must depend on the matching `@ecc/s100-viewer` version.

3. Refresh the lockfile.

   ```sh
   npm install --package-lock-only --ignore-scripts
   ```

4. Run release checks.

   ```sh
   npm run maintainability:check
   npm run check:release-target
   npm run test:release-target
   npm run build:release-target
   npm run pack:release-target:dry-run
   ```

5. Create the real tarballs.

   ```sh
   node tools/run-release-targets.mjs pack
   ```

6. Publish the tarballs to GitHub Releases.

   ```sh
   VERSION=0.1.0-alpha.13
   TAG=ecc-s100-lib-v$VERSION

   gh release create "$TAG" \
     "ecc-s100-viewer-$VERSION.tgz" \
     "ecc-s100-viewer-adapter-nasa-ammos-$VERSION.tgz" \
     "ecc-s100-viewer-adapter-cesium-$VERSION.tgz" \
     --repo ElectronicChartCentre/ecc-s100-lib \
     --title "$TAG" \
     --notes "Release tarballs for ecc-s100-lib $VERSION."
   ```

7. Update consumer package URLs.

   Consumers should reference the exact GitHub Release tarball URLs. Refresh
   each consumer lockfile with `npm install` and run the consumer checks.

8. Commit and push the release changes.

   Commit the version, lockfile, documentation, and consumer dependency updates
   as appropriate for the release.

## More Detail

- [Release model and tarball naming](./release-tarballs/release-model.md)
- [Versioning and verification](./release-tarballs/versioning-and-verification.md)
- [Packing and inspecting tarballs](./release-tarballs/packing.md)
- [Publishing GitHub Release assets](./release-tarballs/publishing.md)
- [Consumer updates and smoke tests](./release-tarballs/consumers-and-smoke-tests.md)
- [Release target maintenance and troubleshooting](./release-tarballs/release-target-maintenance.md)

## Quick Checklist

- Release target list checked in `tools/release-targets.mjs`.
- Package versions and internal dependency versions aligned.
- Lockfile refreshed.
- Release checks passed.
- Real tarballs created.
- GitHub Release created with all release-target tarballs attached.
- Consumer URLs and lockfiles updated.
- Consumer type checks and manual demo smoke tests completed.
