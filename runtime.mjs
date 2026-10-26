import {mkdir,chown,chmod} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
// Railway attaches persistent volumes as root. Initialize only this app's
// subdirectory, then permanently drop privileges before importing the server.
if(process.env.NODE_ENV==='production'&&process.getuid?.()===0){
 const db=resolve(process.env.DB_PATH||'/data/office/office.sqlite');
 const directory=dirname(db);
 if(!directory.startsWith('/data/office'+sep)&&directory!=='/data/office')throw Error('Privileged bootstrap requires DB_PATH under /data/office');
 await mkdir(directory,{recursive:true,mode:0o700});
 await chown(directory,1000,1000);await chmod(directory,0o700);
 process.setgroups([]);process.setgid(1000);process.setuid(1000);
 if(process.getuid()!==1000)throw Error('Unable to drop runtime privileges');
}
console.log('Runtime process uid: '+(process.getuid?.()??'unavailable'));
await import('./server.mjs');
