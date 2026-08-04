# Consumer Updates and Smoke Tests

This page covers updating applications that consume the GitHub Release tarballs
and validating the packed packages outside the workspace.

## Consumer Package URLs

Applications should reference the GitHub Release tarballs directly until the
packages move to a public npm registry release.

For example:

```json
{
  "dependencies": {
    "@ecc/s100-viewer": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-0.1.0-alpha.13.tgz",
    "@ecc/s100-viewer-adapter-nasa-ammos": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-adapter-nasa-ammos-0.1.0-alpha.13.tgz",
    "@ecc/s100-viewer-adapter-cesium": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-adapter-cesium-0.1.0-alpha.13.tgz"
  }
}
```

S-100 Explorer currently needs only the core package and the maintained adapter
package it instantiates. Do not add adapter tarballs that the application does
not import just because they exist in the release.

After editing a consumer `package.json`, refresh the consumer lockfile:

```sh
npm install
```

Then run the consumer's boundary and type checks. For S-100 Explorer, use the
webapp scripts from the webapp package root.

## Local Install Smoke Test

Before asking another developer to consume a release, validate the tarballs in a
throwaway project:

```sh
mkdir -p /tmp/ecc-s100-lib-tarball-smoke
cd /tmp/ecc-s100-lib-tarball-smoke
npm init -y
npm install \
  /path/to/ecc-s100-viewer-0.1.0-alpha.13.tgz \
  /path/to/ecc-s100-viewer-adapter-nasa-ammos-0.1.0-alpha.13.tgz
node --input-type=module -e 'import("@ecc/s100-viewer").then((m) => console.log(Boolean(m.createS100Viewer)))'
```

For Cesium-specific validation, also install the Cesium adapter tarball and the
`cesium` runtime dependency expected by the consuming application.

## After Public npm Publication

After public npm publication, consumers should use registry versions instead of
GitHub Release URLs:

```json
{
  "dependencies": {
    "@ecc/s100-viewer": "0.1.0-alpha.13",
    "@ecc/s100-viewer-adapter-nasa-ammos": "0.1.0-alpha.13",
    "@ecc/s100-viewer-adapter-cesium": "0.1.0-alpha.13"
  }
}
```
