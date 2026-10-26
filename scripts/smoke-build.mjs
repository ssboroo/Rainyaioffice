import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'rainy-build-'));
const child=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,PORT:'0',NODE_ENV:'production',APP_ORIGIN:'https://office.example.com',DB_PATH:join(data,'office.sqlite'),OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',b=>errors+=b);
try {
 const port=await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Build server startup timed out: '+errors)),10000);child.stdout.on('data',b=>{const m=String(b).match(/listening on (\d+)/);if(m){clearTimeout(timer);ok(m[1]);}});child.on('exit',code=>{clearTimeout(timer);no(Error('Build server exited '+code+': '+errors));});});
 const base='http://127.0.0.1:'+port;
 for(const path of ['/','/app.js','/style.css','/healthz']){const r=await fetch(base+path);assert.equal(r.status,200,path);}
 const health=await(await fetch(base+'/healthz')).json();assert.equal(health.ok,true);
 const source=await readFile(resolve('dist/public/app.js'),'utf8');assert.ok(!source.includes('from"/office3d.js"'));assert.ok(!source.includes('from"/vendor/'));
 const headers={Origin:'https://office.example.com','Content-Type':'application/json'};
 const r=await fetch(base+'/api/register',{method:'POST',headers,body:JSON.stringify({email:'build-test@example.com',password:'build-smoke-123456',name:'Build QA',workspace:'Isolated build test'})});assert.equal(r.status,201);assert.match(r.headers.get('set-cookie'),/Secure/);assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 const session=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(base+'/api/me',{headers:{Cookie:session}})).json();assert.equal(me.workspaces.length,1);assert.equal(me.aiConfigured,false);
 console.log('Production build smoke passed: assets, health, database initialization, registration, Secure sessions.');
} finally {child.kill('SIGTERM');await new Promise(ok=>child.exitCode!==null?ok():child.once('exit',ok));await rm(data,{recursive:true,force:true});}
