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
const camBaseQ = camera.quaternion.clone();   // the solved pose — roll (the eviction chase) is applied on top per frame
const camBasePos = camera.position.clone();   // the solved position — the corner crane/orbit move around this
// the corner turn's HELICOPTER shot: crane the camera up+back to a bird's-eye over the city (aerial→1),
// spin 90° up there where altitude hides the world reset, then dive back to the street pose on the new block
const CAM_HIGH   = new THREE.Vector3(0, 96, 40);        // drone perch — high enough to read as bird's-eye, low enough that Bam stays legible
const CAM_PIVOT  = new THREE.Vector3(0, 1.5, -3.84);    // Bam at the corner (walk plane, screen centre)
const CAM_STREETLOOK = new THREE.Vector3(0, 0.66, -26); // the street pose's look target
const _camLook = new THREE.Vector3();

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
const edgeLines=[];
for(const z of [ -3.4, 18.4 ]){
  const edge=new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W,0.4),
    toonMat({ color:'#cfc6a4', roughness:.8 }));
  edge.rotation.x=-Math.PI/2; edge.position.set(0,0.02,z); scene.add(edge); edgeLines.push(edge);
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
    glow:'#ffd98a', names:['BREW & CO','THE ROASTERY','GRIND TIME','CREMA','MORNING CO','PRESS'] },
  { k:'matcha',   fac:['#7fae7a','#eaffd8'], sign:'#2f6a44', awA:'#4f9a52', awB:'#4f9a52', solid:true,  icon:'leaf',     dress:'lantern',
    glow:'#b0ffd0', names:['MATCHA HOUSE','ZEN MATCHA','LEAF & BEAN','STEEP'] },
  { k:'smoothie', fac:['#ff8a5a','#fff2b0'], sign:'#e0503f', awA:'#ff8a5a', awB:'#ffe6b0', solid:false, icon:'cupStraw', dress:'aframe',
    glow:'#ff6f9e', neon:'#ff6f9e', names:['SMOOTHIE STOP','BLEND BAR','FOAM','SIP'] },
  { k:'juice',    fac:['#ffb02e','#fff2b0'], sign:'#e07a2e', awA:'#ffd23a', awB:'#fffbe8', solid:false, icon:'orange',   dress:'crates',
    glow:'#ffd23a', neon:'#ff9e2e', names:['THE JUICE BOX','PULP','CITRUS BAR','SUNBEAM'] },
  { k:'bakery',   fac:['#e8c9a0','#fffbe8'], sign:'#c9758f', awA:'#e8a4c0', awB:'#e8a4c0', solid:true,  icon:'donut',    dress:'aframe',
    glow:'#ffb545', names:['WHISK','GOLDEN HOUR','THE OVEN','BUTTER & CO'] },
  { k:'records',  fac:['#5f5286','#e8d8ff'], sign:'#31284e', awA:'#31284e', awB:'#c9bfe8', solid:false, icon:'vinyl',    dress:null,
    glow:'#c98aff', neon:'#c98aff', names:['B-SIDE','WAX CITY','THE CRATE','SPIN'] },
  { k:'florist',  fac:['#4f9a52','#ffd0e6'], sign:'#37703a', awA:'#4f9a52', awB:'#f4ead6', solid:false, icon:'flower',   dress:'planters',
    glow:'#c0ffd8', names:['BLOOM','PETAL & CO','STEM','WILDFLOWER'] },
  { k:'pizza',    fac:['#e8552f','#ffcf9a'], sign:'#2f8f5a', awA:'#c94436', awB:'#f4ead6', solid:false, icon:'pizza',    dress:'crates',
    glow:'#ff5a5a', neon:'#ff5a5a', names:['SLICE HOUSE','BIG PIE','CORNER SLICE','RED SAUCE'] },
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
// a neon tube stroke: coloured glow passes + a white core, like real glass tube
function neonPath(x, col, draw){
  x.save(); x.lineCap='round'; x.lineJoin='round';
  x.shadowColor=col; x.shadowBlur=13; x.strokeStyle=col; x.lineWidth=3.6;
  x.beginPath(); draw(x); x.stroke(); x.stroke();
  x.shadowBlur=0; x.strokeStyle='#fff'; x.lineWidth=1.5; x.beginPath(); draw(x); x.stroke();
  x.restore();
}
// the display window. NOT every shop gets neon — each kind has its own light source:
// juice/smoothie/records/pizza hang a neon ICON in the glass (a fruit, a cup, a disc, a slice —
// no words); the bakery runs a golden pastry-case glow; the florist a cool botanical light;
// coffee and matcha keep quiet warm interiors (their light hangs outside — bulbs and lanterns).
function shopWindowTexture(kind, seed){
  const c=document.createElement('canvas'); c.width=192; c.height=96; const x=c.getContext('2d');
  x.fillStyle='#1d1410'; x.fillRect(0,0,192,96);
  let g=x.createLinearGradient(0,0,0,96);
  if(kind.k==='bakery'){ g.addColorStop(0,'#8a5a2a'); g.addColorStop(1,'#4a2c16'); }
  else if(kind.k==='florist'){ g.addColorStop(0,'#55705a'); g.addColorStop(1,'#26332a'); }
  else { g.addColorStop(0,'#5a3a22'); g.addColorStop(1,'#2a1a12'); }
  x.fillStyle=g; x.fillRect(5,5,182,86);
  if(kind.k==='florist'){
    // stems and blooms instead of shelf stock
    for(let i=0;i<7;i++){ const px=20+i*24, hh=26+((Math.floor(seed*11)+i*5)%18);
      x.strokeStyle='#3f8a4a'; x.lineWidth=3; x.beginPath(); x.moveTo(px,88); x.lineTo(px+((i%2)*6-3),88-hh); x.stroke();
      x.fillStyle=['#ef5f92','#ffd23a','#ff8a5a','#e8a4c0'][i%4];
      x.beginPath(); x.arc(px+((i%2)*6-3),86-hh,5.5,0,7); x.fill(); }
  } else if(kind.k==='bakery'){
    // pastry domes on lit shelves
    for(let r=0;r<2;r++){ const ry=56+r*28;
      x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(10,ry,172,3);
      for(let i=0;i<6;i++){ x.fillStyle=['#ffe6b0','#e8a4c0','#f4ead6'][i%3];
        x.beginPath(); x.arc(24+i*28, ry-2, 9, Math.PI, 0); x.fill(); } }
  } else {
    const cols=[kind.awA, kind.awB, '#f4ead6'];
    for(let r=0;r<2;r++){ const ry=56+r*26;
      x.fillStyle='rgba(0,0,0,.4)'; x.fillRect(10,ry,172,3);
      for(let i=0;i<8;i++){ const hh=8+((Math.floor(seed*13)+i*7+r*3)%9);
        x.fillStyle=cols[(i+r)%cols.length]; x.globalAlpha=.85; x.fillRect(14+i*21, ry-hh, 14, hh); x.globalAlpha=1; } }
  }
  // icon neon, only for the neon kinds
  if(kind.k==='juice'){
    const v=Math.floor(seed*7)%3;
    if(v===0){ neonPath(x,'#ff9e2e',p=>p.arc(96,32,14,0,Math.PI*2));                      // orange
      neonPath(x,'#5fdc6a',p=>{ p.moveTo(96,16); p.quadraticCurveTo(108,8,114,16); p.quadraticCurveTo(104,20,96,16); }); }
    else if(v===1){ neonPath(x,'#ffe23a',p=>{ p.moveTo(72,24); p.quadraticCurveTo(94,52,120,26); p.quadraticCurveTo(96,40,72,24); }); }  // banana
    else { neonPath(x,'#ff4a5e',p=>{ p.moveTo(82,24); p.quadraticCurveTo(80,42,96,50); p.quadraticCurveTo(112,42,110,24); p.quadraticCurveTo(96,16,82,24); });  // strawberry
      neonPath(x,'#5fdc6a',p=>{ p.moveTo(88,20); p.lineTo(92,12); p.moveTo(96,19); p.lineTo(96,10); p.moveTo(104,20); p.lineTo(100,12); }); }
  } else if(kind.k==='smoothie'){
    neonPath(x,kind.neon,p=>{ p.moveTo(84,20); p.lineTo(108,20); p.lineTo(104,50); p.lineTo(88,50); p.closePath(); p.moveTo(100,20); p.lineTo(107,7); });
  } else if(kind.k==='records'){
    neonPath(x,kind.neon,p=>p.arc(96,32,16,0,Math.PI*2));
    neonPath(x,'#ff6f9e',p=>p.arc(96,32,5,0,Math.PI*2));
  } else if(kind.k==='pizza'){
    neonPath(x,kind.neon,p=>{ p.moveTo(78,20); p.lineTo(114,20); p.lineTo(96,52); p.closePath(); });
    neonPath(x,'#ffd23a',p=>{ p.arc(90,27,2.5,0,7); p.moveTo(104.5,29); p.arc(102,29,2.5,0,7); p.moveTo(98.5,38); p.arc(96,38,2.5,0,7); });
  }
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
  // the front band's face math (details, `front` below) stays on the razor-thin band numbers, but
  // the BOX itself gets real depth extending BACKWARD from that same face — side-on nothing moves,
  // and when the corner-turn camera orbits, the row reads as actual buildings instead of a stage
  // flat ("behind the curtain"). Other bands keep their declared depth.
  const bodyD = band.store ? 7 : band.depth;
  const bodyZ = (band.z + band.depth/2) - bodyD/2;      // same front face, deeper back
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, bodyD);
  m.position.set(baseX, h/2, bodyZ);
  m.castShadow = !band.skyline; m.receiveShadow = true;
  scene.add(m);
  const extras=[];
  // ink outline (inverted hull) for the comic silhouette — skip the hazy skyline band
  // NO x-inflation on the hull: the wall is edge-to-edge, so a widened outline juts out from
  // behind the neighbour as a black sliver at every seam. Inflate only height/depth — the
  // silhouette line still reads along the roofline, where it matters.
  if(!band.skyline){ const OL=0.7, ol=new THREE.Mesh(boxGeo, OUTLINE_MAT);
    ol.scale.set(w, h+OL, bodyD+OL); ol.position.set(baseX, h/2, bodyZ); ol.userData.ox=0;
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
  // storefront: glass front + frame + mullions + sign + awning. NO door — only the real walk-in
  // item store (its own rig) has one; a painted door on a shop you can't enter just reads as a lie.
  if(band.store){
    // display window: a lit interior with stocked shelves + a neon word buzzing in the glass.
    // MeshBasicMaterial so it GLOWS against the dusk instead of taking the street light.
    detail(extras, boxGeo, new THREE.MeshBasicMaterial({ map:shopWindowTexture(kind, seed) }), baseX, w*0.86,4.2,0.3, baseX,2.3,front+0.22);
    detail(extras, boxGeo, MAT.metal, baseX, w*0.9,0.5,0.5, baseX,0.35,front+0.25);
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
    } else if(kind.dress==='lantern'){                                             // paper lanterns flanking the door
      for(const o of [-0.38,0.38]){
        detail(extras, boxGeo, MAT.dark, baseX, 0.08,1.2,0.08, baseX+w*o,4.3,front+0.5);
        detail(extras, sphGeo, toonMat({color:'#ffd98a', emissive:'#ffb545', emissiveIntensity:.6}), baseX, 0.32,0.42,0.32, baseX+w*o,3.5,front+0.5); }
    }
    // ---- each kind is its own SOURCE of light on the street ----
    // (glow meshes bypass detail() so they never cast shadows)
    const glow=(geo,mat,sx2,sy2,sz2,px,py,pz,rx)=>{ const gm=new THREE.Mesh(geo,mat);
      gm.scale.set(sx2,sy2,sz2); if(rx) gm.rotation.x=rx; gm.position.set(px,py,pz);
      gm.userData.ox=px-baseX; scene.add(gm); extras.push(gm); return gm; };
    if(kind.k==='coffee'){                                                          // string lights sagging under the awning
      const bulbMat=new THREE.MeshBasicMaterial({ color:0xffe6a8 });
      for(let i=0;i<7;i++){ const tt=i/6;
        glow(sphGeo, bulbMat, 0.11,0.11,0.11, baseX+(tt-0.5)*w*0.8, 4.5-Math.sin(Math.PI*tt)*0.35, front+1.9); }
    }
    // coloured light spilling from the shopfront onto the pavement — the street picks up
    // a different pool of colour at every store
    glow(new THREE.PlaneGeometry(1,1),
      new THREE.MeshBasicMaterial({ map:POOL_TEX, color:new THREE.Color(kind.glow), transparent:true,
        opacity: kind.neon?0.55:0.35, blending:THREE.AdditiveBlending, depthWrite:false }),
      w*0.8,3.6,1, baseX,0.035,-6.7, -Math.PI/2);
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

// ---- a REAL fire escape: railed landings, alternating stair runs with treads, drop ladder ----
// Built once per mount from scaled boxes in black steel. Local orientation: mounted on a wall whose
// face points +z (toward the viewer); platforms extend outward in +z. Rotate the group to remount.
const FE_STEEL=toonMat({ color:'#171219', roughness:.85 });
function buildFireEscape(floors, w){
  const g=new THREE.Group();
  const fh=3.15, d=1.15;
  const bar=(sx,sy,sz,px,py,pz,rz)=>{ const m=new THREE.Mesh(boxGeo,FE_STEEL);
    m.scale.set(sx,sy,sz); m.position.set(px,py,pz); if(rz)m.rotation.z=rz; g.add(m); return m; };
  for(let f=0;f<floors;f++){
    const y=f*fh;
    bar(w,0.12,d, 0,y,d/2);                                     // landing
    bar(w,0.07,0.07, 0,y+1.05,d-0.06);                          // top rail
    bar(w,0.05,0.05, 0,y+0.6,d-0.06);                           // mid rail
    const nb=Math.max(4,Math.round(w/0.65));
    for(let i=0;i<=nb;i++) bar(0.05,1.05,0.05, -w/2+i*(w/nb), y+0.53, d-0.06);   // balusters
    for(const sx of [-1,1]){                                    // end rails
      bar(0.05,1.05,0.05, sx*(w/2-0.02), y+0.53, d*0.3);
      bar(0.06,0.06,d*0.6, sx*(w/2-0.02), y+1.05, d*0.4);
    }
    if(f<floors-1){                                             // stair run to the next landing, alternating
      const dir=f%2?1:-1, x0=dir*(w/2-0.55), x1=-dir*(w/2-0.55), ns=6;
      for(let i=1;i<=ns;i++){ const tt=i/(ns+1);
        bar(0.8,0.07,0.55, x0+(x1-x0)*tt, y+fh*tt, d/2); }      // treads
      const ang=Math.atan2(fh, x1-x0), L=Math.hypot(x1-x0, fh);
      bar(L,0.07,0.07, (x0+x1)/2, y+fh/2-0.15, d/2, ang);       // stringer
      bar(L,0.06,0.06, (x0+x1)/2, y+fh/2+1.0, d-0.06, ang);     // handrail
    }
  }
  const lx=-(w/2-0.35);                                         // drop ladder below the first landing
  for(const sx of [lx-0.22, lx+0.22]) bar(0.06,2.6,0.06, sx, -1.3, d*0.45);
  for(let i=0;i<5;i++) bar(0.5,0.05,0.05, lx, -0.35-i*0.5, d*0.45);
  return g;
}

// ---- a back-alley, rebuilt from the user's reference photos (Cortlandt Alley et al.) ----
// The real-photo signature: a SERVICE-LANE width (not a slot), FULL-height brick flanks, a black
// zigzag FIRE ESCAPE on one wall, utility WIRES sagging down its length, dumpster + trash bags +
// AC boxes along the walls, a graffiti tag, a caged-bulb service door, a WET centre strip catching
// the light — and an OPEN far end glowing through to the next street (never a dead end).
const ALLEY_H=13, ALLEY_D=30;
function buildAlleyMesh(){
  const g=new THREE.Group();
  const brick=brickTexture(); brick.repeat.set(2,5);
  const brick2=brickTexture(); brick2.repeat.set(2,5);
  const wallMatL=toonMat({ map:brick,  color:'#7a6450', roughness:1 });
  const wallMatR=toonMat({ map:brick2, color:'#6a5a52', roughness:1 });   // the two flanks read as different buildings
  const steel=toonMat({ color:'#14101a', roughness:.9 });
  const F=new THREE.Mesh(boxGeo, toonMat({ color:'#161320', roughness:1 })); g.add(F);   // worn asphalt path
  const wet=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ color:0xffb35a, transparent:true, opacity:0.13 })); // the drainage strip, catching warm light
  wet.rotation.x=-Math.PI/2; g.add(wet);
  const puddles=[]; for(let i=0;i<2;i++){ const p=new THREE.Mesh(new THREE.CircleGeometry(0.9,10),
    new THREE.MeshBasicMaterial({ color:0xffc98a, transparent:true, opacity:0.22 })); p.rotation.x=-Math.PI/2; g.add(p); puddles.push(p); }
  // full-height flanking walls, one long slab per side (real 3D does the perspective)
  const wallL=new THREE.Mesh(boxGeo, wallMatL), wallR=new THREE.Mesh(boxGeo, wallMatR); g.add(wallL); g.add(wallR);
  const olL=new THREE.Mesh(boxGeo, OUTLINE_MAT), olR=new THREE.Mesh(boxGeo, OUTLINE_MAT); g.add(olL); g.add(olR);
  // FIRE ESCAPE on the left wall — the real builder: railed landings, treaded runs, drop ladder
  const fe2=buildFireEscape(3, 4.2); g.add(fe2);
  // utility wires strung ACROSS the gap between the two buildings (reads as horizontal lines in the
  // mouth from the street — wires along the alley are edge-on to the camera and just look like noise)
  const wires=[]; for(let i=0;i<3;i++){ const m=new THREE.Mesh(boxGeo, steel); g.add(m); wires.push(m); }
  // small barred windows on the inner faces — scale cue that these flanks are real buildings
  const wins=[]; for(let i=0;i<4;i++){ const w=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.6),
    new THREE.MeshBasicMaterial({ color:0x2a1f2e })); g.add(w); wins.push(w); }
  // dumpster + lid + trash bags + a second can + AC boxes on the right wall
  const bin=new THREE.Mesh(boxGeo, toonMat({ color:'#2f5a3a', roughness:1 })); g.add(bin);
  const binOl=new THREE.Mesh(boxGeo, OUTLINE_MAT); g.add(binOl);
  const lid=new THREE.Mesh(boxGeo, toonMat({ color:'#254a30', roughness:1 })); g.add(lid);
  const bags=[]; for(let i=0;i<3;i++){ const b=new THREE.Mesh(sphGeo, toonMat({ color:'#191521', roughness:1 })); g.add(b); bags.push(b); }
  const can2=new THREE.Mesh(boxGeo, toonMat({ color:'#4a4552', roughness:1 })); g.add(can2);
  const acs=[]; for(let i=0;i<2;i++){ const a=new THREE.Mesh(boxGeo, toonMat({ color:'#9aa0a8', roughness:.9 })); g.add(a); acs.push(a); }
  // service door + caged amber bulb + its light pool; a loud graffiti tag on the opposite wall
  const door=new THREE.Mesh(boxGeo, toonMat({ color:'#3a2a22', roughness:1 })); g.add(door);
  const bulb=new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color:0xffca7a })); g.add(bulb);
  const pool=new THREE.Mesh(new THREE.CircleGeometry(1.4,10), new THREE.MeshBasicMaterial({ color:0xffb35a, transparent:true, opacity:0.20 })); pool.rotation.x=-Math.PI/2; g.add(pool);
  const graf=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.1), new THREE.MeshBasicMaterial({ color:0xff2e88, transparent:true, opacity:0.55 })); g.add(graf);
  const graf2=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.8), new THREE.MeshBasicMaterial({ color:0x3ad1ff, transparent:true, opacity:0.45 })); g.add(graf2);
  // the far end fades to warm haze (the lit next street showing through) — an opening, not a wall.
  // Grounded and wide, plus a soft outer wash, so it reads as street light spilling in, not a door.
  const far=new THREE.Mesh(new THREE.PlaneGeometry(5,6), new THREE.MeshBasicMaterial({ color:0xffb35a, transparent:true, opacity:0.8 })); g.add(far);
  const farSoft=new THREE.Mesh(new THREE.PlaneGeometry(9,9), new THREE.MeshBasicMaterial({ color:0xffb35a, transparent:true, opacity:0.28 })); g.add(farSoft);
  g.position.z=-8.5;   // mouth on the front-row plane; children recede in -z
  g.userData={F,wet,puddles,wallL,wallR,olL,olR,fe2,wires,wins,bin,binOl,lid,bags,can2,acs,door,bulb,pool,graf,graf2,far,farSoft};
  g.visible=false;
  return g;
}
function layoutAlley(a, gapW){
  // gapW = the FULL carved opening in the front row. The corridor stays alley-narrow; the flanking
  // walls are thick PARTY-WALL building masses sized to fill everything else — so the opening in the
  // row is exactly the alley, with no leftover intersection margins on either side.
  const u=a.userData, H=ALLEY_H, D=ALLEY_D;
  const gw=Math.max(gapW, 8.6);
  const cw=Math.min(6.8, gw-1.8), hw=cw/2;       // the corridor — always reads as an alley
  const wt=Math.max(0.8,(gw-cw)/2);              // party-wall masses fill the rest of the gap
  u.F.scale.set(cw,0.3,D); u.F.position.set(0,0.15,-D/2);
  u.wet.scale.set(hw*0.5, D*0.94, 1); u.wet.position.set(0,0.32,-D/2);
  u.puddles[0].position.set(-hw*0.3,0.33,-D*0.28); u.puddles[1].position.set(hw*0.34,0.33,-D*0.62);
  u.wallL.scale.set(wt,H,D+0.6); u.wallL.position.set(-(hw+wt/2), H/2, -D/2);
  u.wallR.scale.set(wt,H,D+0.6); u.wallR.position.set( (hw+wt/2), H/2, -D/2);
  u.olL.scale.set(wt+0.3,H+0.3,D+0.9); u.olL.position.copy(u.wallL.position);
  u.olR.scale.set(wt+0.3,H+0.3,D+0.9); u.olR.position.copy(u.wallR.position);
  // fire escape hugging the left wall, facing into the corridor
  u.fe2.position.set(-(hw-0.1), 3.3, -D*0.40); u.fe2.rotation.y=Math.PI/2;
  // wires strung ACROSS the gap, wall to wall, stepping back into the alley
  for(let w=0;w<3;w++){
    const m=u.wires[w]; m.scale.set(hw*2+1.2,0.07,0.07); m.rotation.set(0,0,0);
    m.position.set(0, H-2.6-w*1.1, -D*0.22-w*5.5);
  }
  // barred windows: two per inner face, staggered heights and depths
  u.wins[0].position.set(-(hw-0.03),7.6,-D*0.30); u.wins[0].rotation.y= Math.PI/2;
  u.wins[1].position.set(-(hw-0.03),10.6,-D*0.55); u.wins[1].rotation.y= Math.PI/2;
  u.wins[2].position.set( (hw-0.03),6.8,-D*0.48); u.wins[2].rotation.y=-Math.PI/2;
  u.wins[3].position.set( (hw-0.03),10.0,-D*0.26); u.wins[3].rotation.y=-Math.PI/2;
  u.bin.scale.set(2.6,1.9,1.5); u.bin.position.set(-hw*0.52,0.95,-D*0.5);
  u.binOl.scale.set(3.0,2.3,1.9); u.binOl.position.copy(u.bin.position);
  u.lid.scale.set(2.7,0.35,1.6); u.lid.position.set(-hw*0.52,2.0,-D*0.5);
  u.bags[0].scale.set(0.9,0.6,0.8); u.bags[0].position.set(-hw*0.4,0.3,-D*0.4);
  u.bags[1].scale.set(0.7,0.5,0.7); u.bags[1].position.set(-hw*0.28,0.25,-D*0.44);
  u.bags[2].scale.set(0.8,0.55,0.7); u.bags[2].position.set(hw*0.44,0.27,-D*0.74);
  u.can2.scale.set(0.9,1.3,0.9); u.can2.position.set(hw*0.55,0.65,-D*0.3);
  u.acs[0].scale.set(1.3,1.0,0.7); u.acs[0].position.set(hw+0.2,5.4,-D*0.42);
  u.acs[1].scale.set(1.1,0.9,0.6); u.acs[1].position.set(hw+0.2,8.2,-D*0.66);
  u.door.scale.set(0.24,3.0,1.7); u.door.position.set(-(hw-0.05),1.5,-D*0.72);
  u.bulb.scale.set(0.16,0.16,0.16); u.bulb.position.set(-(hw-0.5),3.6,-D*0.72);
  u.pool.position.set(-(hw-1.2),0.34,-D*0.72);
  u.graf.position.set(hw-0.05,2.1,-D*0.42); u.graf.rotation.y=-Math.PI/2;
  u.graf2.position.set(-(hw-0.05),1.6,-D*0.22); u.graf2.rotation.y=Math.PI/2;
  u.far.position.set(0,3.0,-D+0.2);
  u.farSoft.position.set(0,4.2,-D+0.05);
}
const alleyRig=buildAlleyMesh(); scene.add(alleyRig);

// ---- STAGE 2: the ALLEY WORLD — the whole level runs inside the alley Bam ducked into ----
// The storefront row is replaced by one continuous back-of-building brick wall, dressed from the
// reference-photo kit: service doors with caged bulbs, barred windows, fire escapes, AC boxes,
// graffiti, dumpsters + bags + cans on an all-asphalt floor, wires sagging overhead, rooftop huts.
// Segments wrap with scroll exactly like the street's building bands.
const alleySegs=[];
(function(){
  const SEG=26, N=Math.round(SPAN/SEG);
  const doorMat=toonMat({ color:'#3a2a22', roughness:1 });
  const steel=toonMat({ color:'#14101a', roughness:.9 });
  const winMat=new THREE.MeshBasicMaterial({ color:0x241a2c });
  const acMat=toonMat({ color:'#9aa0a8', roughness:.9 });
  const bagMat=toonMat({ color:'#191521', roughness:1 });
  const capMat=toonMat({ color:'#4a3b42', roughness:1 });
  const grafCols=[0xff2e88,0x3ad1ff,0xc9d13a,0xff9d3a];
  for(let k=0;k<N;k++){
    const g=new THREE.Group(), R=s=>hash(k*131+s);
    const h=11.5+R(1)*4.5, wallCol=['#7a6450','#6a5a52','#75604a','#665648'][k%4];
    const btex=brickTexture(); btex.repeat.set(5,Math.max(3,Math.round(h/4)));
    const wall=new THREE.Mesh(boxGeo, toonMat({ map:btex, color:wallCol, roughness:1 }));
    wall.scale.set(SEG+0.15,h,2); wall.position.set(0,h/2,-9.5); g.add(wall);       // face flush at z=-8.5
    const cap=new THREE.Mesh(boxGeo, capMat); cap.scale.set(SEG+0.3,0.5,2.3); cap.position.set(0,h+0.2,-9.5); g.add(cap);
    // barred windows — sparse, high, dark
    for(let i=0;i<3;i++){ if(R(20+i)<0.35) continue;
      const w=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.7), winMat);
      w.position.set(-9+i*8+(R(24+i)-0.5)*3, 5.5+R(28+i)*4, -8.44); g.add(w);
      const bar=new THREE.Mesh(boxGeo, steel); bar.scale.set(1.4,0.06,0.06); bar.position.set(w.position.x, w.position.y, -8.42); g.add(bar); }
    // a service door with a caged amber bulb + light pool
    if(R(3)>0.3){ const dx=(R(4)-0.5)*16;
      const door=new THREE.Mesh(boxGeo, doorMat); door.scale.set(1.8,3.1,0.3); door.position.set(dx,1.55,-8.4); g.add(door);
      const bulb=new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color:0xffca7a })); bulb.scale.set(0.15,0.15,0.15); bulb.position.set(dx,3.9,-8.2); g.add(bulb);
      const pool=new THREE.Mesh(new THREE.CircleGeometry(1.6,10), new THREE.MeshBasicMaterial({ color:0xffb35a, transparent:true, opacity:0.16 }));
      pool.rotation.x=-Math.PI/2; pool.position.set(dx,0.04,-7.2); g.add(pool); }
    // graffiti tag at waist height
    if(R(5)>0.5){ const gr=new THREE.Mesh(new THREE.PlaneGeometry(2.6+R(6)*1.6,1.1),
      new THREE.MeshBasicMaterial({ color:grafCols[Math.floor(R(7)*grafCols.length)], transparent:true, opacity:0.5 }));
      gr.position.set((R(8)-0.5)*18, 1.6+R(9)*0.8, -8.44); g.add(gr); }
    // AC boxes bolted on
    if(R(10)>0.4){ const ac=new THREE.Mesh(boxGeo, acMat); ac.scale.set(1.2,0.9,0.7); ac.position.set((R(11)-0.5)*18, 4.5+R(12)*4, -8.2); g.add(ac); }
    // a REAL fire escape every third segment: railed landings, treaded runs, drop ladder
    if(k%3===1){ const fesc=buildFireEscape(h>14?3:2, 4.6);
      fesc.position.set((R(13)-0.5)*12, 3.3, -8.4); g.add(fesc); }
    // ground clutter: dumpster + bags / a can — hugging the wall
    if(R(14)>0.55){ const dxx=(R(15)-0.5)*16;
      const bin=new THREE.Mesh(boxGeo, toonMat({ color:['#2f5a3a','#5a2f34','#33475a'][Math.floor(R(16)*3)], roughness:1 }));
      bin.scale.set(2.6,1.9,1.5); bin.position.set(dxx,0.95,-6.9); g.add(bin);
      const lid=new THREE.Mesh(boxGeo, capMat); lid.scale.set(2.7,0.3,1.6); lid.position.set(dxx,2.0,-6.9); g.add(lid);
      for(let b2=0;b2<2;b2++){ const bag=new THREE.Mesh(sphGeo, bagMat); bag.scale.set(0.8,0.55,0.7);
        bag.position.set(dxx+2+b2*0.9, 0.28, -6.6); g.add(bag); } }
    if(R(17)>0.6){ const can=new THREE.Mesh(cylGeo, toonMat({ color:'#4a4552', roughness:.9 }));
      can.scale.set(0.55,1.2,0.55); can.position.set((R(18)-0.5)*20,0.6,-6.6); g.add(can); }
    // wires sagging overhead across the play space
    if(k%2===0){ const wx=(R(19)-0.5)*12;
      const wire=new THREE.Mesh(boxGeo, steel); wire.scale.set(0.07,0.07,27);
      wire.position.set(wx, 10.4, 4.5); wire.rotation.x=-0.075; g.add(wire); }
    // rooftop silhouette: a stair hut or water tower against the sky
    if(R(30)>0.6){ const hut=new THREE.Mesh(boxGeo, capMat); const hw2=1.6+R(31)*1.4;
      hut.scale.set(hw2,1.5,1.4); hut.position.set((R(32)-0.5)*18, h+0.95, -9.5); g.add(hut); }
    const baseX=-SPAN/2 + k*SEG + SEG/2;
    g.position.z = R(40)>0.55 ? -(0.5+R(41)*1.0) : 0;   // stagger some buildings back — the wall itself has relief
    g.visible=false; scene.add(g);
    alleySegs.push({ g, baseX });
  }
})();
// foreground silhouettes for the alley: crates, cans, a chain-link run — close to the lens at the
// bottom of the frame, sliding faster than the play plane. Sparse, low, and dark so they read as
// depth, not obstacles.
const alleyFg=[];
(function(){
  const dim=toonMat({ color:'#1d1826', roughness:1 });
  const dim2=toonMat({ color:'#262133', roughness:1 });
  const N=8;
  for(let k=0;k<N;k++){
    const g=new THREE.Group(), R=s=>hash(k*77+s+9);
    const kind=Math.floor(R(1)*3);
    if(kind===0){ for(let i=0;i<2+Math.floor(R(2)*2);i++){ const c=new THREE.Mesh(boxGeo, i%2?dim:dim2);   // crate stack
        const s2=1.0+R(3+i)*0.7; c.scale.set(s2,s2*0.8,s2); c.position.set((R(5+i)-0.5)*1.2, s2*0.4+i*0.7, 0); g.add(c); } }
    else if(kind===1){ for(let i=0;i<2;i++){ const c=new THREE.Mesh(cylGeo, dim);                          // trash cans
        c.scale.set(0.5,1.0,0.5); c.position.set(i*0.9,0.5,0); g.add(c); } }
    else { const rail=new THREE.Mesh(boxGeo, dim); rail.scale.set(7,0.12,0.08); rail.position.set(0,1.75,0); g.add(rail);   // chain-link run
      for(let i=0;i<4;i++){ const p2=new THREE.Mesh(boxGeo, dim); p2.scale.set(0.1,1.8,0.1); p2.position.set(-3+i*2,0.9,0); g.add(p2); }
      const net=new THREE.Mesh(new THREE.PlaneGeometry(7,1.55), new THREE.MeshBasicMaterial({ color:0x14101a, transparent:true, opacity:0.35 }));
      net.position.set(0,0.95,0); g.add(net); }
    const baseX=-SPAN/2+(k+R(8))*(SPAN/N);
    g.position.set(baseX,0,16.6+R(9)*1.5);
    g.visible=false; scene.add(g); alleyFg.push({ g, baseX });
  }
})();

// ---- a cross-street intersection: a real perpendicular ROAD that cuts through the sidewalk ----
// The front row breaks; an asphalt strip with its OWN double-yellow lines runs from the main road
// straight back between two receding rows of buildings, with a crosswalk where it meets the drag.
// Reads unmistakably as another street of the same neighbourhood heading off into the sunset haze.
const XST_W=26;                                    // as wide as the main drag — it's the same kind of street
// the whole chase is a DOWNHILL run, so the cross-street keeps falling: the corridor's road deck
// drops away at this grade past the mouth, buildings sit full-size and vertical on the slope
// (bases stepping down — never shrinking), and the aerial blocks terrace down with it.
const XGRADE=0.2, XGA=Math.atan(0.2), XMOUTH=-8.5;
const xdrop=z=> z<XMOUTH ? (XMOUTH-z)*XGRADE : 0;
function buildCrossStreet(){
  const g=new THREE.Group();
  const roadMat=toonMat({ color:'#2b2731', roughness:1 });
  const yellowMat=toonMat({ color:'#f2c53a', roughness:.7 });
  const cwMat=toonMat({ color:'#e8e2d4', roughness:.9 });
  const Zfront=1.6, Zback=-72, roadW=17;
  // FLAT APRON through the intersection (the crosswalk zone) — level with the main drag
  const apLen=Zfront-XMOUTH+0.4;
  const apron=new THREE.Mesh(boxGeo, roadMat); apron.scale.set(roadW,0.66,apLen); apron.position.set(0,0.31,(Zfront+XMOUTH)/2); g.add(apron);
  for(let i=0;i<4;i++){ const st=new THREE.Mesh(new THREE.PlaneGeometry(roadW*0.82,0.6), cwMat);
    st.rotation.x=-Math.PI/2; st.position.set(0,0.67, Zfront-0.6-i*1.0); g.add(st); }
  // GRADED DECK past the mouth — the road itself falls away downhill (the whole chase is a downhill
  // run; a level corridor made the receding buildings read as shrinking instead of descending)
  const dkLen=XMOUTH-Zback;
  const grade=new THREE.Group(); grade.position.set(0,0.31,XMOUTH); grade.rotation.x=-XGA; g.add(grade);
  const deck=new THREE.Mesh(boxGeo, roadMat); deck.scale.set(roadW,0.66,dkLen); deck.position.set(0,0,-dkLen/2); grade.add(deck);
  for(const sx of [-1.1,1.1]){ const yl=new THREE.Mesh(new THREE.PlaneGeometry(0.45,dkLen-6), yellowMat);
    yl.rotation.x=-Math.PI/2; yl.position.set(sx,0.36,-dkLen/2); grade.add(yl); }
  // BOTH sides of the side street are lined with thin shopfront facades (razor-thin like the main
  // row, since you look straight down the street and the far side is fully visible too). They tile
  // back toward the vanishing point, stepping down in height for a receding roofline. The FRONT
  // pair sits flush with the main row's face (z=-8.5) as the block's corner buildings.
  const cols=['#c07a54','#c98a5e','#a8694c','#8f5f52','#6f4f66','#57496b','#463f5e','#3a3450'];
  const roofC=['#cbb49c','#bfa78e','#d8c3ab'];
  const bd=5.0;                                  // real building DEPTH — the drone shot looks down on these; slats read as cardboard
  for(let i=0;i<8;i++){ const z=(XMOUTH-bd/2) - i*5.4, lit=i<3;
    // full-size buildings STEPPING DOWN the grade — bases drop with the road, heights just vary.
    // (The old 12.5-i*1.05 shrink was a flat-view perspective fake; real 3D made it read as the
    // buildings literally getting smaller down the street.)
    const h=9.5+hash(i*97+11)*4.5, w=5.6, dp=xdrop(z);
    const ftex=facades[i%facades.length].clone(); ftex.needsUpdate=true;
    ftex.repeat.set(1, Math.max(2,Math.round(h/7)));
    for(const side of [-1,1]){
      const bx=side*(roadW/2 + w/2 - 0.2);
      const m=new THREE.Mesh(boxGeo, toonMat({ map:ftex, color:cols[i], roughness:1, emissive:lit?'#ff8a3a':'#000', emissiveIntensity:lit?0.14:0 }));
      m.scale.set(w,h,bd); m.position.set(bx,h/2-dp,z); m.castShadow=true; g.add(m);
      const o=new THREE.Mesh(boxGeo, OUTLINE_MAT); o.scale.set(w+0.25,h+0.25,bd+0.25); o.position.copy(m.position); g.add(o);
      const r=new THREE.Mesh(boxGeo, toonMat({ color:roofC[(i+ (side>0?1:0))%3], roughness:1 }));   // pale sunlit roof cap
      r.scale.set(w+0.2,0.4,bd+0.2); r.position.set(bx,h+0.15-dp,z); g.add(r);
    }
  }
  // a low hazy band capping the vanishing point, and a warm glow so the street glows into the sunset
  // (both ride at the bottom of the grade, where the road has dropped to)
  const capDp=xdrop(Zback+1.5);
  const cap=new THREE.Mesh(boxGeo, toonMat({ color:'#5a4a63', roughness:1, emissive:'#ff8a3a', emissiveIntensity:0.15 }));
  cap.scale.set(roadW+14,8,3); cap.position.set(0,4-capDp,Zback+1.5); g.add(cap);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(roadW*0.7,7), new THREE.MeshBasicMaterial({ color:0xffb867, transparent:true, opacity:0.6 }));
  glow.position.set(0,3.4-capDp,Zback+2.9); g.add(glow);
  g.position.set(0,0,0);   // positioned in x only per frame; all z's are world-space
  g.userData={};
  g.visible=false;
  return g;
}
const xstreetPool=[]; for(let i=0;i<2;i++){ const s=buildCrossStreet(); scene.add(s); xstreetPool.push(s); }

// ---- the AERIAL CITY: what a helicopter actually sees over a city block ----
// Reference: real aerial photography of urban blocks. The signature is NOT scattered boxes — it's
// CONTIGUOUS buildings shoulder-to-shoulder around each block's PERIMETER (jagged rooflines, shared
// walls), hollow courtyards inside, a street GRID with avenues and a back street (asphalt +
// centre lines + intersections), pale sidewalk aprons ringing every block, and rooftop clutter —
// stair huts, AC units, and the classic water tower on the taller roofs. That's what this builds.
// The far side rides with any altitude; the near side (which would wall off the camera at street
// level) only appears once the drone is high enough to look down past it.
const aerialFar=new THREE.Group(), aerialNear=new THREE.Group();
(function(){
  const roofMats=['#cbb49c','#bfa78e','#3f3a44','#c9c2b8','#a89078','#d8c3ab'].map(c=>toonMat({ color:c, roughness:1 }));  // sun-lit tar/silver/pale mix
  const hutMat=toonMat({ color:'#5a4636', roughness:1 });
  const acMat=toonMat({ color:'#9aa0a8', roughness:.9 });
  const wtCap=toonMat({ color:'#3a2f2a', roughness:1 });
  const walkMat=toonMat({ color:'#b9a98f', roughness:1 });
  const asMat=toonMat({ color:'#2b2731', roughness:1 });
  const ylMat=toonMat({ color:'#f2c53a', roughness:.7 });
  const cols=['#8a5a40','#7a5a52','#6f4f66','#a06a48','#57496b','#8f5f52','#463f5e','#b0714b'];
  let sd=7; const R=()=>hash(sd++);
  const wtGeo=new THREE.CylinderGeometry(1.05,1.05,2.1,10), wtCapGeo=new THREE.ConeGeometry(1.22,0.9,10);
  function bldg(g,x,z,w,d){
    const h=5+R()*12;
    const m=new THREE.Mesh(boxGeo, toonMat({ color:cols[Math.floor(R()*cols.length)], roughness:1 }));
    m.scale.set(w,h,d); m.position.set(x,h/2,z); g.add(m);
    const r=new THREE.Mesh(boxGeo, roofMats[Math.floor(R()*roofMats.length)]);
    r.scale.set(w+0.3,0.5,d+0.3); r.position.set(x,h+0.2,z); g.add(r);           // parapet lip
    if(h>11 && R()>0.7){                                                          // the classic rooftop water tower
      const wx=x+(R()-0.5)*w*0.4, wz=z+(R()-0.5)*d*0.4;
      const t=new THREE.Mesh(wtGeo, hutMat); t.position.set(wx,h+1.5,wz); g.add(t);
      const c=new THREE.Mesh(wtCapGeo, wtCap); c.position.set(wx,h+3.0,wz); g.add(c);
    } else if(R()>0.55){                                                          // stair hut / AC unit
      const hut=new THREE.Mesh(boxGeo, R()>0.5?hutMat:acMat); const hw=1.4+R()*1.6;
      hut.scale.set(hw,1.3,hw); hut.position.set(x+(R()-0.5)*w*0.5, h+1.1, z+(R()-0.5)*d*0.5); g.add(hut);
    }
  }
  function block(g,cx,cz,bw,bd,y0){
    // each block sits on its own TERRACE — the whole hillside steps down the grade with the road
    const tg=new THREE.Group(); tg.position.y=y0||0; g.add(tg);
    const walk=new THREE.Mesh(boxGeo, walkMat);                                   // sidewalk apron under the whole block
    walk.scale.set(bw+3,0.28,bd+3); walk.position.set(cx,0.14,cz); tg.add(walk);
    const D=9;                                                                    // perimeter building depth — courtyard hollow inside
    for(const sz of [-1,1]){                                                      // north+south edges: contiguous row along x
      const ez=cz+sz*(bd/2-D/2); let x=cx-bw/2;
      while(x<cx+bw/2-2){ const w=Math.min(6+R()*6, cx+bw/2-x); bldg(tg,x+w/2,ez,w,D); x+=w; }
    }
    for(const sx of [-1,1]){                                                      // east+west edges fill between the rows
      const ex=cx+sx*(bw/2-D/2); let z=cz-bd/2+D;
      while(z<cz+bd/2-D-2){ const d2=Math.min(6+R()*6, cz+bd/2-D-z); bldg(tg,ex,z+d2/2,D,d2); z+=d2; }
    }
  }
  function street(g,cx,cz,w,len,vert,y0){                                         // asphalt strip + centre line
    const a=new THREE.Mesh(boxGeo, asMat); a.scale.set(vert?w:len,0.22,vert?len:w); a.position.set(cx,0.11+(y0||0),cz); g.add(a);
    const l=new THREE.Mesh(new THREE.PlaneGeometry(vert?0.5:len*0.94, vert?len*0.94:0.5), ylMat);
    l.rotation.x=-Math.PI/2; l.position.set(cx,0.24+(y0||0),cz); g.add(l);
  }
  // FAR side (beyond the main street's rows): 2×2 blocks each side of the corridor + avenues + a back
  // street — every row terraced down the grade so the hillside falls WITH the corridor's road.
  // Each terrace gets its own GROUND SLAB (the world's flat backlot carpet is dropped out of the way
  // during the aerial — it would otherwise cover the sunken terraces from above).
  const slabMat=toonMat({ color:'#6b4a52', roughness:1 });
  for(const sx of [-1,1]){
    for(const [cz,zc,zd] of [[-33,-32.2,40.5],[-77,-74.2,43.5]]){
      const slab=new THREE.Mesh(boxGeo, slabMat);                                 // terrace ground, corridor kept clear
      slab.scale.set(101,0.24,zd); slab.position.set(sx*64.6,-xdrop(cz)-0.12,zc); aerialFar.add(slab);
      block(aerialFar, sx*37, cz, 44, 34, -xdrop(cz)); block(aerialFar, sx*91, cz, 44, 34, -xdrop(cz));
      street(aerialFar, sx*64, cz, 10, 44, true, -xdrop(cz));                     // avenue segments ride each terrace
    }
  }
  street(aerialFar, 0, -55, 10, 226, false, -xdrop(-55));                         // the back street, crossing the corridor
  // NEAR side (south of the main drag, uphill of the crest): level row of blocks
  for(const sx of [-1,1]){ block(aerialNear, sx*37, 47, 44, 34, 0); block(aerialNear, sx*91, 47, 44, 34, 0); }
  street(aerialNear, 0, 47, 17, 42, true, 0);                                     // the cross-street continues south
  aerialFar.visible=false; aerialNear.visible=false;
  scene.add(aerialFar); scene.add(aerialNear);
})();

// ---- the FOURTH WALL: the far side of the main street, for the corner-turn cinematic only ----
// Normal play looks north; the south side of the street sits behind the camera and doesn't exist.
// The orbit exposes that void, so this kit fudges it: a mirrored sidewalk + connected building row
// across the road, with a gap at x=0 where the cross-street continues south (a proper four-way).
// It lives only while the cinematic runs, rising in during the early swing while the frame edge is
// sweeping — by the time the eye can rest on it, the street has always had two sides.
const mirrorRig=(function(){
  const g=new THREE.Group();
  // sidewalk strip + curb lip across the road (z 14.2 .. 20.6)
  const pt=pavingTex.clone(); pt.needsUpdate=true; pt.repeat.set(SPAN/6, 1);
  const sw=new THREE.Mesh(boxGeo, toonMat({ map:pt, roughness:1 }));
  sw.scale.set(SPAN,0.6,6.4); sw.position.set(0,0.3,17.4); sw.receiveShadow=true; g.add(sw);
  const curb=new THREE.Mesh(boxGeo, toonMat({ color:'#b9b2a2', roughness:1 }));
  curb.scale.set(SPAN,0.5,0.4); curb.position.set(0,0.25,14.1); g.add(curb);
  // the cross-street continuing SOUTH through the gap: asphalt stub + its own double yellow
  const stub=new THREE.Mesh(boxGeo, toonMat({ color:'#2b2731', roughness:1 }));
  stub.scale.set(17,0.64,17); stub.position.set(0,0.31,22.9); g.add(stub);
  const yl=toonMat({ color:'#f2c53a', roughness:.7 });
  for(const sx of [-1.1,1.1]){ const l=new THREE.Mesh(new THREE.PlaneGeometry(0.45,15), yl);
    l.rotation.x=-Math.PI/2; l.position.set(sx,0.66,22.6); g.add(l); }
  // connected building row flanking the gap, faces toward the road (z 21 .. 29)
  const gapHW=13;
  for(const side of [-1,1]){
    let x=side*gapHW;
    while(Math.abs(x)<SPAN/2){
      const sd=Math.round(Math.abs(x)*7)+ (side>0?3:5);
      // LOW storefront row: the elevated orbit camera flies right over this band mid-swing, so tall
      // buildings here loom as a giant rooftop filling the foreground. Keep it a believable 2-storey
      // shopfront wall (h 4.2..7.4) — reads as the street across the way, never eats the frame.
      const w=6+hash(sd)*5, h=4.2+hash(sd*3+1)*3.2;
      const ft=facades[Math.floor(hash(sd*7+2)*facades.length)].clone(); ft.needsUpdate=true;
      ft.repeat.set(Math.max(1,Math.round(w/5)), Math.max(1,Math.round(h/4)));
      const bx=x+side*w/2;
      const b=new THREE.Mesh(boxGeo, toonMat({ map:ft, roughness:.92 }));
      b.scale.set(w,h,8); b.position.set(bx,h/2,25); g.add(b);
      const ol=new THREE.Mesh(boxGeo, OUTLINE_MAT); ol.scale.set(w,h+0.7,8.7); ol.position.copy(b.position); g.add(ol);
      const roof=new THREE.Mesh(boxGeo, toonMat({ color:'#4a3b42', roughness:1 }));   // low parapet cap
      roof.scale.set(w*1.02,0.4,8.2); roof.position.set(bx,h+0.12,25); g.add(roof);
      if(hash(sd*11)>0.45){                                   // awning strip over the ground-floor windows
        const aw=new THREE.Mesh(boxGeo, toonMat({ color:SIGN_COLS[sd%SIGN_COLS.length], roughness:.9 }));
        aw.scale.set(w*0.86,0.45,1.5); aw.position.set(bx,2.8,20.4); aw.rotation.x=0.3; g.add(aw);
      }
      x += side*w;
    }
  }
  g.visible=false; scene.add(g);
  return g;
})();

// ---- Bam as a real BILLBOARD in the 3D scene, for the corner-turn cinematic ----
// A 2.5D character lives IN the 3D world so the camera can orbit and he stays planted on the
// ground, always facing the lens (that's what a Sprite does). The game blits his current frame
// onto heroCv each cinematic frame; stepBg parks the billboard at his 3D position and shows it,
// then hides the flat 2D overlay. Only used during the turn — normal play keeps the 2D sprite.
const heroCv=document.createElement('canvas'); heroCv.width=92; heroCv.height=92;
const heroTex=new THREE.CanvasTexture(heroCv); heroTex.colorSpace=THREE.SRGBColorSpace;
heroTex.magFilter=THREE.NearestFilter; heroTex.minFilter=THREE.NearestFilter;
// depthTest OFF: Bam is the cinematic star for the whole orbit — he must never vanish behind a
// building as the camera swings past the row. He draws on top; at this speed the depth cheat reads as
// nothing but "the hero stays on screen." (Only ever visible during the turn, so it can't affect play.)
const heroSpr=new THREE.Sprite(new THREE.SpriteMaterial({ map:heroTex, transparent:true, depthTest:false, depthWrite:false }));
heroSpr.renderOrder=999;
heroSpr.visible=false; scene.add(heroSpr);
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
  function stepBg(sc, storeXs, bossState, roll, alleyX, xstreetXs, yaw, hero, aerial, chaseOn, alleyMode){
    scroll=sc; bgTick++;
    const openings=[];   // gaps carved into the row this frame (alley, cross-streets) — props keep clear of them
    // STAGE 2 — the ALLEY WORLD: swap the whole street dressing for the back-alley kit
    alleyMode=!!alleyMode;
    sidewalk.visible=!alleyMode; curb.visible=!alleyMode;
    for(const e of edgeLines) e.visible=!alleyMode;
    for(const s of alleySegs){ const sx=s.baseX-scroll; if(sx<-SPAN/2)s.baseX+=SPAN; else if(sx>SPAN/2)s.baseX-=SPAN;
      s.g.position.x=s.baseX-scroll; s.g.visible=alleyMode; }
    for(const f of alleyFg){ const sx=f.baseX-scroll; if(sx<-SPAN/2)f.baseX+=SPAN; else if(sx>SPAN/2)f.baseX-=SPAN;
      f.g.position.x=f.baseX-scroll; f.g.visible=alleyMode; }
    // The corner turn is a HELICOPTER shot: aerial (0..1) cranes into a bird's-eye DRONE that TRACKS
    // Bam — its perch is a fixed offset above+behind him, rotated by yaw, always looking at him — so he
    // stays centred and legible while he runs the corner and the city rotates around him. roll is the
    // downhill tilt. On the ground (aerial 0) it's the solved street pose; the perch/look blend by
    // altitude for a smooth lift-off and dive.
    camera.position.copy(camBasePos);
    camera.quaternion.copy(camBaseQ);
    aerial = aerial||0;
    // push the sunset fog WAY out while airborne so the bird's-eye city (and Bam running the corner)
    // reads crisp instead of dissolving into orange haze; restore the street-level haze on the ground.
    scene.fog.near = 58 + aerial*300;
    scene.fog.far  = 195 + aerial*650;
    if(aerial>0){
      // Bam's ground position in 3D (same mapping the billboard uses), riding the corridor's grade
      const hx = hero ? (hero.gx - hero.camX - 320)*0.0805 : CAM_PIVOT.x;
      const hz = hero ? -8.5 + ((hero.gz==null?252:hero.gz) - 228)*0.194 : CAM_PIVOT.z;
      const hy = CAM_PIVOT.y - xdrop(hz);
      const c=Math.cos(yaw||0), s=Math.sin(yaw||0);
      const rx = -CAM_HIGH.z*s, rz = CAM_HIGH.z*c;     // "behind" offset, rotated by yaw about vertical
      const droneX=hx+rx, droneY=CAM_HIGH.y, droneZ=hz+rz;   // perch above+behind Bam
      camera.position.set(camBasePos.x+(droneX-camBasePos.x)*aerial,
                          camBasePos.y+(droneY-camBasePos.y)*aerial,
                          camBasePos.z+(droneZ-camBasePos.z)*aerial);
      camera.up.set(0,1,0);
      _camLook.set(CAM_STREETLOOK.x+(hx-CAM_STREETLOOK.x)*aerial,
                   CAM_STREETLOOK.y+(hy-CAM_STREETLOOK.y)*aerial,
                   CAM_STREETLOOK.z+(hz-CAM_STREETLOOK.z)*aerial);
      camera.lookAt(_camLook);
    }
    if(roll) camera.rotateZ(roll);
    syncBoss(bossState);
    const xs=alleyMode ? [] : (storeXs||[]).filter(x=>Math.abs(x-scroll)<40).slice(0,storePool.length);
    const lit=(bgTick%150)<126;
    // position the row first (restore ALL visible), collecting the front band AND the rows behind it.
    // In alley mode the whole street's building bands hide — the alley wall is the world.
    const fronts=[], backs=[];
    for(const b of world){ const sx=b.baseX-scroll; if(sx<-SPAN/2)b.baseX+=SPAN; else if(sx>SPAN/2)b.baseX-=SPAN;
      const nx=b.baseX-scroll; b.mesh.position.x=nx; for(const e of b.extras) e.position.x=nx+(e.userData.ox||0);
      // alley mode: only the FRONT storefront band swaps out for the alley wall — the back rows and
      // skyline stay up, rising over the parapet and scrolling at their own depths (real parallax).
      const vis=!alleyMode || !b.band.store;
      b.mesh.visible=vis; for(const e of b.extras) e.visible=vis;
      (b.band.store ? fronts : backs).push(b); }
    // an alley/intersection is a GAP you see THROUGH — so the rows BEHIND the front row can't cap it.
    // Clear every building (back band + skyline) sitting behind an opening's mouth, so the path
    // recedes to the rig's own far end / the sky instead of running into a wall right behind it.
    const clearBehind=(gx,hw)=>{ for(const b of backs){ if(Math.abs(b.mesh.position.x-gx)<hw){ b.mesh.visible=false; for(const e of b.extras) e.visible=false; } } };
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
    // the chase alley: hide the nearest front building at alleyX, then MEASURE the true open span
    // between the surviving neighbors and fill it edge-to-edge — the hidden building's own width
    // undershoots the row's real spacing, which left intersection-like margins around the corridor.
    if(alleyX!=null && Math.abs(alleyX-scroll)<SPAN/2){
      const gx=alleyX-scroll; alleyRig.visible=true;
      let best=null,bd=1e9;
      for(const b of fronts){ const d=Math.abs(b.mesh.position.x-gx); if(d<bd){bd=d;best=b;} }
      if(best && bd<16){ best.mesh.visible=false; for(const e of best.extras) e.visible=false; }
      let lE=-1e9, rE=1e9;
      for(const b of fronts){ if(!b.mesh.visible) continue;
        const c0=b.mesh.position.x, h2=b.mesh.scale.x/2;
        if(c0+h2<=gx+0.5) lE=Math.max(lE, c0+h2);
        if(c0-h2>=gx-0.5) rE=Math.min(rE, c0-h2); }
      if(lE<-1e8) lE=gx-9; if(rE>1e8) rE=gx+9;
      const gapW=Math.min(rE-lE, 30);
      alleyRig.userData._dbg={gx:+gx.toFixed(1),lE:+lE.toFixed(1),rE:+rE.toFixed(1),gapW:+gapW.toFixed(1)};
      alleyRig.position.x=(lE+rE)/2;                // centre the rig on the REAL gap, not the trigger x
      openings.push({gx:(lE+rE)/2, hw:gapW/2+2});
      clearBehind(gx, 6.5);                         // see through the corridor, nothing capping it
      layoutAlley(alleyRig, gapW);
    } else alleyRig.visible=false;
    // cross-street intersections: slot the receding-street rigs at their xs, hiding the front
    // buildings across the mouth (same trick as the store/alley, just a wider bite)
    const ixs=(xstreetXs||[]).filter(x=>Math.abs(x-scroll)<SPAN/2).slice(0,xstreetPool.length);
    for(let i=0;i<xstreetPool.length;i++){ const s=xstreetPool[i];
      if(i>=ixs.length){ s.visible=false; continue; }
      const gx=ixs[i]-scroll; s.visible=true; s.position.x=gx;
      for(const b of fronts){ if(Math.abs(b.mesh.position.x-gx) < XST_W/2+1){ b.mesh.visible=false; for(const e of b.extras) e.visible=false; } }
      clearBehind(gx, XST_W/2+3);                    // clear the back rows so you see all the way down the cross-street
      openings.push({gx, hw:XST_W/2+2});
    }
    // street furniture stays OFF the openings (no trees standing in the middle of a cross-street)
    // and clears out entirely during the chase — nothing on the sidewalk but the notice guys.
    for(const p of props){ const sx=p.baseX-scroll; if(sx<-SPAN/2)p.baseX+=SPAN; else if(sx>SPAN/2)p.baseX-=SPAN;
      const px=p.baseX-scroll; p.g.position.x=px;
      p.g.visible = !chaseOn && !alleyMode && !openings.some(o=>Math.abs(px-o.gx)<o.hw); }
    for(const pe of peds){ pe.baseX+=pe.vx; let sx=pe.baseX-scroll; if(sx<-SPAN/2)pe.baseX+=SPAN; else if(sx>SPAN/2)pe.baseX-=SPAN;
      pe.spr.visible=!chaseOn && !alleyMode;         // bystanders clear out for the chase — and nobody strolls the alley
      pe.spr.position.x=pe.baseX-scroll; pe.spr.position.y=pe.y+Math.abs(Math.sin(pe.baseX*0.6))*0.18; pe.spr.scale.x=(pe.vx<0?-Math.abs(pe.sx):Math.abs(pe.sx));
      pe.spr.material = pe.mats[Math.floor(Math.abs(pe.baseX)*1.4)%2]; }   // stride/passing leg frames — an actual walk, not a glide
    asphaltTex.offset.x=scroll/9; pavingTex.offset.x=scroll/6;
    for(const g of road.concat(decals)){ const sx=g.baseX-scroll; if(sx<-SPAN/2)g.baseX+=SPAN; else if(sx>SPAN/2)g.baseX-=SPAN;
      g.mesh.position.x=g.baseX-scroll; g.mesh.visible=!alleyMode; }   // no lane paint on an alley floor
    for(const s of clouds){ s.position.x-=0.012; if(s.position.x<-150)s.position.x=150; }
    // the fourth wall (the far side of the street) rides only with the corner cinematic — hidden
    // in normal play (it would sit between the camera and the gameplay), fully up for the orbit
    // where the swinging camera would otherwise see the void behind itself.
    if(hero){ mirrorRig.visible=true; mirrorRig.position.y=0; }
    else mirrorRig.visible=false;
    // the aerial city rides only with the helicopter shot, anchored to the corner cross-street.
    // Far quadrants come in with any altitude; the near side waits until the drone is high enough
    // that it reads as ground below instead of a wall in front of the lens.
    if(aerial>0.04 && (xstreetXs&&xstreetXs.length)){
      const cgx=xstreetXs[0]-scroll;
      aerialFar.position.x=cgx; aerialNear.position.x=cgx;
      aerialFar.visible=true; aerialNear.visible=aerial>0.45;
      backlot.position.y=-15.5;      // drop the flat carpet below the hillside — it would cover the sunken terraces from above
    } else { aerialFar.visible=false; aerialNear.visible=false; backlot.position.y=-0.06; }
    // Bam's billboard, planted in the 3D world for the corner-turn cinematic (the game drew his
    // frame onto heroCv before this call). Same game→3D mapping the boss/store use.
    if(hero){
      heroSpr.visible=true; heroTex.needsUpdate=true;
      const x3=(hero.gx - hero.camX - 320)*0.0805;
      const z3=-8.5 + ((hero.gz==null?252:hero.gz) - 228)*0.194;
      const y3=Math.max(0,hero.gy||0)*0.0805 - xdrop(z3);   // feet ride the corridor's downhill grade
      const hh=hero.h||8.6;
      heroSpr.scale.set(hh,hh,1);
      heroSpr.position.set(x3, y3 + 0.26*hh, z3);   // feet (row 70/92) on the ground
    } else heroSpr.visible=false;
    renderer.render(scene,camera);
  }
  globalThis.__bg3d = { render:stepBg, canvas:canvas, heroCanvas:heroCv, _alley:alleyRig };
}catch(e){ /* any init failure -> game keeps its procedural background */ }
})();
