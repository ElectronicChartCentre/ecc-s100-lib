# Examples

Runnable and copy-pasteable S-100 viewer examples:

- [Minimal NASA-AMMOS scene](./minimal-nasa-ammos/main.ts)
- [S-102 and S-101 scene](./s102-s101-scene/main.ts)
- [S-111 time scene](./s111-time-scene/main.ts)
- [S-100 Explorer integration pattern](./s100-explorer-integration/main.ts)
- [Engine adapter switcher demo app](./engine-adapter-switcher)

The engine adapter switcher is a private workspace app that exercises the
public package imports a future standalone consumer would use:

```sh
cp examples/engine-adapter-switcher/.env.example examples/engine-adapter-switcher/.env.local
npm run demo:engine-switcher
npm run build:demo:engine-switcher
```

Until the packages are published to npm, local workspaces and release tarballs
are the expected dependency sources. Once published, the install shape is:

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos
npm install @ecc/s100-viewer-adapter-cesium cesium
```

The other example files are TypeScript snippets that document public API usage
without becoming applications of their own.
