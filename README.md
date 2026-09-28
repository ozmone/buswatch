# BUS WATCH — CAIRNS

## Phone app on GitHub Pages

https://ozmone.github.io/buswatch/

The Pages version is installable. GitHub Actions fetches the official live Cairns feed every 20 seconds and publishes it on the `live-data` branch. The browser matches that feed to the official timetable. Original feed and trip timestamps must be under two minutes old to show LIVE; failures and delayed jobs are shown explicitly. Stop bookmarks and search work locally on the phone.

The `Cairns live data` workflow runs for five hours per job, with another scheduled every four hours and only one running at a time. GitHub scheduling and CDN delivery can be delayed: this is best-effort live data, not a guaranteed transport service. Restart it from Actions → Cairns live data → Run workflow if needed. Disable that workflow to stop the publisher. No Cloudflare account or deployment is used by the Pages version.

To update the Pages build, run `npm run data` and `node scripts/build-pages.mjs` from `app/`, then commit and push the generated `docs/` folder. GitHub Pages publishes `main` → `/docs`.

The application is in [`app/`](app/). See [`app/README.md`](app/README.md) for run, deployment and maintenance instructions.

```powershell
cd D:\Documents\buswatch\app
npm ci
npm run data
npm run dev
```

Open http://localhost:8787.
