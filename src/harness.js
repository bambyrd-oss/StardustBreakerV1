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
   get P(){return P}, get ents(){return ents}, get crowd(){return crowd}, get npcs(){return npcs},
   get drops(){return drops}, get fires(){return fires}, get cans(){return cans}, get cars(){return cars},
   get BUILDINGS(){return BUILDINGS}, get GATES(){return GATES}, get U(){return U},
   get UPG(){return UPG}, get COMBO(){return COMBO}, get camX(){return camX},
   get boss(){return boss}, get camLock(){return camLock},
   get date(){return date}, get dateOn(){return dateOn},
   get lives(){return lives}, get night(){return night}, get dawnShown(){return dawnShown},
   get continueOn(){return continueOn}, get builtOn(){return builtOn}, get DAWN_X(){return DAWN_X},
   get busMob(){return busMob},
   spawn:(e)=>ents.push(e), clearEnts:()=>{ ents.length=0; },
   setCamLock:(v)=>{ camLock=v; camX=v; }, setBest:(v)=>{ best=v; }, setLives:(v)=>{ lives=v; },
   setBusMobAt:(v)=>{ busMobAt=v; },   // deterministic suite: park the once-a-run roll so it can't fire mid-scene
   releaseArena:()=>{ ents.length=0; camLock=null; boss=null; bossDone=0; hitstop=0; dateOn=false; date=null; fires.length=0; },
   rat,vamp,connect,hurtPlayer,setShop,buy,spawnWave,tier,stream,update,render,talkLen,resolveTalk,aggro,mkNpc,coopApply,coopBroadcastEnts,coopMirrorEnts,
   tryGrab,grabbable,atCurb,splatInTraffic,dropGrab,launchGrabbed,tossPlayerToStreet,
   throwWeapon,drop, get WEAPONS(){return WEAPONS},
   genBoss,spawnBoss,updateBoss,killBoss,enrageBoss,hits,atkBox,startDate,resolveDate,
   buyContinue,callItNight,clutchRevive,continueCost,confFloor,
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
  // clear any grab/street residue a prior scene's sim may have left on the player, so scenes stay independent
  try{ const g=globalThis.__G();
    if(['grab','grabbed','caged','wthrow','punch'].includes(g.P.state)) g.P.state='idle';
    g.P.grabE=null; g.P.grabbedBy=null; g.P.cageB=null; g.P.inStreet=false; g.P.weapon=null; }catch(e){}
  try{ fn(); console.log('  ok    '+name); }
  catch(e){ console.log('  FAIL  '+name+'\n        '+e.constructor.name+': '+e.message+
    '\n        '+(e.stack||'').split('\n')[1].trim()); err=err||e; }
}
if(!err){
  const G=globalThis.__G();
  console.log('\nscenarios:');
  scene('title screen runs 900 ticks (drink loop, ambient, card)', ()=>{
    if(__mode()!=='title') throw new Error('did not boot to title, got: '+__mode());
    let peak=0;
    for(let i=0;i<900;i++){ __titleTick(); __titleRender(); peak=Math.max(peak,__G().P.drunk); }
    if(peak<70) throw new Error('title never reaches the warp; peak drunk '+peak.toFixed(0));
    console.log('        peak drunk on the loop: '+Math.round(peak));
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
    const dropped=g.ents.filter(e=>e.k==='vamp').length;   // vamps + Darnells only, both ride the 'vamp' entity type — no rats off this bus
    if(dropped<20) throw new Error('bus mob dropped too few enemies: '+dropped);
    if(g.ents.some(e=>e.k==='rat')) throw new Error('bus mob spawned a rat — should be vamps/Darnells only');
    console.log('        bus stopped and dropped '+dropped+' enemies');
    while(g.busMob && ticks<3000){ g.updateBusMob(); ticks++; }
    if(g.busMob) throw new Error('bus never left after '+ticks+' ticks');
    console.log('        bus drove off after '+ticks+' ticks total');
    g.releaseArena();
  });
  scene('mash punch 600 ticks (full combo, connects)', ()=>{
    for(let i=0;i<600;i++){ if(i%7===0) __key('KeyJ',true); else __key('KeyJ',false); __tick(1); }
  });
  scene('drink to empty then dry-fire', ()=>{
    const g=__G(); g.P.bottles=3;
    for(let i=0;i<400;i++){ __key('KeyL', i%40===0); __tick(1); }
    if(g.P.bottles>0) throw new Error('bottles not spent: '+g.P.bottles);
  });
  scene('drunk to 100 + render (composite, warp, lean, stumble)', ()=>{
    const g=__G(); g.P.drunk=100; __tick(200); __draw();
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
    const g=__G(); g.ents.push(g.vamp(g.P.x+40,300,false,true)); __tick(500); __draw();
  });
  scene('take a hit / knockdown', ()=>{
    const g=__G(); g.P.iframes=0; g.hurtPlayer(20,g.P.x+30); __tick(120); __draw();
  });
  scene('date: nail the rhythm flirt → resolves with conf', ()=>{
    const g=__G(); g.ents.length=0;
    const n=g.npcs.find(q=>!q.talked && !q.scammer) || g.npcs[0];
    n.talked=false; n.scammer=false; n.trueTier=7; n.blown=false;
    g.P.x=n.x; g.P.z=n.z; g.P.conf=50; g.P.drunk=0;
    g.startDate(n);                                  // (talk-init calls this; drive it directly for a clean test)
    if(!g.dateOn) throw new Error('startDate did not begin the date');
    const conf0=g.P.conf, KEYS=['KeyJ','KeyK','KeyL','KeyE'];
    let guard=0;
    while(g.dateOn && guard++<3000){
      const d=g.date;
      for(const nt of d.notes){ if(!nt.hit&&!nt.miss && Math.abs(nt.hitT-d.t)<=2) __key(KEYS[nt.lane],true); }
      __tick(1); __draw();
      for(const k of KEYS) __key(k,false);
    }
    if(g.dateOn) throw new Error('date never ended');
    if(!n.talked) throw new Error('date did not resolve');
    if(g.P.conf<=conf0) throw new Error('a nailed date gave no confidence');
    console.log('        nailed date; conf '+conf0+' -> '+Math.round(g.P.conf));
  });
  scene('date: bombing the rhythm blows her off', ()=>{
    const g=__G(); g.ents.length=0;
    const n=g.npcs.find(q=>!q.talked) || g.npcs[0];
    n.talked=false; n.blown=false; n.trueTier=7;
    g.P.x=n.x; g.P.z=n.z; g.P.conf=60; g.P.drunk=0;
    g.startDate(n);
    if(!g.dateOn) throw new Error('startDate did not begin the date');
    let guard=0; while(g.dateOn && guard++<3000){ __tick(1); }   // press nothing → miss everything
    if(!n.talked) throw new Error('bombed date did not resolve');
    if(!n.blown) throw new Error('bombing should blow her off');
    __draw();
  });
  scene('deli boss: henchmen → boot → gun, renders every phase', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'deli'); const b=g.boss;
    if(!b||b.arch!=='deli') throw new Error('deli did not spawn');
    for(let i=0;i<60;i++){ __tick(1); __draw(); }               // intro + guard
    if(g.ents.filter(e=>e.k==='sammich'&&!e.dead).length<3) throw new Error('deli spawned no henchmen');
    if(b.phase!=='guard') throw new Error('deli not in guard phase');
    for(const e of g.ents) if(e.k==='sammich') e.dead=1;         // beat the sandwiches
    for(let i=0;i<40;i++){ __tick(1); __draw(); }               // boot phase
    if(b.phase!=='boot') throw new Error('deli did not enter boot phase, got '+b.phase);
    b.hp=Math.round(b.maxhp*0.2);                                // trip the gun
    let sawBullet=false;
    for(let i=0;i<200;i++){ __tick(1); __draw(); if(g.fires.some(f=>f.bullet)) sawBullet=true; }
    if(b.phase!=='gun') throw new Error('deli did not pull the gun under 25%');
    if(!sawBullet) throw new Error('gun phase fired no bullets');
    console.log('        deli guard→boot→gun ok; bullets sprayed');
  });
  scene('subway boss: the train sweeps the rail and ends cleanly (no softlock)', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=232; g.P.y=0; g.P.vy=0; g.P.drunk=80; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'subway'); const b=g.boss;
    if(!b||b.arch!=='subway') throw new Error('subway boss did not spawn');
    for(let i=0;i<50;i++){ __tick(1); __draw(); }
    b.trainCd=1; let sawTrain=false; const hp0=g.P.hp;
    for(let i=0;i<220;i++){ if(g.P.hp>=hp0){ g.P.z=232; g.P.iframes=0; } __tick(1); __draw(); if(b.state==='train') sawTrain=true; }
    if(!sawTrain) throw new Error('the train never swept');
    if(b.state==='train') throw new Error('train never ended — softlock');   // regression guard for the dir bug
    if(!(g.P.hp<hp0)) throw new Error('the train did not hit a player on the rail');
    if(!(g.P.drunk<80)) throw new Error('the train should sober you');
    console.log('        train swept + ended; drunk 80→'+Math.round(g.P.drunk));
  });
  scene('halal boss: throws skewers, ducks behind the cart (shielded)', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'halal'); const b=g.boss;
    if(!b||b.arch!=='halal') throw new Error('halal boss did not spawn');
    __tick(60);
    let sawSkewer=false;
    for(let i=0;i<220;i++){ __tick(1); __draw(); if(g.fires.some(f=>f.skewer)) sawSkewer=true; }
    if(!sawSkewer) throw new Error('the cart man threw no skewers');
    b.duckCd=1; let ticks=0; while(b.state!=='duck' && ticks++<160){ __tick(1); __draw(); }
    if(b.state!=='duck') throw new Error('cart man never ducked');
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:40,stun:10});
    if(b.hp<hp0) throw new Error('ducked cart man took damage through the cart');
    console.log('        skewers thrown; ducked = shielded');
  });
  scene('auteur boss: clapper/tornado + the tidy window is vulnerable', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'auteur'); const b=g.boss;
    if(!b||b.arch!=='auteur') throw new Error('auteur did not spawn');
    for(let i=0;i<40;i++){ __tick(1); __draw(); }
    b.tidyCd=999;
    const force=(mv,wl,al)=>{ b.state='wind'; b.st=0; b.move=mv; b.windLen=wl; b.atkLen=al;
      for(let i=0;i<wl+al+6;i++){ __tick(1); __draw(); } };
    force('clap',16,22); if(!g.fires.some(f=>f.clap)) throw new Error('no clapperboard');
    force('tornado',26,24); if(!g.fires.some(f=>f.tornado)) throw new Error('no tornado');
    b.tidyCd=1; let ticks=0; while(b.state!=='tidy' && ticks++<200){ __tick(1); __draw(); }
    if(b.state!=='tidy') throw new Error('auteur never tidied');
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:30,stun:10});
    if(!(b.hp<hp0)) throw new Error('the tidy window must be vulnerable');
    console.log('        clap + tornado + tidy-window-open ok');
  });
  scene('the night: 3 lives → continue curve → clutch revive → dawn recap', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=100; g.P.conf=0; g.P.money=1000; g.P.x=200; g.P.z=300; g.setLives(3); g.U.rep=0;
    const die=()=>{ g.P.hp=0; __tick(1); };
    die(); die(); if(g.lives!==1) throw new Error('two deaths should leave 1 life, got '+g.lives);
    die(); if(!g.continueOn) throw new Error('continue prompt did not open at 0 lives');
    if(g.continueCost()!==50) throw new Error('first continue should be $50');
    g.buyContinue(); die(); if(g.continueCost()!==100) throw new Error('second continue should be $100');
    g.buyContinue(); die(); if(g.continueCost()!==250) throw new Error('third should be $250');
    g.buyContinue(); die(); if(g.continueCost()!==500) throw new Error('fourth+ should be $500');
    // clutch revive: die at full confidence with no money
    g.buyContinue(); g.P.money=0; g.P.conf=100; g.P.hp=0; __tick(1);
    if(!g.builtOn) throw new Error('built-different did not fire at full confidence');
    if(g.continueOn) throw new Error('should skip the money gate at full confidence');
    g.clutchRevive();
    if(!(g.lives===1 && g.P.dmgMul===2.5 && g.P.builtT>3000)) throw new Error('clutch should grant a free life + 2.5x');
    if(g.P.conf!==g.confFloor()) throw new Error('clutch should spend your confidence');
    // dawn ends the night on the recap (fresh arena + low x so no boss re-triggers)
    g.releaseArena(); g.P.x=200; g.P.z=300;
    g.night.bosses=2; g.night.women=3; g.night.cash=200; g.night.reach=g.DAWN_X+10; __tick(1);
    if(!g.dawnShown) throw new Error('reaching dawn did not fire the recap');
    console.log('        lives/continue + clutch revive + dawn recap all ok');
  });
  scene('tourist boss: bus parks, photo hits in-frame and misses out-of-frame', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'tourist'); const b=g.boss;
    if(!b||b.arch!=='tourist') throw new Error('tourist did not spawn');
    for(let i=0;i<60;i++){ __tick(1); __draw(); }
    if(Math.abs(b.busX-b.busPark)>50) throw new Error('the tour bus never parked');
    b.state='wind'; b.st=0; b.move='photo'; b.windLen=30; b.photo=null; g.P.iframes=0;
    const hp0=g.P.hp;
    for(let i=0;i<50;i++){ __tick(1); __draw(); }
    if(!(g.P.hp<hp0)) throw new Error('in-frame photo did no damage');
    g.P.hp=g.P.maxhp; g.P.z=300; g.P.iframes=0;
    b.state='wind'; b.st=0; b.move='photo'; b.windLen=30; b.photo=null; __tick(2);
    const f=b.photo, safeZ=f.z-f.rd-10, hp1=g.P.hp;
    for(let i=0;i<50;i++){ g.P.z=safeZ; g.P.iframes=0; __tick(1); __draw(); }
    if(g.P.hp<hp1) throw new Error('out-of-frame still ate the photo');
    console.log('        bus parked; in-frame flashed, out-of-frame safe');
  });
  scene('bosses can only sober you twice a fight, and drink softens their hits', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'bouncer'); const b=g.boss;                 // spawnBoss resets the per-fight sober count
    const heavy=()=>{ g.P.drunk=100; g.P.iframes=0; g.P.state='idle'; g.hurtPlayer(10,b.x,50); };
    heavy(); const after1=g.P.drunk;                          // #1 sobers
    heavy();                                                  // #2 sobers
    heavy();                                                  // #3 must NOT sober
    if(!(after1<100)) throw new Error('the first heavy hit should sober you');
    if(g.P.drunk!==100) throw new Error('a third heavy hit must not sober you (cap is 2), drunk='+g.P.drunk);
    // light pokes/projectiles do NOT sober you at all during a boss fight (only the 2 heavy hits do)
    g.P.drunk=100; g.P.iframes=0; g.P.state='idle'; g.hurtPlayer(6,b.x,10);
    if(g.P.drunk!==100) throw new Error('light pokes must not sober you during a boss fight, drunk='+g.P.drunk);
    // alcohol dulls the pain: the same hit costs less HP when you're lit
    g.P.drunk=0;   g.P.iframes=0; g.P.state='idle'; g.P.hp=1000; g.hurtPlayer(100,b.x,0); const soberDmg=1000-g.P.hp;
    g.P.drunk=100; g.P.iframes=0; g.P.state='idle'; g.P.hp=1000; g.hurtPlayer(100,b.x,0); const drunkDmg=1000-g.P.hp;
    if(!(drunkDmg<soberDmg)) throw new Error('being drunk should reduce damage taken: '+drunkDmg+' vs '+soberDmg);
    console.log('        sober cap = 2; drunk softens the blow ('+Math.round(drunkDmg)+' vs '+Math.round(soberDmg)+' HP)');
  });
  scene('boss enrage: ~20% roll a second wind under 25%; it heals to 50% once, then faster', ()=>{
    const g=__G();
    // RATE — over many bosses dropped under 25%, roughly 1 in 5 gets the second wind (not every time, not never)
    let enr=0; const N=40;
    for(let k=0;k<N;k++){ g.clearEnts(); g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.state='idle'; g.P.iframes=999;
      g.setCamLock(Math.max(0,g.P.x-170)); g.spawnBoss(2,'bouncer'); const bb=g.boss;
      for(let i=0;i<50;i++) __tick(1); bb.hp=Math.round(bb.maxhp*0.20); __tick(1); if(bb.enraged) enr++; }
    if(enr===0) throw new Error('the second wind never fired over '+N+' bosses');
    if(enr>N*0.55) throw new Error('the second wind fires too often ('+enr+'/'+N+') — should be ~20%, not near-always');
    // EFFECTS — force one and check the heal-once + faster cooldown
    g.clearEnts(); g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.state='idle'; g.P.iframes=999;
    g.setCamLock(Math.max(0,g.P.x-170)); g.spawnBoss(2,'bouncer'); const b=g.boss;
    for(let i=0;i<50;i++) __tick(1);
    b.hp=Math.round(b.maxhp*0.20); g.enrageBoss(b);
    if(!b.enraged || Math.abs(b.hp-b.maxhp*0.5)>2) throw new Error('the second wind should heal back to ~50%');
    for(let i=0;i<14;i++) __tick(1);
    b.hp=Math.round(b.maxhp*0.10); for(let i=0;i<3;i++) __tick(1);
    if(b.hp>b.maxhp*0.15) throw new Error('the second wind must not heal a second time, got '+Math.round(b.hp/b.maxhp*100)+'%');
    b.state='idle'; b.cd=40; const cd0=b.cd; __tick(1); const drained=cd0-b.cd;
    if(!(drained>1)) throw new Error('enraged boss should burn its cooldown faster (got '+drained.toFixed(1)+'/frame)');
    console.log('        second wind ~20% ('+enr+'/'+N+'); heals to 50% once, cd drains '+drained.toFixed(1)+'/frame');
  });
  scene('boss hurtbox reaches ≥25px past its side (easier to hit)', ()=>{
    const g=__G(); g.clearEnts();
    g.spawnBoss(2,'bouncer'); const b=g.boss;
    // a punch box just past the boss's own half-width should still connect thanks to the fat hurtbox
    const swing={x:b.x + (b.w+22), z:b.z, rw:2, rd:6};      // arc sits 22px beyond the boss body edge, only 2px wide
    if(!g.hits(swing,b)) throw new Error('a swing 22px past the boss edge should land (hurtbox pads +25)');
    const miss={x:b.x + (b.w+40), z:b.z, rw:2, rd:6};       // 40px past → beyond the +25 pad, should whiff
    if(g.hits(miss,b)) throw new Error('40px past the edge should be out of the padded hurtbox');
    // an ordinary street enemy gets NO pad
    const e=g.vamp(1000,300,false,false);
    const near={x:e.x + (e.w+22), z:e.z, rw:2, rd:6};
    if(g.hits(near,e)) throw new Error('the pad is boss-only — a vamp should not get it');
    console.log('        boss hurtbox pads +25px horizontally; street enemies unchanged');
  });
  scene('lawyer boss: serves a subpoena fan, gavel sends a shockwave, open on recover', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle';
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'lawyer'); const b=g.boss;
    if(!b||b.arch!=='lawyer') throw new Error('lawyer did not spawn');
    for(let i=0;i<40;i++){ __tick(1); __draw(); }
    // force a subpoena — expect a fan of three papers in the air at once
    b.state='wind'; b.st=0; b.move='subpoena'; b.windLen=16; b.atkLen=22; b.hitDone=false;
    let fan=0; for(let i=0;i<50;i++){ __tick(1); __draw(); fan=Math.max(fan,g.fires.filter(f=>f.paper).length); }
    if(fan<3) throw new Error('the lawyer did not serve a 3-paper fan, saw '+fan);
    // force a gavel slam — expect ground shockwave rings
    b.state='wind'; b.st=0; b.move='gavel'; b.windLen=22; b.atkLen=30; b.hitDone=false;
    let sawShock=false; for(let i=0;i<60;i++){ __tick(1); __draw(); if(g.fires.some(f=>f.shock)) sawShock=true; }
    if(!sawShock) throw new Error('the gavel produced no shockwave');
    // the recover window is the opening — a clean hit must land
    b.state='recover'; b.st=0; __tick(1);
    const hp0=b.hp; g.P.x=b.x-24; g.P.face=1; g.P.iframes=0;
    g.connect(b,{dmg:30,stun:10});
    if(!(b.hp<hp0)) throw new Error('lawyer recover window must be vulnerable');
    console.log('        subpoena fan + gavel shockwave + open on recover');
  });
  scene('lawyer boss: the briefcase lockup cages you, bangs you, mash to break out', ()=>{
    const g=__G(); g.clearEnts();
    g.P.hp=g.P.maxhp=1e9; g.P.x=8020; g.P.z=300; g.P.y=0; g.P.vy=0; g.P.state='idle'; g.P.iframes=0;
    g.setCamLock(Math.max(0,g.P.x-170));
    g.spawnBoss(2,'lawyer'); const b=g.boss;
    if(!b||b.arch!=='lawyer') throw new Error('lawyer did not spawn');
    for(let i=0;i<50;i++){ __tick(1); __draw(); }         // settle past the intro + entrance i-frames
    // force the grab from point-blank — expect to get caged
    g.P.state='idle'; g.P.cageB=null; b.caged=false;      // clear anything the settle loop started
    b.x=g.P.x+50; b.z=g.P.z; b.face=-1; g.P.iframes=0;
    b.state='wind'; b.st=0; b.move='lockup'; b.windLen=18; b.atkLen=74; b.hitDone=false;
    let caged=false; for(let i=0;i<30;i++){ __tick(1); __draw(); if(g.P.state==='caged') caged=true; g.P.iframes=0; }
    if(!caged) throw new Error('the point-blank lockup did not cage the player');
    const hp0=g.P.hp;
    for(let i=0;i<40;i++){ __tick(1); __draw(); }        // let the case get banged
    if(!(g.P.hp<hp0)) throw new Error('the briefcase slams did no damage');
    // out-of-range: the grab must whiff (not cage), and he opens on recover
    g.P.hp=g.P.maxhp; g.P.state='idle'; g.P.x=b.x-300; g.P.z=g.P.z; g.P.iframes=0; b.caged=false;
    b.state='wind'; b.st=0; b.move='lockup'; b.windLen=18; b.atkLen=74; b.hitDone=false;
    let everCaged=false; for(let i=0;i<30;i++){ __tick(1); __draw(); if(g.P.state==='caged') everCaged=true; }
    if(everCaged) throw new Error('a far-away grab should whiff, not cage');
    console.log('        lockup cages + bangs you; out-of-range whiffs');
  });
  scene('grab-toss: hold ↓+punch to grab, wind up, hurl into traffic; a hit mid-windup breaks it', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=310; g.P.y=0; g.P.state='idle'; g.P.iframes=999;
    g.setCamLock(Math.max(0,g.P.x-170)); g.night.traffic=0;
    const mk=()=>{ const e=g.vamp(g.P.x+24,308,false); e.state='walk'; e.hitstun=0; g.spawn(e); return e; };
    // START the grab
    let e=mk();
    if(!g.atCurb()||!g.grabbable()) throw new Error('should be able to grab at the curb');
    if(!g.tryGrab()) throw new Error('tryGrab should start the grab');
    if(g.P.state!=='grab'||g.P.grabE!==e||e.state!=='held') throw new Error('grab did not lock both in place');
    // it must NOT be instant — a couple frames in (holding punch) you are still winding, enemy still held
    __key('KeyJ',true);
    for(let i=0;i<10;i++) __tick(1);
    if(e.state!=='held') throw new Error('the toss should not be instant — enemy left held too early: '+e.state);
    // hold through the wind-up → HURL
    for(let i=0;i<90;i++){ __tick(1); if(e.state==='thrown') break; }
    if(e.state!=='thrown') throw new Error('holding through the wind-up should hurl the enemy, got '+e.state);
    // car finishes it
    g.cars.push({x:e.x-60,dir:1,spd:6,col:'#8b1a2b',lane:348,len:90,horn:false});
    for(let i=0;i<50 && !e.dead;i++) __tick(1);
    if(!e.dead||g.night.traffic!==1) throw new Error('car splat should tally traffic, got dead='+e.dead+' traffic='+g.night.traffic);
    __key('KeyJ',false);
    // INTERRUPT: start another grab, then get hit mid-windup → grab breaks, enemy NOT thrown
    g.P.state='idle'; g.P.grabE=null; g.ents.length=0; g.P.iframes=999; e=mk();
    if(!g.tryGrab()) throw new Error('second grab should start');
    __key('KeyJ',true); for(let i=0;i<8;i++) __tick(1);
    if(g.P.state!=='grab') throw new Error('should still be winding the grab');
    g.P.iframes=0; g.hurtPlayer(20, g.P.x+40, 0);          // someone clocks you mid-grab
    if(g.P.state==='grab') throw new Error('a hit should knock you out of the grab');
    if(e.state==='thrown') throw new Error('a broken grab must NOT toss the enemy');
    __key('KeyJ',false);
    console.log('        grab locks both → wind-up (not instant) → hurl+splat; hit breaks the grab');
  });
  scene('grabbed: an enemy hurls YOU into the street unless you mash out', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1000; g.P.x=1200; g.P.z=310; g.P.y=0; g.P.state='idle'; g.P.iframes=0;
    g.setCamLock(Math.max(0,g.P.x-170));
    const grabYou=()=>{ const e=g.vamp(g.P.x+22,308,false); e.state='grabbing'; e.grabT=0; e.face=-1; g.spawn(e);
      g.P.state='grabbed'; g.P.grabbedBy=e; g.P.struggle=0; return e; };
    // DON'T mash → you get tossed into the street (heavy, but you survive)
    let e=grabYou(); const hp0=g.P.hp;
    for(let i=0;i<120;i++){ __tick(1); if(g.P.inStreet) break; }
    if(!g.P.inStreet) throw new Error('failing to mash out should throw you into the street');
    if(g.P.state!=='down') throw new Error('being tossed should knock you down');
    if(!(g.P.hp<hp0)) throw new Error('the toss should hurt');
    if(g.P.hp<=0) throw new Error('the toss must not instantly kill you');
    // recover fully
    for(let i=0;i<120;i++){ __tick(1); if(!g.P.inStreet && g.P.state==='idle') break; }
    if(g.P.inStreet) throw new Error('you should crawl back off the road');
    // NOW mash out in time → you break free, no toss
    g.P.hp=g.P.maxhp; g.P.x=1200; g.P.z=310; g.P.state='idle'; g.ents.length=0;
    e=grabYou();
    let escaped=false; for(let i=0;i<60;i++){ __key('KeyJ',true); __tick(1); __key('KeyJ',false); __tick(1);
      if(g.P.state!=='grabbed'){ escaped=true; break; } }
    if(!escaped) throw new Error('mashing punch should break the enemy grab');
    if(g.P.inStreet) throw new Error('mashing out should mean you are NOT tossed');
    console.log('        no mash → tossed into the street (survivable); mash → shook loose');
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
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.drunk=0; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const mk=()=>{ const e=g.vamp(g.P.x+30,260,false,false); e.state='walk'; e.hitstun=0; e.hp=e.maxhp=1000; g.spawn(e); return e; };
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
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.drunk=0; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+28,260,false,false); e.state='walk'; e.hp=e.maxhp=1000; g.spawn(e);
    g.P.weapon={type:'bottle',dur:g.WEAPONS.bottle.dur};
    __key('KeyJ',true); __tick(1); __key('KeyJ',false); for(let i=0;i<22;i++) __tick(1);
    if(g.P.weapon) throw new Error('a bottle (dur 1) should shatter on the first connect');
    console.log('        bottle shattered on contact');
  });
  scene('weapon: HOLD punch winds up and hurls it; a quick tap just swings', ()=>{
    const g=__G(); g.releaseArena();
    g.P.hp=g.P.maxhp=1e9; g.P.x=1200; g.P.z=260; g.P.y=0; g.P.state='idle'; g.P.iframes=99999; g.P.face=1;
    g.setCamLock(Math.max(0,g.P.x-170));
    const e=g.vamp(g.P.x+90,260,false,false); e.state='walk'; e.hp=e.maxhp=1000; g.spawn(e); const hp0=e.hp;
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
  scene('scam scales with confidence: broke on a 10/10 empties pockets, confident keeps it', ()=>{
    const g=__G(); g.clearEnts(); g.setCamLock(0);     // camLock non-null suppresses the 'her man' boss side-effect
    g.P.z=300; g.P.drunk=0;
    const mk=()=>({x:0,z:0,trueTier:10,scammer:false,talked:false,blown:false,listening:false,laugh:0,tellPh:0,lie:0,lieT:0,revealed:false});
    g.P.conf=0; g.P.money=1000; g.resolveTalk(mk());
    if(g.P.money>60) throw new Error('0-conf 10/10 should empty pockets, left $'+g.P.money);
    g.P.conf=100; g.P.money=1000; g.resolveTalk(mk());
    if(g.P.money<1000) throw new Error('confident player got played, lost $'+(1000-g.P.money));
    console.log('        broke → cleaned out; confident → kept it');
  });
  scene('confidence bleeds over time', ()=>{
    const g=__G(); g.clearEnts();
    g.U.rep=0; g.P.conf=80; g.P.drunk=0; g.P.x=400; g.P.z=300;
    const c0=g.P.conf; __tick(250);
    if(!(g.P.conf<c0-3)) throw new Error('confidence did not bleed: '+c0+'→'+g.P.conf);
    console.log('        conf '+c0+' → '+Math.round(g.P.conf)+' over 250 ticks');
  });
  scene('shop: open, buy every rank of everything', ()=>{
    const g=__G();
    const b=g.BUILDINGS.find(q=>q.kind==='burger');
    if(!b) throw new Error('no burger shop generated in 4000px');
    g.P.money=99999; g.setShop(true,b);
    for(const k in g.UPG) for(let i=0;i<g.UPG[k].max+2;i++) g.buy(k);
    g.P.hp=1; g.buy('burger'); g.buy('burger');
    g.setShop(false);
    for(const k in g.UPG) if(g.U[k]!==g.UPG[k].max) throw new Error(k+' stuck at '+g.U[k]);
  });
  scene('play on with all upgrades maxed', ()=>{
    __key('KeyD',true); __tick(1500); __key('KeyD',false); __draw();
  });
  scene('death does NOT wipe the screen', ()=>{
    const g=__G(); g.clearEnts();
    g.spawn(g.vamp(g.P.x+80,300,false,false));
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
  scene('knocked down in front of her = permanently done', ()=>{
    const g=__G(); g.clearEnts();
    const n=g.npcs.find(q=>!q.talked&&!q.blown);
    if(!n) throw new Error('no fresh npc');
    g.P.x=n.x+20; g.P.z=n.z; g.P.conf=100; g.P.iframes=0; g.P.hp=200; g.P.maxhp=200;
    g.hurtPlayer(30,g.P.x+30); __tick(140);
    if(!n.blown) throw new Error('she did not close off');
    if(!n.talked) throw new Error('blown npc still approachable');
    // and pressing talk gets you nothing
    g.P.x=n.x; g.P.state='idle'; g.P.downT=0;
    __key('KeyE',true); __tick(1); __key('KeyE',false); __tick(5);
    if(g.P.state==='talk') throw new Error('still able to talk to her after she saw it');
    __draw();
    console.log('        conf after: '+Math.round(g.P.conf)+'  (was 100)');
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
    const g=__G();
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
  scene('co-op: women are deterministic (same door → same woman + crew)', ()=>{
    // mkNpc must be a pure function of position so every client in a room generates the
    // identical woman/crew at each door. Was Math.random() — the reason women desynced.
    const g=__G();
    const a=g.mkNpc(1234,306), b=g.mkNpc(1234,306);
    if(a.who!==b.who) throw new Error('mkNpc.who not deterministic: '+a.who+' vs '+b.who);
    if(a.crew.length!==b.crew.length) throw new Error('mkNpc.crew size not deterministic');
    if(a.scammer!==b.scammer || a.trueTier!==b.trueTier) throw new Error('mkNpc tier/scammer not deterministic');
    const seen=new Set(); for(let x=200;x<6000;x+=520) seen.add(g.mkNpc(x,306).who);
    if(seen.size<2) throw new Error('mkNpc gives the same woman at every door — not seeded by position');
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
    g.clearEnts(); g.spawn(g.vamp(500,306,false)); g.spawn(g.rat(560,310));
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
    const nid=g.drops[0].nid, before=g.P.money;
    store.dropsGone={[nid]:{by:'other', m:20}}; g.coopApply();
    if(g.P.money!==before+20) throw new Error('teammate cash not credited: money '+g.P.money+' expected '+(before+20));
    if(!g.drops[0].gone) throw new Error('picked-up drop not removed for teammate');
    __setMP(false); delete global.Playroom;
  });
  const g2=__G();
  console.log('\nend state: x='+Math.round(g2.P.x)+'  block '+(g2.tier()+1)+
    '  ents '+g2.ents.length+'  buildings '+g2.BUILDINGS.length+
    '  crowd '+g2.crowd.length+'  drops '+g2.drops.length+'  fires '+g2.fires.length);
}
process.exit(err?1:0);
