// Minimal DOM + canvas stub so the game can actually EXECUTE in node.
// Syntax checks miss load-time ReferenceErrors; this doesn't.
const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||'/home/claude/v3.html','utf8');
const js=html.match(/<script>([\s\S]*)<\/script>/)[1];

// which element ids exist in the markup?
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));

const noop=()=>{};
function ctxStub(){
  return new Proxy({
    canvas:{width:640,height:360},
    createLinearGradient:()=>({addColorStop:noop}),
    createRadialGradient:()=>({addColorStop:noop}),
    measureText:()=>({width:12}),
    getImageData:()=>({data:new Uint8ClampedArray(4)}),
    save:noop, restore:noop, drawImage:noop, fillRect:noop, clearRect:noop,
  },{ get(t,k){ if(k in t) return t[k];
      if(typeof k==='string') return noop; return undefined; },
      set(){ return true; } });
}
function el(id){
  const e={ id, style:{}, dataset:{}, children:[],
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
                toggle(c,v){ v===undefined? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (v?this._s.add(c):this._s.delete(c)); },
                contains(c){return this._s.has(c)} },
    addEventListener:noop, removeEventListener:noop, setPointerCapture:noop,
    getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),
    getContext:()=>ctxStub(), toDataURL:()=>'data:image/png;base64,AA',
    appendChild:noop, querySelector:()=>null, closest:()=>null,
    focus:noop, blur:noop, click:noop };
  Object.defineProperty(e,'textContent',{get(){return ''},set(){},configurable:true});
  Object.defineProperty(e,'innerHTML',{get(){return ''},set(){},configurable:true});
  return e;
}
const cache={};
const MISSING=[];
global.document={
  head:el('head'), body:el('body'), documentElement:el('html'),
  getElementById(id){ if(!ids.has(id)&&!cache[id]) MISSING.push(id);
    return cache[id]||(cache[id]=el(id)); },
  createElement:(t)=>el('created-'+t),
  querySelector:()=>null, addEventListener:noop,
  fullscreenElement:null,
};
global.navigator={ userAgent:'harness', platform:'x', maxTouchPoints:0,
  getGamepads:()=>[], vibrate:noop, serviceWorker:{register:()=>Promise.reject()} };
global.screen={ orientation:{ lock:()=>Promise.reject(new Error('no')) } };
global.matchMedia=()=>({matches:false, addEventListener:noop});
global.performance={now:()=>Date.now()};
global.URL={ createObjectURL:()=>'blob:x', revokeObjectURL:noop };
global.Blob=class Blob{constructor(){}};
global.innerWidth=844; global.innerHeight=390;
global.location={href:'file:///x.html', protocol:'file:'};
global.AudioContext=class{ constructor(){this.currentTime=0;this.destination={};}
  createOscillator(){return {frequency:{value:0,exponentialRampToValueAtTime:noop},type:'',connect:noop,start:noop,stop:noop};}
  createGain(){return {gain:{value:0,exponentialRampToValueAtTime:noop},connect:noop};} };

let rafQ=[];
global.requestAnimationFrame=(f)=>{ rafQ.push(f); return rafQ.length; };
const listeners={};
global.addEventListener=(k,f)=>{ (listeners[k]=listeners[k]||[]).push(f); };
global.removeEventListener=noop;

let imgOnload=null;
global.Image=class{ constructor(){ this.width=920; this.height=736; }
  set src(v){ imgOnload=()=>this.onload&&this.onload(); }
  get src(){return ''} };

global.window=global;
global.self=global; global.top=global;

// deterministic RNG so the shared-state scene suite can't flake run-to-run (mulberry32, fixed seed)
let __rng=0x1a2b3c4d;
Math.random=()=>{ __rng|=0; __rng=(__rng+0x6D2B79F5)|0; let x=Math.imul(__rng^(__rng>>>15),1|__rng);
  x=(x+Math.imul(x^(x>>>7),61|x))^x; return ((x^(x>>>14))>>>0)/4294967296; };

global.setTimeout=(f)=>{ try{f();}catch(e){} return 0; };  // waves spawn inline so we can test them
const driver = `
;globalThis.__G=()=>({
   get P(){return P}, get ents(){return ents}, get crowd(){return crowd},
   get drops(){return drops}, get fires(){return fires}, get cans(){return cans},
   get BUILDINGS(){return BUILDINGS}, get GATES(){return GATES}, get U(){return U},
   get UPG(){return UPG}, get COMBO(){return COMBO}, get camX(){return camX},
   get boss(){return boss}, get camLock(){return camLock},
   get lives(){return lives}, get night(){return night}, get dawnShown(){return dawnShown},
   get continueOn(){return continueOn}, get DAWN_X(){return DAWN_X},
   get busMob(){return busMob},
   get stageNum(){return stageNum}, get wavesThisStage(){return wavesThisStage},
   get shopOpen(){return shopOpen}, get BOSS_ARCH(){return BOSS_ARCH},
   spawn:(e)=>ents.push(e), clearEnts:()=>{ ents.length=0; },
   setCamLock:(v)=>{ camLock=v; camX=v; }, setBest:(v)=>{ best=v; }, setLives:(v)=>{ lives=v; },
   setWaves:(n)=>{ wavesThisStage=n; }, setStage:(n)=>{ stageNum=n; }, setBossDone:(n)=>{ bossDone=n; },
   setBusMobAt:(v)=>{ busMobAt=v; },   // deterministic suite: park the once-a-run roll so it can't fire mid-scene
   releaseArena:()=>{ ents.length=0; camLock=null; boss=null; bossDone=0; hitstop=0; fires.length=0; },
   rat,vamp,connect,hurtPlayer,setShop,buy,spawnWave,tier,stream,update,render,aggro,coopApply,coopBroadcastEnts,coopMirrorEnts,
   throwWeapon,drop, get WEAPONS(){return WEAPONS},
   genBoss,spawnBoss,updateBoss,killBoss,hits,atkBox,stageCleared,
   buyContinue,callItNight,continueCost,
   gainFreedom,gainXp,loseHeart,heavyHitAt,maxComboStep,xpToLevel,
   spawnBusMob,updateBusMob});
;globalThis.__key=(k,v)=>{ if(v&&!key[k]) pressed[k]=true; key[k]=v; };
;globalThis.__tick=(n)=>{ for(let i=0;i<n;i++){ update(); } };
;globalThis.__draw=()=>render();
;globalThis.__mode=()=>mode;
;globalThis.__titleTick=()=>titleTick();
;globalThis.__titleRender=()=>titleRender();
;globalThis.__start=()=>startGame();
;globalThis.__setMP=(v)=>{ MP=v; };
;globalThis.__others=()=>others;
`;
let err=null;
try{
  (0,eval)(js+driver);
}catch(e){ err=e; console.log('LOAD-TIME THROW:\n  '+e.constructor.name+': '+e.message); }

if(!err){
  console.log('load       OK');
  try{
    imgOnload && imgOnload();       // fire sheet.onload -> flip build, buildManifest, reset()
    console.log('onload     OK  (reset + manifest ran)');
  }catch(e){ console.log('ONLOAD THROW:\n  '+e.constructor.name+': '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')); err=e; }
}
if(!err){
  try{
    let n=0, t0=0;
    while(rafQ.length && n<240){ const f=rafQ.shift(); t0+=16.7; f(t0); n++; }
    console.log('ran        '+n+' frames OK');
  }catch(e){ console.log('RUNTIME THROW after frames:\n  '+e.constructor.name+': '+e.message+'\n'+(e.stack||'').split('\n').slice(1,5).join('\n')); err=e; }
}
if(MISSING.length) console.log('ids requested but NOT in markup: '+[...new Set(MISSING)].join(', '));

// ---------------- scenarios ----------------
function scene(name, fn){
  // clear any residue a prior scene's sim may have left on the player, so scenes stay independent
  try{ const g=globalThis.__G(), P=g.P;
    if(['caged','wthrow','punch','jump','air','upper','kick','shoot'].includes(P.state)) P.state='idle';
    P.cageB=null; P.weapon=null; P.landHold=0; P.y=0; P.vy=0;
    // transient combat buffs/timers a prior scene (e.g. the Imagination special) can leave hot
    P.fireT=0; P.dmgMul=1; P.dmgT=0; P.stepV=0; P.airT=0; P.buf=0; P.st=0; P.step=0; P.connected=false; }catch(e){}
  try{ fn(); console.log('  ok    '+name); }
  catch(e){ console.log('  FAIL  '+name+'\n        '+e.constructor.name+': '+e.message+
    '\n        '+(e.stack||'').split('\n')[1].trim()); err=err||e; }
}
if(!err){
  const G=globalThis.__G();
  console.log('\nscenarios:');
  scene('title screen runs 900 ticks (Imagination demo loop, ambient, card)', ()=>{
    if(__mode()!=='title') throw new Error('did not boot to title, got: '+__mode());
    let sawImagine=false;
    for(let i=0;i<900;i++){ __titleTick(); __titleRender(); if(__G().P.state==='imagine') sawImagine=true; }
    if(!sawImagine) throw new Error('title screen never demoed the Imagination attack');
    console.log('        title loop demoed the Imagination attack');
  });
  scene('PRESS START -> play', ()=>{
    __start();
    if(__mode()!=='play') throw new Error('still on title after start');
    __G().setBusMobAt(Infinity);   // the once-a-run tour-bus roll is real randomness — park it so the
                                    // rest of this deterministic suite can't have it land mid-scene
    __tick(120);
  });
  scene('walk right 4000 ticks (streaming, gates, waves, AI)', ()=>{
    __key('KeyD',true); __tick(4000); __key('KeyD',false);
  });
  scene('chunks streamed + culled', ()=>{
    const g=__G(); if(!g.BUILDINGS.length) throw new Error('no buildings after walking');
  });
  scene('tour bus mob (dev button): rolls in, drops a horde, then leaves', ()=>{
    const g=__G(); g.releaseArena();
    g.spawnBusMob(true);
    if(!g.busMob) throw new Error('spawnBusMob did not arm a bus');
    let ticks=0;
    while(g.busMob && g.busMob.phase==='arrive' && ticks<200){ g.updateBusMob(); ticks++; }
    if(!g.busMob || g.busMob.phase!=='stopped') throw new Error('bus never reached its stop, phase='+(g.busMob&&g.busMob.phase));
    const dropped=g.ents.filter(e=>e.k==='vamp').length;   // all four street-enemy types ride the 'vamp' entity kind — no rats off this bus
    if(dropped<20) throw new Error('bus mob dropped too few enemies: '+dropped);
    if(g.ents.some(e=>e.k==='rat')) throw new Error('bus mob spawned a rat — should be street enemies only');
    console.log('        bus stopped and dropped '+dropped+' enemies');
    while(g.busMob && ticks<3000){ g.updateBusMob(); ticks++; }
    if(g.busMob) throw new Error('bus never left after '+ticks+' ticks');
    console.log('        bus drove off after '+ticks+' ticks total');
    g.releaseArena();
  });
  scene('mash punch 600 ticks (full combo, connects)', ()=>{
    for(let i=0;i<600;i++){ if(i%7===0) __key('KeyJ',true); else __key('KeyJ',false); __tick(1); }
  });
  scene('hearts: a light hit costs half a heart (no knockdown), a heavy hit costs a full heart (knockdown)', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp; g.P.iframes=0; g.P.state='idle';
    const hp0=g.P.hp;
    g.hurtPlayer(5, g.P.x+30);                          // below heavyHitAt() (10) -> half heart
    if(g.P.hp!==hp0-0.5) throw new Error('light hit should cost half a heart, hp '+hp0+'->'+g.P.hp);
    if(g.P.state==='down') throw new Error('a half-heart hit should not knock you down');
    g.P.iframes=0; const hp1=g.P.hp;
    g.hurtPlayer(20, g.P.x+30);                         // above heavyHitAt() -> full heart + knockdown
    if(g.P.hp!==hp1-1) throw new Error('heavy hit should cost a full heart, hp '+hp1+'->'+g.P.hp);
    if(g.P.state!=='down') throw new Error('a full-heart hit should knock you down');
    console.log('        half heart (no kd) then full heart (kd) — hp ended at '+g.P.hp);
  });
  scene('Freedom Meter: fills on kills, and a full meter unleashes the Imagination attack', ()=>{
    const g=__G(); g.releaseArena();
    g.P.x=1200; g.P.z=300; g.P.state='idle'; g.P.y=0; g.P.vy=0; g.setCamLock(0);
    g.P.freedom=0; const e=g.vamp(g.P.x+18,g.P.z,false,false,'guard'); e.hp=e.maxhp=1; g.spawn(e);
    g.connect(e,{name:'jab',dmg:20,push:0,stun:20,y:0});
    if(!(g.P.freedom>0)) throw new Error('a kill should fill the Freedom Meter');
    g.P.freedom=g.P.maxFreedom; __tick(20); g.P.state='idle'; g.P.y=0; g.P.vy=0;   // let the kill's hitstop settle, then re-plant on the ground
    const e2=g.vamp(g.P.x+20,g.P.z,false,false,'guard'); g.spawn(e2); const hp0=e2.hp;
    __key('KeyL',true); __tick(1); __key('KeyL',false);
    if(g.P.state!=='imagine') throw new Error('a full meter should trigger the Imagination attack on press');
    if(g.P.freedom>1) throw new Error('using the attack should drain the meter, left '+g.P.freedom);   // drained on the trigger frame — check before the burst can refill it by killing an enemy
    __tick(3);
    if(!(e2.hp<hp0)) throw new Error('the Imagination burst should hit nearby enemies');
    __tick(60); __draw();
    console.log('        Freedom Meter filled on kill, drained on use, hit enemies in range');
  });
  scene('XP leveling unlocks the combo string (level 1: 2 hits, level 3: the full launcher)', ()=>{
    const g=__G(); g.releaseArena();
    g.P.x=1200; g.P.z=300; g.P.state='idle'; g.P.y=0; g.setCamLock(0); g.P.xp=0;
    // force level 1 and confirm the chain caps at step 1 (jab, jab2 — no cross/launcher)
    const P=g.P; P.level=1; P.step=0; P.st=0; P.buf=0; P.state='punch'; P.hitDone=false; P.connected=true;
    let maxStep=0;
    for(let i=0;i<200;i++){ __key('KeyJ',true); __tick(1); __key('KeyJ',false); __tick(1); maxStep=Math.max(maxStep,P.step); }
    if(maxStep>1) throw new Error('level 1 should cap the combo at step 1 (jab2), reached step '+maxStep);
    // level up to 3 and confirm the launcher (step 3) becomes reachable
    for(let i=0;i<20 && P.level<3;i++) g.gainXp(g.xpToLevel(P.level));
    if(P.level<3) throw new Error('gainXp did not reach level 3');
    P.step=0; P.st=0; P.buf=0; P.state='punch'; P.hitDone=false; P.connected=true; maxStep=0;
    for(let i=0;i<200;i++){ __key('KeyJ',true); __tick(1); __key('KeyJ',false); __tick(1); maxStep=Math.max(maxStep,P.step); }
    if(maxStep<3) throw new Error('level 3 should unlock the launching 4th hit, only reached step '+maxStep);
    __key('KeyJ',false);
    console.log('        level 1 capped at step 1; level '+P.level+' reached the launcher (step 3)');
  });
  scene('fire rats + big rat', ()=>{
    const g=__G();
    g.clearEnts();                                  // no leftover token holders
    g.spawn(g.rat(g.P.x+70,g.P.z,false,{fire:true}));
    g.spawn(g.rat(g.P.x+110,g.P.z,false,{big:true,fire:true}));
    let peak=0; for(let i=0;i<600;i++){ __tick(1); peak=Math.max(peak,g.fires.length); }
    __draw();
    if(peak===0) throw new Error('fire rats never breathed in 10s');
    console.log('        peak fire particles alive: '+peak);
  });
  scene('elite vamp full lifecycle', ()=>{
    const g=__G(); g.ents.push(g.vamp(g.P.x+40,300,false,true,'guard')); __tick(500); __draw();
  });
  scene('take a hit / knockdown', ()=>{
    const g=__G(); g.P.iframes=0; g.hurtPlayer(20,g.P.x+30); __tick(120); __draw();
  });
  scene('drop kick: jump then kick connects and knocks an enemy back', ()=>{
    const g=__G(); g.releaseArena();
    g.P.x=1200; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle'; g.P.face=1; g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+30,300,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e);
    __key('KeyK',true); __tick(1); __key('KeyK',false); __tick(10);   // jump
    if(g.P.state!=='jump') throw new Error('expected jump state before kicking, got '+g.P.state);
    __key('KeyI',true); __tick(1); __key('KeyI',false);
    if(g.P.state!=='air'||g.P.airPunch!==false) throw new Error('JUMP then KICK should enter air state with airPunch=false, got state='+g.P.state+' airPunch='+g.P.airPunch);
    const hp0=e.hp; __tick(30);
    if(!(e.hp<hp0)) throw new Error('drop kick should have connected, enemy hp unchanged at '+e.hp);
    console.log('        jump+kick -> air state (airPunch=false), drop kick connected for '+(hp0-e.hp)+' dmg');
  });
  scene('sprint: double-tap a direction to run, attack mid-sprint = drop kick', ()=>{
    const g=__G(), P=g.P; g.releaseArena();
    P.x=1200; P.z=300; P.y=0; P.vy=0; P.state='idle'; P.face=1; P.weapon=null; P.iframes=999;
    P.sprinting=false; P.tapDir=0; P.tapT=-99; P.lastDir=0; g.setCamLock(Math.max(0,P.x-170));
    const e=g.vamp(P.x+60,300,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e);
    __key('KeyD',true); __tick(2); __key('KeyD',false); __tick(3);   // tap 1
    __key('KeyD',true); __tick(2);                                    // tap 2 within the window -> sprint
    if(!P.sprinting) throw new Error('double-tapping D should start a sprint');
    __key('KeyJ',true); __tick(1); __key('KeyJ',false);               // attack mid-sprint
    if(P.state!=='air'||P.airPunch!==false) throw new Error('sprint+punch should launch the drop kick, got state='+P.state+' airPunch='+P.airPunch);
    const hp0=e.hp; __tick(30); __key('KeyD',false);
    if(!(e.hp<hp0)) throw new Error('the sprint drop kick should have connected, enemy hp unchanged at '+e.hp);
    console.log('        double-tap -> sprint; sprint+punch -> drop kick, connected for '+(hp0-e.hp)+' dmg');
  });
  scene('standing kick: I with feet on the ground connects without launching', ()=>{
    const g=__G(); g.releaseArena();
    g.P.x=1200; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle'; g.P.face=1; g.P.weapon=null; g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+30,300,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e);
    __key('KeyI',true); __tick(1); __key('KeyI',false);
    if(g.P.state!=='kick') throw new Error('I on the ground should enter the kick state, got '+g.P.state);
    const hp0=e.hp; __tick(20);
    if(!(e.hp<hp0)) throw new Error('standing kick should have connected, enemy hp unchanged at '+e.hp);
    __tick(10);
    if(g.P.state!=='idle') throw new Error('kick should release back to idle, got '+g.P.state);
    console.log('        I on the ground -> kick state, standing kick connected for '+(hp0-e.hp)+' dmg');
  });
  scene('SHOOT: hold the dedicated button to spray finger-gun dots, punch stays melee', ()=>{
    const g=__G(), P=g.P; g.releaseArena();
    P.x=1200; P.z=300; P.y=0; P.vy=0; P.state='idle'; P.face=1; P.weapon=null; P.iframes=999; P.shootCd=0; P.shootT=0;
    g.setCamLock(Math.max(0,P.x-170));
    const e=g.vamp(P.x+90,300,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e);
    // HOLD the SHOOT button → sprays dots on a cooldown; stays put and never enters a locked attack state
    const x0=P.x, hp0=e.hp; let dots=0;
    __key('KeyU',true);
    for(let i=0;i<40;i++){ const before=g.fires.filter(f=>f.dot).length; __tick(1); const after=g.fires.filter(f=>f.dot).length; if(after>before) dots++; }
    __key('KeyU',false);
    if(dots<3) throw new Error('holding SHOOT should spam several dots, got '+dots);
    if(P.state==='punch') throw new Error('shooting must not enter the melee punch combo');
    if(Math.abs(P.x-x0)>2) throw new Error('shooting should be stationary (no forced movement), drifted '+(P.x-x0).toFixed(1));
    if(!(e.hp<hp0)) throw new Error('the finger-gun dots should connect');
    // walk-not-run: holding a direction while firing moves slower than a normal run
    P.shootT=10; P.x=1200; __key('KeyD',true); __key('KeyU',true);
    const wx=P.x; __tick(1); const walkStep=P.x-wx; __key('KeyU',false);
    P.shootT=0; const rx=P.x; __tick(1); const runStep=P.x-rx; __key('KeyD',false);
    if(!(walkStep>0 && walkStep<runStep)) throw new Error('firing while moving should walk (slower) not run: walk='+walkStep.toFixed(2)+' run='+runStep.toFixed(2));
    // punch is always melee — no mode involved
    P.state='idle'; P.shootT=0; g.ents.length=0;
    const e2=g.vamp(P.x+20,300,false,false,'guard'); e2.state='walk'; e2.hitstun=0; e2.hp=e2.maxhp=1000; g.spawn(e2);
    __key('KeyJ',true); __tick(1); __key('KeyJ',false);
    if(P.state!=='punch') throw new Error('punch should melee, got '+P.state);
    console.log('        held SHOOT: '+dots+' dots, stationary; walk<run while firing; punch melees');
  });
  scene('uppercut: UP+PUNCH on the ground launches a grounded enemy', ()=>{
    const g=__G(); g.releaseArena();
    g.P.x=1200; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle'; g.P.face=1; g.P.weapon=null; g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+20,300,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e);
    __key('KeyW',true); __key('KeyJ',true); __tick(1); __key('KeyJ',false);
    if(g.P.state!=='upper') throw new Error('UP+PUNCH on the ground should enter the upper state, got '+g.P.state);
    const hp0=e.hp; __tick(20); __key('KeyW',false);
    if(!(e.hp<hp0)) throw new Error('uppercut should have connected, enemy hp unchanged at '+e.hp);
    if(e.state!=='launch') throw new Error('uppercut should launch the enemy, state='+e.state);
    __tick(60);
    console.log('        UP+PUNCH -> upper state, uppercut connected for '+(hp0-e.hp)+' dmg and launched the target');
  });
  scene('Landlord D. Evict: guards → eviction notices → exhausted and dizzy', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(1,'landlord'); const b=g.boss;
    if(!b||b.arch!=='landlord') throw new Error('landlord did not spawn');
    for(let i=0;i<60;i++){ __tick(1); __draw(); }               // intro + guard
    if(g.ents.filter(e=>e.k==='sammich'&&!e.dead).length<3) throw new Error('landlord summoned no security');
    if(b.phase!=='guard') throw new Error('landlord not in guard phase');
    for(const e of g.ents) if(e.k==='sammich') e.dead=1;         // clear his security
    for(let i=0;i<40;i++){ __tick(1); __draw(); }               // notices phase
    if(b.phase!=='notices') throw new Error('landlord did not move to the notices phase, got '+b.phase);
    let sawNotice=false;
    for(let i=0;i<200;i++){ __tick(1); __draw(); if(g.fires.some(f=>f.paper)) sawNotice=true; }
    if(!sawNotice) throw new Error('landlord never threw an eviction notice');
    b.hp=Math.round(b.maxhp*0.2); __tick(2);                     // exhaust him
    if(b.phase!=='dizzy') throw new Error('landlord did not get dizzy under 25% hp');
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:30,stun:10});
    if(!(b.hp<hp0)) throw new Error('a dizzy landlord should be fully vulnerable');
    console.log('        guards→notices→dizzy ok; wide open once exhausted');
  });
  scene('B.I.G. Farma: pills/syringes → self-inject buff → crashes when it wears off', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'farma'); const b=g.boss;
    if(!b||b.arch!=='farma') throw new Error('farma did not spawn');
    for(let i=0;i<40;i++){ __tick(1); __draw(); }
    const force=(mv,wl,al)=>{ b.state='wind'; b.st=0; b.move=mv; b.windLen=wl; b.atkLen=al;
      for(let i=0;i<wl+al+6;i++){ __tick(1); __draw(); } };
    force('throw',16,22); if(!g.fires.some(f=>f.clap)) throw new Error('farma never threw pills');
    const dmg0=b.dmg;
    force('inject',20,16);
    if(!(b.dmg>dmg0) || b.buffT<=0) throw new Error('self-injecting should buff his strength');
    b.buffT=1; __tick(3); __draw();                     // fast-forward straight to the buff running out
    if(b.state!=='crash') throw new Error('farma should crash once the high wears off, got '+b.state);
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:30,stun:10});
    if(!(b.hp<hp0)) throw new Error('the crash window must be vulnerable');
    console.log('        pills + self-inject buff + crash-window-open ok');
  });
  scene('The President: runs from you, calls in a missile strike, then one punch ends him', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(3,'president'); const b=g.boss;
    if(!b||b.arch!=='president') throw new Error('the president did not spawn');
    for(let i=0;i<40;i++){ __tick(1); __draw(); }
    // he runs when you close the distance
    g.P.x=b.x-40; const x0=b.x;
    for(let i=0;i<30;i++){ __tick(1); g.P.x=b.x-40; }
    if(!(Math.abs(b.x-x0)>10)) throw new Error('the president should run rather than stand and fight up close');
    // three missile strikes end in the one-punch final phase
    for(let k=0;k<3;k++){ b.strikeCd=1; let ticks=0; while(b.state!=='idle'&&ticks++<120){ __tick(1); __draw(); }
      while(b.state==='idle'&&!b.finalPhase&&ticks++<400){ __tick(1); __draw(); if(b.strikeCd<=1) break; } }
    let guard=0; while(!b.finalPhase && guard++<2000){ if(b.strikeCd<=0) b.strikeCd=1; __tick(1); __draw(); }
    if(!b.finalPhase) throw new Error('the president never reached his one-punch final phase');
    if(b.hp!==1) throw new Error('final phase should leave him at 1 hp for the finishing punch');
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:5,stun:10});
    if(b.hp>0) throw new Error('a single punch should finish him in the final phase');
    console.log('        ran from a close player; 3 strikes -> final phase -> one punch');
  });
  scene('lives → continue cost curve → calling it ends the run on the recap', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=8; g.P.bucks=1000; g.P.x=200; g.P.z=300; g.setLives(3);
    const die=()=>{ g.P.hp=0; __tick(1); };
    die(); die(); if(g.lives!==1) throw new Error('two deaths should leave 1 life, got '+g.lives);
    die(); if(!g.continueOn) throw new Error('continue prompt did not open at 0 lives');
    if(g.continueCost()!==50) throw new Error('first continue should be 50 BB');
    g.buyContinue(); die(); if(g.continueCost()!==100) throw new Error('second continue should be 100 BB');
    g.buyContinue(); die(); if(g.continueCost()!==250) throw new Error('third should be 250 BB');
    g.buyContinue(); die(); if(g.continueCost()!==500) throw new Error('fourth+ should be 500 BB');
    g.callItNight();
    if(!g.dawnShown) throw new Error('calling it should show the recap');
    console.log('        lives/continue curve + call-it recap all ok');
  });
  scene('stage flow: two waves then a boss; clearing the boss opens the shop and advances the stage', ()=>{
    const g=__G(); g.releaseArena(); g.setStage(1); g.setWaves(0); g.setBossDone(0);
    g.P.hp=g.P.maxhp; g.P.x=200; g.P.z=300; g.P.y=0; g.P.state='idle';
    g.setWaves(2);                                     // two waves already cleared
    let ticks=0; while(!g.boss && ticks++<200){ __tick(1); }
    if(!g.boss) throw new Error('the stage boss never spawned after 2 waves');
    if(g.boss.arch!=='landlord') throw new Error('stage 1 should spawn Landlord D. Evict, got '+g.boss.arch);
    g.killBoss(g.boss); for(const e of g.ents) e.dead=1;   // clear him + any of his guards still standing
    ticks=0; while(g.boss && ticks++<60){ __tick(1); }
    if(g.shopOpen!==true) throw new Error('clearing the stage boss should open the between-stage shop');
    g.setShop(false);
    if(g.stageNum!==2) throw new Error('closing the shop should advance to stage 2, got '+g.stageNum);
    if(g.wavesThisStage!==0) throw new Error('the new stage should start with 0 waves cleared');
    // clearing stage 3's boss wins the run instead of opening another shop
    g.setStage(3); g.setBossDone(2); g.setWaves(2);
    ticks=0; while(!g.boss && ticks++<200){ __tick(1); }
    if(!g.boss || g.boss.arch!=='president') throw new Error('stage 3 should spawn The President');
    g.killBoss(g.boss); for(const e of g.ents) e.dead=1;
    ticks=0; while(g.boss && ticks++<60){ __tick(1); }
    if(!g.dawnShown) throw new Error('clearing stage 3 should end the run on the win recap');
    console.log('        2 waves -> named boss -> shop -> next stage; stage 3 wins the run');
  });
  scene('boss hurtbox reaches ≥25px past its side (easier to hit)', ()=>{
    const g=__G(); g.clearEnts();
    g.spawnBoss(1,'landlord'); const b=g.boss;
    // a punch box just past the boss's own half-width should still connect thanks to the fat hurtbox
    const swing={x:b.x + (b.w+22), z:b.z, rw:2, rd:6};      // arc sits 22px beyond the boss body edge, only 2px wide
    if(!g.hits(swing,b)) throw new Error('a swing 22px past the boss edge should land (hurtbox pads +25)');
    const miss={x:b.x + (b.w+40), z:b.z, rw:2, rd:6};       // 40px past → beyond the +25 pad, should whiff
    if(g.hits(miss,b)) throw new Error('40px past the edge should be out of the padded hurtbox');
    // an ordinary street enemy gets NO pad
    const e=g.vamp(1000,300,false,false,'guard');
    const near={x:e.x + (e.w+22), z:e.z, rw:2, rd:6};
    if(g.hits(near,e)) throw new Error('the pad is boss-only — a vamp should not get it');
    console.log('        boss hurtbox pads +25px horizontally; street enemies unchanged');
  });
  scene('weapon: walk over a pipe to equip; a second is left on the ground while armed', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.weapon=null; g.P.iframes=0;
    g.setCamLock(Math.max(0,g.P.x-170));
    g.drop(g.P.x, g.P.z, 'weapon', 'pipe'); const wd=g.drops[g.drops.length-1];
    for(let i=0;i<50 && !wd.land;i++) __tick(1);          // let it settle
    g.P.x=wd.x; g.P.z=wd.z;                                // stand on it
    for(let i=0;i<10 && !g.P.weapon;i++) __tick(1);
    if(!g.P.weapon || g.P.weapon.type!=='pipe') throw new Error('walking over a pipe should equip it');
    if(g.P.weapon.dur!==g.WEAPONS.pipe.dur) throw new Error('pipe should start at full durability');
    g.drop(g.P.x, g.P.z, 'weapon', 'bottle'); const wd2=g.drops[g.drops.length-1];
    for(let i=0;i<50 && !wd2.land;i++) __tick(1); for(let i=0;i<10;i++) __tick(1);
    if(g.P.weapon.type!=='pipe') throw new Error('a second weapon must not swap what you are holding');
    if(!g.drops.some(d=>d.kind==='weapon')) throw new Error('the un-picked weapon should stay on the ground');
    console.log('        equipped the pipe; second weapon left on the ground');
  });
  scene('weapon: swing hits harder than a fist, wears out, and breaks', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const mk=()=>{ const e=g.vamp(g.P.x+30,260,false,false,'guard'); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e); return e; };
    const swing=()=>{ __key('KeyJ',true); __tick(1); __key('KeyJ',false); for(let i=0;i<22;i++) __tick(1); };
    let e=mk(); g.P.weapon=null; let hp0=e.hp; swing(); const unarmed=hp0-e.hp;
    if(!(unarmed>0)) throw new Error('unarmed jab did not connect ('+unarmed+')');
    g.ents.length=0; e=mk(); g.P.weapon={type:'pipe',dur:g.WEAPONS.pipe.dur}; hp0=e.hp; const dur0=g.P.weapon.dur; swing();
    const armed=hp0-e.hp;
    if(!(armed>unarmed)) throw new Error('armed swing should hit harder: '+armed+' vs '+unarmed);
    if(!(g.P.weapon && g.P.weapon.dur===dur0-1)) throw new Error('a connecting swing should spend one durability');
    let guard=0; while(g.P.weapon && guard++<40){ g.ents.length=0; mk(); swing(); }
    if(g.P.weapon) throw new Error('the pipe should break after enough swings');
    console.log('        pipe: '+Math.round(armed)+' dmg vs fist '+Math.round(unarmed)+', wore out and broke');
  });
  scene('weapon: a bottle shatters on the first hit', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+28,260,false,false,'guard'); e.state='walk'; e.hp=e.maxhp=1000; g.spawn(e);
    g.P.weapon={type:'bottle',dur:g.WEAPONS.bottle.dur};
    __key('KeyJ',true); __tick(1); __key('KeyJ',false); for(let i=0;i<22;i++) __tick(1);
    if(g.P.weapon) throw new Error('a bottle (dur 1) should shatter on the first connect');
    console.log('        bottle shattered on contact');
  });
  scene('weapon: HOLD punch winds up and hurls it; a quick tap just swings', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+90,260,false,false,'guard'); e.state='walk'; e.hp=e.maxhp=1000; g.spawn(e); const hp0=e.hp;
    g.P.weapon={type:'pipe',dur:g.WEAPONS.pipe.dur};
    __key('KeyJ',true);                                    // press and KEEP holding
    let sawFire=false; for(let i=0;i<50 && g.P.weapon;i++){ __tick(1); if(g.fires.some(f=>f.weapon)) sawFire=true; }
    __key('KeyJ',false);
    if(g.P.weapon) throw new Error('holding punch should wind up and hurl the weapon');   // hands emptied → it left
    for(let i=0;i<50 && e.hp===hp0;i++) __tick(1);
    if(!(e.hp<hp0)) throw new Error('the thrown weapon should hit an enemy in its path');
    // quick TAP must swing, not throw
    g.ents.length=0; g.P.weapon={type:'pipe',dur:g.WEAPONS.pipe.dur};
    g.P.state='idle'; g.P.wcommit=false; g.P.wthrowT=0;
    __key('KeyJ',false); __tick(1);                        // clean neutral frame, then a quick tap
    __key('KeyJ',true); __tick(1); __key('KeyJ',false);
    for(let i=0;i<24;i++){ __tick(1); if(g.P.wcommit) throw new Error('a quick tap must not commit a throw'); }
    if(!g.P.weapon) throw new Error('a tap (air swing, no enemy) should not throw the weapon away');
    if(g.fires.some(f=>f.weapon)) throw new Error('a tap must not spawn a thrown weapon');
    console.log('        hold → hurl + hit; tap → swing (kept the weapon)');
  });
  scene('weapon: a knockdown makes you drop it on the street', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=2000; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=0;
    g.setCamLock(Math.max(0,g.P.x-170));
    g.P.weapon={type:'pipe',dur:g.WEAPONS.pipe.dur};
    const before=g.drops.filter(d=>d.kind==='weapon').length;
    g.hurtPlayer(999, g.P.x+30, 0);                        // 999 >= chin → knockdown
    if(g.P.weapon) throw new Error('a knockdown should knock the weapon out of your hands');
    if(g.drops.filter(d=>d.kind==='weapon').length<=before) throw new Error('the dropped weapon should land on the street');
    console.log('        knocked down → dropped the pipe');
  });
  scene('shop: open, buy every rank of everything', ()=>{
    const g=__G();
    const b=g.BUILDINGS.find(q=>q.kind==='burger');
    if(!b) throw new Error('no burger shop generated in 4000px');
    g.P.bucks=99999; g.setShop(true,b);
    for(const k in g.UPG) for(let i=0;i<g.UPG[k].max+2;i++) g.buy(k);
    g.P.hp=1; g.buy('burger'); g.buy('burger'); g.buy('life');
    g.setShop(false);
    for(const k in g.UPG) if(g.U[k]!==g.UPG[k].max) throw new Error(k+' stuck at '+g.U[k]);
  });
  scene('play on with all upgrades maxed', ()=>{
    __key('KeyD',true); __tick(1500); __key('KeyD',false); __draw();
  });
  scene('death does NOT wipe the screen', ()=>{
    const g=__G(); g.clearEnts();
    g.spawn(g.vamp(g.P.x+80,300,false,false,'guard'));
    g.spawn(g.rat(g.P.x+120,300,false,{big:true}));
    const bigBefore=g.ents.find(e=>e.big); bigBefore.hp=70;   // half-killed big rat
    const before=g.ents.length;
    g.P.hp=1; g.P.iframes=0; g.hurtPlayer(999,g.P.x+10); __tick(2);
    const after=g.ents.filter(e=>!e.dead).length;
    if(after<before) throw new Error('enemies wiped on death: '+before+' -> '+after);
    const big=g.ents.find(e=>e.big);
    if(!big) throw new Error('big rat vanished on death');
    if(big.hp!==70) throw new Error('big rat healed on death: '+big.hp);
    if(g.P.iframes<60) throw new Error('no respawn grace: '+g.P.iframes);
    __tick(200); __draw();
    console.log('        survived: '+after+' enemies, big rat still at '+big.hp+'/'+big.maxhp);
  });
  scene('render every frame for 600 ticks', ()=>{
    for(let i=0;i<600;i++){ __tick(1); __draw(); }
  });
  scene('co-op: a remote teammate renders without freezing the loop', ()=>{
    // stub PlayroomKit: a local player + one remote broadcasting a synced pos.
    // Regression guard for the getAllPlayers() crash — this drove render() out of the
    // rAF loop the instant a peer appeared. render() must survive a remote being present.
    const g=__G();
    const remote={ id:'r1', onQuit:()=>{},
      getState:(k)=> k==='pos' ? {x:g.P.x+40, y:0, z:g.P.z, state:'walk', face:-1} : null };
    global.Playroom={ myPlayer:()=>({ id:'me', setState:()=>{}, getState:()=>null }) };
    __others().length=0; __others().push(remote);
    __setMP(true);
    let threw=null;
    try{ for(let i=0;i<60;i++){ __draw(); } }catch(e){ threw=e; }
    __setMP(false); __others().length=0; delete global.Playroom;
    if(threw) throw new Error('render threw with a remote present: '+threw.message);
  });
  scene('co-op guest: mirrors the host, no local spawns, no bosses', ()=>{
    // Enemies are host-authoritative. The GUEST must not spawn or simulate its own — it
    // mirrors the host snapshot (empty here). Walk a long way as guest and assert ents
    // stays empty, and that bosses never spawn in co-op.
    const g=__G(); g.releaseArena();          // a prior scenario's boss may still be sitting in 'dead', unswept
    global.Playroom={ myPlayer:()=>({ id:'me', setState:()=>{}, getState:()=>null }),
      getState:()=>null, setState:()=>{} };
    __others().length=0; __others().push({id:'aaa', getState:()=>null, onQuit:()=>{}});   // a lower id → 'me' is the GUEST (host = lowest id)
    __setMP(true); g.clearEnts();
    __key('KeyD',true); for(let i=0;i<2000;i++){ __tick(1); } __key('KeyD',false);
    g.spawnBoss(3);                       // bosses stay off in co-op regardless of host/guest
    const spawned=g.ents.length, gotBoss=!!g.boss;
    __setMP(false); delete global.Playroom; g.clearEnts(); __others().length=0;
    if(spawned) throw new Error(spawned+' local enemies on the guest (should mirror host)');
    if(gotBoss) throw new Error('a boss spawned in co-op');
  });
  scene('co-op: enemy snapshot round-trips via player-state (id-keyed object)', ()=>{
    // Enemies ride the host's PLAYER-state (same channel as 'pos'), not global room state.
    // The host writes an id-keyed object to its player-state; the guest reads it off the
    // host player and rebuilds every enemy. (An array over room state reached no one.)
    const g=__G();
    const s={};
    const meP={ id:'me', setState:(k,v)=>{s[k]=v;}, getState:k=>s[k] };
    global.Playroom={ myPlayer:()=>meP, getState:()=>null, setState:()=>{} };
    __setMP(true);
    g.clearEnts(); g.spawn(g.vamp(500,306,false,undefined,'guard')); g.spawn(g.rat(560,310));
    g.coopBroadcastEnts();
    const ok = s.ents && !Array.isArray(s.ents) && Object.keys(s.ents).length===2;
    g.clearEnts(); g.coopMirrorEnts();
    const n=g.ents.length;
    __setMP(false); delete global.Playroom; g.clearEnts();
    if(!ok) throw new Error('enemy snapshot is not a 2-entry id-keyed object on player-state');
    if(n!==2) throw new Error('guest mirror rebuilt '+n+' enemies, expected 2');
  });
  scene('co-op: cans + drops sync, and cash pays both players', ()=>{
    const g=__G();
    const store={cansDead:{}, dropsGone:{}};
    global.Playroom={ myPlayer:()=>({id:'me'}), getState:k=>store[k], setState:(k,v)=>{store[k]=v;} };
    __setMP(true);
    g.clearEnts(); g.cans.length=0; g.drops.length=0;
    g.cans.push({id:'ctest', x:g.P.x+300, z:306, type:'can', hp:2, dead:false});
    // a teammate smashed the can → this client must mark it dead and spawn the (tagged) loot
    store.cansDead={ctest:1}; g.coopApply();
    if(!g.cans[0].dead) throw new Error('synced can not marked dead');
    if(!g.drops.length || g.drops[0].nid==null) throw new Error('synced can spawned no id-tagged loot');
    // a teammate then picked up a cash drop worth 20 → the drop vanishes for us AND we get paid 20
    const nid=g.drops[0].nid, before=g.P.bucks;
    store.dropsGone={[nid]:{by:'other', m:20}}; g.coopApply();
    if(g.P.bucks!==before+20) throw new Error('teammate cash not credited: bucks '+g.P.bucks+' expected '+(before+20));
    if(!g.drops[0].gone) throw new Error('picked-up drop not removed for teammate');
    __setMP(false); delete global.Playroom;
  });
  const g2=__G();
  console.log('\nend state: x='+Math.round(g2.P.x)+'  block '+(g2.tier()+1)+
    '  ents '+g2.ents.length+'  buildings '+g2.BUILDINGS.length+
    '  crowd '+g2.crowd.length+'  drops '+g2.drops.length+'  fires '+g2.fires.length);
}
process.exit(err?1:0);
