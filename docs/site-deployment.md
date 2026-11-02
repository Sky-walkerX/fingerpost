# Website deployment handoff

Local preparation is complete; Firebase Hosting deployment and public browser acceptance are still pending.

`infra/firebase.json` preserves the deny-all Firestore rules and serves only `apps/web/dist` on Hosting site `fingerpost`. Run Firebase commands from the repository root with `--config infra/firebase.json` and an explicit project. The public path is relative to that configuration file. Do not deploy the repository or the Vite source directory.

## Local verification

```sh
pnpm --filter @fingerpost/web build
node scripts/check-built-web.mjs
pnpm --filter @fingerpost/web test
```

The smoke check uses a temporary loopback-only Vite preview server to fetch the six production pages, their links and emitted bundles, the PNG QR, and three nonexistent routes. It checks that distinct pages survive the build and that a missing script or page receives HTTP 404. It also checks that the custom Firebase 404 artifact was copied. This verifies production files and Vite's multipage behavior; it does not implement or verify Firebase's header/redirect engine.

The site has directory indexes for `/privacy/`, `/data-safety/`, `/install/`, `/sim/` and `/label/`. Hosting adds trailing slashes; there is no catch-all rewrite to the landing page. Unknown paths use `404.html` with HTTP 404. Only hashed `/assets/**` files get a year of immutable caching. HTML routes and the unversioned release QR require revalidation. Global headers prevent MIME sniffing and framing, limit referrer details, and disable camera, microphone and geolocation permissions. The simulator and labeler use synthetic scenes and local file selection, so these permissions are unnecessary. See [Firebase's configuration reference](https://firebase.google.com/docs/hosting/full-config).

## Before opening the waitlist

- Confirm the chosen gateway has persistent production Firestore waitlist storage and the intended CORS origin. An in-memory mock registration is not a public waitlist.
- Build with the intended HTTPS API base, for example `VITE_GATEWAY_URL=https://gateway.example.test pnpm --filter @fingerpost/web build`. This is an example domain, not a deployment setting. The client stays closed without a configured HTTPS base.
- Confirm that the latest-release link/QR resolves to an actual published APK, and retain the clean-phone installation result separately.
- Confirm the removal-request contact and the privacy/data-safety disclosures. Current default builds disable Crashlytics uploads. Enabling `fingerpost.crashReporting=true` requires a reviewed disclosure and the privacy verification in [the crash-reporting handoff](android-crash-reporting.md).

## Human deployment and acceptance

An authorized account owner must select the actual Firebase project and confirm it owns Hosting site `fingerpost`. No account, deployment or billing change was made locally. With an existing Firebase CLI, preview locally first:

```sh
firebase emulators:start --only hosting --project demo-fingerpost --config infra/firebase.json
```

Use the displayed loopback URL to verify pages, canonical redirects, response headers and real custom 404 responses. Then an authorized owner may deploy **Hosting only**, with the reviewed project id:

```sh
firebase deploy --only hosting --project <reviewed-project-id> --config infra/firebase.json
```

After deployment, verify `/`, the three information pages, `/sim/`, `/label/`, the QR and a nonexistent route at `https://fingerpost.web.app`. Inspect cache/security headers on an HTML page, a hashed bundle and the QR. Test the waitlist with a permissioned address, including rate limiting and removal, then perform mobile screen-reader and keyboard checks. Record actual results before marking C6-1 done. These commands are a handoff; they have not been run against Firebase.
