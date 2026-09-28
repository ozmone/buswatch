const BASE=self.registration.scope;
const CACHE='buswatch-pages-d080bbcf6355';
const SHELL=['./','index.html','styles.css','app-d080bbcf6355.js','data-api-d080bbcf6355.js','manifest.json','favicon.svg','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('buswatch-pages-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(BASE))return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}
    return r;
  }).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match(BASE):Response.error())));
});
