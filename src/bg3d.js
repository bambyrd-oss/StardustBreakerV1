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

// double yellow centre line — two solid stripes straddling the road's exact centre. The road is
// bounded by the lane edges at z -3.4 and 18.4, so its middle is z 7.5; the stripes sit at 7.5 ± 1.4
// (the perspective foreshortens the road hard, so they need real spacing to read as a pair, not one).
for(const z of [ 6.1, 8.9 ]){
  const line=new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, 0.42),
    toonMat({ color:'#f2c53a', roughness:.7 }));
  line.rotation.x=-Math.PI/2; line.position.set(0,0.02,z); scene.add(line);
}

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

// ---- deterministic per-column pseudo-random so recycling stays stable ----
function hash(n){ n=(n^61)^(n>>>16); n=n+(n<<3); n=n^(n>>>4); n=Math.imul(n,0x27d4eb2d); n=n^(n>>>15); return ((n>>>0)%100000)/100000; }

// building depth bands. Each band is a CONNECTED WALL: its buildings tile edge-to-edge (no gaps),
// so the street reads as a solid row of shopfronts with a jagged roofline instead of scattered
// towers with dark voids between them. FRONT row = tall & varied storefronts; BACK row is shorter
// and set back so its rooftops peek up in the valleys and the sunset sky shows over it; a far hazy
// skyline sits low on the horizon for depth. `tile` = target building width (widths are then
// normalised to sum to SPAN exactly so the wall stays seamless when it wraps).
const BANDS = [
  { z:-13, hBase:7,  hVar:6,  depth:9,  store:true,  tile:9,  off:0 },   // FRONT (red) — connected storefront wall, narrow shops, jagged roofline (7..13)
  { z:-27, hBase:4,  hVar:4,  depth:11, store:false, tile:12, off:6 },   // BACK (blue) — connected but SHORTER (4..8), so sky shows over it in the front's valleys
  { z:-74, hBase:7,  hVar:7,  depth:13, store:false, tile:17, off:5, skyline:true },  // far hazy skyline, low on the horizon
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
  const h = band.hBase + hash(seed*3+1)*band.hVar;
  const tex = facades[Math.floor(hash(seed*7+2)*facades.length)];
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
  if(!band.skyline){ const OL=0.7, ol=new THREE.Mesh(boxGeo, OUTLINE_MAT);
    ol.scale.set(w+OL, h+OL, band.depth+OL); ol.position.set(baseX, h/2, band.z); ol.userData.ox=0;
    scene.add(ol); extras.push(ol); }
  const front = band.z + band.depth/2;                       // z of the camera-facing face
  // parapet cap / cornice (some buildings get a stepped cornice)
  detail(extras, boxGeo, toonMat({ color:'#00000026', transparent:true, roughness:1 }), baseX, w*1.03,1.1,band.depth*1.05, baseX,h+0.3,band.z);
  if(!band.skyline && hash(seed*17)>0.5) detail(extras, boxGeo, MAT.trim, baseX, w*1.06,0.5,band.depth*1.08, baseX,h-0.3,band.z);
  if(!band.skyline){
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
    detail(extras, boxGeo, MAT.glass, baseX, w*0.86,4.2,0.3, baseX,2.3,front+0.22);
    detail(extras, boxGeo, MAT.metal, baseX, w*0.9,0.5,0.5, baseX,0.35,front+0.25);
    detail(extras, boxGeo, MAT.dark,  baseX, 1.2,3.0,0.34, baseX+w*0.25,1.7,front+0.27);           // door
    for(let mi=-1;mi<=1;mi++) detail(extras, boxGeo, MAT.metal, baseX, 0.12,4.2,0.33, baseX+mi*w*0.22,2.3,front+0.24);
    const sc=SIGN_COLS[Math.floor(hash(seed*13)*SIGN_COLS.length)];
    detail(extras, boxGeo, toonMat({ color:sc, roughness:.7, emissive:sc, emissiveIntensity:.14 }), baseX, w*0.8,1.5,0.35, baseX,6.5,front+0.2);
    detail(extras, boxGeo, MAT.trim, baseX, w*0.8,0.28,0.4, baseX,5.75,front+0.22);
    const aw=awnings[Math.floor(hash(seed*11+5)*awnings.length)].clone(); aw.needsUpdate=true; aw.repeat.set(Math.max(2,Math.round(w/2)),1);
    detail(extras, boxGeo, toonMat({ map:aw, roughness:.85 }), baseX, w*0.9,0.5,2.4, baseX,4.9,front+0.9, -0.32);
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


  renderer.setSize(640,360,false);
  let scroll=0;
  function stepBg(sc){
    scroll=sc;
    for(const b of world){ const sx=b.baseX-scroll; if(sx<-SPAN/2)b.baseX+=SPAN; else if(sx>SPAN/2)b.baseX-=SPAN;
      const nx=b.baseX-scroll; b.mesh.position.x=nx; for(const e of b.extras) e.position.x=nx+(e.userData.ox||0); }
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
