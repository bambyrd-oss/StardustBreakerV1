// 3D street background — Three.js scene rendered to an offscreen 640x360 canvas and
// composited by render() as the game's background layer (see the __bg3d branch there).
// Self-disables (leaving the procedural bg() in charge) when WebGL is unavailable —
// which is exactly what the node harness sees, so tests exercise the fallback path.
// Camera height/pitch are SOLVED against the game's walk band, not tuned: sprites put
// their feet at screen-y=z across y 228..344 of 360, so the storefront base line must
// project to exactly 228px and the road front to 344px. The 0.0805 scroll factor in
// render() is the same solve: 3D units per game px at the sidewalk plane.
(function(){
try{
  if(typeof THREE==='undefined') return;
  const probe=document.createElement('canvas');
  const gl=probe.getContext && (probe.getContext('webgl2')||probe.getContext('webgl'));
  if(!gl || !gl.getParameter || !gl.getParameter(gl.VERSION)) return;   // no real WebGL -> procedural bg
const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=360;
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, preserveDrawingBuffer:true });
renderer.setPixelRatio(1);   // fixed 640x360 offscreen, upscaled by the game's pixelated blit
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

// ---- cel shading: a hard-stepped gradient ramp turns smooth lighting into flat comic tones ----
function toonGradient(steps){
  const c=document.createElement('canvas'); c.width=steps; c.height=1; const x=c.getContext('2d');
  for(let i=0;i<steps;i++){ const v=Math.round(255*(0.35+0.65*i/(steps-1))); x.fillStyle=`rgb(${v},${v},${v})`; x.fillRect(i,0,1,1); }
  const t=new THREE.CanvasTexture(c); t.minFilter=t.magFilter=THREE.NearestFilter; t.generateMipmaps=false; t.colorSpace=THREE.NoColorSpace; return t;
}
const TOON_GRAD = toonGradient(4);
// drop-in for MeshStandardMaterial: same options, but flat toon shading (roughness/metalness ignored)
function toonMat(o){ const p=Object.assign({}, o||{}); delete p.roughness; delete p.metalness; p.gradientMap=TOON_GRAD; return new THREE.MeshToonMaterial(p); }
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color:0x1a1220, side:THREE.BackSide });   // inverted-hull ink line

// ---- saturated sunset sky ----
function skyTexture(){
  const c = document.createElement('canvas'); c.width=8; c.height=256;
  const ctx=c.getContext('2d'); const g = ctx.createLinearGradient(0,0,0,256);
  g.addColorStop(0.00, '#241a55');   // deep indigo zenith
  g.addColorStop(0.28, '#5c327f');   // violet
  g.addColorStop(0.50, '#c34a72');   // magenta
  g.addColorStop(0.68, '#ff6b52');   // hot coral
  g.addColorStop(0.84, '#ff9e3d');   // orange
  g.addColorStop(1.00, '#ffdf7a');   // warm yellow at the horizon
  ctx.fillStyle=g; ctx.fillRect(0,0,8,256);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
scene.background = skyTexture();
const HORIZON = new THREE.Color('#ff9e5a');       // warm haze the distant buildings melt into
scene.fog = new THREE.Fog(HORIZON, 58, 195);

// ---- camera: side-on, slight downward tilt, pulled back so the street + skyline + sky all read ----
// telephoto → gentle perspective. Height/pitch are SOLVED, not tuned: the game draws sprite
// feet at screen-y = z over a fixed walk band (y 228→344 of 360), so the ground must project
// onto exactly that strip — storefront base (3D y0.6,z-8.5) → 228px, road front (3D z14) → 344px.
const camera = new THREE.PerspectiveCamera(24, 640/360, 0.1, 500);
camera.position.set(0, 21.91, 62);
camera.lookAt(0, 0.66, -26);

// ---- golden-hour light: low warm sun + cool sky fill = saturated, contrasty colour ----
scene.add(new THREE.HemisphereLight(0xffc98a, 0x59406a, 1.15));   // warm sky, cool violet ground bounce
scene.add(new THREE.AmbientLight(0xffb37a, 0.30));
const sun = new THREE.DirectionalLight(0xff9433, 1.8);            // saturated orange, low on the horizon
sun.position.set(34, 16, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);   // lighter for mobile GPUs
sun.shadow.camera.left=-70; sun.shadow.camera.right=70;
sun.shadow.camera.top=70; sun.shadow.camera.bottom=-30;
sun.shadow.camera.near=1; sun.shadow.camera.far=160;
sun.shadow.bias=-0.0004;
scene.add(sun);
const coolFill = new THREE.DirectionalLight(0x6f6cff, 0.35);      // cool rim from the opposite side (no shadow)
coolFill.position.set(-30, 22, 18); scene.add(coolFill);

// ---- sun disc + glow low in the sky ----
function glowTexture(){
  const c=document.createElement('canvas'); c.width=128;c.height=128; const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,64);
  g.addColorStop(0,'rgba(255,250,225,1)'); g.addColorStop(0.22,'rgba(255,226,150,.92)');
  g.addColorStop(0.5,'rgba(255,150,80,.42)'); g.addColorStop(1,'rgba(255,120,80,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTexture(), transparent:true, depthWrite:false, opacity:.95 }));
sunSprite.scale.set(85,85,1); sunSprite.position.set(46, 14, -150); scene.add(sunSprite);

// warm pool of light a street lamp throws down onto the pavement
function poolTexture(){
  const S=128,c=document.createElement('canvas');c.width=S;c.height=S;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,3,64,64,62);
  g.addColorStop(0,'rgba(255,230,165,.8)'); g.addColorStop(.45,'rgba(255,198,118,.34)'); g.addColorStop(1,'rgba(255,180,100,0)');
  x.fillStyle=g;x.fillRect(0,0,S,S);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const POOL_TEX=poolTexture();

// ---- ground: asphalt street + raised sidewalk ----
const GROUND_W = 1200;
// asphalt: speckle + tonal blotches + a few cracks, so the road reads as worn tarmac not flat grey
function asphaltTexture(){
  const S=256, c=document.createElement('canvas'); c.width=S;c.height=S; const x=c.getContext('2d');
  x.fillStyle='#45444d'; x.fillRect(0,0,S,S);
  const img=x.getImageData(0,0,S,S), d=img.data;
  for(let i=0;i<d.length;i+=4){ const n=(Math.random()*34-17)|0; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
  x.putImageData(img,0,0);
  for(let i=0;i<26;i++){ const cx=Math.random()*S, cy=Math.random()*S, r=16+Math.random()*54;
    const g=x.createRadialGradient(cx,cy,2,cx,cy,r);
    const dk=Math.random()<0.5; g.addColorStop(0, dk?'rgba(20,20,26,.22)':'rgba(150,150,160,.12)'); g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); }
  x.strokeStyle='rgba(15,15,20,.4)'; x.lineWidth=1.4;
  for(let i=0;i<5;i++){ x.beginPath(); let px=Math.random()*S, py=Math.random()*S; x.moveTo(px,py);
    for(let s=0;s<5;s++){ px+=(Math.random()-0.5)*70; py+=(Math.random()-0.5)*70; x.lineTo(px,py);} x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const asphaltTex = asphaltTexture(); asphaltTex.repeat.set(GROUND_W/9, 34/9);
const street = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, 34),
  toonMat({ map:asphaltTex, roughness:0.98 }));
street.rotation.x = -Math.PI/2; street.position.set(0, 0, 6); street.receiveShadow = true;
scene.add(street);

// back lot: ground extending under all the building bands, so the gaps BETWEEN buildings
// show dusky ground instead of the sunset sky punching through at street level
const backlot = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, 135),
  toonMat({ color:'#6b4a52' }));
backlot.rotation.x = -Math.PI/2; backlot.position.set(0, -0.06, -79.5);   // spans z -12 .. -147, tucked just under the sidewalk
backlot.receiveShadow = true; scene.add(backlot);

// (the double yellow centre line is built AFTER the crosswalks below — it breaks at every
// crosswalk like real road paint, so its segments must ride the same scroll/recycle slots)

// solid edge lines near each side of the road (static — a solid line reads the same scrolling or not)
for(const z of [ -3.4, 18.4 ]){
  const edge=new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W,0.4),
    toonMat({ color:'#cfc6a4', roughness:.8 }));
  edge.rotation.x=-Math.PI/2; edge.position.set(0,0.02,z); scene.add(edge);
}

// paved sidewalk with expansion joints
function pavingTexture(){
  const S=128,c=document.createElement('canvas'); c.width=S;c.height=S; const x=c.getContext('2d');
  x.fillStyle='#b0aa9c'; x.fillRect(0,0,S,S);
  const img=x.getImageData(0,0,S,S),d=img.data; for(let i=0;i<d.length;i+=4){ const n=(Math.random()*22-11)|0; d[i]+=n;d[i+1]+=n;d[i+2]+=n; } x.putImageData(img,0,0);
  x.strokeStyle='rgba(60,56,48,.55)'; x.lineWidth=3;
  for(let i=0;i<=S;i+=S/2){ x.beginPath();x.moveTo(i,0);x.lineTo(i,S);x.stroke(); x.beginPath();x.moveTo(0,i);x.lineTo(S,i);x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const pavingTex=pavingTexture(); pavingTex.repeat.set(GROUND_W/6, 13.6/6);
// sidewalk spans 3D z -12..+1.6 — the +1.6 curb line is where the game's CURB (z=272) projects,
// so the visual sidewalk/road boundary matches where gameplay switches from sidewalk to road
const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(GROUND_W, 0.6, 13.6),
  toonMat({ map:pavingTex, roughness:1 }));
sidewalk.position.set(0, 0.3, -5.2); sidewalk.receiveShadow = true; sidewalk.castShadow = true;
scene.add(sidewalk);
// curb lip between road and sidewalk
const curb=new THREE.Mesh(new THREE.BoxGeometry(GROUND_W,0.62,0.7),
  toonMat({ color:'#8f8a7e', roughness:1 }));
curb.position.set(0,0.31,1.25); curb.receiveShadow=true; curb.castShadow=true; scene.add(curb);

// ---- scrolling road dressing: crosswalks + manhole/patch decals, recycled like the buildings ----
function crosswalkTexture(){
  // ladder-rung zebra: each bar long ALONG the road (U/X), stacked in the crossing direction (V/Z)
  const c=document.createElement('canvas'); c.width=32;c.height=128; const x=c.getContext('2d');
  x.clearRect(0,0,32,128); x.fillStyle='#e7e2d4'; for(let i=0;i<8;i++) x.fillRect(2,4+i*16,28,9);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const cwTex=crosswalkTexture();
const road=[];    // {mesh, baseX}
const CW_N=3;     // sparse — a crosswalk roughly every ~87 world units
for(let k=0;k<CW_N;k++){
  const cw=new THREE.Mesh(new THREE.PlaneGeometry(9,20), toonMat({ map:cwTex, transparent:true, roughness:.9 }));
  cw.rotation.x=-Math.PI/2; cw.position.set(0,0.03,7);
  scene.add(cw); road.push({ mesh:cw, baseX:-260/2 + k*(260/CW_N) });
}
// double yellow centre line — two solid stripes straddling the road's centre (z 7.5 ± 1.4; the
// foreshortening needs real spacing for them to read as a pair). Like real road paint (MUTCD:
// longitudinal lines don't run through a crossing), the pair BREAKS at every crosswalk: each
// segment spans crosswalk-to-crosswalk minus a setback, and rides the SAME recycle slots as the
// crosswalk decals so the gaps stay glued to the crossings as the street scrolls.
{ const intv=260/CW_N, setback=2.0, segLen=intv-9-setback*2;   // 9 = crosswalk width along the road
  const yellow=toonMat({ color:'#f2c53a', roughness:.7 });
  for(let k=0;k<CW_N;k++){
    for(const z of [6.1,8.9]){
      const seg=new THREE.Mesh(new THREE.PlaneGeometry(segLen,0.42), yellow);
      seg.rotation.x=-Math.PI/2; seg.position.set(0,0.02,z);
      scene.add(seg); road.push({ mesh:seg, baseX:-260/2 + k*intv + intv/2 });   // centred between crossings
    }
  }
}
const decals=[];
for(let k=0;k<10;k++){
  const man = k%2===0;
  const m=new THREE.Mesh(man?new THREE.CircleGeometry(1.1,18):new THREE.PlaneGeometry(3.4,2.2),
    toonMat({ color: man?'#3a3a40':'#3d3c44', roughness:1 }));
  m.rotation.x=-Math.PI/2; m.position.set(0,0.02, man?12:4);
  scene.add(m); decals.push({ mesh:m, baseX:-260/2 + k*(260/10) + 6 });
}

// ---- facade texture: window grid on a base colour ----
function facadeTexture(base, lit){
  const W=128, H=256, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle=base; x.fillRect(0,0,W,H);
  // subtle vertical shading
  const g=x.createLinearGradient(0,0,W,0); g.addColorStop(0,'rgba(255,255,255,.06)'); g.addColorStop(.5,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.10)');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  const cols=4, rows=6, pad=14, gw=(W-pad*2)/cols, gh=(H-pad*2)/rows;
  const glass=['#ffc98a','#ff9e6e','#ffd7a8','#e79bc0','#b48fd8'];     // sunset-reflecting glass (warm + a little sky-violet)
  for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
    const wx=pad+col*gw+4, wy=pad+r*gh+4, ww=gw-8, wh=gh-10;
    const warm = ((r*7+col*3)%9===0);
    x.fillStyle = warm ? lit : glass[(r*3+col)%glass.length];
    x.fillRect(wx,wy,ww,wh);
    const gg=x.createLinearGradient(wx,wy,wx+ww,wy+wh);                // glassy diagonal sheen
    gg.addColorStop(0,'rgba(255,255,255,.34)'); gg.addColorStop(.5,'rgba(255,255,255,0)');
    x.fillStyle=gg; x.fillRect(wx,wy,ww,wh);
    x.fillStyle='rgba(0,0,0,.20)'; x.fillRect(wx,wy+wh-2,ww,2);        // bottom mullion
  }
  x.strokeStyle='rgba(0,0,0,.22)'; x.lineWidth=3; x.strokeRect(1.5,1.5,W-3,H-3);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping; return t;
}
// [facade base, warm-lit window] — saturated, and the bases skew warm to catch the sunset
const PALETTE = [
  ['#1fb3a0','#ffe27a'], ['#ff6f4e','#ffd98a'], ['#ffb02e','#fff2b0'],
  ['#ef5f92','#ffd0e6'], ['#4f74e0','#cfe0ff'], ['#a05fce','#f0d8ff'],
  ['#5ec24a','#eaffb0'], ['#e8552f','#ffcf9a'], ['#e0407a','#ffd4e2'],
];
const facades = PALETTE.map(([b,l])=>facadeTexture(b,l));

// awning stripe texture
function awningTexture(a, b){
  const c=document.createElement('canvas'); c.width=64; c.height=16; const x=c.getContext('2d');
  for(let i=0;i<8;i++){ x.fillStyle=i%2?a:b; x.fillRect(i*8,0,8,16); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; return t;
}
const awnings=[ awningTexture('#e0503f','#f4ead6'), awningTexture('#2f8f5a','#f4ead6'), awningTexture('#3a6fae','#f4ead6') ];

// ---- shop identities for the front row ----
// The block's culture from the game's own shop names — coffee, matcha, smoothies, juice,
// a bakery, a record shop, a florist, pizza — as visual KINDS instead of one repeated
// construction. Each kind owns its facade palette, sign colour, awning (striped or solid),
// a chunky 3D icon on the sign band, and its own sidewalk dressing.
const SHOP_KINDS=[
  { k:'coffee',   fac:['#6f4e37','#ffd98a'], sign:'#4a3222', awA:'#6f4e37', awB:'#f4ead6', solid:false, icon:'cup',      dress:'aframe',
    word:'COFFEE', neon:'#ffd23a', names:['BREW & CO','THE ROASTERY','GRIND TIME','CREMA','MORNING CO','PRESS'] },
  { k:'matcha',   fac:['#7fae7a','#eaffd8'], sign:'#2f6a44', awA:'#4f9a52', awB:'#4f9a52', solid:true,  icon:'leaf',     dress:'lantern',
    word:'MATCHA', neon:'#7fffb0', names:['MATCHA HOUSE','ZEN MATCHA','LEAF & BEAN','STEEP'] },
  { k:'smoothie', fac:['#ff8a5a','#fff2b0'], sign:'#e0503f', awA:'#ff8a5a', awB:'#ffe6b0', solid:false, icon:'cupStraw', dress:'aframe',
    word:'SMOOTHIES', neon:'#ff6f9e', names:['SMOOTHIE STOP','BLEND BAR','FOAM','SIP'] },
  { k:'juice',    fac:['#ffb02e','#fff2b0'], sign:'#e07a2e', awA:'#ffd23a', awB:'#fffbe8', solid:false, icon:'orange',   dress:'crates',
    word:'JUICE', neon:'#ffd23a', names:['THE JUICE BOX','PULP','CITRUS BAR','SUNBEAM'] },
  { k:'bakery',   fac:['#e8c9a0','#fffbe8'], sign:'#c9758f', awA:'#e8a4c0', awB:'#e8a4c0', solid:true,  icon:'donut',    dress:'aframe',
    word:'BAKERY', neon:'#ff9ec8', names:['WHISK','GOLDEN HOUR','THE OVEN','BUTTER & CO'] },
  { k:'records',  fac:['#5f5286','#e8d8ff'], sign:'#31284e', awA:'#31284e', awB:'#c9bfe8', solid:false, icon:'vinyl',    dress:null,
    word:'RECORDS', neon:'#c98aff', names:['B-SIDE','WAX CITY','THE CRATE','SPIN'] },
  { k:'florist',  fac:['#4f9a52','#ffd0e6'], sign:'#37703a', awA:'#4f9a52', awB:'#f4ead6', solid:false, icon:'flower',   dress:'planters',
    word:'FLOWERS', neon:'#7fffb0', names:['BLOOM','PETAL & CO','STEM','WILDFLOWER'] },
  { k:'pizza',    fac:['#e8552f','#ffcf9a'], sign:'#2f8f5a', awA:'#c94436', awB:'#f4ead6', solid:false, icon:'pizza',    dress:'crates',
    word:'PIZZA', neon:'#ff5a5a', names:['SLICE HOUSE','BIG PIE','CORNER SLICE','RED SAUCE'] },
];
for(const sk of SHOP_KINDS) sk.tex=facadeTexture(sk.fac[0], sk.fac[1]);
// the shop's name, painted on its sign band
function signTexture(kind, name){
  const c=document.createElement('canvas'); c.width=256; c.height=48; const x=c.getContext('2d');
  x.fillStyle=kind.sign; x.fillRect(0,0,256,48);
  x.fillStyle='rgba(255,255,255,.10)'; x.fillRect(0,0,256,7);
  x.strokeStyle='rgba(0,0,0,.35)'; x.lineWidth=4; x.strokeRect(2,2,252,44);
  x.font='700 26px "Bebas Neue", Impact, "Arial Narrow", sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.fillStyle='rgba(0,0,0,.45)'; x.fillText(name,150,27);
  x.fillStyle='#f4ead6'; x.fillText(name,148,25);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
// the display window: warm-lit interior, stocked shelves in the kind's colours, and a neon
// word buzzing in the glass — same language as the item store's OPEN
function shopWindowTexture(kind, seed){
  const c=document.createElement('canvas'); c.width=192; c.height=96; const x=c.getContext('2d');
  x.fillStyle='#1d1410'; x.fillRect(0,0,192,96);
  const g=x.createLinearGradient(0,0,0,96); g.addColorStop(0,'#5a3a22'); g.addColorStop(1,'#2a1a12');
  x.fillStyle=g; x.fillRect(5,5,182,86);
  const cols=[kind.awA, kind.awB, '#f4ead6'];
  for(let r=0;r<2;r++){ const ry=56+r*26;
    x.fillStyle='rgba(0,0,0,.4)'; x.fillRect(10,ry,172,3);
    for(let i=0;i<8;i++){ const hh=8+((Math.floor(seed*13)+i*7+r*3)%9);
      x.fillStyle=cols[(i+r)%cols.length]; x.globalAlpha=.85; x.fillRect(14+i*21, ry-hh, 14, hh); x.globalAlpha=1; } }
  x.font='700 24px "Bebas Neue", Impact, sans-serif'; x.textAlign='center'; x.textBaseline='middle';
  x.shadowColor=kind.neon; x.shadowBlur=14;
  x.fillStyle=kind.neon; x.fillText(kind.word, 96, 26);
  x.fillText(kind.word, 96, 26);
  x.shadowBlur=0; x.fillStyle='#fff8f0'; x.globalAlpha=.85; x.fillText(kind.word, 96, 26); x.globalAlpha=1;
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

// ---- deterministic per-column pseudo-random so recycling stays stable ----
function hash(n){ n=(n^61)^(n>>>16); n=n+(n<<3); n=n^(n>>>4); n=Math.imul(n,0x27d4eb2d); n=n^(n>>>15); return ((n>>>0)%100000)/100000; }

// building depth bands. Each band is a CONNECTED WALL: its buildings tile edge-to-edge (no gaps),
// so the street reads as a solid row of shopfronts with a jagged roofline instead of scattered
// towers with dark voids between them. FRONT row = tall & varied storefronts; BACK row is shorter
// and set back so its rooftops peek up in the valleys and the sunset sky shows over it; a far hazy
// skyline sits low on the horizon for depth. `tile` = target building width (widths are then
// normalised to sum to SPAN exactly so the wall stays seamless when it wraps).
const BANDS = [
  // FRONT row's face sits AT the walk-plane depth (z=-8.5, where the game's storefront base line
  // projects): every point on that plane scrolls exactly 1:1 with the game world, so the game's
  // 2D store facade (pinned to its world doorX) stays GLUED to one slot in this row instead of
  // parallax-sliding across it. Face z = -8.5 → band centre = -8.5 - depth/2.
  { z:-9.1, hBase:6,  hVar:5,  depth:1.2, store:true,  tile:9,  off:0 },  // FRONT (red) — razor-thin facade wall (6..11), scrolls 1:1
  { z:-27, hBase:5,  hVar:4,  depth:4,   store:false, tile:12, off:6 },   // BACK (blue) — 5..9: overlaps the front's range, so its roofs genuinely peek above the shorter fronts (its own roof hides behind the wall)
  { z:-74, hBase:4,  hVar:4,  depth:4,   store:false, tile:17, off:5, skyline:true },  // far haze: LOW (4..8) so it sits on the horizon instead of curtaining off the sky
];
const SPAN = 260;                        // world-x wrap width
const boxGeo = new THREE.BoxGeometry(1,1,1);
const cylGeo = new THREE.CylinderGeometry(1,1,1,12);
const coneGeo = new THREE.ConeGeometry(1,1,12);
const sphGeo = new THREE.SphereGeometry(1,10,8);
const MAT = {
  metal:  toonMat({ color:'#3b3f46', roughness:.65, metalness:.45 }),
  fesc:   toonMat({ color:'#9c7a5e' }),   // warm wrought-iron that catches the sunset instead of going black
  dark:   toonMat({ color:'#2a2d33', roughness:.6, metalness:.5 }),
  wood:   toonMat({ color:'#6e4a30', roughness:.95 }),
  vent:   toonMat({ color:'#9a9da2', roughness:.8, metalness:.3 }),
  glass:  toonMat({ color:'#ffd3a2', roughness:.12, metalness:.3, emissive:'#ff7a38', emissiveIntensity:.35 }),
  trim:   toonMat({ color:'#ece6d4', roughness:.9 }),
  leaf:   toonMat({ color:'#4f9a52', roughness:1 }),
  red:    toonMat({ color:'#c94436', roughness:.7 }),
  blue:   toonMat({ color:'#2f5f9e', roughness:.7 }),
  lamp:   toonMat({ color:'#fff6d2', emissive:'#ffce6a', emissiveIntensity:0.9 }),
};
const SIGN_COLS = ['#e0503f','#2f8f5a','#e0b24a','#c9758f','#3a8fae','#e07a3f','#7a5fae'];
const world = [];                        // {mesh, baseX, band, extras[]}
// helper: spawn a detail mesh that rides with its building (local x-offset preserved on recycle)
function detail(extras, geo, mat, baseX, sx,sy,sz, px,py,pz, rot){
  const m=new THREE.Mesh(geo,mat); m.scale.set(sx,sy,sz); m.position.set(px,py,pz);
  if(rot) m.rotation.x=rot; m.userData.ox=px-baseX; m.castShadow=true; m.receiveShadow=true;
  scene.add(m); extras.push(m); return m;
}

function buildColumn(band, baseX, seed, fixedW){
  const w = fixedW!=null ? fixedW : (5 + hash(seed)*6) * (band.wMul||1);
  let h = band.hBase + hash(seed*3+1)*band.hVar;
  const kind = band.store ? SHOP_KINDS[Math.floor(hash(seed*29+4)*SHOP_KINDS.length)] : null;
  if(band.store && hash(seed*23+7)<0.28) h = 4.7 + hash(seed*23+9)*0.9;   // some shops are little one-storey joints — breaks the roofline rhythm
  const tex = kind ? kind.tex : facades[Math.floor(hash(seed*7+2)*facades.length)];
  const t2 = tex.clone(); t2.needsUpdate=true; t2.repeat.set(Math.max(1,Math.round(w/5)), Math.max(2,Math.round(h/7)));
  const mat = band.skyline
    ? toonMat({ map:t2, color:'#ff9e6a', roughness:1 })   // warm hazy skyline, melts into the sunset fog
    : toonMat({ map:t2, roughness:.92 });
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, band.depth);
  m.position.set(baseX, h/2, band.z);
  m.castShadow = !band.skyline; m.receiveShadow = true;
  scene.add(m);
  const extras=[];
  // ink outline (inverted hull) for the comic silhouette — skip the hazy skyline band
  // NO x-inflation on the hull: the wall is edge-to-edge, so a widened outline juts out from
  // behind the neighbour as a black sliver at every seam. Inflate only height/depth — the
  // silhouette line still reads along the roofline, where it matters.
  if(!band.skyline){ const OL=0.7, ol=new THREE.Mesh(boxGeo, OUTLINE_MAT);
    ol.scale.set(w, h+OL, band.depth+OL); ol.position.set(baseX, h/2, band.z); ol.userData.ox=0;
    scene.add(ol); extras.push(ol); }
  const front = band.z + band.depth/2;                       // z of the camera-facing face
  // parapet cap / cornice (some buildings get a stepped cornice)
  detail(extras, boxGeo, toonMat({ color:'#00000026', transparent:true, roughness:1 }), baseX, w*1.03,1.1,band.depth*1.05, baseX,h+0.3,band.z);
  if(!band.skyline && hash(seed*17)>0.5) detail(extras, boxGeo, MAT.trim, baseX, w*1.06,0.5,band.depth*1.08, baseX,h-0.3,band.z);
  if(!band.skyline && band.depth>=3){   // rooftop clutter needs a real roof — on the razor-thin facade band it would overhang absurdly
    // rooftop water tower (iconic) on ~40%
    if(hash(seed*5+9)>0.6){
      const tr=1.1+hash(seed*5+6)*0.5, tx=baseX+(hash(seed*5+3)-0.5)*w*0.4, tz=band.z+(hash(seed*5+4)-0.5)*band.depth*0.3;
      detail(extras, cylGeo, MAT.wood, baseX, tr,2.4,tr, tx,h+2.0,tz);
      detail(extras, coneGeo, MAT.wood, baseX, tr*1.2,1.1,tr*1.2, tx,h+3.65,tz);
      for(let L=0;L<4;L++){ const a=L*Math.PI/2+0.78, lx=tx+Math.cos(a)*tr*0.7, lz=tz+Math.sin(a)*tr*0.7;
        detail(extras, boxGeo, MAT.dark, baseX, 0.16,1.7,0.16, lx,h+0.85,lz); }
    }
    // rooftop vents / AC boxes
    const vn=hash(seed*8)>0.5?2:1;
    for(let v=0;v<vn;v++){ const vx=baseX+(hash(seed*8+v*3)-0.5)*w*0.7;
      detail(extras, boxGeo, MAT.vent, baseX, 0.8+hash(seed*8+v)*0.9,0.7,0.9, vx,h+0.5,band.z+(hash(seed*8+v+2)-0.5)*band.depth*0.4); }
  }
  // storefront: glass front + frame + door + mullions + sign + awning
  if(band.store){
    // display window: a lit interior with stocked shelves + a neon word buzzing in the glass.
    // MeshBasicMaterial so it GLOWS against the dusk instead of taking the street light.
    detail(extras, boxGeo, new THREE.MeshBasicMaterial({ map:shopWindowTexture(kind, seed) }), baseX, w*0.86,4.2,0.3, baseX,2.3,front+0.22);
    detail(extras, boxGeo, MAT.metal, baseX, w*0.9,0.5,0.5, baseX,0.35,front+0.25);
    detail(extras, boxGeo, MAT.dark,  baseX, 1.2,3.0,0.34, baseX+w*0.25,1.7,front+0.27);           // door
    for(let mi=-1;mi<=1;mi++) detail(extras, boxGeo, MAT.metal, baseX, 0.12,4.2,0.33, baseX+mi*w*0.22,2.3,front+0.24);
    // sign band with the shop's NAME painted on it (drops to a roof sign on the one-storey joints)
    const sy=Math.min(6.5, h+0.4);
    const name=kind.names[Math.floor(hash(seed*37+2)*kind.names.length)];
    detail(extras, boxGeo, toonMat({ map:signTexture(kind,name), emissive:'#ffffff', emissiveIntensity:.10 }), baseX, w*0.8,1.5,0.35, baseX,sy,front+0.2);
    detail(extras, boxGeo, MAT.trim, baseX, w*0.8,0.28,0.4, baseX,sy-0.75,front+0.22);
    // awning: striped or solid, in the kind's colours
    const awMat = kind.solid ? toonMat({ color:kind.awA, roughness:.85 })
      : (()=>{ const t=awningTexture(kind.awA,kind.awB); t.repeat.set(Math.max(2,Math.round(w/2)),1); return toonMat({ map:t, roughness:.85 }); })();
    detail(extras, boxGeo, awMat, baseX, w*0.9,0.5,2.4, baseX,4.9,front+0.9, -0.32);
    // the shop's 3D icon, mounted on the sign band — what KIND of place this is at a glance
    const ix=baseX-w*0.28, iy=sy, iz=front+0.6;
    if(kind.icon==='cup'){ detail(extras, cylGeo, toonMat({color:'#f4ead6'}), baseX, 0.5,0.72,0.5, ix,iy,iz);
      detail(extras, boxGeo, toonMat({color:'#f4ead6'}), baseX, 0.16,0.34,0.16, ix+0.58,iy,iz); }                      // mug + handle
    else if(kind.icon==='cupStraw'){ detail(extras, cylGeo, toonMat({color:'#ff6f9e'}), baseX, 0.42,0.85,0.42, ix,iy,iz);
      detail(extras, boxGeo, toonMat({color:'#fffbe8'}), baseX, 0.1,0.85,0.1, ix+0.2,iy+0.55,iz); }                    // smoothie + straw
    else if(kind.icon==='leaf'){ detail(extras, sphGeo, toonMat({color:'#3f8a4a'}), baseX, 0.6,0.8,0.22, ix,iy,iz); }  // matcha leaf
    else if(kind.icon==='orange'){ detail(extras, sphGeo, toonMat({color:'#ff9e2e'}), baseX, 0.55,0.55,0.4, ix,iy,iz);
      detail(extras, boxGeo, toonMat({color:'#3f8a4a'}), baseX, 0.16,0.3,0.16, ix,iy+0.6,iz); }                        // orange + stem
    else if(kind.icon==='donut'){ const d=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.22,8,14), toonMat({color:'#e8a4c0'}));
      d.position.set(ix,iy,iz); d.userData.ox=ix-baseX; d.castShadow=true; scene.add(d); extras.push(d); }             // pink donut
    else if(kind.icon==='vinyl'){ detail(extras, cylGeo, toonMat({color:'#16121e'}), baseX, 0.9,0.14,0.9, ix,iy,iz, Math.PI/2);
      detail(extras, cylGeo, toonMat({color:'#e0407a'}), baseX, 0.3,0.18,0.3, ix,iy,iz+0.04, Math.PI/2); }             // record + label
    else if(kind.icon==='flower'){ detail(extras, sphGeo, toonMat({color:'#ef5f92'}), baseX, 0.42,0.42,0.42, ix,iy+0.2,iz);
      detail(extras, boxGeo, toonMat({color:'#3f8a4a'}), baseX, 0.12,0.6,0.12, ix,iy-0.3,iz); }                        // bloom on a stem
    else if(kind.icon==='pizza'){ detail(extras, new THREE.ConeGeometry(0.72,0.2,3), toonMat({color:'#ffb75a'}), baseX, 1,1,1, ix,iy,iz, Math.PI/2); }   // slice
    // sidewalk dressing per kind, up against the shopfront
    if(kind.dress==='aframe'){                                                     // chalkboard A-frame
      detail(extras, boxGeo, toonMat({color:'#3a2a1a'}), baseX, 0.7,1.05,0.1, baseX+w*0.32,0.52,-7.0, -0.18);
      detail(extras, boxGeo, toonMat({color:'#f4ead6'}), baseX, 0.52,0.68,0.03, baseX+w*0.32,0.58,-6.93, -0.18);
    } else if(kind.dress==='planters'){                                            // flowers spilling out front
      for(const o of [-0.32,0.34]){ detail(extras, boxGeo, MAT.wood, baseX, 0.85,0.5,0.55, baseX+w*o,0.25,-7.0);
        detail(extras, sphGeo, toonMat({color:'#4f9a52'}), baseX, 0.48,0.36,0.32, baseX+w*o,0.62,-7.0);
        detail(extras, sphGeo, toonMat({color:'#ef5f92'}), baseX, 0.16,0.16,0.16, baseX+w*o-0.22,0.74,-6.9);
        detail(extras, sphGeo, toonMat({color:'#ffd23a'}), baseX, 0.14,0.14,0.14, baseX+w*o+0.2,0.72,-6.88); }
    } else if(kind.dress==='crates'){                                              // produce stacked outside
      detail(extras, boxGeo, MAT.wood, baseX, 0.95,0.45,0.7, baseX+w*0.32,0.23,-7.0);
      detail(extras, boxGeo, MAT.wood, baseX, 0.95,0.45,0.7, baseX+w*0.32,0.7,-7.0);
      detail(extras, sphGeo, toonMat({color:'#ff9e2e'}), baseX, 0.2,0.2,0.2, baseX+w*0.32-0.22,0.99,-6.9);
      detail(extras, sphGeo, toonMat({color:'#c94436'}), baseX, 0.2,0.2,0.2, baseX+w*0.32+0.2,0.99,-6.88);
    } else if(kind.dress==='lantern'){                                             // a warm paper lantern by the door
      detail(extras, boxGeo, MAT.dark, baseX, 0.08,1.2,0.08, baseX-w*0.38,4.3,front+0.5);
      detail(extras, sphGeo, toonMat({color:'#ffd98a', emissive:'#ffb545', emissiveIntensity:.6}), baseX, 0.32,0.42,0.32, baseX-w*0.38,3.5,front+0.5);
    }
  }
  return { mesh:m, baseX, band, extras };
}

let colSeed = 0;
for(const band of BANDS){
  const cs0 = colSeed*101.7 + band.z*3.3;
  // pick per-building widths, then normalise them to sum to EXACTLY SPAN so the connected wall
  // tiles the wrap period seamlessly — when a building scrolls off one edge and +/-SPAN back to
  // the other, it lands flush against the chain instead of leaving a seam.
  const n = Math.max(3, Math.round(SPAN/band.tile));
  const raw=[]; let total=0;
  for(let i=0;i<n;i++){ const w = band.tile*(0.72 + hash(cs0+i*3.1)*0.7); raw.push(w); total+=w; }
  const k = SPAN/total;
  let x = -SPAN/2 + (band.off||0);
  for(let i=0;i<n;i++){ const w = raw[i]*k;
    world.push(buildColumn(band, x + w/2, colSeed, w));   // edge-to-edge: centre at x+w/2, advance by w
    x += w; colSeed++;
  }
}

// ---- street props on the sidewalk (recycled) ----
const props=[];   // {g, baseX}
function makeProp(type, seed){
  const g=new THREE.Group();
  const add=(geo,mat,sx,sy,sz,px,py,pz)=>{ const m=new THREE.Mesh(geo,mat); m.scale.set(sx,sy,sz); m.position.set(px,py,pz); m.castShadow=true; g.add(m); return m; };
  if(type==='lamp'){ add(cylGeo,MAT.dark,0.14,6.5,0.14,0,3.25,0); add(boxGeo,MAT.dark,1.6,0.14,0.14,0.7,6.4,0); add(boxGeo,MAT.lamp,0.5,0.4,0.5,1.4,6.2,0);
    // small bulb glint (not a big bloom) + a warm pool cast down on the pavement
    const gs=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:new THREE.Color('#ffdc88'), opacity:.5 }));
    gs.scale.set(1.6,1.6,1); gs.position.set(1.4,6.2,0.2); g.add(gs);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(6,4), new THREE.MeshBasicMaterial({ map:POOL_TEX, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    pool.rotation.x=-Math.PI/2; pool.position.set(1.2,0.03,0.5); g.add(pool); }
  else if(type==='tree'){ add(cylGeo,MAT.wood,0.28,3.0,0.28,0,1.5,0); add(sphGeo,MAT.leaf,2.0,1.9,2.0,0,3.7,0); add(sphGeo,MAT.leaf,1.4,1.4,1.4,0.8,3.1,0.3);
    add(boxGeo,toonMat({color:'#7a7266',roughness:1}),1.5,0.6,1.5,0,0.3,0); }   // planter
  else if(type==='hydrant'){ add(cylGeo,MAT.red,0.35,1.1,0.35,0,0.55,0); add(sphGeo,MAT.red,0.4,0.35,0.4,0,1.15,0); add(boxGeo,MAT.red,1.0,0.16,0.22,0,0.75,0); }
  else if(type==='trash'){ add(cylGeo,toonMat({color:'#33553f',roughness:.9}),0.55,1.3,0.55,0,0.65,0); add(cylGeo,MAT.dark,0.6,0.16,0.6,0,1.35,0); }
  else if(type==='mailbox'){ add(cylGeo,MAT.blue,0.55,0.5,0.55,0,1.2,0); add(boxGeo,MAT.blue,1.1,1.0,1.1,0,0.85,0); add(cylGeo,MAT.dark,0.12,1.0,0.12,0,0.5,0); }
  else if(type==='bench'){ add(boxGeo,MAT.wood,2.6,0.2,0.9,0,0.9,0); add(boxGeo,MAT.wood,2.6,0.9,0.15,0,1.4,-0.35); add(boxGeo,MAT.dark,0.15,0.9,0.8,-1.1,0.45,0); add(boxGeo,MAT.dark,0.15,0.9,0.8,1.1,0.45,0); }
  return g;
}
{ const kinds=['lamp','tree','hydrant','trash','mailbox','bench','tree','lamp'];
  const N=11;
  for(let k=0;k<N;k++){ const type=kinds[Math.floor(hash(k*31)*kinds.length)];
    const g=makeProp(type,k); const bx=-SPAN/2 + k*(SPAN/N) + (hash(k*7)-0.5)*3;
    g.position.set(bx, 0.6, -1.4 - hash(k*5)*1.4);       // on the sidewalk, near the curb
    scene.add(g); props.push({ g, baseX:bx }); }
}

// ---- pedestrians: small billboard walkers on the sidewalk (recycled) ----
// two texture frames per outfit — legs apart / legs together — swapped by walk phase
function pedTexture(shirt, stride){
  const c=document.createElement('canvas'); c.width=32;c.height=64; const x=c.getContext('2d');
  x.clearRect(0,0,32,64);
  x.fillStyle='#2a2029'; x.beginPath(); x.arc(16,10,5,0,7); x.fill();   // head
  x.fillStyle=shirt; x.fillRect(10,15,12,20);                            // torso
  x.fillStyle='#2a2833';
  if(stride){ x.fillRect(7,34,4,22); x.fillRect(21,34,4,22); }           // legs apart, mid-stride
  else      { x.fillRect(12,34,4,22); x.fillRect(17,34,4,22); }          // legs passing
  x.fillStyle=shirt;
  if(stride){ x.fillRect(6,16,3,16); x.fillRect(23,16,3,16); }           // arms swing with the stride
  else      { x.fillRect(8,16,3,16); x.fillRect(21,16,3,16); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const PED_COLS=['#c0503f','#3a7fae','#e0b24a','#4f9a52','#c9758f','#d8d2c4'];
const pedMats=PED_COLS.map(col=>[0,1].map(st=>new THREE.SpriteMaterial({ map:pedTexture(col,st), transparent:true })));
const peds=[];
for(let k=0;k<9;k++){
  const mats=pedMats[k%pedMats.length];
  const spr=new THREE.Sprite(mats[0]);
  const s=2.4+hash(k*13)*0.5, z=-2.5-hash(k*9)*3.5, y=1.6;
  spr.scale.set(s,s*1.9,1); const bx=-SPAN/2+k*(SPAN/9)+(hash(k*3)-0.5)*4;
  spr.position.set(bx, y, z); scene.add(spr);
  peds.push({ spr, mats, baseX:bx, y, sx:s, vx:(hash(k*5)<0.5?-1:1)*(0.03+hash(k*11)*0.03) });
}

// ---- clouds: real 3D toon puffs (clustered flattened spheres) drifting across the sunset ----
const clouds=[];
{ const tints=['#ffd8b0','#ffb99a','#ff9e8a','#f6c6d8','#ffe0b0'];   // sunset-lit undersides
  for(let i=0;i<8;i++){
    const g=new THREE.Group();
    const mat=toonMat({ color:tints[i%tints.length], emissive:'#7a3050', emissiveIntensity:.18, fog:false });
    const n=3+Math.floor(hash(i*23)*3);
    for(let b=0;b<n;b++){                              // a fat core blob + smaller side puffs
      const m=new THREE.Mesh(sphGeo, mat);
      const r=(b===0?1:0.45+hash(i*31+b)*0.35) * (7+hash(i*17)*6);
      m.scale.set(r*1.5, r*0.62, r);
      m.position.set((b===0?0:(b%2?1:-1)*(0.9+hash(i*7+b))*r*1.1), (b===0?0:-r*0.14), (hash(i*11+b)-0.5)*r*0.7);
      g.add(m);
    }
    g.position.set(-130+hash(i*41)*260, 32+hash(i*43)*18, -115-hash(i*47)*35);
    scene.add(g); clouds.push(g);
  }
}


// ---- the item store: a REAL 3D building slotted INTO the front row ----
// The game passes store door positions (world-x in 3D units) into render(). Front-row buildings
// overlapping a store are hidden — the row leaves a GAP — and a pooled store building (brick,
// pink awning, OPEN display window, lit open doorway, real depth so its side faces read in
// perspective) fills the slot. Its face sits on the 1:1 plane, so it stays aligned with the
// game's door trigger from every camera position.
const STORE_W=10, STORE_D=4, STORE_H=11;
function brickTexture(){
  const c=document.createElement('canvas'); c.width=64;c.height=64; const x=c.getContext('2d');
  x.fillStyle='#8a4438'; x.fillRect(0,0,64,64);
  x.fillStyle='rgba(60,24,18,.6)';
  for(let r=0;r<8;r++){ x.fillRect(0,r*8,64,1);
    for(let k=0;k<4;k++) x.fillRect(((r%2)*8+k*16)%64,r*8,1,8); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function openTexture(lit){
  // the store's stocked display window, OPEN sign hanging mid-glass; two variants = the flash
  const c=document.createElement('canvas'); c.width=128;c.height=128; const x=c.getContext('2d');
  x.fillStyle='#241a14'; x.fillRect(0,0,128,128);
  const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'#ffe6a8'); g.addColorStop(1,'#e2963a');
  x.fillStyle=g; x.fillRect(6,6,116,116);
  x.fillStyle='rgba(42,26,12,.6)';
  for(let r=0;r<3;r++){ const ry=40+r*34;
    for(let i=0;i<9;i++){ const ph=8+((i*37+r*13)%12); x.fillRect(10+i*13, ry-ph, 9, ph); }
    x.fillRect(8,ry,112,3); }
  x.fillStyle='#140a12'; x.fillRect(20,46,88,34);
  x.font='700 28px Impact, sans-serif'; x.textAlign='center';
  if(lit){ x.shadowColor='#ff3c96'; x.shadowBlur=14; x.fillStyle='#ffd7ec'; x.fillText('OPEN',64,73); x.shadowBlur=0; }
  else { x.fillStyle='#40222f'; x.fillText('OPEN',64,73); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const OPEN_ON=openTexture(true), OPEN_OFF=openTexture(false);
function buildStoreMesh(){
  // local x=0 is the DOOR (the game's trigger point); the body is laid out per-frame by
  // layoutStore() to exactly fill the slot of the ONE front-row building it replaces.
  const g=new THREE.Group();
  const brick=brickTexture(); brick.repeat.set(3,4);
  const body=new THREE.Mesh(boxGeo, toonMat({ map:brick, roughness:.95 }));
  body.castShadow=true; body.receiveShadow=true; g.add(body);
  const ol=new THREE.Mesh(boxGeo, OUTLINE_MAT); g.add(ol);
  const cor=new THREE.Mesh(boxGeo, toonMat({ color:'#d9c6a8', roughness:.9 })); g.add(cor);
  const winUp=[];
  for(let i=0;i<3;i++){ const wm=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.5),
      i===1? new THREE.MeshBasicMaterial({ color:0xffcf8a }) : toonMat({ color:'#2a2036', roughness:.4 }));
    g.add(wm); winUp.push(wm); }
  // pink striped awning, extending OUT toward the camera — the store's depth cue
  const awc=document.createElement('canvas'); awc.width=64; awc.height=16; const ax=awc.getContext('2d');
  for(let i=0;i<8;i++){ ax.fillStyle=i%2?'#ff2e88':'#ffe6f2'; ax.fillRect(i*8,0,8,16); }
  const awt=new THREE.CanvasTexture(awc); awt.colorSpace=THREE.SRGBColorSpace; awt.wrapS=THREE.RepeatWrapping; awt.repeat.set(3,1);
  const aw=new THREE.Mesh(boxGeo, toonMat({ map:awt, roughness:.85 }));
  aw.rotation.x=-0.3; g.add(aw);
  // display window with the OPEN sign (texture-swapped for the flash)
  const win=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.4), new THREE.MeshBasicMaterial({ map:OPEN_ON }));
  g.add(win);
  // the open doorway: lit interior, dark frame, door leaf swung to the jamb, welcome mat
  const dg=new THREE.Mesh(new THREE.PlaneGeometry(3.7,4.7), new THREE.MeshBasicMaterial({ color:0xffd9a0 }));
  dg.position.set(0,2.35,0.05); g.add(dg);
  const fr=new THREE.Mesh(boxGeo, toonMat({ color:'#3a221c', roughness:.9 }));
  fr.scale.set(4.5,0.5,0.5); fr.position.set(0,4.9,0.1); g.add(fr);                         // lintel
  for(const sx of [-2.1,2.1]){ const j=new THREE.Mesh(boxGeo, toonMat({ color:'#3a221c', roughness:.9 }));
    j.scale.set(0.4,4.8,0.5); j.position.set(sx,2.4,0.1); g.add(j); }                       // jambs
  const leaf=new THREE.Mesh(boxGeo, toonMat({ color:'#5a3a20', roughness:.9 }));
  leaf.scale.set(0.35,4.6,0.3); leaf.position.set(-1.7,2.3,0.28); g.add(leaf);
  const mat=new THREE.Mesh(boxGeo, toonMat({ color:'#7a2f3a', roughness:1 }));
  mat.scale.set(3.2,0.1,1.1); mat.position.set(0,0.05,0.6); g.add(mat);
  // face on the SAME plane as the front row (z=-8.5, the 1:1 plane) — children put the face at
  // local z0, so the whole group shifts back. This was the "floating on the sidewalk" bug.
  g.position.z=-8.5;
  g.userData={body,ol,cor,winUp,aw,win};
  return g;
}
// mould the store to the slot it fills: body centred where the replaced building stood (local c,
// relative to the door at x=0), body width = that building's width — the row stays seamless.
function layoutStore(s, c, bw){
  const u=s.userData, h=STORE_H, d=STORE_D;
  u.body.scale.set(bw,h,d);        u.body.position.set(c,h/2,-d/2);
  u.ol.scale.set(bw,h+0.7,d+0.7);  u.ol.position.copy(u.body.position);
  u.cor.scale.set(bw*1.04,0.6,d*1.1); u.cor.position.set(c,h-0.1,-d/2);
  const sp=Math.min(3, Math.max(2.2, bw/3.4));
  for(let i=0;i<3;i++){ const px=c+(i-1)*sp;
    u.winUp[i].position.set(px, 7.6, 0.06);
    u.winUp[i].visible = Math.abs(px-c) < bw/2-1.0; }   // keep windows on the wall
  u.aw.scale.set(bw*0.98,0.45,2.2); u.aw.position.set(c,5.6,0.75);
  // the OPEN window goes on whichever side of the door has more wall
  const leftW=(-2.0)-(c-bw/2), rightW=(c+bw/2)-2.0;
  const side=leftW>=rightW?-1:1, spaceW=Math.max(leftW,rightW);
  const ww=Math.min(4.4, spaceW-0.6);
  if(ww<1.6){ u.win.visible=false; }
  else { u.win.visible=true; u.win.scale.set(ww/4.4, Math.max(0.75,ww/4.4), 1);
    u.win.position.set(side*(2.0+ww/2+0.2), 2.5, 0.06); }
}
const storePool=[]; for(let i=0;i<3;i++){ const s=buildStoreMesh(); s.visible=false; scene.add(s); storePool.push(s); }
let bgTick=0;

// ---- Landlord D. Evict, in the flesh: a cel-shaded 3D boss rig ----
// The game's boss entity stays the single source of truth (AI, hitboxes, HP all unchanged);
// every frame render() passes its pose in and this rig mirrors it — position on the 1:1 plane,
// facing, intro rise-from-the-ground, the notice-throwing arm, dizzy sway, enrage shell, hit
// flash, and the death keel-over. drawBoss() skips its 2D body while this is on screen.
const bossRig=(function(){
  const g=new THREE.Group();
  const suit=toonMat({ color:'#3a2f1a', roughness:.95 }), dark=toonMat({ color:'#1a140a', roughness:.95 });
  const skin=toonMat({ color:'#c98d6a', roughness:.9 });
  const add=(geo,mat,sx,sy,sz,px,py,pz,shadow)=>{ const m=new THREE.Mesh(geo,mat);
    m.scale.set(sx,sy,sz); m.position.set(px,py,pz); if(shadow){ m.castShadow=true; } g.add(m); return m; };
  add(boxGeo,dark,1.0,0.4,1.2,-0.62,0.2,0); add(boxGeo,dark,1.0,0.4,1.2,0.62,0.2,0);          // shoes
  add(boxGeo,suit,0.8,1.7,0.95,-0.6,1.25,0,1); add(boxGeo,suit,0.8,1.7,0.95,0.6,1.25,0,1);    // cheap suit pants
  add(boxGeo,suit,2.9,2.6,1.5,0,3.4,0,1);                                                     // jacket
  add(boxGeo,dark,3.3,0.55,1.6,0,4.75,0,1);                                                   // shoulders
  const tie=add(boxGeo,toonMat({ color:'#c9d13a', roughness:.8 }),0.45,1.1,0.16,0,3.85,0.78); // eviction-yellow tie
  add(sphGeo,toonMat({ color:'#c9d13a', emissive:'#c9d13a', emissiveIntensity:.3 }),0.8,0.66,0.5,0,2.75,0.62); // the gut — his weak point
  add(boxGeo,skin,1.5,1.45,1.3,0,5.75,0,1);                                                   // ruddy face
  add(boxGeo,dark,0.22,0.22,0.1,-0.36,5.95,0.68); add(boxGeo,dark,0.22,0.22,0.1,0.36,5.95,0.68); // eyes
  const mus=add(boxGeo,toonMat({ color:'#5a4636', roughness:1 }),0.85,0.24,0.12,0.12,5.42,0.68);  // mustache
  const armL=add(boxGeo,suit,0.75,2.1,0.8,-1.95,3.55,0,1), armR=add(boxGeo,suit,0.75,2.1,0.8,1.95,3.55,0,1);
  const paper=add(boxGeo,toonMat({ color:'#efe9d8', roughness:.9 }),0.95,1.15,0.09,2.6,4.5,0.4); // the served notice
  // ink outlines PER PART — one big hull box swallowed the whole silhouette into a black slab
  const hull=(sx,sy,sz,px,py,pz)=>{ const m=new THREE.Mesh(boxGeo, OUTLINE_MAT);
    m.scale.set(sx+0.22,sy+0.22,sz+0.22); m.position.set(px,py,pz); g.add(m); return m; };
  hull(2.9,2.6,1.5, 0,3.4,0);       // jacket
  hull(1.5,1.45,1.3, 0,5.75,0);     // head
  hull(3.3,0.55,1.6, 0,4.75,0);     // shoulders
  const flash=new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.5, depthWrite:false }));
  flash.scale.set(3.6,7.5,2.1); flash.position.set(0,3.6,0); g.add(flash);
  const rage=new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color:0xff2a2a, transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  rage.scale.set(2.4,4.4,1.8); rage.position.set(0,3.6,0); g.add(rage);
  g.visible=false; scene.add(g);
  g.userData={armL,armR,mus,paper,flash,rage,tie};
  return g;
})();
function syncBoss(bs){
  if(!bs){ bossRig.visible=false; return; }
  const u=bossRig.userData, f=bs.face||1;
  bossRig.visible=true;
  const G= bs.state==='intro' ? Math.max(0.02, 1-(bs.rise||0)) : 1;
  const swell= bs.enraged ? 1.12+0.02*Math.sin(bgTick*0.35) : 1;
  bossRig.position.x = (bs.x-320)*0.0805 - scroll;   // -320: 3D x=0 is screen CENTRE, game x is left-edge-referenced
  bossRig.position.z = -8.5 + (bs.z-228)*0.194;
  bossRig.position.y = bs.y*0.0805 + Math.sin((bs.anim||0)*2)*0.18;
  bossRig.scale.set(swell, G*swell, swell);
  // asymmetric bits mirror with facing
  u.armR.position.x=1.95*f; u.armL.position.x=-1.95*f; u.mus.position.x=0.12*f; u.paper.position.x=2.6*f;
  // pose: wind rears back, attack lunges, dizzy sways with arms dropped, death keels over
  let lean=0;
  if(bs.state==='wind') lean=0.10*f;
  else if(bs.state==='attack') lean=-0.14*f;
  if(bs.dizzy) lean=Math.sin(bgTick*0.1)*0.1;
  if(bs.state==='dead'){ const d=Math.min(1,(bs.st||0)/30); lean=-f*d*1.45; bossRig.position.y-=d*1.6; }
  bossRig.rotation.z=lean;
  const arm= bs.dizzy?0.5:0;
  u.armL.rotation.z=arm; u.armR.rotation.z= bs.notice? -1.05*f : -arm;
  u.armR.position.y= bs.notice? 4.45 : 3.55;
  u.paper.visible=!!bs.notice;
  u.flash.visible=!!bs.hit;
  u.rage.visible=!!bs.enraged;
}

  renderer.setSize(640,360,false);
  let scroll=0;
  function stepBg(sc, storeXs, bossState){
    scroll=sc; bgTick++;
    syncBoss(bossState);
    const xs=(storeXs||[]).filter(x=>Math.abs(x-scroll)<40).slice(0,storePool.length);
    const lit=(bgTick%150)<126;
    // position the row first (all visible), collecting the front band
    const fronts=[];
    for(const b of world){ const sx=b.baseX-scroll; if(sx<-SPAN/2)b.baseX+=SPAN; else if(sx>SPAN/2)b.baseX-=SPAN;
      const nx=b.baseX-scroll; b.mesh.position.x=nx; for(const e of b.extras) e.position.x=nx+(e.userData.ox||0);
      if(b.band.store){ if(!b.mesh.visible){ b.mesh.visible=true; for(const e of b.extras) e.visible=true; } fronts.push(b); } }
    // each store REPLACES exactly the one front-row building behind its door: hide that building
    // and mould the store to fill its slot (same centre, same width) — the row stays seamless,
    // no oversized gap. The store's face shares the row's z-plane (see buildStoreMesh).
    for(let i=0;i<storePool.length;i++){ const s=storePool[i];
      if(i>=xs.length){ s.visible=false; continue; }
      const gx=xs[i]-scroll;
      s.visible=true; s.position.x=gx;
      s.userData.win.material.map= lit?OPEN_ON:OPEN_OFF;
      let best=null,bd=1e9;
      for(const b of fronts){ const d=Math.abs(b.mesh.position.x-gx); if(d<bd){bd=d;best=b;} }
      let c=0, bw=STORE_W;
      if(best && bd<12){
        best.mesh.visible=false; for(const e of best.extras) e.visible=false;
        c=best.mesh.position.x-gx; bw=best.mesh.scale.x+0.5;
      }
      const lim=Math.max(0,bw/2-2.6); c=Math.max(-lim,Math.min(lim,c));   // keep the door inside the wall
      layoutStore(s, c, bw);
    }
    for(const p of props){ const sx=p.baseX-scroll; if(sx<-SPAN/2)p.baseX+=SPAN; else if(sx>SPAN/2)p.baseX-=SPAN; p.g.position.x=p.baseX-scroll; }
    for(const pe of peds){ pe.baseX+=pe.vx; let sx=pe.baseX-scroll; if(sx<-SPAN/2)pe.baseX+=SPAN; else if(sx>SPAN/2)pe.baseX-=SPAN;
      pe.spr.position.x=pe.baseX-scroll; pe.spr.position.y=pe.y+Math.abs(Math.sin(pe.baseX*0.6))*0.18; pe.spr.scale.x=(pe.vx<0?-Math.abs(pe.sx):Math.abs(pe.sx));
      pe.spr.material = pe.mats[Math.floor(Math.abs(pe.baseX)*1.4)%2]; }   // stride/passing leg frames — an actual walk, not a glide
    asphaltTex.offset.x=scroll/9; pavingTex.offset.x=scroll/6;
    for(const g of road.concat(decals)){ const sx=g.baseX-scroll; if(sx<-SPAN/2)g.baseX+=SPAN; else if(sx>SPAN/2)g.baseX-=SPAN; g.mesh.position.x=g.baseX-scroll; }
    for(const s of clouds){ s.position.x-=0.012; if(s.position.x<-150)s.position.x=150; }
    renderer.render(scene,camera);
  }
  globalThis.__bg3d = { render:stepBg, canvas:canvas };
}catch(e){ /* any init failure -> game keeps its procedural background */ }
})();
