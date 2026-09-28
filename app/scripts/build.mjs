import { build } from 'esbuild';
import { mkdir, cp, writeFile } from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['src/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,external:['node:*']});
await cp('public','dist/client',{recursive:true});
await writeFile('dist/wrangler.json',JSON.stringify({name:'bus-watch-cairns',main:'server/index.js',compatibility_date:'2026-09-01',compatibility_flags:['nodejs_compat'],assets:{directory:'client',binding:'ASSETS',run_worker_first:['/api/*']}},null,2));
console.log('Worker and PWA built into dist/.');
