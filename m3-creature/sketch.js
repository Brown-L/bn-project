/* NEON FAUNA / Specimen 01
 * p5.js WEBGL study: blocky hull, four articulated legs, six segmented feelers.
 * The ground-plane cursor is the creature's attention target.
 */
const CFG={arena:520,approach:230,personal:120,walk:80,flee:200,startle:1.2,step:36,stepHeight:24,feedRange:300,feedStop:125,absorb:.34,dormant:10,defensive:5.5,ventR:118,ventComfort:240};
const C={cyan:[25,242,255],pink:[255,46,147],amber:[255,184,0],hull:[34,38,68],upper:[28,32,60],lower:[46,50,90],ant:[22,26,48]};
const ENV_BASE={AIR_TEMP:15,PH_LEVEL:7,GEYSER_PSI:120};
const ENV_RANGE={AIR_TEMP:[-30,60],PH_LEVEL:[1,12],GEYSER_PSI:[0,1000]};
const FEED_COLORS={GOLD:[255,184,0],EMERALD:[70,255,168],AZURE:[84,196,255]};
const FEED_NAMES={GOLD:'金黃嗜熱菌 GOLD',EMERALD:'翠綠嗜熱菌 EMERALD',AZURE:'深青嗜熱菌 AZURE'};
const STATE_META={watch:['觀察中','WATCH'],curious:['好奇靠近','CURIOUS'],wary:['保持距離','WARY'],startled:['受驚逃竄','STARTLED'],wander:['漫遊中','WANDER'],idle:['休息中','REST'],feeding:['覓食中','FEEDING'],satisfied:['能量充盈','SATISFIED'],defensive:['防禦硬殼','DEFENSIVE'],dormant:['節能休眠','DORMANT'],overheat:['過熱警戒','OVERHEAT'],warming:['取暖中','WARMING'],cooling:['散熱中','COOLING'],shielded:['矽殼防護','SHIELDED'],resonating:['聲納共振','RESONATING'],exploring:['探索環境','EXPLORING'],clustering:['趨源群聚','CLUSTERING'],migrating:['季節遷移','MIGRATING'],trial:['熱梯度考驗','TRIAL']};
const ENV={AIR_TEMP:15,PH_LEVEL:7,GEYSER_PSI:120,eruptT:0,eruptTotal:4.8,cooldown:0,shake:0,sonarT:0,sonarAt:null,autoRate:6,symbiont:null,ui:null};
const VENT={x:-268,z:-168};
const mixCol=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const V=(x=0,y=0,z=0)=>({x,y,z}), add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z), sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z), mul=(a,k)=>V(a.x*k,a.y*k,a.z*k), dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z, len=a=>Math.hypot(a.x,a.y,a.z), norm=a=>mul(a,1/(len(a)||1)), mix=(a,b,t)=>add(a,mul(sub(b,a),t)), cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x), smooth=(dt,r)=>1-Math.exp(-dt*r), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const BODY={hx:76,hy:21,hz:35,h:86};let L1=48,L2=54;
let cam,cr,legs,chains,mouse,shocks,decor,ui,reduceMotion=false,elapsed=0,crystals,footprints,vent,ventParticles,press=null,threat=0,glitchTimer=0,clickTimer=0,clickBurst=0,lastClickT=-10000;
let uiHover=false,deckOpen=false,antennaClock=0,floorCol=C.cyan,eruptAccum=0,cmdHistory=[],histIdx=0,mats=[],eruptParticles=[],sonarPulses=[];
let gridSegs=[],boundarySegs=[],lastHudT=0,lastGlitchT=-10,stageResizeObserver=null;

function setup(){
  const stageEl=document.getElementById('stage'),cw=Math.max(1,stageEl.clientWidth||windowWidth),ch=Math.max(1,stageEl.clientHeight||windowHeight);
  setAttributes({antialias:true,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  const canvas=createCanvas(cw,ch,WEBGL);canvas.parent('stage');
  if(window.ResizeObserver){stageResizeObserver=new ResizeObserver(()=>fitStage());stageResizeObserver.observe(stageEl)}
  requestAnimationFrame(fitStage);setTimeout(fitStage,120);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>fitStage()).catch(()=>{});
  /* Full-resolution backing store so the 3D edges stay crisp. */
  pixelDensity(1);
  frameRate(30);
  buildFloorGrid();
  reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  cam={yaw:.6,pitch:.44,dist:640,cx:0,cz:0,fov:Math.PI/3.2,eye:V(),fwd:V(0,0,-1)};
  cr={x:0,z:0,a:.4,v:0,phase:0,bob:0,startle:0,fleeA:0,state:'watch',wander:V(120,0,-80),wanderT:0,defensive:0,satisfied:0,glow:0,cold:0,warm:0,sink:0,overT:0,feedPoint:null,fed:0,dormant:false,airCold:0,heatStress:0,acidShield:0,alkaline:0,shiver:0,symbiont:null,symbiontName:null,energy:66,habitat:70,symbiosis:30,vitality:60,growth:.05,localTemp:15,survival:null};
  mouse={hit:V(200,0,100),lastMove:-999,attention:0,px:windowWidth/2,py:windowHeight/2,speed:0};shocks=[];mouse.lastMove=millis()/1000;
  crystals=[];footprints=[];vent={x:VENT.x,z:VENT.z};press=null;threat=0;clickBurst=0;lastClickT=-10000;mats=[];eruptParticles=[];sonarPulses=[];antennaClock=0;eruptAccum=0;
  ventParticles=Array.from({length:42},()=>{const max=2.2+Math.random()*1.8;return{x:(Math.random()-.5)*26,y:10+Math.random()*105,z:(Math.random()-.5)*26,r:Math.random()*TWO_PI,sp:34+Math.random()*46,life:Math.random()*max,max}});
  const hips=[[.74,-1],[.74,1],[-.74,-1],[-.74,1]];
  legs=hips.map(([f,s],i)=>({f:f*BODY.hx,s:s*(BODY.hz-4),group:(i===0||i===3)?0:1,foot:null,from:null,to:null,stepping:false,t:0,knee:V(),hip:V()}));
  const defs=[
    {base:[-62,21,16],idle:[-.7,.9,.2],seg:[34,34,30],w:.55},{base:[8,21,-20],idle:[.1,1,-.5],seg:[26,24,22],w:.8},
    {base:[42,21,18],idle:[.8,.7,.3],seg:[32,30,26],w:.9},{base:[76,8,-12],idle:[1,.1,-.3],seg:[34,32,30],w:1},
    {base:[76,0,10],idle:[1,.05,.35],seg:[30,30,26],w:1},{base:[76,-8,0],idle:[1,-.1,0],seg:[28,26],w:.9}
  ];
  chains=defs.map((d,i)=>({...d,i,total:d.seg.reduce((a,b)=>a+b,0),pts:null,tip:null,lock:0}));
  decor=Array.from({length:7},(_,i)=>{const a=i/7*TWO_PI+.4,r=700+(i%3)*120;return{x:Math.cos(a)*r,y:-(160+(i*53)%220),z:Math.sin(a)*r,s:38+(i*17)%34,r:i*1.3,sp:.12+(i%3)*.05,m:i%2}});
  ui={state:document.getElementById('state'),dist:document.getElementById('dist'),x:document.getElementById('coordX'),z:document.getElementById('coordZ'),motion:document.getElementById('motionToggle'),thermal:document.getElementById('thermalState'),thermalBar:document.getElementById('thermalBar'),thermalVal:document.getElementById('thermalVal'),energy:document.getElementById('energy'),code:document.getElementById('stateCode')};
  ui.motion.addEventListener('click',()=>{reduceMotion=!reduceMotion;document.body.classList.toggle('reduce-motion',reduceMotion);ui.motion.setAttribute('aria-pressed',String(reduceMotion));ui.motion.innerHTML=`<span>◉</span> 動態：${reduceMotion?'減少':'開啟'}`;});
  document.body.classList.toggle('reduce-motion',reduceMotion);
  setupTelemetry();
  if(window.NF_ECO)window.NF_ECO.init();
  if(window.NF_AUDIO)window.NF_AUDIO.install();
  noCursor();
}
function fitStage(){const s=document.getElementById('stage');if(!s)return;const w=Math.max(1,s.clientWidth),h=Math.max(1,s.clientHeight);if(w>1&&h>1&&(w!==width||h!==height))resizeCanvas(w,h)}
function windowResized(){fitStage()}
document.addEventListener('visibilitychange',()=>{const inst=window.p5&&p5.instance;if(document.hidden){if(typeof noLoop==='function')noLoop();else if(inst)inst.noLoop()}else{if(typeof loop==='function')loop();else if(inst)inst.loop()}});
const isCanvasEvent=e=>!e||!e.target||e.target.tagName==='CANVAS';
function mouseMoved(){if(uiHover)return;mouse.lastMove=millis()/1000}function mouseDragged(){if(uiHover)return;mouse.lastMove=millis()/1000}function touchMoved(){if(uiHover)return;mouse.lastMove=millis()/1000;return false}
function mousePressed(e){if(!isCanvasEvent(e)||uiHover)return false;mouse.lastMove=millis()/1000;press={t:millis(),x:mouseX,y:mouseY,fired:false};return false}
function mouseReleased(e){if(!press)return false;const dur=millis()-press.t,moved=Math.hypot(mouseX-press.x,mouseY-press.y);if(!press.fired&&dur<520&&moved<16){const near=Math.hypot(cr.x-mouse.hit.x,cr.z-mouse.hit.z)<CFG.personal+90;clickBurst=millis()-lastClickT<600?clickBurst+1:1;lastClickT=millis();if(near&&clickBurst>=3)threat+=.6;const p={x:mouse.hit.x,z:mouse.hit.z};clearTimeout(clickTimer);clickTimer=setTimeout(()=>startleAt(p),210)}press=null;return false}
function doubleClicked(e){if(!isCanvasEvent(e)||uiHover)return false;if(press)press.fired=true;clearTimeout(clickTimer);cr.startle=0;plantCrystal(mouse.hit);return false}
function startleAt(p){p=p||mouse.hit;shocks.push({x:p.x,z:p.z,t:0});cr.fleeA=Math.atan2(cr.z-p.z,cr.x-p.x);cr.startle=Math.hypot(cr.x-p.x,cr.z-p.z)<420?CFG.startle:.5;triggerGlitch()}
function updatePress(){if(!press||press.fired||!mouseIsPressed)return;if(millis()-press.t>620&&Math.hypot(mouseX-press.x,mouseY-press.y)<16){press.fired=true;plantCrystal(mouse.hit)}}
function plantCrystal(p){const x=clamp(p.x,-CFG.arena+40,CFG.arena-40),z=clamp(p.z,-CFG.arena+40,CFG.arena-40);if(crystals.length>=4)crystals.shift();crystals.push({x,z,e:1,t:0,rot:Math.random()*TWO_PI});shocks.push({x,z,t:0});triggerGlitch()}
function triggerGlitch(dur=260){const el=document.getElementById('stage');if(!el||reduceMotion)return;el.classList.remove('glitch');void el.offsetWidth;el.classList.add('glitch');clearTimeout(glitchTimer);glitchTimer=setTimeout(()=>el.classList.remove('glitch'),dur)}
function draw(){const dt=Math.min(deltaTime/1000,.05);elapsed+=dt;updatePress();updateEnvironment(dt);applyEnvToCreature(dt);if(window.NF_ECO)window.NF_ECO.tick(dt);clear();updateCamera(dt);updateMouseHit();updateCreature(dt);drawFloor();drawFootprints(dt);drawShadow();drawShocks(dt);drawSonar(dt);drawMats(dt);drawReticle();drawVent(dt);drawCrystals(dt);drawDecor(dt);ambientLight(52,56,96);directionalLight(110,140,215,.4,.7,-.6);pointLight(255,46,147,mouse.hit.x,-70,mouse.hit.z);pointLight(25,242,255,cr.x,-360,cr.z);pointLight(255,92,36,vent.x,-70,vent.z);drawCreature(dt);if(millis()-lastHudT>200){lastHudT=millis();updateHud()}if(window.NF_AUDIO)window.NF_AUDIO.update()}
function updateCamera(dt){const mx=(mouseX/width-.5)||0,my=(mouseY/height-.5)||0,k=reduceMotion?0:.35;cam.yaw=lerp(cam.yaw,.6+mx*k,smooth(dt,2));cam.pitch=lerp(cam.pitch,.44+my*.12*(reduceMotion?0:1),smooth(dt,2));cam.cx=lerp(cam.cx,cr.x*.55,smooth(dt,1.6));cam.cz=lerp(cam.cz,cr.z*.55,smooth(dt,1.6));const cp=Math.cos(cam.pitch),c=V(cam.cx,-30,cam.cz);cam.eye=V(c.x+Math.sin(cam.yaw)*cp*cam.dist,c.y-Math.sin(cam.pitch)*cam.dist,c.z+Math.cos(cam.yaw)*cp*cam.dist);cam.fwd=norm(sub(c,cam.eye));perspective(cam.fov,width/height,20,6000);const sh=ENV.shake*(reduceMotion?0:1),sx=sh?Math.sin(elapsed*97)*11*sh:0,sy=sh?Math.cos(elapsed*83)*7*sh:0,sz=sh?Math.sin(elapsed*71)*9*sh:0;camera(cam.eye.x+sx,cam.eye.y+sy,cam.eye.z+sz,c.x+sx*.6,c.y+sy*.6,c.z+sz*.6,0,1,0)}
function updateMouseHit(){const right=norm(cross(cam.fwd,V(0,1,0))),down=cross(right,cam.fwd),tn=Math.tan(cam.fov/2),nx=(mouseX/width)*2-1,ny=(mouseY/height)*2-1,d=norm(add(add(cam.fwd,mul(right,nx*tn*(width/height))),mul(down,ny*tn)));let p;if(d.y>.03){const t=-cam.eye.y/d.y;p=V(cam.eye.x+d.x*t,0,cam.eye.z+d.z*t)}else{const h=Math.hypot(d.x,d.z)||1;p=V(cam.eye.x+d.x/h*1500,0,cam.eye.z+d.z/h*1500)}const r=Math.hypot(p.x,p.z);if(r>CFG.arena+40){p.x*= (CFG.arena+40)/r;p.z*=(CFG.arena+40)/r}mouse.hit=mix(mouse.hit,p,.6)}
function updateCreature(dt){const active=elapsed-mouse.lastMove<4.5&&!uiHover,M=mouse.hit,dx=M.x-cr.x,dz=M.z-cr.z,dm=Math.hypot(dx,dz),sv=cr.survival||{};let angle=cr.a,want=0;
 cr.defensive=Math.max(0,cr.defensive-dt);cr.satisfied=Math.max(0,cr.satisfied-dt);cr.glow=Math.max(0,cr.glow-dt*1.35);cr.overT=Math.max(0,cr.overT-dt);
 const sp=Math.hypot(mouseX-(mouse.px||mouseX),mouseY-(mouse.py||mouseY))/Math.max(dt,1e-3);mouse.px=mouseX;mouse.py=mouseY;mouse.speed=sp;
 if(!uiHover&&dm<CFG.personal+140&&sp>820)threat+=dt*(sp/2300);else threat=Math.max(0,threat-dt*.5);
 if(threat>1&&cr.defensive<=0){threat=0;cr.defensive=CFG.defensive;cr.startle=0;shocks.push({x:cr.x,z:cr.z,t:0});triggerGlitch();if(window.NF_AUDIO)window.NF_AUDIO.event('defense',{x:cr.x,z:cr.z})}
 let food=null,foodD=1e9,foodKind=null;
 for(const c of crystals){const d=Math.hypot(c.x-cr.x,c.z-cr.z);if(d<foodD){foodD=d;food=c;foodKind='crystal'}}
 for(const m of mats){const d=Math.hypot(m.x-cr.x,m.z-cr.z);if(d<foodD){foodD=d;food=m;foodKind='mat'}}
 const idle=elapsed-mouse.lastMove,ventD=Math.hypot(cr.x-vent.x,cr.z-vent.z),ventCold=clamp((ventD-330)/220,0,1);
 if(cr.dormant&&active&&dm<CFG.approach)cr.dormant=false;
 cr.cold=lerp(cr.cold,clamp(ventCold*.55+cr.airCold*.95,0,1),smooth(dt,1.4));cr.warm=lerp(cr.warm,clamp(1-Math.abs(ventD-CFG.ventComfort)/160,0,1),smooth(dt,1.4));
 const chill=Math.min(1-cr.airCold*.5,1-ventCold*.55),acidSlow=1-.45*cr.acidShield;
 const eruptDanger=ENV.eruptT>0&&ventD<780,pressureDanger=ENV.GEYSER_PSI>700&&ventD<400;
 if((eruptDanger||pressureDanger)&&cr.startle<=0){cr.startle=.9;cr.fleeA=Math.atan2(cr.z-vent.z,cr.x-vent.x)}
 if(cr.defensive>0){cr.state='defensive';want=0;cr.feedPoint=null}
 else if(cr.satisfied>0){cr.state='satisfied';want=0;cr.feedPoint=null}
 else if(cr.startle>0){cr.startle-=dt;angle=Math.hypot(cr.x,cr.z)>CFG.arena*.85?Math.atan2(-cr.z,-cr.x):cr.fleeA;want=CFG.flee*Math.min(1,Math.max(0,cr.startle)/.4);cr.state='startled';cr.feedPoint=null}
 else if(sv.mode==='challenge'&&sv.target){const tx=sv.target.x-cr.x,tz=sv.target.z-cr.z;angle=Math.atan2(tz,tx);want=Math.min(CFG.walk*.98,Math.hypot(tx,tz)*1.2)*chill;cr.state='trial';cr.feedPoint=null}
 else if(food&&foodD<CFG.feedRange){cr.dormant=false;if(foodD>CFG.feedStop){angle=Math.atan2(food.z-cr.z,food.x-cr.x);want=Math.min(CFG.walk*.95,26+(foodD-CFG.feedStop)*.35)*chill;cr.state='feeding'}else{want=0;cr.state='feeding';food.e-=dt*CFG.absorb;if(food.e<=0){if(foodKind==='mat'){cr.symbiont=food.color;cr.symbiontName=food.type;ENV.symbiont=food.type;mats.splice(mats.indexOf(food),1);cr.satisfied=3.2;cr.glow=1;cr.fed++;if(window.NF_ECO)window.NF_ECO.onFeed('mat');if(window.NF_AUDIO)window.NF_AUDIO.event('absorb',{x:food.x,z:food.z});shocks.push({x:food.x,z:food.z,t:0});triggerGlitch(380);logTerminal(`共生完成 // ${FEED_NAMES[food.type]} 色素已寫入背甲與足跡。`,'ok');if(ENV.ui&&ENV.ui.feedTag){ENV.ui.feedTag.textContent=food.type;ENV.ui.feedTag.dataset.mode=food.type;ENV.ui.feedTag.style.color=`rgb(${food.color.join(',')})`}}else{crystals.splice(crystals.indexOf(food),1);cr.satisfied=2.8;cr.glow=1;cr.fed++;if(window.NF_ECO)window.NF_ECO.onFeed('crystal');if(window.NF_AUDIO)window.NF_AUDIO.event('absorb',{x:food.x,z:food.z});shocks.push({x:food.x,z:food.z,t:0});triggerGlitch()}}}cr.feedPoint=V(food.x,-24,food.z)}
 else if(sv.mode==='migrate'&&sv.urgent&&sv.target){const tx=sv.target.x-cr.x,tz=sv.target.z-cr.z;angle=Math.atan2(tz,tx);want=Math.hypot(tx,tz)>28?CFG.walk*.94*chill:0;cr.state='migrating';cr.dormant=false;cr.feedPoint=null}
 else if(sv.mode==='cluster'&&(sv.urgent||!active)&&sv.target){const tx=sv.target.x-cr.x,tz=sv.target.z-cr.z;angle=Math.atan2(tz,tx);want=Math.hypot(tx,tz)>30?Math.min(CFG.walk*.88,24+Math.hypot(tx,tz)*.45)*chill:0;cr.state='clustering';cr.dormant=false;cr.feedPoint=null}
 else if(ENV.AIR_TEMP<0&&ventD>CFG.ventR+24){cr.dormant=false;angle=Math.atan2(vent.z-cr.z,vent.x-cr.x);want=ventD>CFG.ventComfort+20?CFG.walk*.92*chill:0;cr.state='warming';cr.feedPoint=null}
 else if(ventD<CFG.ventR){angle=Math.atan2(cr.z-vent.z,cr.x-vent.x);want=92;cr.state='overheat';cr.feedPoint=null;if(cr.overT<=0){cr.overT=.9;const a=Math.atan2(cr.z-vent.z,cr.x-vent.x)+Math.PI;cr.wander=V(vent.x+Math.cos(a)*CFG.ventComfort,0,vent.z+Math.sin(a)*CFG.ventComfort);cr.wanderT=3;triggerGlitch()}}
 else if(cr.dormant||idle>CFG.dormant){cr.dormant=true;cr.state='dormant';want=0;cr.feedPoint=null}
 else if(active){if(dm>CFG.approach){angle=Math.atan2(dz,dx);want=Math.min(CFG.walk,22+(dm-CFG.approach)*.5)*chill;cr.state='curious'}else if(dm<CFG.personal){angle=Math.atan2(-dz,-dx);want=46*chill;cr.state='wary'}else{angle=Math.atan2(dz,dx);cr.state='watch'}cr.feedPoint=null}
 else{let target=null;if(sv.mode==='explore'&&sv.target)target=sv.target;if(!target){cr.wanderT-=dt;if(cr.wanderT<=0){const a=Math.random()*TWO_PI;if(ventD>170){const rr=150+Math.random()*80;cr.wander=V(vent.x+Math.cos(a)*rr,0,vent.z+Math.sin(a)*rr)}else{const rr=80+Math.random()*300;cr.wander=V(Math.cos(a)*rr,0,Math.sin(a)*rr)}cr.wanderT=4+Math.random()*3}target=cr.wander}const wx=target.x-cr.x,wz=target.z-cr.z,wd=Math.hypot(wx,wz);angle=Math.atan2(wz,wx);want=wd>50?42*chill:0;cr.state=want?(target===cr.wander&&ventD<CFG.ventComfort+80?'warming':'exploring'):'idle';cr.feedPoint=null}
 if(cr.startle<=0&&cr.state!=='startled')want*=acidSlow;
 if(cr.heatStress>.45&&(cr.state==='watch'||cr.state==='idle'||cr.state==='wander'))cr.state='cooling';
 if(cr.acidShield>.4&&(cr.state==='watch'||cr.state==='idle'))cr.state='shielded';
 if(ENV.sonarT>0&&(cr.state==='watch'||cr.state==='idle'||cr.state==='wander'||cr.state==='cooling'||cr.state==='shielded'||cr.state==='resonating'))cr.state='resonating';
 cr.sink=lerp(cr.sink,(cr.state==='dormant'||cr.state==='defensive')?1:cr.acidShield*.75,smooth(dt,2.2));
 let da=angle-cr.a;while(da>Math.PI)da-=TWO_PI;while(da< -Math.PI)da+=TWO_PI;const turn=(cr.startle>0?7:cr.defensive>0?0:2.4)*dt;cr.a+=clamp(da,-turn,turn);if(Math.abs(da)>1)want*=.2;cr.v+=(want-cr.v)*smooth(dt,4);cr.x+=Math.cos(cr.a)*cr.v*dt;cr.z+=Math.sin(cr.a)*cr.v*dt;const r=Math.hypot(cr.x,cr.z);if(r>CFG.arena){cr.x*=CFG.arena/r;cr.z*=CFG.arena/r}cr.phase+=cr.v*dt*.09;cr.bob=Math.sin(cr.phase*2)*2.4*Math.min(1,cr.v/40)+Math.sin(elapsed*2.1)*.9}
function applyEnvToCreature(dt){
 const cold=clamp(-ENV.AIR_TEMP/22,0,1),heat=clamp((ENV.AIR_TEMP-45)/15,0,1),acid=clamp((3-ENV.PH_LEVEL)/2,0,1),alk=clamp((ENV.PH_LEVEL-10)/2,0,1);
 cr.airCold=lerp(cr.airCold,cold,smooth(dt,2.2));cr.heatStress=lerp(cr.heatStress,heat,smooth(dt,2.4));
 cr.acidShield=lerp(cr.acidShield,acid,smooth(dt,3.2));cr.alkaline=lerp(cr.alkaline,alk,smooth(dt,3));
 cr.shiver=cr.airCold*(reduceMotion?0:1);
 antennaClock+=dt*(1-.55*cr.airCold+.12*cr.alkaline);
}
function updateEnvironment(dt){
 if(ENV.eruptT>0){
  ENV.eruptT=Math.max(0,ENV.eruptT-dt);
  ENV.GEYSER_PSI=clamp(1000*(ENV.eruptT/ENV.eruptTotal),0,1000);
  ENV.shake=Math.min(1,ENV.shake+dt*2.6);
  if(!reduceMotion&&elapsed-lastGlitchT>1.1){lastGlitchT=elapsed;triggerGlitch(300)}
  if(ENV.eruptT<=0){ENV.GEYSER_PSI=0;ENV.cooldown=7;logTerminal('壓力歸零 // 噴發結束，生物逐漸冷靜。','warn')}
 }else{
  ENV.cooldown=Math.max(0,ENV.cooldown-dt);ENV.shake=Math.max(0,ENV.shake-dt*1.8);
  if(ENV.cooldown<=0&&ENV.GEYSER_PSI<750){ENV.GEYSER_PSI=clamp(ENV.GEYSER_PSI+dt*ENV.autoRate,0,1000);if(ENV.GEYSER_PSI>=750)triggerEruption('auto')}
 }
 if(ENV.GEYSER_PSI>620)ENV.shake=Math.max(ENV.shake,(ENV.GEYSER_PSI-620)/380*.16);
 ENV.sonarT=Math.max(0,ENV.sonarT-dt);
 updateEruptionParticles(dt);
}
function updateEruptionParticles(dt){
 if(ENV.eruptT>0){eruptAccum+=dt*(reduceMotion?44:170);while(eruptAccum>=1){eruptAccum-=1;spawnEruptParticle()}}
 for(let i=eruptParticles.length-1;i>=0;i--){const p=eruptParticles[i];p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy+=150*dt;p.vx*=.995;p.vz*=.995;if(p.life>p.max||p.y>30)eruptParticles.splice(i,1)}
 if(eruptParticles.length>460)eruptParticles.splice(0,eruptParticles.length-460);
}
function spawnEruptParticle(){
 const a=Math.random()*TWO_PI,r=Math.random()*24;
 eruptParticles.push({x:vent.x+Math.cos(a)*r,y:-88-Math.random()*16,z:vent.z+Math.sin(a)*r,vx:Math.cos(a)*(20+Math.random()*100),vy:-(220+Math.random()*400),vz:Math.sin(a)*(20+Math.random()*100),life:0,max:1.2+Math.random()*1.5,size:1.6+Math.random()*4.6});
}
function triggerEruption(source){
 if(ENV.eruptT>0)return false;
 ENV.eruptTotal=4.8;ENV.eruptT=ENV.eruptTotal;ENV.GEYSER_PSI=1000;ENV.shake=1;eruptParticles.length=0;
 const d=Math.hypot(cr.x-vent.x,cr.z-vent.z);
 if(d<780){cr.startle=Math.max(cr.startle,1.9);cr.fleeA=Math.atan2(cr.z-vent.z,cr.x-vent.x);cr.wanderT=0;shocks.push({x:vent.x,z:vent.z,t:0})}
 triggerGlitch(520);syncEnvControls();if(window.NF_AUDIO)window.NF_AUDIO.event('eruption');
 logTerminal(source==='cmd'?'指令接受：FORCE ERUPT // 熱液柱噴發中。':source==='auto'?'地熱壓力臨界 // 間歇泉自然噴發！':'手動壓力超載 // 間歇泉噴發！',source==='cmd'?'warn':'err');
 return true;
}
function spawnCulture(kind,at){
 const type=String(kind||'').toUpperCase(),color=FEED_COLORS[type];
 if(!color)return false;
 let x,z;
 if(at){x=at.x;z=at.z}else{const dist=175;x=cr.x+Math.cos(cr.a)*dist;z=cr.z+Math.sin(cr.a)*dist;if(Math.hypot(x,z)>CFG.arena-60){x=cr.x-Math.cos(cr.a)*dist;z=cr.z-Math.sin(cr.a)*dist}}
 x=clamp(x,-CFG.arena+50,CFG.arena-50);z=clamp(z,-CFG.arena+50,CFG.arena-50);
 mats.push({x,z,type,color,e:1,t:0,rot:Math.random()*TWO_PI});
 while(mats.length>6)mats.shift();
 shocks.push({x,z,t:0});triggerGlitch(300);if(window.NF_AUDIO)window.NF_AUDIO.event('feed',{x,z});
 logTerminal(`THERMO_FEED // 已投放 ${FEED_NAMES[type]} 群落（${Math.round(x)}, ${Math.round(z)}）。`,'ok');
 if(ENV.ui&&ENV.ui.feedTag){ENV.ui.feedTag.textContent='DEPLOYED '+type;ENV.ui.feedTag.dataset.mode=type;ENV.ui.feedTag.style.color=`rgb(${color.join(',')})`}
 return true;
}
function fireSonar(){
 ENV.sonarT=3.4;ENV.sonarAt=V(mouse.hit.x,-56,mouse.hit.z);
 sonarPulses.push({x:mouse.hit.x,z:mouse.hit.z,t:0});
 shocks.push({x:mouse.hit.x,z:mouse.hit.z,t:0});triggerGlitch(320);if(window.NF_AUDIO)window.NF_AUDIO.event('sonar',{x:mouse.hit.x,z:mouse.hit.z});
 logTerminal('SONAR PULSE // 全場聲納脈衝發射，六根觸角同步共振。','warn');
}
function bioStats(){
 const ventD=Math.hypot(cr.x-vent.x,cr.z-vent.z);
 const coreTemp=cr.localTemp!=null?cr.localTemp:ENV.AIR_TEMP+Math.max(0,1-ventD/460)*34+cr.heatStress*4;
 const armor=clamp(44+cr.acidShield*38+(cr.defensive>0?12:0)+(cr.airCold>.2?6:0),0,100);
 const acidRes=clamp(16+cr.acidShield*76+cr.airCold*4,0,100);
 const symEnergy=clamp(cr.symbiosis||0,0,100);
 return{coreTemp,armor,acidRes,symEnergy,ventD,energy:cr.energy||0,habitat:cr.habitat||0,vitality:cr.vitality||0};
}
function basis(){const sh=cr.shiver||0,jx=reduceMotion?0:Math.sin(elapsed*53)*sh*1.8,jz=reduceMotion?0:Math.cos(elapsed*47)*sh*1.6,jy=reduceMotion?0:Math.sin(elapsed*61)*sh*1.2;return{F:V(Math.cos(cr.a),0,Math.sin(cr.a)),S:V(-Math.sin(cr.a),0,Math.cos(cr.a)),U:V(0,-1,0),B:V(cr.x+jx,-(BODY.h+cr.bob-9*cr.sink)-jy,cr.z+jz)}}
const local=(b,f,u,s)=>add(add(add(b.B,mul(b.F,f)),mul(b.U,u)),mul(b.S,s));

function buildFloorGrid(){
 const n=8,step=80;gridSegs=[];boundarySegs=[];
 for(let i=-n;i<=n;i++)for(let j=-n;j<n;j++){const a=j*step,b=(j+1)*step,k=i*step;gridSegs.push(k,a,k,b);gridSegs.push(a,k,b,k)}
 const R=n*step+60;
 for(let i=0;i<72;i++){const a0=i/72*TWO_PI,a1=(i+1)/72*TWO_PI;boundarySegs.push(Math.cos(a0)*R,Math.sin(a0)*R,Math.cos(a1)*R,Math.sin(a1)*R)}
}
function drawThermalField(){
 push();translate(vent.x,-1,vent.z);blendMode(ADD);noStroke();
 const gl=drawingContext;gl.depthMask(false);/* coplanar translucent bands: no depth write, avoids z-fight flicker */
 const bands=9;
 for(let i=bands-1;i>=0;i--){
  const t=i/(bands-1),r=CFG.ventR+24+t*390,c=mixCol([255,78,28],[62,176,255],t);
  fill(c[0],c[1],c[2],7+10*(1-t));
  beginShape();for(let k=0;k<=64;k++){const a=k/64*TWO_PI;vertex(Math.cos(a)*r,0,Math.sin(a)*r)}endShape(CLOSE);
 }
 gl.depthMask(true);blendMode(BLEND);noFill();
 for(let i=0;i<6;i++){const t=i/5,c=mixCol([255,120,52],[62,190,255],t);stroke(c[0],c[1],c[2],24+18*(1-t));strokeWeight(1);ring(0,0,CFG.ventR+t*400,4,48)}
 pop();
}
function drawFloor(){
 const frost=clamp(-ENV.AIR_TEMP/20,0,1),heat=clamp((ENV.AIR_TEMP-30)/30,0,1);
 floorCol=mixCol(mixCol(C.cyan,[222,246,255],frost),[255,120,60],heat*.3);
 if(frost>.03){push();translate(0,-.9,0);noStroke();fill(198,238,255,8+16*frost);drawingContext.depthMask(false);beginShape();for(let i=0;i<=48;i++){const a=i/48*TWO_PI;vertex(Math.cos(a)*650,0,Math.sin(a)*650)}endShape(CLOSE);drawingContext.depthMask(true);pop()}
 drawThermalField();
 strokeWeight(1);stroke(floorCol[0],floorCol[1],floorCol[2],40+24*frost);
 beginShape(LINES);for(let i=0;i<gridSegs.length;i+=4){vertex(gridSegs[i],0,gridSegs[i+1]);vertex(gridSegs[i+2],0,gridSegs[i+3])}endShape();
 floorRipples(cr.x,cr.z,300,C.cyan,30);floorRipples(mouse.hit.x,mouse.hit.z,220,C.cyan,24);
 stroke(...C.pink,70);strokeWeight(2);beginShape(LINES);for(let i=0;i<boundarySegs.length;i+=4){vertex(boundarySegs[i],0,boundarySegs[i+1]);vertex(boundarySegs[i+2],0,boundarySegs[i+3])}endShape();
}
function floorRipples(x,z,r,col,a){
 push();translate(x,0,z);noFill();
 const n=5,seg=44;
 for(let i=0;i<n;i++){
  const p=reduceMotion ? .12+i*.18 : (elapsed*.2+i/n)%1;
  const rr=r*(.14+.86*p),aa=a*(1-p);
  if(aa<1)continue;
  stroke(col[0],col[1],col[2],aa);
  strokeWeight(p<.2?1.3:.8);
  beginShape(LINES);
  for(let k=0;k<seg;k++){
   const a0=k/seg*TWO_PI,a1=(k+1)/seg*TWO_PI;
   vertex(Math.cos(a0)*rr,-.6,Math.sin(a0)*rr);
   vertex(Math.cos(a1)*rr,-.6,Math.sin(a1)*rr);
  }
  endShape();
 }
 pop();
}
function drawShadow(){const b=basis(),q=[[1,1],[1,-1],[-1,-1],[-1,1]].map(([f,s])=>add(V(b.B.x,-.4,b.B.z),add(mul(b.F,f*BODY.hx*1.1),mul(b.S,s*BODY.hz*1.05))));noStroke();fill(0,0,0,120);beginShape();q.forEach(p=>vertex(p.x,p.y,p.z));endShape(CLOSE)}
function drawShocks(dt){noFill();for(let i=shocks.length-1;i>=0;i--){const s=shocks[i];s.t+=dt;if(s.t>1.1){shocks.splice(i,1);continue}const fade=1-s.t/1.1;for(let k=0;k<2;k++){const r=(s.t-k*.12)*520;if(r<=0)continue;stroke(k?C.cyan[0]:C.pink[0],k?C.cyan[1]:C.pink[1],k?C.cyan[2]:C.pink[2],230*fade);strokeWeight(k?1.5:3);ring(s.x,s.z,r,6,36)}}}
function ring(x,z,r,n,seg){beginShape(LINES);for(let i=0;i<seg;i++){const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;vertex(x+Math.cos(a0)*r,-.6,z+Math.sin(a0)*r);vertex(x+Math.cos(a1)*r,-.6,z+Math.sin(a1)*r)}endShape()}
function drawSonar(dt){
 for(let i=sonarPulses.length-1;i>=0;i--){const s=sonarPulses[i];s.t+=dt;if(s.t>2.6){sonarPulses.splice(i,1);continue}const fade=1-s.t/2.6;
  for(let k=0;k<3;k++){const tt=s.t-k*.16;if(tt<=0)continue;noFill();stroke(C.cyan[0],C.cyan[1],C.cyan[2],150*fade*(1-k*.2));strokeWeight(k?1:2);ring(s.x,s.z,tt*560,4,40)}}
 if(ENV.sonarT>0&&ENV.sonarAt){const a=ENV.sonarAt,pulse=.5+.5*Math.sin(elapsed*8);
  push();translate(a.x,-1,a.z);noFill();stroke(...C.cyan,120*pulse);strokeWeight(1.5);ring(0,0,40+18*pulse,4,36);pop();
  push();translate(a.x,0,a.z);stroke(...C.cyan,60+60*pulse);strokeWeight(1);line(0,0,0,0,-260,0);pop();
  push();translate(a.x,a.y,a.z);blendMode(ADD);noStroke();fill(25,242,255,40*pulse);sphere(9,8,6);blendMode(BLEND);pop()}
}
function drawMats(dt){
 for(const m of mats){m.t+=dt;const pulse=.7+.3*Math.sin(m.t*3+m.rot),col=m.color;
  push();translate(m.x,-1,m.z);noStroke();fill(col[0],col[1],col[2],12*pulse);beginShape();for(let i=0;i<=36;i++){const a=i/36*TWO_PI;vertex(Math.cos(a)*38,0,Math.sin(a)*38)}endShape(CLOSE);
  for(let i=0;i<4;i++){noFill();stroke(col[0],col[1],col[2],(92-i*19)*pulse);strokeWeight(1.2);ring(0,0,15+i*9+pulse*3,4,30)}
  blendMode(ADD);noStroke();for(let j=0;j<6;j++){const ang=m.rot+j*1.7+m.t*.4,rr=9+j*4.6,yy=-3-((m.t*20+j*13)%42);fill(col[0],col[1],col[2],120*pulse);push();translate(Math.cos(ang)*rr,yy,Math.sin(ang)*rr);sphere(1.7,6,4);pop()}
  fill(col[0],col[1],col[2],8*pulse);cylinder(4,58,6);blendMode(BLEND);pop();
  push();translate(m.x,-3,m.z);noFill();stroke(col[0],col[1],col[2],80*pulse);strokeWeight(1);line(0,0,0,0,-34-10*pulse,0);pop()}
}
function drawReticle(){const M=mouse.hit,c=cr.defensive>0?[255,80,96]:cr.state==='overheat'?[255,120,60]:cr.state==='feeding'?[120,255,170]:cr.state==='wary'?C.amber:C.cyan,R=26,rot=elapsed*1.4;stroke(...c,240);strokeWeight(2);noFill();for(let i=0;i<3;i++){const a=rot+i/3*TWO_PI,b=rot+(i+1)/3*TWO_PI;line(M.x+Math.cos(a)*R,-1,M.z+Math.sin(a)*R,M.x+Math.cos(b)*R,-1,M.z+Math.sin(b)*R)}strokeWeight(1);stroke(...c,110);ring(M.x,M.z,R*1.9,4,4);line(M.x,0,M.z,M.x,-70,M.z);push();translate(M.x,-74,M.z);noStroke();fill(...c);sphere(2.6,5,4);pop()}
function drawDecor(dt){noFill();for(const d of decor){if(!reduceMotion)d.r+=dt*d.sp;push();translate(d.x,d.y+Math.sin(elapsed*.6+d.r)*(reduceMotion?0:10),d.z);rotateY(d.r);rotateX(d.r*.6);stroke(...(d.m?C.pink:C.cyan),70);strokeWeight(1.3);octa(d.s);pop()}}
function octa(s){const p=[[s,0,0],[-s,0,0],[0,s*1.3,0],[0,-s*1.3,0],[0,0,s],[0,0,-s]];beginShape(LINES);for(const a of [0,1])for(const b of [2,3])for(const c of [4,5]){vertex(...p[a]);vertex(...p[b]);vertex(...p[b]);vertex(...p[c]);vertex(...p[c]);vertex(...p[a])}endShape()}

function drawVent(dt){const vd=Math.hypot(cr.x-vent.x,cr.z-vent.z),heat=clamp(1-vd/420,0,1),pressure=clamp(ENV.GEYSER_PSI/1000,0,1);
 push();translate(vent.x,-6,vent.z);noStroke();fill(16,14,22);cylinder(58,12,10);pop();
 push();translate(vent.x,-27,vent.z);noStroke();fill(12,11,18);cylinder(37,42,8);pop();
 push();translate(vent.x,-54,vent.z);noStroke();fill(9,8,14);cylinder(26,32,8);pop();
 push();translate(vent.x,-76,vent.z);noStroke();fill(21,14,19);cone(22,26,8,1,true);pop();
 push();translate(vent.x,-87,vent.z);rotateX(HALF_PI);noFill();stroke(255,96,42,120+100*Math.abs(Math.sin(elapsed*2.2)));strokeWeight(2.2);torus(19,3,8,10);pop();
 noFill();stroke(255,88,36,35+55*heat+40*pressure);strokeWeight(1.2);ring(vent.x,vent.z,CFG.ventR+Math.sin(elapsed*2)*4,4,40);stroke(70,255,168,38+28*heat);strokeWeight(1);ring(vent.x,vent.z,CFG.ventR*.74,4,34);stroke(25,242,255,30+22*heat);strokeWeight(1);ring(vent.x,vent.z,CFG.ventR*.52,4,30);
 if(pressure>.58){stroke(255,72,48,(.3+.7*Math.abs(Math.sin(elapsed*(8+pressure*12))))*170);strokeWeight(1.6);ring(vent.x,vent.z,CFG.ventR+18+Math.sin(elapsed*3)*7,4,44)}
 if(ventParticles.length<120+Math.round(80*pressure))ventParticles.push({x:(Math.random()-.5)*28,y:58+Math.random()*22,z:(Math.random()-.5)*28,r:Math.random()*TWO_PI,sp:34+Math.random()*48,life:0,max:2.1+Math.random()*1.8});
 for(let i=ventParticles.length-1;i>=0;i--){const p=ventParticles[i];p.life+=dt;p.y+=p.sp*dt;p.r+=dt*1.7;if(p.life>p.max)ventParticles.splice(i,1)}
 blendMode(ADD);strokeWeight(2.2);
 for(let kb=0;kb<3;kb++)for(let ab=0;ab<4;ab++){
  stroke(255,150+80*(kb+.5)/3,58,175*(ab+.5)/4);
  beginShape(LINES);
  for(const p of ventParticles){const k=1-p.life/p.max,a=k*k;if(Math.min(2,Math.floor(k*3))!==kb||Math.min(3,Math.floor(a*4))!==ab)continue;const mx=Math.sin(p.r)*10*k,mz=Math.cos(p.r*.8)*10*k;vertex(vent.x+p.x+mx,-p.y,vent.z+p.z+mz);vertex(vent.x+p.x+mx*.55,-p.y-11,vent.z+p.z+mz*.55)}
  endShape();
 }
 blendMode(BLEND);
 drawEruptionPlume();
}
function drawEruptionPlume(){
 if(ENV.eruptT<=0&&!eruptParticles.length)return;
 const k=clamp(ENV.eruptT/ENV.eruptTotal,0,1);blendMode(ADD);
 if(ENV.eruptT>0){
  push();translate(vent.x,-90,vent.z);stroke(255,132,58,70*k);strokeWeight(16);line(0,0,0,Math.sin(elapsed*4)*10,-300,Math.sin(elapsed*3)*12);stroke(255,220,160,40*k);strokeWeight(5);line(0,0,0,Math.sin(elapsed*5)*6,-330,Math.cos(elapsed*4)*8);pop();
  for(let i=0;i<14;i++){const q=i/14,sway=Math.sin(elapsed*3.4+i*.7)*(8+i*2.4);push();translate(vent.x+sway,-110-q*280,vent.z+Math.cos(elapsed*2.6+i)*10);noStroke();fill(255,145+70*q,70,(34-18*q)*(0.55+0.45*k));sphere(26+q*24,8,6);pop()}
 }
 for(const p of eruptParticles){const a=Math.pow(1-p.life/p.max,1.4),c=mixCol([255,238,190],[255,58,20],Math.min(1,.25+p.life/p.max*1.15));push();translate(p.x,p.y,p.z);noStroke();fill(c[0],c[1],c[2],195*a);sphere(p.size*(.6+a*.85),6,4);pop()}
 blendMode(BLEND);
}
function drawCrystals(dt){for(const c of crystals){c.t+=dt;const e=Math.max(0,c.e),pulse=.7+.3*Math.sin(c.t*5+c.rot),y=-22-e*8+Math.sin(c.t*2+c.rot)*3,s=20+14*e;
 noFill();stroke(...C.cyan,55*pulse);strokeWeight(1.2);ring(c.x,c.z,42+16*(1-e),4,28);
 push();translate(c.x,y,c.z);rotateY(c.t*.9+c.rot);blendMode(ADD);
 noStroke();fill(...C.cyan,9*pulse);cylinder(9,70,8);
 fill(...C.cyan,18*pulse);sphere(s*.95,12,10);fill(255,255,255,16*pulse);sphere(s*.32,8,6);
 blendMode(BLEND);
 stroke(255,255,255,230);strokeWeight(1.3);octa(s*.72);
 stroke(...C.cyan,190);strokeWeight(2.8);octa(s);
 stroke(...C.pink,90);strokeWeight(1);line(0,-s*2.1,0,0,s*.2,0);
 pop();
 push();translate(c.x,-2,c.z);noStroke();fill(...C.cyan,150*pulse);sphere(2.6,6,4);pop();
}}
function spawnFootprint(f,L){footprints.push({x:f.x,z:f.z,t:0,life:1.6,rot:cr.a+((L&&L.s<0)?0:Math.PI)});if(footprints.length>56)footprints.shift();if(window.NF_AUDIO)window.NF_AUDIO.event('step',{x:f.x,z:f.z})}
function drawFootprints(dt){const col=cr.symbiont||C.cyan,col2=cr.symbiont?mixCol(cr.symbiont,C.pink,.35):C.pink;for(let i=footprints.length-1;i>=0;i--){const f=footprints[i];f.t+=dt;if(f.t>f.life){footprints.splice(i,1);continue}const k=1-f.t/f.life,a=Math.pow(k,1.5);push();translate(f.x,-.9,f.z);rotateX(HALF_PI);rotateZ(f.rot);rectMode(CENTER);noStroke();fill(...col,22*a);rect(0,0,17,17);noFill();stroke(...col,170*a);strokeWeight(1.4+2.2*a);rect(0,0,21+11*(1-k),21+11*(1-k));stroke(...col2,70*a);strokeWeight(1);rect(0,0,30+14*(1-k),30+14*(1-k));pop()}}

function drawCreature(dt){const b=basis();stepLegs(b,dt);
 const def=cr.defensive>0,hot=cr.state==='overheat',dorm=cr.state==='dormant',sat=cr.satisfied>0||cr.glow>0;
 const acid=cr.acidShield>.32,heat=cr.heatStress,sym=cr.symbiont,symPulse=.5+.5*Math.sin(elapsed*3.4),glowCol=sym||C.cyan;
 const dormPulse=.3+.2*(.5+.5*Math.sin(elapsed*.55));
 const edge=def?[255,62,86]:acid?[255,184,0]:hot?[255,96,44]:dorm?mixCol([14,44,78],[44,112,168],dormPulse):sym||(sat?[255,255,255]:C.cyan);
 const warn=hot?.45+.55*Math.abs(Math.sin(elapsed*16)):heat>.35?.55+.45*Math.abs(Math.sin(elapsed*(10+26*heat))):1;
 const alpha=dorm?70+60*dormPulse:235;
 let hull=mixCol(mixCol(mixCol(C.hull,[12,38,96],cr.cold*.8),def?[78,18,30]:[52,40,42],def?.55:cr.warm*.3),[5,9,20],dorm?.7:0);
 hull=mixCol(hull,[38,110,132],sat?.32:0);if(acid)hull=mixCol(hull,[96,64,10],.38);if(sym)hull=mixCol(hull,sym,.12+symPulse*.1);
 if(cr.glow>0){const g=cr.glow;push();translate(b.B.x,b.B.y-6,b.B.z);blendMode(ADD);stroke(glowCol[0],glowCol[1],glowCol[2],130*g);strokeWeight(1.8);const R=62+(1-g)*44;beginShape(LINES);for(let i=0;i<12;i++){const a=i/12*TWO_PI+elapsed*.6,yy=Math.sin(i*1.9)*16;vertex(Math.cos(a)*40,yy,Math.sin(a)*40);vertex(Math.cos(a)*R,yy*1.4,Math.sin(a)*R)}endShape();noStroke();fill(glowCol[0],glowCol[1],glowCol[2],20*g);sphere(44,12,10);fill(255,255,255,14*g);sphere(24,8,6);blendMode(BLEND);pop()}
 obox(b.B,b,BODY.hx,BODY.hy,BODY.hz,hull,[...edge,alpha*warn],def?2.6:1.6);obox(add(b.B,mul(b.U,BODY.hy-1)),b,BODY.hx-12,2.5,BODY.hz-10,def?[54,12,20]:[18,20,40],[...C.pink,dorm?90:200],1.2);obox(add(b.B,mul(b.F,BODY.hx+1)),b,1.5,BODY.hy-5,BODY.hz-8,[14,16,34],[...C.amber,(dorm?90:220)*warn],1.2);
 if(acid){const gp=.6+.4*Math.sin(elapsed*4);wireBox(b.B,b,BODY.hx+8,BODY.hy+6,BODY.hz+8,[255,184,0,120*gp],1.2);wireBox(b.B,b,BODY.hx+15,BODY.hy+11,BODY.hz+15,[255,184,0,48*gp],1);push();translate(b.B.x,b.B.y,b.B.z);blendMode(ADD);noStroke();fill(255,184,0,20*gp);sphere(64,12,8);blendMode(BLEND);pop()}
 if(sym){push();translate(b.B.x,b.B.y,b.B.z);blendMode(ADD);noStroke();fill(sym[0],sym[1],sym[2],13+12*symPulse);sphere(62,12,8);blendMode(BLEND);pop();noFill();stroke(sym[0],sym[1],sym[2],55+45*symPulse);strokeWeight(1);push();translate(b.B.x,-6,b.B.z);rotateX(HALF_PI);ellipse(0,0,BODY.hx*2+26,BODY.hz*2+26);pop()}
 for(const L of legs){const le=acid?[255,184,0]:cr.cold>.05?mixCol(edge,[70,130,255],cr.cold*.6):edge;segBox(L.hip,L.knee,6.5,6.5,mixCol(C.upper,[10,30,70],cr.cold*.6),[...le,dorm?65:200],b.F);segBox(L.knee,L.foot,9.5,8.5,mixCol(C.lower,[14,36,80],cr.cold*.55),[...le,dorm?75:230],b.F);jointCube(L.knee,5,def?[255,90,100]:acid?[255,184,0]:dorm?[30,60,90]:C.amber)}updateAntennae(b,dt);for(const c of chains)drawChain(c);
 if(hot||heat>.28){const k=hot?warn:heat;push();translate(b.B.x,b.B.y-26,b.B.z);blendMode(ADD);noStroke();fill(hot?255:255,hot?94:120,hot?52:40,90*k);sphere(11+k*9,8,6);blendMode(BLEND);pop()}}
function stepLegs(b,dt){const speed=Math.abs(cr.v),dur=Math.max(.16,.3-speed*.0007),tuck=cr.defensive>0,feed=cr.state==='feeding';for(const L of legs){L.hip=local(b,L.f,-BODY.hy+4,L.s);let rest;if(tuck)rest=V(cr.x+b.F.x*L.f*.3+b.S.x*L.s*.22,0,cr.z+b.F.z*L.f*.3+b.S.z*L.s*.22);else if(feed&&!L.stepping&&L.f>0)rest=V(L.hip.x+b.F.x*14,0,L.hip.z+b.F.z*14);else rest=V(L.hip.x+b.F.x*speed*.28,0,L.hip.z+b.F.z*speed*.28);if(!L.foot)L.foot=V(rest.x,0,rest.z);if(!L.stepping){const other=legs.some(o=>o.group!==L.group&&o.stepping);if(!other&&Math.hypot(L.foot.x-rest.x,L.foot.z-rest.z)>CFG.step-(speed<5?12:0)){L.stepping=true;L.t=0;L.from=V(L.foot.x,0,L.foot.z);L.to=rest}}else{L.t+=dt/dur;const t=Math.min(1,L.t),e=t*t*(3-2*t);L.foot=V(lerp(L.from.x,L.to.x,e),-Math.sin(t*Math.PI)*CFG.stepHeight,lerp(L.from.z,L.to.z,e));if(t>=1){L.stepping=false;spawnFootprint(L.foot,L)}}L.knee=twoBone(L.hip,L.foot,L1,L2,add(b.F,mul(b.U,.35)))}}
function twoBone(H,F,a,b,pole){const d=sub(F,H);let dist=clamp(len(d),Math.abs(a-b)+1,a+b-.5);const dn=norm(d),x=(a*a-b*b+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,a*a-x*x)),pp=norm(sub(pole,mul(dn,dot(pole,dn))));return add(add(H,mul(dn,x)),mul(pp,h))}
function updateAntennae(b,dt){const M=V(mouse.hit.x,-48,mouse.hit.z),active=elapsed-mouse.lastMove<4.5&&!uiHover,alarm=cr.startle>0?1:0,def=cr.defensive>0,acid=cr.acidShield>.4,feed=cr.state==='feeding'&&cr.feedPoint,sonar=ENV.sonarT>0&&ENV.sonarAt;mouse.attention=lerp(mouse.attention,active?1:.15,smooth(dt,3));for(const c of chains){const base=local(b,...c.base),ph=antennaClock*(.7+c.i*.17)+c.i*1.9,spread=1+cr.heatStress*.95,idleDir=norm(add(add(mul(b.F,c.idle[0]*(1-cr.airCold*.2)),mul(b.U,c.idle[1]+Math.sin(ph)*.25-cr.heatStress*1.15+cr.airCold*.35)),mul(b.S,(c.idle[2]+Math.cos(ph*1.3)*.3)*spread))),idleTip=add(base,mul(idleDir,c.total*.88)),wob=V(Math.sin(ph*1.6)*14,Math.cos(ph*1.1)*8,Math.cos(ph*1.6)*14),toM=sub(add(M,wob),base),mouseTip=add(base,mul(norm(toM),Math.min(len(toM),c.total*.97))),jit=V(Math.sin(elapsed*38+c.i)*7,Math.sin(elapsed*31+c.i*2)*7,Math.cos(elapsed*35+c.i)*7),alarmDir=norm(add(mul(b.U,.9),mul(b.F,-.5+c.i*.1))),alarmTip=add(add(base,mul(alarmDir,c.total*.95)),jit);let target=mix(idleTip,mouseTip,Math.min(1,mouse.attention*c.w));
 if(feed){const fp=V(cr.feedPoint.x+Math.sin(ph)*4,-30+Math.cos(ph*1.4)*3,cr.feedPoint.z+Math.cos(ph)*4),toF=sub(fp,base),fd=norm(toF);target=add(base,mul(fd,Math.min(len(toF),c.total*.94)))}
 else if(def){const curl=norm(add(add(mul(b.U,1.25),mul(b.F,-.32)),mul(b.S,-Math.sign(c.idle[2]||1)*.5+c.idle[2]*.18)));target=add(base,mul(curl,c.total*(.4+c.i*.025)))}
 else if(acid){const curl=norm(add(add(mul(b.U,1.08),mul(b.F,-.42)),mul(b.S,-Math.sign(c.idle[2]||1)*.52)));target=add(base,mul(curl,c.total*(.34+c.i*.018)))}
 if(sonar){const toS=sub(ENV.sonarAt,base);target=add(add(base,mul(norm(toS),Math.min(len(toS),c.total*.96))),V(Math.sin(elapsed*44+c.i*1.3)*3,Math.cos(elapsed*39+c.i)*3,Math.sin(elapsed*41+c.i)*3))}
 target=mix(target,alarmTip,(def||feed||acid||sonar)?0:alarm);if(cr.alkaline>.03)target=add(target,V(Math.sin(elapsed*66+c.i*1.7)*6*cr.alkaline,Math.cos(elapsed*71+c.i)*5*cr.alkaline,Math.sin(elapsed*63+c.i*.8)*6*cr.alkaline));if(cr.airCold>.05)target=add(target,V(Math.sin(elapsed*52+c.i)*3*cr.airCold,Math.cos(elapsed*47+c.i)*2*cr.airCold,Math.cos(elapsed*55+c.i)*3*cr.airCold));c.tip=c.tip?mix(c.tip,target,smooth(dt,(alarm||def||acid||sonar)?22:9*(1-cr.airCold*.45))):target;if(!c.pts){c.pts=[base];for(let i=0;i<c.seg.length;i++)c.pts.push(add(c.pts[i],mul(idleDir,c.seg[i])))}fabrik(c.pts,c.seg,base,c.tip);c.lock=(!alarm&&!def&&!feed&&!acid&&!sonar&&active&&len(sub(c.tip,mouseTip))<8&&mouse.attention*c.w>.55)?1:0}}
function fabrik(p,lens,base,target){const n=lens.length;p[n]=V(target.x,target.y,target.z);for(let i=n-1;i>=0;i--)p[i]=add(p[i+1],mul(norm(sub(p[i],p[i+1])),lens[i]));p[0]=V(base.x,base.y,base.z);for(let i=0;i<n;i++)p[i+1]=add(p[i],mul(norm(sub(p[i+1],p[i])),lens[i]));for(const q of p)if(q.y>-3)q.y=-3}
function drawChain(c){const p=c.pts,n=p.length-1,dorm=cr.state==='dormant',acid=cr.acidShield>.4,sonar=ENV.sonarT>0,dark=mixCol(mixCol(C.ant,[10,26,64],cr.cold*.7),[4,8,18],dorm?.6:0),edge=cr.defensive>0?[255,80,96]:acid?[255,184,0]:cr.cold>.05?mixCol(C.pink,[72,124,255],cr.cold*.85):cr.symbiont?mixCol(C.pink,cr.symbiont,.7):C.pink,la=dorm?90:235;for(let i=0;i<n;i++){const w=3.4-i*.55;segBox(p[i],p[i+1],w,w,dark,[...edge,la],V(0,-1,0));if(i>0)jointCube(p[i],w*.78,cr.defensive>0?[255,90,100]:acid?[255,184,0]:dorm?[30,60,90]:C.amber)}const tip=p[n],tipCol=cr.defensive>0?[255,70,90]:acid?[255,184,0]:sonar?C.cyan:c.lock?C.cyan:cr.symbiont||C.pink;push();translate(tip.x,tip.y,tip.z);noStroke();fill(tipCol[0],tipCol[1],tipCol[2],dorm?140:230);sphere((c.lock?5:3.5)+(cr.alkaline>.3?Math.sin(elapsed*50+c.i)*1.4*cr.alkaline:0),6,4);pop()}

function wireBox(center,b,hx,hy,hz,edge,w){const F=b.F,U=b.U,S=b.S,P=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]].map(([f,u,s])=>add(center,add(add(mul(F,f),mul(U,u)),mul(S,s))));noFill();stroke(...edge);strokeWeight(w);beginShape(LINES);for(const e of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]){vertex(P[e[0]].x,P[e[0]].y,P[e[0]].z);vertex(P[e[1]].x,P[e[1]].y,P[e[1]].z)}endShape()}
// Box faces are batched as QUADS; TRIANGLES introduces a visible lighting seam.
function obox(center,b,hx,hy,hz,body,edge,w){const F=b.F,U=b.U,S=b.S,P=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]].map(([f,u,s])=>add(center,add(add(mul(F,f),mul(U,u)),mul(S,s))));const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]];noStroke();fill(...body);beginShape(QUADS);for(const face of faces){for(const i of face)vertex(P[i].x,P[i].y,P[i].z)}endShape();stroke(...edge);strokeWeight(w);beginShape(LINES);for(const e of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]){vertex(P[e[0]].x,P[e[0]].y,P[e[0]].z);vertex(P[e[1]].x,P[e[1]].y,P[e[1]].z)}endShape()}
function segBox(A,B,w,d,col,edge,pole){const axis=norm(sub(B,A)),side=norm(cross(axis,pole||V(0,-1,0))),up=norm(cross(side,axis)),mid=mul(add(A,B),.5),half=len(sub(B,A))*.5,verts=[[-w,-half,-d],[w,-half,-d],[w,half,-d],[-w,half,-d],[-w,-half,d],[w,-half,d],[w,half,d],[-w,half,d]].map(([x,y,z])=>add(mid,add(add(mul(side,x),mul(axis,y)),mul(up,z))));const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]];noStroke();fill(...col);beginShape(QUADS);for(const f of faces){for(const i of f)vertex(verts[i].x,verts[i].y,verts[i].z)}endShape();stroke(...edge);strokeWeight(1.4);beginShape(LINES);for(const e of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]){vertex(verts[e[0]].x,verts[e[0]].y,verts[e[0]].z);vertex(verts[e[1]].x,verts[e[1]].y,verts[e[1]].z)}endShape()}
function jointCube(p,s,col){push();translate(p.x,p.y,p.z);noStroke();ambientMaterial(...col);box(s);pop()}
function updateHud(){const d=Math.round(Math.hypot(mouse.hit.x-cr.x,mouse.hit.z-cr.z)),meta=STATE_META[cr.state]||STATE_META.watch;ui.state.textContent=meta[0];ui.state.dataset.mode=cr.state;if(ui.code)ui.code.textContent=meta[1];ui.dist.textContent=String(d).padStart(3,'0')+'u';ui.x.textContent=String(Math.round(cr.x)).padStart(3,'0');ui.z.textContent=String(Math.round(cr.z)).padStart(3,'0');
 const vd=Math.hypot(cr.x-vent.x,cr.z-vent.z),s=bioStats(),fit=Math.round(clamp(s.habitat,0,100));let mode=fit>65?'warm':fit>35?'cold':'hot',label=mode==='warm'?'適合':mode==='cold'?'邊緣':'不適';
 const pct=fit;
 if(ui.thermal){ui.thermal.textContent=label;ui.thermal.dataset.mode=mode;ui.thermalVal.textContent=String(pct).padStart(3,'0');if(ui.thermalBar){ui.thermalBar.style.width=pct+'%';ui.thermalBar.dataset.mode=mode}}
 if(ui.energy)ui.energy.textContent=String(Math.round(cr.energy||0)).padStart(2,'0');
 if(ENV.ui){const u=ENV.ui,col=cr.symbiont;
  if(u.bioCore)u.bioCore.textContent=s.coreTemp.toFixed(1);if(u.bioArmor)u.bioArmor.textContent=s.armor.toFixed(0);if(u.bioAcid)u.bioAcid.textContent=s.acidRes.toFixed(0);if(u.bioSym)u.bioSym.textContent=s.symEnergy.toFixed(0).padStart(2,'0');
  if(u.bioCoreBar)u.bioCoreBar.style.width=clamp((s.coreTemp+30)/120,0,1)*100+'%';if(u.bioArmorBar)u.bioArmorBar.style.width=s.armor+'%';if(u.bioAcidBar)u.bioAcidBar.style.width=s.acidRes+'%';if(u.bioSymBar){u.bioSymBar.style.width=s.symEnergy+'%';if(col){u.bioSymBar.style.background=`linear-gradient(90deg,rgba(${col.join(',')},.2),rgb(${col.join(',')}))`;u.bioSymBar.style.boxShadow=`0 0 8px rgb(${col.join(',')})`}}
  syncEnvControls();
 }
}

/* ============================================================
   TELEMETRY DECK / TERMINAL
   ============================================================ */
function setupTelemetry(){
 const $=id=>document.getElementById(id);
 ENV.ui={deck:$('telemetryDeck'),toggle:$('deckToggle'),log:$('terminalLog'),input:$('terminalInput'),form:$('terminalForm'),airR:$('airTempRange'),airN:$('airTempNumber'),airNote:$('airTempNote'),phR:$('phRange'),phN:$('phNumber'),phNote:$('phNote'),psiR:$('psiRange'),psiN:$('psiNumber'),psiNote:$('psiNote'),psiBar:$('psiBar'),feedTag:$('feedTag'),bioCore:$('bioCore'),bioCoreBar:$('bioCoreBar'),bioArmor:$('bioArmor'),bioArmorBar:$('bioArmorBar'),bioAcid:$('bioAcid'),bioAcidBar:$('bioAcidBar'),bioSym:$('bioSym'),bioSymBar:$('bioSymBar'),termStatus:$('termStatus')};
 const u=ENV.ui;if(!u.deck)return;
 const bindPair=(key,r,n)=>{r?.addEventListener('input',()=>{if(window.NF_AUDIO)window.NF_AUDIO.event('tick');setEnvValue(key,r.value)});n?.addEventListener('input',()=>{if(n.value!=='')setEnvValue(key,n.value)});n?.addEventListener('change',()=>{if(n.value===''||!isFinite(parseFloat(n.value)))syncEnvControls(true);else setEnvValue(key,n.value)})};
 bindPair('AIR_TEMP',u.airR,u.airN);bindPair('PH_LEVEL',u.phR,u.phN);bindPair('GEYSER_PSI',u.psiR,u.psiN);
 u.deck.addEventListener('pointerenter',()=>uiHover=true);
 u.deck.addEventListener('pointerleave',()=>uiHover=false);
 u.deck.addEventListener('pointerdown',e=>e.stopPropagation());
 u.toggle?.addEventListener('click',()=>setDeck(!deckOpen));
 $('deckClose')?.addEventListener('click',()=>setDeck(false));
 document.querySelectorAll('.feed-btn').forEach(btn=>btn.addEventListener('click',()=>spawnCulture(btn.dataset.kind)));
 $('eruptBtn')?.addEventListener('click',()=>{if(!triggerEruption('manual'))logTerminal('噴發序列已在執行中。','warn')});
 u.form?.addEventListener('submit',e=>{e.preventDefault();const v=u.input.value;u.input.value='';if(v.trim()){cmdHistory.push(v.trim());if(cmdHistory.length>40)cmdHistory.shift();histIdx=cmdHistory.length;if(window.NF_AUDIO)window.NF_AUDIO.event('ui');runCommand(v)}});
 u.input?.addEventListener('keydown',e=>{if(e.key==='ArrowUp'){e.preventDefault();if(cmdHistory.length){histIdx=Math.max(0,histIdx-1);u.input.value=cmdHistory[histIdx]||''}}else if(e.key==='ArrowDown'){e.preventDefault();if(cmdHistory.length){histIdx=Math.min(cmdHistory.length,histIdx+1);u.input.value=cmdHistory[histIdx]||''}}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&deckOpen)setDeck(false)});
 setDeck(window.innerWidth>=1180);
 syncEnvControls(true);
 logTerminal('CALDERA LINK ESTABLISHED // 0x7F4A','ok');
 logTerminal('黃石破火山口・地熱觀測站 已上線。','sys');
 logTerminal('調整環境數值即刻影響生物；輸入 help 取得指令。','sys');
}
function setDeck(open){
 deckOpen=open;const d=ENV.ui&&ENV.ui.deck,t=ENV.ui&&ENV.ui.toggle,s=document.getElementById('stage');
 if(d)d.classList.toggle('is-open',open);if(t)t.setAttribute('aria-expanded',String(open));if(s)s.classList.toggle('deck-open',open);
}
function clampEnv(key,v){const lim=ENV_RANGE[key];let n=Number(v);if(!isFinite(n))n=ENV[key];n=clamp(n,lim[0],lim[1]);return key==='GEYSER_PSI'?Math.round(n):Math.round(n*10)/10}
const fmtEnv=(v,d=1)=>Number(v).toFixed(d);
function setEnvValue(key,value,opts={}){
 const v=clampEnv(key,value);ENV[key]=v;
 if(key==='GEYSER_PSI'&&v>=750&&!opts.noErupt)triggerEruption('manual');
 syncEnvControls();
}
function syncEnvControls(force=false){
 const u=ENV.ui;if(!u)return;
 const setN=(el,val)=>{if(el&&(force||document.activeElement!==el))el.value=val};
 if(u.airR)u.airR.value=ENV.AIR_TEMP;setN(u.airN,fmtEnv(ENV.AIR_TEMP,1));
 if(u.phR)u.phR.value=ENV.PH_LEVEL;setN(u.phN,fmtEnv(ENV.PH_LEVEL,1));
 if(u.psiR)u.psiR.value=Math.round(ENV.GEYSER_PSI);setN(u.psiN,String(Math.round(ENV.GEYSER_PSI)));
 if(u.psiBar){const p=clamp(ENV.GEYSER_PSI/10,0,100);u.psiBar.style.width=p+'%';u.psiBar.dataset.mode=ENV.GEYSER_PSI>=750?'critical':ENV.GEYSER_PSI>=500?'high':'normal'}
 updateEnvNotes();
}
function updateEnvNotes(){
 const u=ENV.ui;if(!u)return;const t=ENV.AIR_TEMP,ph=ENV.PH_LEVEL,psi=ENV.GEYSER_PSI;
 if(u.airNote){let txt='常溫：代謝與步態維持基準。',mode='ok';if(t<0){txt='❄ 極寒：移動 -50%、觸角遲滯、發抖，主動趨向間歇泉取暖。';mode='cold'}else if(t>45){txt='☀ 灼熱：背甲排熱燈加速、觸角上張散熱。';mode='warn'}u.airNote.textContent=txt;u.airNote.dataset.mode=mode}
 if(u.phNote){let txt='中性：常態漫遊。',mode='ok';if(ph<3){txt='☣ 強酸：矽質硬殼啟動，外骨骼琥珀金光、底盤壓低。';mode='danger'}else if(ph>10){txt='⚡ 強鹼：觸角尖端高頻震顫，感測離子濃度。';mode='warn'}else if(ph<6.5||ph>8){txt='酸鹼偏移：仍在耐受範圍內。';mode='warn'}u.phNote.textContent=txt;u.phNote.dataset.mode=mode}
 if(u.psiNote){let txt='穩定：地熱自然累積 +6 PSI/s。',mode='ok';if(ENV.eruptT>0){txt='⚠ 噴發中：壓力釋放 '+Math.round(ENV.GEYSER_PSI/10)+'%。';mode='danger'}else if(psi>=750){txt='臨界：壓力超載，噴發序列啟動。';mode='danger'}else if(psi>=500){txt='高壓：地熱持續蓄積，接近臨界。';mode='warn'}u.psiNote.textContent=txt;u.psiNote.dataset.mode=mode}
 if(u.termStatus)u.termStatus.textContent=ENV.eruptT>0?'ERUPTING':ENV.sonarT>0?'SONAR':'LINK '+(cr.habitat||0).toFixed(0)+'%';
}
function logTerminal(text,type='sys'){
 const el=ENV.ui&&ENV.ui.log;if(!el)return;
 const line=document.createElement('div');line.className='term-line '+type;
 const time=document.createElement('span');time.className='term-time';const d=new Date();time.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
 const body=document.createElement('span');body.className='term-text';body.textContent=text;
 line.append(time,body);el.appendChild(line);
 while(el.children.length>140)el.removeChild(el.firstChild);
 el.scrollTop=el.scrollHeight;
}
function runCommand(raw){
 const text=String(raw||'').trim();if(!text)return;
 logTerminal('❯ '+text,'input');
 const parts=text.toLowerCase().split(/\s+/),cmd=parts[0],arg=parts[1];
 switch(cmd){
  case 'erupt':if(!triggerEruption('cmd'))logTerminal('噴發序列已在執行中。','warn');break;
  case 'blizzard':setEnvValue('AIR_TEMP',-25);logTerminal('BLIZZARD // AIR_TEMP → -25°C，暴風雪低溫遲滯模式啟動。','warn');triggerGlitch(420);break;
  case 'acid':setEnvValue('PH_LEVEL',1.5);logTerminal('ACID BATH // pH → 1.5，耐酸矽質硬殼強制啟動。','warn');break;
  case 'feed':{const t=(arg||'').toUpperCase();if(!FEED_COLORS[t]){logTerminal('用法：feed [gold / emerald / azure]','err');break}spawnCulture(t);break}
  case 'sonar':case 'pulse':fireSonar();break;
  case 'scan':printScan();break;
  case 'reset':resetEnvironment();logTerminal('RESET // 環境參數已回復黃石基準平衡值。','ok');break;
  case 'help':printHelp();break;
  default:logTerminal(`未知指令「${cmd}」。輸入 help 取得指令清單。`,'err');
 }
}
function printScan(){
 const s=bioStats();
 logTerminal('── BIO-SCAN / 生理掃描 ─────────────','scan');
 logTerminal(`核心體溫 CORE TEMP .... ${s.coreTemp.toFixed(1)} °C`,'scan');
 logTerminal(`外甲硬度 ARMOR ........ ${s.armor.toFixed(0)} %`,'scan');
 logTerminal(`耐酸抗性 ACID RES ..... ${s.acidRes.toFixed(0)} %`,'scan');
 logTerminal(`共生整合 SYMBIONT ..... ${s.symEnergy.toFixed(0)} %  [${cr.symbiontName||'未共生'}]`,'scan');
 logTerminal(`能量儲備 ENERGY ....... ${(cr.energy||0).toFixed(0)} %`,'scan');
 logTerminal(`環境適合 HABITAT ...... ${(cr.habitat||0).toFixed(0)} %`,'scan');
 logTerminal(`生存指標 VITALITY ..... ${(cr.vitality||0).toFixed(0)} %`,'scan');
 logTerminal(`狀態 STATE ............ ${(STATE_META[cr.state]||STATE_META.watch)[0]}`,'scan');
 logTerminal(`環境 ENV .............. ${ENV.AIR_TEMP.toFixed(1)}°C / pH ${ENV.PH_LEVEL.toFixed(1)} / ${ENV.GEYSER_PSI.toFixed(0)} PSI`,'scan');
 logTerminal('── SCAN COMPLETE ─────────────────','ok');
}
function printHelp(){
 logTerminal('可用指令 / AVAILABLE COMMANDS','warn');
 logTerminal('  erupt .................. 壓力拉滿，引爆間歇泉','sys');
 logTerminal('  blizzard ............... 氣溫驟降至 -25°C','sys');
 logTerminal('  acid ................... pH 調至 1.5，啟動矽殼','sys');
 logTerminal('  feed [gold/emerald/azure] 投放嗜熱菌群落','sys');
 logTerminal('  sonar | pulse .......... 全場聲納脈衝','sys');
 logTerminal('  scan ................... 逐行列印生理報告','sys');
 logTerminal('  reset .................. 回復黃石基準環境','sys');
 logTerminal('  help ................... 顯示本清單','sys');
}
function resetEnvironment(){
 Object.assign(ENV,{AIR_TEMP:ENV_BASE.AIR_TEMP,PH_LEVEL:ENV_BASE.PH_LEVEL,GEYSER_PSI:ENV_BASE.GEYSER_PSI,eruptT:0,cooldown:2,shake:0,sonarT:0,sonarAt:null});
 mats.length=0;eruptParticles.length=0;sonarPulses.length=0;cr.startle=0;cr.fleeA=0;
 syncEnvControls(true);triggerGlitch(280);if(window.NF_AUDIO)window.NF_AUDIO.event('reset');
}