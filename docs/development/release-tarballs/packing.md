# Packing and Inspecting Tarballs

This page covers creation and inspection of the real `.tgz` package artifacts.

## Dry Run First

Before creating final tarballs, run:

```sh
npm run pack:release-target:dry-run
```

This verifies the npm package file lists without writing the final `.tgz`
artifacts.

## Create Tarballs

After checks pass, create the real tarballs:

```sh
node tools/run-release-targets.mjs pack
```

This creates one `.tgz` file per release target in the repository root. The
script adds an npm cache under `/tmp/ecc-s100-viewer-npm-cache` unless another
`--cache` argument is supplied.

## Inspect Contents

Inspect tarball contents when the package surface has changed:

```sh
tar -tzf ecc-s100-viewer-0.1.0-alpha.13.tgz | sort | less
tar -tzf ecc-s100-viewer-adapter-nasa-ammos-0.1.0-alpha.13.tgz | sort | less
tar -tzf ecc-s100-viewer-adapter-cesium-0.1.0-alpha.13.tgz | sort | less
```

Expected top-level tar entries use npm's `package/` prefix.

The release packages should include:

- built `dist` output
- `package.json`
- package `README.md`
- `LICENSE`

They should not include:

- local `.env` files
- generated service credentials
- workspace-only source internals not intended for package consumers
- demo-only assets unless a package explicitly needs them at runtime
