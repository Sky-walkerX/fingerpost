# Landing page configuration

Build with `VITE_GATEWAY_URL=https://<verified-gateway-host> pnpm --filter @fingerpost/web build` to enable registration. The endpoint must be HTTPS and support the existing `/v1/waitlist` CORS route. With no configured endpoint the form remains disabled and explicitly says registration is closed. No successful signup is shown unless the gateway responds with `{ok:true}`.

Verify persistence in the production Firestore waitlist store before deploying. A mock gateway accepts requests into memory only and must not be advertised as a public registration service. Use synthetic emails for testing; never paste real addresses into logs or reports.

The page links to GitHub's latest release page without claiming an APK has passed acceptance. Hosting deployment, browser/device checks remain open. The release QR points to the same latest-release URL and was independently decoded with macOS Core Image. The public pages' automated axe checks run with `pnpm --filter @fingerpost/web test`; jsdom does not test screen-reader speech or rendered layout.

To regenerate the static QR on macOS with the existing developer tools, run `swift scripts/generate-release-qr.swift apps/web/public/release-qr.png`. The script decodes the generated PNG before writing it. Core Image needs access to the macOS graphics service; sandboxed execution may fail. This generator is not needed to build or serve the website.
