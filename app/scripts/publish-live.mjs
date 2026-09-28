import { fetchFeed } from '../src/transit.mjs';

const token=process.env.GITHUB_TOKEN;
const repository=process.env.GITHUB_REPOSITORY;
if(!token || !repository) throw Error('GitHub repository and token are required.');
const base=`https://api.github.com/repos/${repository}`;
const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'buswatch-live'};
async function request(path,method='GET',body) {
  const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=await r.json();
  if(!r.ok) throw Object.assign(Error(`GitHub ${method} ${path}: ${r.status} ${data.message || ''}`),{status:r.status});
  return data;
}
try {await request('/git/ref/heads/live-data');}
catch(error) {
  if(error.status!==404)throw error;
  const main=await request('/git/ref/heads/main');
  await request('/git/refs','POST',{ref:'refs/heads/live-data',sha:main.object.sha});
}
let sha;
try {sha=(await request('/contents/live.json?ref=live-data')).sha;}
catch(error) {if(error.status!==404)throw error;}
const once=process.argv.includes('--once');
const until=Date.now()+(once?1:5*60*60*1000);
let lastTimestamp=0;
do {
  const started=Date.now();
  try {
    const feed=await fetchFeed();
    if(feed.header.timestamp!==lastTimestamp) {
      const body={publishedAt:Math.floor(Date.now()/1000),feed};
      const result=await request('/contents/live.json','PUT',{
        message:'Refresh official Cairns live feed',branch:'live-data',
        content:Buffer.from(JSON.stringify(body)).toString('base64'),...(sha?{sha}:{})
      });
      sha=result.content.sha;lastTimestamp=feed.header.timestamp;
      console.log(`Published feed ${new Date(lastTimestamp*1000).toISOString()}; ${feed.entity?.length || 0} updates`);
    }
  } catch(error) {
    console.error(error.message);
    if(once)throw error;
    // Keep the prior snapshot; the PWA rejects old feed timestamps.
    try {sha=(await request('/contents/live.json?ref=live-data')).sha;}catch{}
  }
  if(!once)await new Promise(resolve=>setTimeout(resolve,Math.max(1000,20000-(Date.now()-started))));
} while(!once && Date.now()<until);
