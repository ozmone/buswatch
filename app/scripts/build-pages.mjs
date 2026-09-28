import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
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
await writeFile('../docs/.nojekyll','');
await copyFile('src/pages-sw.js','../docs/sw.js');
console.log('GitHub Pages PWA built in docs/ with the GitHub-hosted live feed.');
