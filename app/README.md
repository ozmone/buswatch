# BUS WATCH — CAIRNS

A small mobile PWA with a Cloudflare Worker and no account, database, GPS or API key. Saved **stop IDs** stay in this browser's localStorage. The app starts with 750042 and 750045 only on the first launch; deleting every stop stays deleted on later launches.

## Run locally

Install Node.js 22 or newer. In PowerShell:

```powershell
cd D:\Documents\buswatch\app
npm ci
npm run data
npm run prove
npm run dev
```

Open http://localhost:8787. Keep the terminal running. `npm run prove` prints actual upcoming departures, feed timestamps and exact GTFS trip IDs for both initial stops. It never substitutes demo data. A captured result is in `data/proof.json` (a dated diagnostic, never loaded by the app).

For phone installation use the HTTPS deployment below. A LAN HTTP URL can preview the page, but it does not provide a secure context for service workers/installability on Android.

## Deploy to Cloudflare Workers

You need a Cloudflare account. From the same directory:

```powershell
npm ci
npx wrangler login
npm run deploy
```

The browser login is for your Cloudflare deployment account; Translink does not require a key. `npm run deploy` refreshes the official static GTFS, bundles `src/worker.mjs`, uploads the PWA assets and publishes the Worker. Wrangler prints your HTTPS `workers.dev` URL. Open that URL in Chrome on Android, then use **Install BUS WATCH** if offered, or Chrome's menu → **Add to Home screen / Install app**. No app login is required on this direct Cloudflare deployment.

To choose a different Worker name, edit `name` in `wrangler.jsonc` before deployment. No secrets belong in the frontend. `npm run build` additionally produces a portable `dist/server/index.js`, `dist/client/` and `dist/wrangler.json`; the regular deploy command builds directly from source.

## Keep the timetable current

The static schedule is fetched at build/deploy time, not downloaded to every phone. Refresh and redeploy regularly, especially when Translink changes its timetable:

```powershell
npm run deploy
```

The current snapshot was fetched on 28 September 2026, and its latest service calendar ends on **25 November 2026**. Individual calendars have different date ranges. The API returns the fetch date and expiry, and the app warns when the overall timetable has expired. No background schedule-update automation is configured. Every deployment refreshes it; do not keep using an old deployment indefinitely.

## Using it

- **LIVE** shows all saved stops in one scrolling board, up to eight departures per stop over the next 24 hours, ordered by expected departure.
- **Add stop** accepts any stop ID validated against the Cairns schedule, with a limit of 30 bookmarks.
- **Route Finder** searches IDs and names and displays the routes serving each stop. Use **Save** to bookmark it.
- The × on a stop removes that bookmark. Re-add its ID to restore it.
- With bookmarks, a new launch opens LIVE. With none, it opens Route Finder.
- LIVE means a fresh GTFS-RT prediction. SCHEDULED means the timetable only. Old predictions are marked STALE and lose their countdown. Failures keep the last good board when available, with a visible warning.
- The board refreshes every 20 seconds while visible, on return to the app, and on manual refresh. The Worker coalesces requests for 20 seconds per isolate. Feed and individual prediction timestamps must be no more than two minutes old.
- Offline, the app shell and last successful snapshot remain available after a successful online visit. Offline data is explicitly stale. Search and adding stops require connectivity for validation.

## Official sources and matching

- Open data: https://translink.com.au/about-translink/open-data
- CNS static GTFS: https://gtfsrt.api.translink.com.au/GTFS/CNS_GTFS.zip
- CNS Trip Updates: https://gtfsrt.api.translink.com.au/api/realtime/CNS/TripUpdates
- CNS Vehicle Positions (not needed by this MVP): https://gtfsrt.api.translink.com.au/api/realtime/CNS/VehiclePositions

Data attribution: Translink, licensed under CC BY 4.0. This is an independent app. Official endpoint discovery used the Queensland data catalogue resource `9850f8e5-f572-4de7-97c5-84d45526f9bd`.

Both upstream responses omit `Access-Control-Allow-Origin`; the browser diagnostics page at `/diagnostics.html` tests direct access to both feeds and the same-origin API. A proxy is necessary. `src/worker.mjs` fetches only the fixed official realtime URL, decodes the Protobuf through `gtfs-realtime-bindings`, joins it to the bundled static schedule and sends small JSON responses. It is not a general URL proxy.

Static tables provide stops, routes, trips, stop sequences, departure/arrival times, calendars and date exceptions. Matching uses exact `trip_id`, GTFS service date and stop sequence (with stop ID fallback). No fuzzy trip-ID replacement is used. Cairns uses UTC+10 year-round; after-midnight GTFS times are handled against the original service day. Explicit departure timestamps take priority over delays, and previous delays propagate only until NO_DATA. Canceled and skipped services are labeled, never presented with an arrival countdown. No-pickup stops are excluded.

Unmatched realtime trips are counted in the API and proof command. In the initial check, the sole unmatched trip was an `ADDED` unplanned route 142 service with no static trip. This MVP does not invent a headsign or schedule for unmatched/added trips. Vehicle positions, alerts, full journey planning and maps are deliberately outside this build.

## Files to edit later

| File | Purpose |
| --- | --- |
| `public/index.html` | Page structure, labels, add-stop dialog |
| `public/styles.css` | Dark theme and responsive layout |
| `public/app.js` | Bookmarks, searching, refresh, stale handling, rendering |
| `src/transit.mjs` | Calendars, realtime decoding and matching |
| `src/worker.mjs` | JSON endpoints and upstream fetch cache |
| `src/config.mjs` | Official feed URLs and freshness threshold |
| `scripts/update-data.mjs` | Download and index static GTFS |
| `data/schedule.json` | Generated schedule; regenerate, don't edit manually |
| `public/manifest.json` | Install name, theme, PWA icons |
| `public/sw.js` | Offline shell; bump cache version when changing cached assets |
| `wrangler.jsonc` | Cloudflare Worker name, entrypoint and assets |

`trip.times` uses compact tuples `[stopId, sequence, arrivalSeconds, departureSeconds, pickupType, stopHeadsign]`; `stopTimes` indexes `[tripId, tupleIndex]` by stop. This keeps the full Cairns schedule small enough for a Worker. Stop search and departure matching are separate functions/endpoints so a future journey-planning view can reuse the data without changing bookmarks.

## Verification

```powershell
npm test
npm run prove
npm run build
```

The tests cover date exceptions, UTC+10/midnight, repeated stops, zero delay, absolute timestamps, propagation, NO_DATA, skipped/canceled services, stale feeds, stale trip updates, and no-pickup stops. Tests use synthetic fixtures only; production and proof scripts always use official data.

`public/diagnostics.html` is a read-only browser check. Optional WebMCP tools are feature-detected; they share the UI's validation and bookmark state and do nothing on browsers without support.

## Deployment status for this checkout

The local app is implemented and verified. A private Sites registration was created, but its local publishing plugin became unavailable before publication; **no hosted Sites deployment was completed**. `.openai/hosting.json` preserves that registration so a later Sites continuation can reuse it. Direct Cloudflare deployment uses only `wrangler.jsonc` and is independent of that registration.
