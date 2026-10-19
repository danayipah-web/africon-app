# Africon Admin (Android test build)

Standalone rebuild of the Africon back office (`africon.ai/admin`) as an Expo / React Native app, built from `Africon_Admin_Build_Spec.md`.

This first build covers spec phases 0–5: app shell, sign-in and roles, Dashboard, Users, Events & Trainings, Bookings and CRM (contacts, filter builder, segments, campaigns, import), plus Settings › Event metadata. Every other sidebar item opens a "Coming soon" page.

## What is real and what is simulated

- **Data lives on the device.** A seeded local database (zustand + AsyncStorage) stands in for the backend. Screens read and write only through `src/data/repo/*`, which is where a Firebase or Postgres backend plugs in later.
- **No real payments, email or SMS.** Campaign sends, event messages and test sends are recorded (counters, contact activity, audit log) but not delivered.
- **Reset demo data:** Settings › This device › Reset demo data (Admins only).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@africon.ai | Admin123! |
| Content Manager | content@africon.ai | Content123! |
| Viewer | viewer@africon.ai | Viewer123! |

The login screen lists them; tap one to fill the form.

## Run it

```bash
npm install
npx expo start            # dev server; press "a" for a connected Android device/emulator
npm test                  # business-rule unit tests (pricing, capacity, RBAC, segments, CRM sync, campaigns, filters)
npx tsc --noEmit          # typecheck
npx expo lint             # lint
```

### Build an APK locally

Needs JDK 17 and the Android SDK (`ANDROID_HOME`).

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk (debug-signed, for testing only)
```

**Windows:** the native (CMake/ninja) step breaks the 260-character path limit from a deep folder. What works: mirror the project to a short path (e.g. `robocopy <project> C:\afb /MIR /XD .cxx .gradle .expo`), install SDK `cmake;3.31.6` (ships ninja 1.12, which supports long paths), and add `cmake.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk\\cmake\\3.31.6` to `android/local.properties` in the mirror before running Gradle there. A `subst` drive does not help, because autolinking resolves real paths.

Install with `adb install -r app-release.apk`, or copy the file to the phone and open it (allow "Install unknown apps").

## Layout

```
src/app/            routes (Expo Router); (admin)/ is the signed-in drawer
src/components/     shared UI: form fields, lists, sheets, confirm dialog, toasts, nav
src/features/       larger screens split out: event wizard, booking form, CRM filter builder…
src/domain/         entity types, defaults, zod schemas
src/lib/            pure business rules (unit tested)
src/data/           local store, seed data, repositories (RBAC + validation + audit on every write)
```

## Not in this build

`TODO(spec)` comments mark gaps the spec leaves open. Main ones: invite-by-email, automations engine (reminders, invoice holds, certificates), Excel import, full rich-text editor, campaign approval flow and quiet hours, Facilitators, AI Sprints and Surveys modules.
