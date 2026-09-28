import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('../docs',{recursive:true});
for(const file of ['index.html','styles.css','app.js','manifest.json','favicon.svg','icon-192.png','icon-512.png']) {
  await copyFile('public/'+file,'../docs/'+file);
}
let html=await readFile('../docs/index.html','utf8');
html=html.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
await writeFile('../docs/index.html',html);
const manifest=JSON.parse(await readFile('../docs/manifest.json','utf8'));
manifest.id='./';manifest.start_url='./';manifest.scope='./';
for(const icon of manifest.icons)icon.src='.'+icon.src;
await writeFile('../docs/manifest.json',JSON.stringify(manifest,null,2));
await build({entryPoints:['src/pages-api.mjs'],outfile:'../docs/data-api.js',bundle:true,format:'esm',platform:'browser',minify:true,target:'es2022'});
// New filenames make installed PWAs receive the new code despite browser/CDN caches.
const revision=createHash('sha256').update(await readFile('../docs/data-api.js')).update(await readFile('../docs/app.js')).digest('hex').slice(0,12);
const appName=`app-${revision}.js`, apiName=`data-api-${revision}.js`;
const app=(await readFile('../docs/app.js','utf8')).replace("'./data-api.js'",`'./${apiName}'`);
await writeFile(`../docs/${appName}`,app);
await copyFile('../docs/data-api.js',`../docs/${apiName}`);
await writeFile('../docs/index.html',html.replace('src="./app.js"',`src="./${appName}"`));
for(const name of await readdir('../docs')) {
  if((/^(?:app|data-api)-[a-f0-9]{12}\.js$/.test(name) && ![appName,apiName].includes(name)) || ['app.js','data-api.js'].includes(name)) {
    await unlink(`../docs/${name}`);
  }
}
await writeFile('../docs/.nojekyll','');
const worker=(await readFile('src/pages-sw.js','utf8')).replace('buswatch-pages-v2',`buswatch-pages-${revision}`).replace("'app.js'",`'${appName}'`).replace("'data-api.js'",`'${apiName}'`);
await writeFile('../docs/sw.js',worker);
console.log('GitHub Pages PWA built in docs/ with the GitHub-hosted live feed.');
