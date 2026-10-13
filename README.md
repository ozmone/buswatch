# BUS WATCH — CAIRNS

## Phone app on GitHub Pages

https://ozmone.github.io/buswatch/

The Pages version is installable. GitHub Actions fetches the official live Cairns feed every 20 seconds and publishes it on the dedicated `live-feed` branch. This generated-data branch has one reachable commit and at most four recent snapshots, avoiding accumulating files or branch history. The publisher verifies an ownership marker and uses a lease so it cannot overwrite a concurrent change. The source branch is never overwritten. The browser matches the feed to the official timetable. Original feed and trip timestamps must be under two minutes old to show LIVE; failures and delayed jobs are shown explicitly. Stop bookmarks and search work locally on the phone.

The `Cairns live data` workflow runs for three hours and 45 minutes, with another scheduled every four hours. This avoids overlapping jobs, which GitHub Actions coalesces and can otherwise turn into multi-hour live-data outages. GitHub scheduling and CDN delivery can still be delayed, so GitHub Pages is best-effort only. For dependable night-time live data, deploy the included Cloudflare Worker: it fetches Translink on demand and does not depend on GitHub Actions. Restart the Pages publisher from Actions → Cairns live data → Run workflow if needed.

To update the Pages build, run `npm run data` and `node scripts/build-pages.mjs` from `app/`, then commit and push the generated `docs/` folder. GitHub Pages publishes `main` → `/docs`.

The application is in [`app/`](app/). See [`app/README.md`](app/README.md) for run, deployment and maintenance instructions.

```powershell
cd D:\Documents\buswatch\app
npm ci
npm run data
npm run dev
```

Open http://localhost:8787.
