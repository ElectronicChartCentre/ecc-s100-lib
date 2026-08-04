# Publishing GitHub Release Assets

This page covers publishing package tarballs to GitHub Releases.

## Create a New Release

Use one immutable GitHub Release per package version:

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

## Upload to an Existing Release

If the release already exists and is still draft or otherwise known to be
unconsumed, upload replacement assets explicitly:

```sh
VERSION=0.1.0-alpha.13
TAG=ecc-s100-lib-v$VERSION

gh release upload "$TAG" \
  "ecc-s100-viewer-$VERSION.tgz" \
  "ecc-s100-viewer-adapter-nasa-ammos-$VERSION.tgz" \
  "ecc-s100-viewer-adapter-cesium-$VERSION.tgz" \
  --repo ElectronicChartCentre/ecc-s100-lib \
  --clobber
```

Use `--clobber` only before the release has been adopted by consumers. Once a
release is consumed, publish a new version instead.

## Release Notes

For small alpha releases, inline notes are acceptable. For larger releases,
write a release-notes file and use:

```sh
gh release create "$TAG" \
  "ecc-s100-viewer-$VERSION.tgz" \
  "ecc-s100-viewer-adapter-nasa-ammos-$VERSION.tgz" \
  "ecc-s100-viewer-adapter-cesium-$VERSION.tgz" \
  --repo ElectronicChartCentre/ecc-s100-lib \
  --title "$TAG" \
  --notes-file /path/to/release-notes.md
```

Release notes should summarize consumer-visible changes, breaking changes,
verification performed, and known limitations.
