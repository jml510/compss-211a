import './build.mjs';
import {readFile,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
const names=['index.html','styles.css','app.mjs','catalog.mjs','schedule.mjs','flashcards.mjs','flashcard-ui.mjs','exercises.mjs','python-worker.mjs','skill-checks.mjs','activity-client.mjs','activity-config.mjs','drills.mjs','drill-data.mjs','drill-ui.mjs','drill-worker.mjs'];
const assets={};
for(const name of names){assets['/'+name]={body:await readFile(new URL(name,import.meta.url),'utf8'),type:name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};}
await rm(new URL('dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('dist/server/assets.mjs',import.meta.url),'export default '+JSON.stringify(assets)+';\n');
for(const name of ['server.mjs','activity-model.mjs','catalog.mjs','schedule.mjs','drills.mjs'])await copyFile(new URL(name,import.meta.url),new URL('dist/server/'+name,import.meta.url));
await writeFile(new URL('dist/server/index.js',import.meta.url),"import assets from './assets.mjs';\nimport {createWorker} from './server.mjs';\nexport default createWorker(assets);\n");
console.log('Built hosted practice with automatic anonymous activity and a private aggregate feed.');
