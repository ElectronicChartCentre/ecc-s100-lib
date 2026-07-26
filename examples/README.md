# Examples

The two primary examples are:

1. [Getting started](./getting-started): the smallest runnable app and
   TypeScript story for wiring the high-level feature sessions into an app.
2. [Reference app](./reference-app): the canonical runnable workspace app
   showing how a software engineering team can structure viewer lifecycle,
   service configuration, feature-session setup, controls, logging, and
   teardown.

Additional focused examples:

- [Step-by-step engine switcher learning guide](../docs/learn/engine-switcher-practical-guide.md)
- [Minimal NASA-AMMOS scene](./minimal-nasa-ammos/main.ts)
- [S-102 and S-101 scene](./s102-s101-scene/main.ts)
- [S-111 time scene](./s111-time-scene/main.ts)
- [S-100 Explorer integration pattern](./s100-explorer-integration/main.ts)
- [RTZ route demo app](./rtz-route), with the
  [RTZ route workflow guide](../docs/workflows/rtz-route.md)
- [Parametric vessel demo app](./parametric-vessel), with the
  [parametric vessel workflow guide](../docs/workflows/parametric-vessel.md)
- [Engine adapter switcher demo app](./engine-adapter-switcher)
- [S-104 fixture service](./s104-fixture-service), a localhost JSON endpoint for
  generated water-level fixtures stored in the static files repository.

The engine adapter switcher is a private workspace app that exercises the
public package imports a future standalone consumer would use:

```sh
cp examples/engine-adapter-switcher/.env.example examples/engine-adapter-switcher/.env.local
npm run demo:engine-switcher
npm run build:demo:engine-switcher
```

The getting-started app is the smallest runnable session example:

```sh
cp examples/getting-started/.env.example examples/getting-started/.env.local
npm run demo:getting-started
npm run build:demo:getting-started
```

The reference app is the fuller session-oriented runnable app:

```sh
cp examples/reference-app/.env.example examples/reference-app/.env.local
npm run demo:reference
npm run build:demo:reference
```

Shared example-only workflow helpers live under `examples/shared`. Runnable
examples may import from `examples/shared`, but should not import each other's
app entrypoints or source files. The boundary check enforces that package code
never imports examples and examples only use package-level public imports.

The RTZ route demo is a focused route portrayal app with a bundled sample RTZ
fixture and file upload:

```sh
npm run demo:rtz-route
npm run build:demo:rtz-route
```

The parametric vessel demo is a focused vessel-shape tuning app:

```sh
npm run demo:parametric-vessel
npm run build:demo:parametric-vessel
```

The S-104 fixture service exposes generated S-104-shaped JSON at the planned
service contract:

```sh
npm run fixtures:s104:generate
npm run demo:s104-fixture-service
curl http://127.0.0.1:8794/s104/catalog.json
```

Until the packages are published to npm, local workspaces and release tarballs
are the expected dependency sources. Once the release-target packages are
published, the install shape is:

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos
npm install @ecc/s100-viewer-adapter-cesium cesium

# Optional when the Three.js reference adapter becomes a release target.
npm install @ecc/s100-viewer-adapter-three three
```

The remaining non-app example files are TypeScript snippets that document public
API usage without becoming applications of their own. Use
`getting-started/main.ts` when you want the higher-level app integration style
where the library owns product orchestration and the app maps user settings into
session calls.
