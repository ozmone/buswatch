import { MAX_FEED_AGE } from './config.mjs';

const RAW = 'https://raw.githubusercontent.com/ozmone/buswatch/';
const REF = 'https://api.github.com/repos/ozmone/buswatch/git/ref/heads/live-feed';

export function createLiveLoader(request = fetch, clock = Date.now) {
  let retained = null;
  let nextDiscovery = 0;
  const fresh = feed => {
    const age = clock() / 1000 - Number(feed?.header?.timestamp);
    return Number.isFinite(age) && age >= -60 && age <= MAX_FEED_AGE;
  };
  async function read(url) {
    const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw Error(`Live feed HTTP ${response.status}`);
    return response.json();
  }
  return async function load() {
    const slot = Math.floor(clock() / 20000);
    // Branch resolution can lag behind publishing. A cached 404 or one failed
    // request must not hide another snapshot that is still genuinely fresh.
    for (const offsets of [[1, 2, 3], [4, 5, 6]]) {
      let found = false;
      const results = await Promise.allSettled(offsets.map(offset =>
        read(`${RAW}live-feed/live/${slot - offset}.json?refresh=${slot}`)));
      for (const result of results) {
        const candidate = result.status === 'fulfilled' && result.value?.feed;
        if (fresh(candidate)) found = true;
        if (fresh(candidate) && (!retained || candidate.header.timestamp > retained.header.timestamp)) retained = candidate;
      }
      if (found) return retained;
    }
    if (fresh(retained)) return retained;
    // Resolve an immutable commit if all branch-file URLs are unavailable.
    // Limit discovery to 48 requests/hour, below GitHub's public API allowance.
    if (clock() >= nextDiscovery) {
      nextDiscovery = clock() + 75000;
      try {
        const ref = await read(`${REF}?refresh=${slot}`);
        if (!/^[a-f0-9]{40}$/.test(ref.object?.sha)) throw Error('Invalid live feed ref');
        const snapshot = await read(`${RAW}${ref.object.sha}/latest.json`);
        if (fresh(snapshot?.feed)) retained = snapshot.feed;
      } catch { /* The final freshness check also covers discovery failures. */ }
    }
    if (fresh(retained)) return retained;
    throw Error('No fresh live snapshot is available');
  };
}
