import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('real SDK against mock transport: handoffs, terminal failure, review gate and persisted session IDs',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rainy-workflow-'));let calls=0,failNext=false,base,child;
 const upstream=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const payload=JSON.parse(raw);assert.equal(payload.environment.type,'none');assert.equal(req.headers['openai-beta'],'agents=v1');const n=++calls,sid='session_'+n,tid='turn_'+n;const turn={id:tid,session_id:sid,subagent_id:null,status:'in_progress'};const session={id:sid,required_actions:[]};let seq=0;
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 function emit(type,rest){res.write(`event: ${type}\ndata: ${JSON.stringify({type,event_id:'evt_'+n+'_'+seq++,session_id:sid,turn_id:tid,...rest})}\n\n`);}
 emit('agent.session.turn.created',{turn});
 if(failNext){failNext=false;emit('agent.session.turn.failed',{turn:{...turn,status:'failed',error:{message:'Mock failure'}}});}
 else{emit('agent.session.turn.item.done',{output_index:0,item:{id:'msg_'+n,turn_id:tid,type:'message',role:'assistant',phase:'final_answer',status:'completed',content:[{type:'output_text',text:'Verified mock output '+n}]}});emit('agent.session.turn.completed',{turn:{...turn,status:'completed'}});}
 emit('agent.session.idle',{session});res.end();});
 await new Promise(ok=>upstream.listen(0,'127.0.0.1',ok));
 try{
 child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',DB_PATH:join(dir,'office.sqlite'),NODE_ENV:'test',APP_ORIGIN:'',OPENAI_API_KEY:'test-only-not-a-real-key',OPENAI_BASE_URL:`http://127.0.0.1:${upstream.address().port}/v1`},stdio:['ignore','pipe','pipe']});
 await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('startup timeout')),10000);child.stdout.on('data',b=>{const m=String(b).match(/listening on (\d+)/);if(m){base='http://127.0.0.1:'+m[1];clearTimeout(timer);ok();}});child.on('exit',()=>no(Error('server exited')));});
 let cookie,w;
 async function request(path,method='GET',data){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie||'','x-workspace-id':w||''},...(data?{body:JSON.stringify(data)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
 await request('register','POST',{email:'workflow@example.com',password:'workflow-password-123',name:'Tester',workspace:'Workflow QA'});w=(await request('me')).data.workspaces[0].id;
 let s=(await request('state')).data;const t=(await request('tasks','POST',{title:'Report',description:'Test handoff',agentId:s.agents[0].id,roomId:s.rooms[0].id,workflow:'team',agentIds:[s.agents[0].id,s.agents[1].id]})).data;
 assert.equal((await request('tasks/'+t.id+'/run','POST',{})).status,202);
 for(let i=0;i<100;i++){s=(await request('state')).data;if(s.tasks[0].status!=='running')break;await new Promise(ok=>setTimeout(ok,20));}
 assert.equal(s.tasks[0].status,'review',s.tasks[0].error);assert.equal(calls,4);assert.deepEqual(s.outputs.map(o=>o.stage),['plan','draft','specialist-2','review']);assert.equal(s.tasks[0].sessions.length,4);assert.equal(s.usage,4);
 assert.equal((await request('tasks/'+t.id+'/approve','POST',{})).status,200);assert.equal((await request('tasks/'+t.id+'/run','POST',{})).status,409);
 failNext=true;const t2=(await request('tasks','POST',{title:'Failure test',description:'Simulate failure',agentId:s.agents[0].id,roomId:s.rooms[0].id})).data;
 await request('tasks/'+t2.id+'/run','POST',{});
 for(let i=0;i<100;i++){s=(await request('state')).data;if(s.tasks.find(t=>t.id===t2.id).status!=='running')break;await new Promise(ok=>setTimeout(ok,20));}
 assert.equal(s.tasks.find(t=>t.id===t2.id).status,'failed');assert.equal(s.outputs.length,4);assert.equal(calls,5,'failed turns must not auto-retry');
 }finally{child?.kill();await new Promise(ok=>upstream.close(ok));setTimeout(()=>rmSync(dir,{recursive:true,force:true}),100);}
});
