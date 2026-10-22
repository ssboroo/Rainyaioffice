import * as THREE from '/vendor/three.module.js';
import { OrbitControls } from '/vendor/OrbitControls.js';

const palette={coral:0xea9a7c,blue:0x7d9be8,purple:0xa69add,orange:0xe4b270,teal:0x7dbbb0,green:0x98b886,pink:0xdca7bb};
const materialCache=new Map();
function material(color,roughness=.65,metalness=0){const key=[color,roughness,metalness].join(':');if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materialCache.get(key);}
function mesh(parent,geometry,color,x,y,z,options={}){const object=new THREE.Mesh(geometry,material(color,options.roughness,options.metalness));object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;}
const box=(p,w,h,d,c,x,y,z,opts)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z,opts);
const sphere=(p,r,c,x,y,z,sx=1,sy=1,sz=1)=>{const m=mesh(p,new THREE.SphereGeometry(r,20,14),c,x,y,z);m.scale.set(sx,sy,sz);return m;};
const cylinder=(p,rt,rb,h,c,x,y,z)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,24),c,x,y,z);
function limb(p,from,to,r,color){const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a);const m=mesh(p,new THREE.CapsuleGeometry(r,Math.max(.001,d.length()-2*r),5,10),color,...a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function plant(p,x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);p.add(g);cylinder(g,.24,.18,.48,0xd8cdbb,0,.24,0);cylinder(g,.21,.21,.03,0x675d48,0,.49,0);for(let i=0;i<9;i++){const a=i*2.4,r=.15+(i%3)*.07,h=.8+(i%4)*.15;limb(g,[0,.48,0],[Math.sin(a)*r,h,Math.cos(a)*r],.018,0x657f48);const leaf=sphere(g,.25,i%2?0x8caa70:0x6f9258,Math.sin(a)*r,h,Math.cos(a)*r,.45,1.3,.25);leaf.rotation.set(.5*Math.cos(a),a,.6*Math.sin(a));}return g;}
function chair(p,x,z){const g=new THREE.Group();g.position.set(x,0,z);p.add(g);cylinder(g,.31,.31,.1,0xced6c9,0,.58,0);const back=box(g,.61,.53,.13,0xdce1d4,0,.93,.25);back.rotation.x=-.12;cylinder(g,.05,.05,.4,0x83938c,0,.32,0);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;limb(g,[0,.15,0],[Math.sin(a)*.32,.08,Math.cos(a)*.32],.025,0x9eaaa4);sphere(g,.055,0x61716c,Math.sin(a)*.32,.06,Math.cos(a)*.32);}return g;}
function desk(p,x,z,index){const g=new THREE.Group();g.position.set(x,0,z);p.add(g);box(g,1.8,.13,.88,0xf1eee5,0,1.04,-.28);box(g,.4,.88,.7,0xd9ded5,.63,.52,-.28);for(const xx of [-.72,.65])box(g,.06,.95,.06,0xbac8bd,xx,.5,-.55);box(g,.06,.3,.06,0xa2b0a9,0,1.28,-.5);box(g,.35,.04,.23,0xbac5bf,0,1.13,-.48);box(g,.84,.52,.065,0x53656c,0,1.57,-.52);const screen=box(g,.78,.46,.008,[0xb9d6de,0xd7d1e8,0xc4dbd0][index%3],0,1.57,-.481);screen.material=new THREE.MeshStandardMaterial({color:screen.material.color,emissive:screen.material.color,emissiveIntensity:.25,roughness:.35});for(let i=0;i<4;i++)box(g,.42-i*.05,.018,.01,0xf6fbf9,-.1,1.68-i*.07,-.473);box(g,.57,.025,.22,0xfafbf7,-.1,1.125,-.06);box(g,.12,.025,.17,0xa5b7af,.39,1.125,-.04);cylinder(g,.075,.062,.14,0xe6b98a,-.61,1.18,-.06);cylinder(g,.06,.06,.007,0x6d5140,-.61,1.255,-.06);chair(g,0,.65);return g;}
function employee(p,a,x,z,index){const color=palette[a.color]||palette.blue;const group=new THREE.Group();group.position.set(x,0,z+.62);group.userData.agentId=a.id;p.add(group);const body=new THREE.Group();group.add(body);
 // All parts are true meshes with depth; arms and legs have articulated pivots.
 box(body,.38,.48,.27,color,0,.96,0);sphere(body,.2,color,0,1.14,0,1,.45,.8);
 limb(body,[-.11,.72,0],[-.15,.67,-.27],.075,0x73858b);limb(body,[.11,.72,0],[.15,.67,-.27],.075,0x73858b);
 limb(body,[-.15,.67,-.27],[-.15,.23,-.25],.06,0x73858b);limb(body,[.15,.67,-.27],[.15,.23,-.25],.06,0x73858b);
 sphere(body,.11,0x46565d,-.15,.18,-.31,1,.55,1.5);sphere(body,.11,0x46565d,.15,.18,-.31,1,.55,1.5);
 const arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.24,1.08,0);body.add(arm);limb(arm,[0,0,0],[side*.08,-.18,-.15],.06,color);limb(arm,[side*.08,-.18,-.15],[side*.08,-.05,-.4],.046,0xefc8a7);sphere(arm,.062,0xefc8a7,side*.08,-.05,-.4);arms.push(arm);}
 cylinder(body,.06,.06,.1,0xefc8a7,0,1.25,0);const head=new THREE.Group();head.position.y=1.49;body.add(head);sphere(head,.23,0xf0d1b3,0,0,0,1,1.08,.92);sphere(head,.235,color,0,.12,.02,1.08,.72,1);sphere(head,.09,color,-.17,.07,-.08);sphere(head,.065,color,.15,.15,-.15);for(const xx of [-.08,.08])sphere(head,.018,0x414343,xx,.015,-.205);sphere(head,.035,0xe7b796,0,-.04,-.215,1,.8,.7);
 // Selection ring is separate from raycast targets and never obscures the employee.
 const ring=mesh(group,new THREE.TorusGeometry(.48,.027,8,48),0x637ee9,0,.06,0);ring.rotation.x=Math.PI/2;ring.material=new THREE.MeshBasicMaterial({color:0x637ee9});ring.visible=false;ring.castShadow=false;
 const beacon=sphere(group,.05,0x7ca886,.37,1.9,0);beacon.material=new THREE.MeshBasicMaterial({color:0x7ca886});
 return {id:a.id,group,body,head,arms,ring,beacon,index,running:false};}

export const environments={
 general:{name:'Ерөнхий оффис',wall:0xe1e9dc,floor:0xf2eee2,accent:0x91b49b},
 research:{name:'Судалгааны студи',wall:0xe5dfd2,floor:0xece4d5,accent:0xb59273},
 development:{name:'Хөгжүүлэлтийн лаборатори',wall:0xd5e1ea,floor:0xdfe6ec,accent:0x638aca},
 finance:{name:'Санхүүгийн төв',wall:0xd9e6df,floor:0xe8eee6,accent:0x6a9e86},
 hr:{name:'Хүний нөөцийн оффис',wall:0xeadfe3,floor:0xf1e8e4,accent:0xc194ac},
 sales:{name:'Борлуулалтын студи',wall:0xeee2d5,floor:0xf4ebdf,accent:0xd8a46f},
 education:{name:'Сургалтын танхим',wall:0xdce8df,floor:0xeae9dc,accent:0x86b6a0},
 government:{name:'Албан ажлын танхим',wall:0xdde2eb,floor:0xe6e1d9,accent:0x7b8fae},
 operations:{name:'Үйл ажиллагааны төв',wall:0xdce4e5,floor:0xe3e5df,accent:0xd0ad62}
};
function screenPanel(p,x,z,width=1.5){box(p,width,.95,.08,0x344954,x,1.6,z);box(p,width-.09,.86,.02,0xb5d0d6,x,1.6,z+.05);return {x,y:1.6,z:z+.065,width};}
function themeDecor(room,type,width,depth,accent){const g=new THREE.Group();g.name='environment-'+type;room.add(g);const back=-depth/2+.2,right=width/2-.65,front=depth/2-1;
 if(type==='research'||type==='government'){const x=-width/2+.35;for(let shelf=0;shelf<3;shelf++){box(g,.46,.06,1.8,0xb59d7e,x,.65+shelf*.6,-1.2);for(let i=0;i<7;i++){const z=-1.93+i*.24;const book=box(g,.29,.28+(i%3)*.07,.11,[0x91a58a,0xb99a82,0x8193ac,0xd2bd91][i%4],x,.85+shelf*.6,z);book.rotation.x=(i%3-1)*.08;}}box(g,.5,.08,1.9,0xb59d7e,x,2.2,-1.2);}
 if(type==='development'){for(let i=0;i<2;i++){const rack=box(g,.65,1.85,.75,0x34444f,-width/2+.55,.95,-1.4+i*.95);rack.name='server-rack';for(let row=0;row<7;row++){box(g,.025,.13,.61,0x5a6b72,-width/2+.89,.26+row*.23,-1.4+i*.95);sphere(g,.025,0x74cbaa,-width/2+.92,.27+row*.23,-1.61+i*.95);}}const p=screenPanel(g,0,back,1.65);for(let i=0;i<6;i++)box(g,.6-i*.05,.022,.015,i%2?0x95b7ca:0xe1efe5,p.x-.25,p.y+.3-i*.11,p.z);}
 if(type==='finance'||type==='sales'||type==='operations'){const p=screenPanel(g,0,back,2.0);for(let i=0;i<7;i++){const h=.14+((i*3)%7)*.085;box(g,.13,h,.025,[accent,0x8fc5b2,0xe8d598][i%3],p.x-.7+i*.23,p.y-.33+h/2,p.z);}for(let i=0;i<3;i++)box(g,.25,.025,.025,0xe7f1ee,p.x+.54,p.y+.25-i*.13,p.z);}
 if(type==='education'){box(g,2.3,1.25,.12,0xb5a282,0,1.6,back);box(g,2.15,1.1,.04,0x658d7b,0,1.6,back+.09);for(let i=0;i<4;i++)box(g,1.3-i*.18,.025,.02,0xe0e9d8,-.15,1.94-i*.18,back+.12);const podium=box(g,.7,1.1,.55,0xc6b897,right,.57,back+.7);podium.name='lectern';for(let i=0;i<3;i++)chair(g,-.8+i*.85,front);}
 if(type==='operations'){for(let shelf=0;shelf<3;shelf++){box(g,.65,.06,1.9,0x9baaa5,-width/2+.43,.2+shelf*.65,-.9);for(let i=0;i<3;i++){const crate=box(g,.43,.4,.45,i%2?0xc6b58c:0x9bb5ac,-width/2+.43,.44+shelf*.65,-1.5+i*.6);crate.name='inventory-box';box(g,.012,.08,.18,0xf0ead6,-width/2+.65,.48+shelf*.65,-1.5+i*.6);}}}
 if(type==='hr'){for(let i=0;i<3;i++){const frame=box(g,.55,.72,.06,0xc2ab9c,-1+i*.75,1.75,back);frame.name='team-portrait';box(g,.45,.62,.025,0xf8f0e3,-1+i*.75,1.75,back+.05);sphere(g,.11,[0xc29b88,0x9db5a1,0x9eabc6][i],-1+i*.75,1.87,back+.1,1,1,.2);box(g,.25,.19,.04,accent,-1+i*.75,1.6,back+.1);}}
 if(type==='government'||type==='finance'){const table=box(g,2,.12,1,0xbba88c,right-1,1.02,front);table.name='meeting-table';for(let i=0;i<2;i++){chair(g,right-1.55+i*.95,front+.6);box(g,.3,.025,.35,0xf6f4ec,right-1.55+i*.95,1.095,front);}for(const x of [right-1.7,right-.3])box(g,.07,.94,.6,0xa7b2ad,x,.49,front);}
 if(type==='sales'){box(g,1.9,.9,.62,0xe1d1b8,right-1,.46,front);box(g,2,.08,.72,0xf4ece0,right-1,.95,front);const p=screenPanel(g,right-1,front-.07,.7);g.children.at(-2).position.y=1.25;g.children.at(-1).position.y=1.25;}
 return g;
}

/** Scene construction is independent of the DOM and is validated by node tests. */
export function buildOffice(agents,{type='general'}={}){materialCache.clear();if(!environments[type])type='general';const theme=environments[type];const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f7f5);const room=new THREE.Group();room.name=type;scene.userData.environment=type;scene.add(room);
 const columns=Math.max(2,Math.ceil(Math.sqrt(agents.length||1))),rows=Math.max(2,Math.ceil(agents.length/columns));const width=Math.max(7.4,columns*2.35+2.2),depth=Math.max(6.2,rows*2.5+1.6);
 box(room,width,.22,depth,0xe2ded2,0,-.16,0);box(room,width+.08,.06,depth+.08,theme.floor,0,-.02,0);
 for(let x=-width/2+.25;x<width/2;x+=.48){box(room,.009,.008,depth-.12,0xd9d4c5,x,.016,0);}
 const walls=[];for(const [w,d,x,z]of [[width,.13,0,-depth/2],[.13,depth,-width/2,0]]){const wall=box(room,w,2.65,d,theme.wall,x,1.31,z);wall.material=wall.material.clone();wall.material.transparent=true;walls.push(wall);}
 // Framed windows, wall board and architectural details.
 for(let i=0;i<3;i++){const x=width/2-1.1-i*.78;box(room,.7,1.3,.04,0xfafcf7,x,1.62,-depth/2+.08);box(room,.6,1.19,.045,0xbdd4d5,x,1.62,-depth/2+.11);box(room,.025,1.2,.05,0xe8f0e8,x,1.62,-depth/2+.14);}
 if(type==='general'){ box(room,.06,1.13,1.65,0xc8d2c4,-width/2+.09,1.6,-.6);box(room,.065,1.03,1.55,0xfafbf7,-width/2+.13,1.6,-.6);for(let i=0;i<4;i++)box(room,.07,.035,1.08-i*.12,0xb0c8b8,-width/2+.17,1.9-i*.16,-.7);
}
 if(['general','hr','research'].includes(type)){ const rug=box(room,2.1,.025,1.65,0xd2ddcc,width/2-1.5,.035,depth/2-1.15);rug.receiveShadow=true;
 box(room,1.8,.38,.66,0xdde4d4,width/2-1.5,.36,depth/2-.65);box(room,1.8,.5,.19,0xc6d2be,width/2-1.5,.68,depth/2-.42);for(const x of [width/2-2.34,width/2-.65])box(room,.17,.47,.7,0xcbd8c3,x,.54,depth/2-.67);
 cylinder(room,.41,.41,.07,0xf7f4eb,width/2-1.5,.48,depth/2-1.5);cylinder(room,.06,.1,.43,0xb4c1ad,width/2-1.5,.24,depth/2-1.5);
}
 themeDecor(room,type,width,depth,theme.accent);
 plant(room,-width/2+.5,-depth/2+.55,1.2);plant(room,width/2-.48,depth/2-.45,1.15);plant(room,-width/2+.5,depth/2-.5,.95);
 const workers=agents.map((a,i)=>{const x=(i%columns-(columns-1)/2)*2.35,z=(Math.floor(i/columns)-(rows-1)/2)*2.5-.35;desk(room,x,z,i);return employee(room,a,x,z,i);});
 const ambient=new THREE.HemisphereLight(0xffffff,0xb9c7b5,2.6);scene.add(ambient);const sun=new THREE.DirectionalLight(0xfff5df,3.2);sun.position.set(4,9,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);const s=Math.max(width,depth);Object.assign(sun.shadow.camera,{left:-s,right:s,top:s,bottom:-s,near:1,far:35});sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;sun.shadow.radius=4;scene.add(sun);const fill=new THREE.DirectionalLight(0xd5e8ff,1.1);fill.position.set(-5,4,-4);scene.add(fill);
 return {scene,workers,walls,width,depth};}
export function disposeScene(scene){const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}if(o.shadow)o.shadow.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());materialCache.clear();}

export function mountOffice(host,{agents,selected,tasks,onSelect,viewState,onView,type='general'}){
 let destroyed=false,contextLost=false,renderer,controls,observer,frame=0,visible=true;const fallback=host.querySelector('.webgl-message'),canvas=host.querySelector('canvas');
 const data=buildOffice(agents,{type}),{scene,workers,walls,width,depth}=data;
 function failure(message){fallback.hidden=false;fallback.textContent=message;canvas.hidden=true;host.dataset.renderer='unavailable';}
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'default'});}catch{disposeScene(scene);failure('WebGL 2 идэвхгүй байна. Browser-ийн hardware acceleration тохиргоогоо шалгана уу. Доорх жагсаалтаас AI ажилтнаа сонгож ажлаа үргэлжлүүлэх боломжтой.');return {update(){},destroy(){}};}
 host.dataset.renderer='webgl2';renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);const radius=Math.max(width,depth);camera.position.set(radius*1.05,radius*.95,radius*1.2);controls=new OrbitControls(camera,canvas);controls.target.set(0,.65,0);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=4;controls.maxDistance=radius*3;controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI/2-.04;controls.enablePan=false;
 const initial={position:camera.position.toArray(),target:controls.target.toArray()};if(viewState){camera.position.fromArray(viewState.position);controls.target.fromArray(viewState.target);}controls.update();
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),clock=new THREE.Clock();let press=null,currentSelected=selected;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const labels=host.querySelector('.worker-labels');const buttons=workers.map(w=>{const button=document.createElement('button');button.className='worker-label';button.textContent=agents[w.index].name;button.onclick=()=>onSelect(w.id);button.setAttribute('aria-label',agents[w.index].name+' сонгох');labels.append(button);return button;});
 const selectable=workers.flatMap(w=>{const meshes=[];w.body.traverse(o=>{if(o.isMesh){o.userData.agentId=w.id;meshes.push(o);}});return meshes;});
 function pick(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(selectable,false)[0]?.object.userData.agentId;}
 function down(e){press={x:e.clientX,y:e.clientY,id:e.pointerId};}
 function up(e){if(press&&press.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<6){const id=pick(e);if(id)onSelect(id);}press=null;}
 function hover(e){canvas.style.cursor=pick(e)?'pointer':'grab';}
 function key(e){if(e.key==='Home'){e.preventDefault();reset();}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.85);}if(e.key==='-'){e.preventDefault();zoom(1.15);}}
 function zoom(amount){camera.position.sub(controls.target).multiplyScalar(amount).clampLength(controls.minDistance,controls.maxDistance).add(controls.target);controls.update();}
 function reset(){camera.position.fromArray(initial.position);controls.target.fromArray(initial.target);controls.update();}
 function lost(e){e.preventDefault();contextLost=true;failure('3D графикийн холболт тасарлаа. Сэргээхийг хүлээнэ үү; доорх ажилтны жагсаалтыг ашиглаж болно.');}
 function restored(){contextLost=false;canvas.hidden=false;fallback.hidden=true;host.dataset.renderer='webgl2';resize();}
 const actions={reset,zoomIn:()=>zoom(.8),zoomOut:()=>zoom(1.2)};const listeners=[];for(const button of host.querySelectorAll('[data-camera]')){const fn=actions[button.dataset.camera];button.addEventListener('click',fn);listeners.push([button,fn]);}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointermove',hover);canvas.addEventListener('keydown',key);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
 function resize(){if(destroyed)return;const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();}
 observer=new ResizeObserver(resize);observer.observe(host);resize();
 const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});visibility.observe(host);
 function update({selected,tasks=[]}){currentSelected=selected;for(const [i,w]of workers.entries()){w.running=tasks.some(t=>t.agentId===w.id&&t.status==='running');w.ring.visible=w.id===selected;w.beacon.material.color.set(w.running?0x4f88e4:0x6ca784);buttons[i].classList.toggle('selected',w.id===selected);buttons[i].setAttribute('aria-pressed',String(w.id===selected));}}
 update({selected,tasks});
 function animate(){if(destroyed)return;frame=requestAnimationFrame(animate);if(document.hidden||!visible||contextLost)return;const time=clock.getElapsedTime();controls.update();
 // Cutaway walls fade only when they would sit between the camera and the team.
 walls[0].material.opacity=camera.position.z<0?.08:1;walls[1].material.opacity=camera.position.x<0?.08:1;
 for(const [i,w]of workers.entries()){if(!reduce.matches){w.head.rotation.y=Math.sin(time*.65+i)*.07;w.body.position.y=Math.sin(time*1.3+i)*.009;w.arms.forEach((arm,j)=>arm.rotation.x=w.running?Math.sin(time*9+j+i)*.065:0);}const p=w.group.position.clone();p.y=2.05;p.project(camera);buttons[i].style.transform=`translate(-50%,-100%) translate(${(p.x*.5+.5)*host.clientWidth}px,${(-p.y*.5+.5)*host.clientHeight}px)`;buttons[i].hidden=p.z>1||p.z< -1;}
 renderer.render(scene,camera);}
 animate();
 return {update,destroy(){if(destroyed)return;destroyed=true;onView?.({position:camera.position.toArray(),target:controls.target.toArray()});cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();controls.dispose();for(const [button,fn]of listeners)button.removeEventListener('click',fn);for(const [event,fn]of [['pointerdown',down],['pointerup',up],['pointermove',hover],['keydown',key],['webglcontextlost',lost],['webglcontextrestored',restored]])canvas.removeEventListener(event,fn);buttons.forEach(b=>b.remove());disposeScene(scene);renderer.dispose();renderer.forceContextLoss();}};
}
