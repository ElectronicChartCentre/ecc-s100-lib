# S-100 Parametric Vessel Demo

Standalone app for stress-testing the parametric vessel API and NASA-AMMOS
procedural vessel renderer.

The core dimensions follow the AIS-style distance model:
`{ draught, bow, stern, port, starboard }`. Overall length is derived from
`bow + stern`; beam is derived from `port + starboard`.

## Run

```sh
npm run demo:parametric-vessel
```

## Validate

```sh
npm run check:demo:parametric-vessel
npm run build:demo:parametric-vessel
```
