# PACKOUT Designer — iOS app (Expo / React Native)

A native iOS (and later Android) client for the PACKOUT organizer designer. It
**reuses the web app's TypeScript core** — `../src/model`, `../src/layout`,
`../src/geometry` (validation, geometry, STL, auto-arrange) — unchanged. Only the
UI is new. STL generation runs **on device**; there is no backend.

## Status — v1 skeleton, runnable in Expo Go

Working:

- Container tab: pick a PACKOUT container, type in its internal cavity, edit
  global parameters (mm/inch toggle).
- Tools tab: starter library + a "measure a tool" form; tools drop onto the
  layout when added.
- Arrange tab: true-scale top-down canvas (`react-native-svg`), drag to move,
  rotate 90°, delete, one-tap auto-arrange, live fit checks.
- Export: generates a binary STL on device and opens the iOS share sheet
  (Mail / AirDrop / Files / Messages…). No account, works offline.

Not done yet: realistic tool silhouettes (the web app's fancy render), pinch/pan
zoom, project save/load files, server-side "email me the STL", Android polish.

## Run it on your iPhone

You need a Mac **or** Windows/Linux machine with Node 20+ to run the dev server;
the phone just needs the free **Expo Go** app from the App Store. No Apple
Developer account, no Xcode, no TestFlight for this stage.

### Option A — merge into a fresh Expo project (most reliable)

Because this folder is checked in without a lockfile and Expo Go only runs the
**current** SDK, the sturdiest path is to let `create-expo-app` pick versions:

```bash
# from the repo root
npx create-expo-app@latest mobile-fresh --template blank-typescript
# copy this app's source + config over the template
cp mobile/App.tsx mobile/index.ts mobile-fresh/
cp -r mobile/src mobile-fresh/
cp mobile/metro.config.js mobile/tsconfig.json mobile/app.json mobile-fresh/
cd mobile-fresh
npx expo install react-native-svg expo-file-system expo-sharing @react-native-async-storage/async-storage zod zustand
npx expo start
```

The shared core is imported as `../src/...`, so keep `mobile-fresh` as a sibling
of `src/` (i.e. move it to the repo root, or adjust `metro.config.js`'s
`repoRoot`). Then: scan the QR code in the terminal with the **Camera app** →
opens in Expo Go.

### Option B — use this folder directly

```bash
cd mobile
npm install
npx expo install --fix     # aligns versions to the installed SDK
npx expo start
```

If `npm install` complains about a version, run
`npx expo install expo@latest && npx expo install --fix` and retry. Then scan the
QR with Expo Go.

### Testing without a computer running the server later

- **TestFlight**: `npx expo install expo-dev-client` then `eas build -p ios
  --profile preview` (needs a free Expo account + an Apple Developer account,
  $99/yr) produces a build you can install via TestFlight on any iPhone with no
  dev server.
- **Development build on your own device**: `eas build -p ios --profile
  development` + register your device UDID — installs like a normal app, still
  loads JS from the dev server when running locally.

## Architecture notes

- `src/store.ts` mirrors the web app's Zustand store (same reducers, AsyncStorage
  instead of localStorage). To be hoisted into a shared package later.
- `src/polyfills.ts` shims `TextEncoder` and provides base64 for Hermes.
- `src/export.ts` is the only file that knows about the device: `exportInsertSTL`
  (shared) → `expo-file-system` → `expo-sharing`.
- `metro.config.js` adds the repo root to `watchFolders` so `../src/*` resolves.

See `../docs/ARCHITECTURE.md` for the portable-core boundary and the (still
optional) backend plan.
