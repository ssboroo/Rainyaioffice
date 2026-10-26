import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stage=resolve(root,'.build-staging');
const dist=resolve(root,'dist');
await rm(stage,{recursive:true,force:true});await mkdir(resolve(stage,'public'),{recursive:true});
try {
 const localImports={
  '/office3d.js':resolve(root,'public/office3d.js'),
  '/vendor/three.module.js':resolve(root,'node_modules/three/build/three.module.js'),
  '/vendor/OrbitControls.js':resolve(root,'node_modules/three/examples/jsm/controls/OrbitControls.js')
 };
 const result=await build({entryPoints:[resolve(root,'public/app.js')],outfile:resolve(stage,'public/app.js'),bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof',metafile:true,plugins:[{name:'local-browser-imports',setup(b){b.onResolve({filter:/^\/(office3d\.js|vendor\/)/},args=>({path:localImports[args.path]}));}}]});
 for(const f of ['index.html','style.css','office3d.js'])await cp(resolve(root,'public',f),resolve(stage,'public',f));
 await cp(resolve(root,'server.mjs'),resolve(stage,'server.mjs'));
 await cp(resolve(root,'package-lock.json'),resolve(stage,'package-lock.json'));
 const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 // Keep the lockfile-compatible manifest; production install omits build dependencies.
 await writeFile(resolve(stage,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 const files=['server.mjs','public/index.html','public/style.css','public/app.js','public/office3d.js','package.json','package-lock.json'];
 const manifest={name:pkg.name,version:pkg.version,files:{},bundledModules:Object.keys(result.metafile.inputs).length};
 for(const f of files){const bytes=await readFile(resolve(stage,f));manifest.files[f]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
 await writeFile(resolve(stage,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await rm(dist,{recursive:true,force:true});await rename(stage,dist);
 console.log(`Production build complete: dist/ (${manifest.bundledModules} modules, ${(manifest.files['public/app.js'].bytes/1024).toFixed(1)} KiB JS)`);
} catch(e) {await rm(stage,{recursive:true,force:true});throw e;}
