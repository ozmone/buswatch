# BUS WATCH — CAIRNS

## Phone app on GitHub Pages

https://ozmone.github.io/buswatch/

The Pages version is installable and uses the official Cairns **scheduled timetable only**. It does not currently receive live delays. This limitation is displayed on the board. Stop bookmarks and search work locally on the phone.

To update the Pages build, run `npm run data` and `node scripts/build-pages.mjs` from `app/`, then commit and push the generated `docs/` folder. GitHub Pages publishes `main` → `/docs`.

The application is in [`app/`](app/). See [`app/README.md`](app/README.md) for run, deployment and maintenance instructions.

```powershell
cd D:\Documents\buswatch\app
npm ci
npm run data
npm run dev
```

Open http://localhost:8787.
