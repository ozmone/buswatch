import { fetchFeed } from '../src/transit.mjs';
import { mkdtemp, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw Error('GitHub repository and token are required.');
const ref = 'refs/heads/live-feed'; // Dedicated disposable data branch; never main.
const marker = 'buswatch-live-feed-v1';
const directory = await mkdtemp(join(tmpdir(), 'buswatch-live-'));
const env = {
  ...process.env,
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
  GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:' + token).toString('base64'),
  GIT_AUTHOR_NAME: 'BUS WATCH live feed', GIT_COMMITTER_NAME: 'BUS WATCH live feed',
  GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
  GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com'
};
function git(...args) {
  return execFileSync('git', args, { cwd: directory, env, encoding: 'utf8', timeout: 30000, stdio: ['pipe','pipe','pipe'] }).trim();
}
git('init', '-q');
git('remote', 'add', 'origin', `https://github.com/${repository}.git`);
let previous = git('ls-remote', '--heads', 'origin', ref).split(/\s/)[0] || '';
if (previous) {
  git('fetch', '--depth=1', 'origin', ref);
  if (git('show', 'FETCH_HEAD:.buswatch-live-feed') !== marker) {
    throw Error('Refusing to overwrite a branch not owned by this feed publisher.');
  }
}
await mkdir(join(directory,'live'));
await writeFile(join(directory,'.buswatch-live-feed'),marker);
const once=process.argv.includes('--once');
const until=Date.now()+(once?1:5*60*60*1000);
do {
  const started=Date.now();
  try {
    const feed=await fetchFeed();
    if(feed.header.timestamp) {
      const body={publishedAt:Math.floor(Date.now()/1000),feed};
      await writeFile(join(directory,'latest.json'),JSON.stringify(body));
      // Immutable time-slot URLs avoid GitHub's several-minute branch-file cache.
      const slot=Math.floor(body.publishedAt/20);
      await writeFile(join(directory,'live',`${slot}.json`),JSON.stringify(body));
      for(const file of await readdir(join(directory,'live'))) {
        if(/^\d+\.json$/.test(file) && Number(file.slice(0,-5)) < slot-3) await unlink(join(directory,'live',file));
      }
      git('add','--all');
      const tree=git('write-tree');
      // No parent: one commit, four slots and one latest-snapshot alias.
      const commit=git('commit-tree',tree,'-m','Current official Cairns live snapshots');
      git('push',`--force-with-lease=${ref}:${previous}`,'origin',`${commit}:${ref}`);
      previous=commit;
      console.log(`Published slot ${slot}, feed ${new Date(feed.header.timestamp*1000).toISOString()}; ${feed.entity?.length || 0} updates`);
    }
  } catch(error) {
    console.error('Live publish failed; previous snapshot retained.');
    if(once)throw error;
    // Keep the prior snapshot; the PWA rejects old feed timestamps.
  }
  if(!once)await new Promise(resolve=>setTimeout(resolve,Math.max(1000,20000-(Date.now()-started))));
} while(!once && Date.now()<until);
