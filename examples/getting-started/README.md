# S-100 Getting Started

This is the smallest runnable app for the high-level feature-session story in
[`main.ts`](./main.ts). The app shell creates a viewer and scene, then calls
`createFeatureSessions(...)` with local configuration.

## Run

```sh
cp examples/getting-started/.env.example examples/getting-started/.env.local
npm run demo:getting-started
```

Without service configuration, the app still creates the viewer and reports the
missing session inputs. Once `.env.local` contains dataset IDs, endpoints, and
keys, the Load button creates the S-102, S-111, and ENC sessions.

`.env.example` is the tracked template. `.env.local` is ignored by git and is
where local service endpoints, credentials, and scenario-specific dataset IDs
belong.

## Validate

```sh
npm run check:demo:getting-started
npm run build:demo:getting-started
```
