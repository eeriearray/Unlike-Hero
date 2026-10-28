import { SEA, EDGE, TEAMS, ISLANDS, BANK_RADIUS, forward, angleDelta } from './sea-map.js';

// Bright, chunky tropical look. Everything that sits in the sea is placed against
// the same wave function the water shader uses, so nothing hovers above it.
let vortices = [];
export function waveHeight(x, z, t) {
 let h = Math.sin(x * 0.16 + z * 0.08 + t * 1.1) * 0.3 + Math.sin(x * 0.07 - z * 0.19 - t * 0.8) * 0.22 + Math.sin(x * 0.31 + z * 0.27 + t * 1.7) * 0.06;
 for (const v of vortices) { const d = Math.hypot(x - v.x, z - v.z); if (d < v.r) { const q = 1 - d / v.r; h = h * (1 - q) - 6 * Math.pow(q, 2); } }
 return h;
}
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Island height in local coordinates. Beaches slope below the waterline so the
// sea meets sand instead of a floating rim.
function islandShape(i) {
 const height = i.kind === 'far' ? 16 : i.kind === 'harbor' ? 5 : i.kind === 'rock' ? 2.6 : i.kind === 'wreck' ? 0 : 3.6;
 const wobble = a => 1 + Math.sin(a * 3 + i.x * 0.1) * 0.07 + Math.sin(a * 7 + i.z * 0.1) * 0.04;
 return (x, z) => {
  const a = Math.atan2(x, z), q = Math.hypot(x, z) / i.r / wobble(a);
  if (q > 1.12) return 0.35 - 0.95 - (q - 1.12) * 7.5;
  if (q > 1) return 0.35 - (q - 1) / 0.12 * 0.95;
  if (q > 0.8) return 0.35 + (1 - q) / 0.2 * 0.75;
  const dome = smooth(1 - q / 0.8);
  return 1.1 + height * dome + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.18 * dome;
 };
}

export function makeView(canvas) {
 const T = window.THREE;
 T.ColorManagement.legacyMode = false;
 const mobile = matchMedia('(pointer:coarse)').matches || !!window.HubPerformance?.low;
 const resolution = window.HubPerformance?.createResolutionBudget(mobile ? 1.5 : 2);
 const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
 const renderer = new T.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
 renderer.setPixelRatio(resolution?.ratio(innerWidth, innerHeight) ?? Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
 renderer.outputEncoding = T.sRGBEncoding;
 renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
 const scene = new T.Scene();
 const FOG = new T.Color('#9fd0e2');
 scene.fog = new T.Fog(FOG, 210, 400);
 const camera = new T.PerspectiveCamera(55, 1, 0.5, 700);
 scene.add(new T.HemisphereLight(0xd6efff, 0x5a6a4a, 0.75));
 const sun = new T.DirectionalLight(0xfff0cf, 1.9); sun.position.set(-60, 90, 40); scene.add(sun); scene.add(sun.target);
 const SUN_OFFSET = sun.position.clone();
 // Desktop gets soft sun shadows from sails, masts and palms; phones skip them.
 if (!mobile) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 260 }); sun.shadow.mapSize.set(window.HubPerformance?.tier === 'balanced' ? 1024 : 2048, window.HubPerformance?.tier === 'balanced' ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
 }
 const shadowed = group => { if (mobile) return; group.traverse(o => { if (o.isMesh && !o.material.transparent && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } }); };
 const SUN_DIR = sun.position.clone().normalize();

 const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
 const flat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
 const glowMat = (color, opacity = 0.6) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, fog: false });
 function mesh(g, m, parent, x = 0, y = 0, z = 0) { const o = new T.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; }
 function rod(parent, a, b, r, material, seg = 6) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b), d = to.clone().sub(from);
  const o = mesh(new T.CylinderGeometry(r, r, d.length(), seg), material, parent);
  o.position.copy(from).add(to).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return o;
 }
 function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
 }

 // ---------- Sky ----------
 const sky = new T.Mesh(new T.SphereGeometry(600, 32, 16), new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: SUN_DIR } },
  vertexShader: 'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 sun;varying vec3 d;void main(){vec3 n=normalize(d);float h=max(n.y,0.);
   vec3 c=mix(vec3(.66,.86,.9),vec3(.2,.52,.86),pow(h,.55));float s=max(dot(n,sun),0.);c+=vec3(1.,.85,.55)*(pow(s,600.)*2.+pow(s,12.)*.18);
   gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <encodings_fragment>
   }` }));
 scene.add(sky);
 // Painted cumulus: soft billboards, sunlit on top and shaded underneath.
 const cloudTex = canvasTexture(256, 128, (g, w, h) => {
  const blob = (x, y, r, top, bottom) => { const gr = g.createRadialGradient(x, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, top); gr.addColorStop(0.7, bottom); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  let seed = 3; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 16; k++) { const x = 40 + rnd() * 176, y = 70 + (rnd() - 0.5) * 30 - Math.sin((x - 40) / 176 * Math.PI) * 22, r = 20 + rnd() * 26; blob(x, y + 8, r, '#c3d3dccc', '#b6c7d300'); }
  for (let k = 0; k < 16; k++) { const x = 40 + rnd() * 176, y = 66 + (rnd() - 0.5) * 26 - Math.sin((x - 40) / 176 * Math.PI) * 24, r = 16 + rnd() * 22; blob(x, y, r, '#ffffffff', '#eef4f7aa'); }
 });
 const clouds = [];
 for (let i = 0; i < 22; i++) {
  const a = i / 22 * Math.PI * 2 + Math.sin(i * 7) * 0.2, r = 380 + (i % 4) * 45, size = 120 + (i % 5) * 35;
  const c = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
  c.position.set(Math.sin(a) * r, 34 + (i % 5) * 16, Math.cos(a) * r); c.scale.set(size, size * 0.5, 1); scene.add(c); clouds.push({ c, a, r });
 }

 // ---------- Water ----------
 const isles = ISLANDS.map(i => new T.Vector3(i.x, i.z, i.r));
 const MAX_BOATS = 8;
 // Shared GLSL: the swell plus a funnel sunk into each whirlpool. Mirrors waveHeight().
 const SWELL = `uniform float time;uniform vec4 whirls[2];
  float swell(vec2 p){float a=p.x*.16+p.y*.08+time*1.1,b=p.x*.07-p.y*.19-time*.8,c=p.x*.31+p.y*.27+time*1.7;
   float h=sin(a)*.3+sin(b)*.22+sin(c)*.06;
   for(int k=0;k<2;k++){float d=length(p-whirls[k].xy),r=whirls[k].z;if(d<r){float q=1.-d/r;h=h*(1.-q)-6.*pow(q,2.);}}
   return h;}`;
 const water = new T.ShaderMaterial({
  uniforms: {
   time: { value: 0 }, isles: { value: isles }, sun: { value: SUN_DIR }, fogColor: { value: FOG }, final: { value: 0 },
   banks: { value: TEAMS.map(t => new T.Vector3(t.x, t.z, BANK_RADIUS)) }, bankColors: { value: TEAMS.map(t => new T.Color(t.color)) },
   whirls: { value: [new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0)] }, whirlDir: { value: [1, -1] },
   boats: { value: Array.from({ length: MAX_BOATS }, () => new T.Vector4(0, 0, 0, 0)) }, boatScale: { value: new Array(MAX_BOATS).fill(1) },
  },
  vertexShader: `${SWELL}varying vec3 w;
   void main(){vec3 p=(modelMatrix*vec4(position,1.)).xyz;p.y+=swell(p.xz);w=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
  fragmentShader: `${SWELL}uniform vec3 isles[${ISLANDS.length}];uniform vec3 sun;uniform vec3 fogColor;uniform vec3 banks[2];uniform vec3 bankColors[2];uniform float final;
   uniform float whirlDir[2];uniform vec4 boats[${MAX_BOATS}];uniform float boatScale[${MAX_BOATS}];
   varying vec3 w;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){return noise(p)*.55+noise(p*2.13+7.1)*.3+noise(p*4.7-3.3)*.15;}
   void main(){
    // Surface normal from the swell, roughened by drifting noise ripples.
    float e=.6,h0=swell(w.xz);vec3 n=normalize(vec3(h0-swell(w.xz+vec2(e,0.)),e,h0-swell(w.xz+vec2(0.,e))));
    vec2 q1=w.xz*.35+vec2(time*.35,time*.2),q2=w.xz*.9-vec2(time*.5,-time*.3);
    n=normalize(n+vec3(noise(q1)-.5,0.,noise(q1+5.3)-.5)*.32+vec3(noise(q2)-.5,0.,noise(q2+9.1)-.5)*.18);
    vec3 v=normalize(cameraPosition-w);
    float shore=1e4;for(int i=0;i<${ISLANDS.length};i++){shore=min(shore,length(w.xz-isles[i].xy)-isles[i].z);}
    vec3 deep=vec3(.008,.11,.26),mid=vec3(.015,.27,.45),shallow=vec3(.12,.66,.66);
    float blotch=fbm(w.xz*.03+time*.01);
    vec3 c=mix(mid,deep,smoothstep(6.,80.,shore)*(.75+.25*blotch));c=mix(shallow,c,smoothstep(-1.,11.,shore));
    // Light glowing through the backs of the waves.
    c+=vec3(.02,.16,.14)*smoothstep(.05,.5,w.y)*max(dot(normalize(vec3(-sun.x,.3,-sun.z)),-v*vec3(1.,0.,1.)),.2);
    float fr=pow(1.-max(dot(n,v),0.),4.);c=mix(c,vec3(.55,.75,.9),fr*.42);
    float sp=pow(max(dot(reflect(-sun,n),v),0.),220.);c+=vec3(1.,.93,.78)*sp*2.2;
    float foam=0.,grain=fbm(w.xz*.7+vec2(time*.15,0.));
    foam+=smoothstep(3.4,.2,shore)*(.6+.4*sin(shore*2.4-time*2.1))*(.5+grain);
    foam+=smoothstep(.66,.9,fbm(w.xz*.12+time*.05))*.15*smoothstep(10.,40.,shore);
    // Hull foam and V-shaped wakes behind every ship.
    for(int i=0;i<${MAX_BOATS};i++){vec4 b=boats[i];if(b.w<=0.)continue;
     float s=boatScale[i];vec2 rel=(w.xz-b.xy)/s,f=vec2(sin(b.z),cos(b.z));
     float along=dot(rel,f),across=abs(dot(rel,vec2(f.y,-f.x))),spd=clamp(b.w/16.,0.,1.2);
     float ell=length(vec2(across/2.55,(along-.4)/5.9));
     foam+=smoothstep(1.3,1.02,ell)*smoothstep(.92,1.02,ell)*(.25+.55*min(spd,1.))*(.5+.6*grain);
     foam+=smoothstep(1.,0.,length(vec2(across*.9,along-5.9)))*min(spd,1.)*.6;
     float back=-along-4.5;
     if(back>0.&&back<42.){float wd=1.6+back*.27;float fade=1.-back/42.;
      float edge=smoothstep(.7,0.,abs(across-wd))*smoothstep(.35,.7,grain);
      float trail=smoothstep(1.8+back*.06,0.,across)*smoothstep(.45,.8,fbm(vec2(across*.9,back*.35-time*.6)));
      foam+=(edge*.6+trail*.7)*fade*fade*min(spd,1.);}
    }
    // Whirlpools: a dark sinking eye ringed by spiralling foam.
    for(int k=0;k<2;k++){vec2 rel=w.xz-whirls[k].xy;float d=length(rel),r=whirls[k].z;
     if(r>0.&&d<r*1.25){float qq=clamp(1.-d/r,0.,1.),ang=atan(rel.y,rel.x),dir=whirlDir[k];
      float spiral=sin(ang*3.+dir*log(d+1.)*6.5-whirls[k].w*4.*dir+grain*1.5);
      c=mix(c,vec3(.0,.07,.15),pow(qq,1.3)*.85);
      foam+=smoothstep(.35,1.,spiral)*qq*(1.-smoothstep(.75,.95,qq))*1.1;
      foam+=smoothstep(.12,0.,abs(d/r-1.))*(.4+.6*grain);
      c=mix(c,vec3(.0,.02,.05),smoothstep(.8,1.,qq));}}
    c=mix(c,vec3(.93,.97,.96),clamp(foam,0.,1.)*.88);
    for(int k=0;k<2;k++){float d=length(w.xz-banks[k].xy),r=banks[k].z;
     float ang=atan(w.z-banks[k].y,w.x-banks[k].x);float dash=step(0.,sin(ang*22.+time*1.5));
     float band=smoothstep(1.,.2,abs(d-r))*(.55+.45*dash);float pulse=.5+.5*sin(time*3.);
     c=mix(c,bankColors[k],band*.8);c=mix(c,bankColors[k],step(d,r)*(.12+final*.12*pulse));}
    float dist=length(w-cameraPosition);c=mix(c,fogColor,smoothstep(190.,420.,dist));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
   }`,
 });
 // A dense sea over the arena, and a coarse ring out to the horizon tucked just beneath it.
 const seaGeo = new T.PlaneGeometry(560, 560, mobile ? 200 : 320, mobile ? 200 : 320); seaGeo.rotateX(-Math.PI / 2);
 const sea = new T.Mesh(seaGeo, water); scene.add(sea);
 const farGeo = new T.RingGeometry(270, 1100, 96, 6); farGeo.rotateX(-Math.PI / 2);
 const farSea = new T.Mesh(farGeo, water); farSea.position.y = -0.35; farSea.renderOrder = -1; scene.add(farSea);
 // Sandy seabed visible through nothing, but closes the world under islands.
 const seabed = mesh(new T.CircleGeometry(760, 32), mat('#2b6f7c'), scene, 0, -6, 0); seabed.rotation.x = -Math.PI / 2;

 // ---------- Land ----------
 const landMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
 const rockMat = flat('#7d8a87'), rockDark = flat('#5f6b6b'), bark = mat('#8a6a43'), leaf = flat('#3f9b4c', { side: T.DoubleSide }), leafLight = flat('#6cbf55', { side: T.DoubleSide });
 const wood = flat('#a87848'), woodDark = flat('#6d4a2c'), plank = flat('#c4955f', { side: T.DoubleSide }), stone = flat('#c9bfa6'), stoneDark = flat('#968c78'), iron = mat('#2c3438', { metalness: 0.5, roughness: 0.45 }), gold = mat('#ffcf4a', { metalness: 0.7, roughness: 0.3, emissive: '#a66f00', emissiveIntensity: 0.35 });
 function terrain(i) {
  const h = islandShape(i), seg = 64, rings = 16, outer = i.r * 1.5, p = [], col = [], idx = [];
  const wet = new T.Color('#c7a56a'), sand = new T.Color('#f3dda2'), grass = new T.Color('#69b552'), grassDark = new T.Color('#4c9447'), cliff = new T.Color('#9c9f8c');
  for (let r = 0; r <= rings; r++) for (let j = 0; j <= seg; j++) {
   const a = j / seg * Math.PI * 2, q = Math.pow(r / rings, 0.85) * outer, x = Math.sin(a) * q, z = Math.cos(a) * q, y = h(x, z);
   p.push(x, y, z);
   const c = y < 0.2 ? wet.clone() : y < 1.15 ? sand.clone() : ((i.kind === 'rock' && y > 2.4) || (i.kind === 'far' && y > 9) ? cliff.clone() : grass.clone().lerp(grassDark, Math.sin(x * 0.5 + z * 0.3) * 0.5 + 0.5));
   c.multiplyScalar(0.94 + Math.sin(x * 2.1 + z * 1.7) * 0.05); col.push(c.r, c.g, c.b);
  }
  for (let r = 0; r < rings; r++) for (let j = 0; j < seg; j++) { const a = r * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
 }
 function palm(parent, x, y, z, height, lean) {
  const g = new T.Group(); g.position.set(x, y - 0.2, z); g.rotation.set(lean * 0.6, x * 1.7, lean); parent.add(g);
  rod(g, [0, 0, 0], [0.5, height * 0.55, 0], 0.32, bark); rod(g, [0.5, height * 0.55, 0], [0.15, height, 0], 0.24, bark);
  for (let j = 0; j < 7; j++) {
   const a = j / 7 * Math.PI * 2, verts = [], side = [-Math.sin(a), 0, Math.cos(a)];
   const at = q => [0.15 + Math.cos(a) * q * 4, height + Math.sin(q * Math.PI) * 0.9 - q * 1.6, Math.sin(a) * q * 4];
   for (let k = 0; k < 8; k++) {
    const q = 0.08 + k * 0.1, p0 = at(q), tip = at(q + 0.12), wd = Math.sin(q * Math.PI) * 0.8;
    for (const s of [-1, 1]) verts.push(...p0, p0[0] + side[0] * wd * s, p0[1] - 0.15, p0[2] + side[2] * wd * s, ...tip);
   }
   const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); geo.computeVertexNormals();
   mesh(geo, j % 2 ? leaf : leafLight, g);
  }
  for (let k = 0; k < 3; k++) mesh(new T.SphereGeometry(0.28, 6, 5), woodDark, g, 0.15 + Math.cos(k * 2) * 0.35, height - 0.35, Math.sin(k * 2) * 0.35);
 }
 function rock(parent, x, y, z, s, tall = 1, dark = false) {
  const r = mesh(new T.DodecahedronGeometry(s, 0), dark ? rockDark : rockMat, parent, x, y + s * tall * 0.35, z);
  r.scale.set(1, tall, 0.85); r.rotation.set(x, z, x * z * 0.01); return r;
 }
 const harbors = [], towers = [];
 let wreckSite = null;
 for (const i of ISLANDS) {
  const g = new T.Group(); g.position.set(i.x, 0, i.z); scene.add(g);
  const h = islandShape(i);
  if (i.kind === 'wreck') { wreckSite = g; continue; }
  mesh(terrain(i), landMat, g);
  const ring = (n, rad, fn) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + i.x * 0.01, x = Math.sin(a) * rad, z = Math.cos(a) * rad; fn(x, h(x, z), z, k); } };
  if (i.kind === 'palm') {
   ring(4, i.r * 0.45, (x, y, z, k) => palm(g, x, y, z, 6 + k % 2 * 1.5, (k % 2 ? 0.18 : -0.15)));
   palm(g, 0, h(0, 0), 0, 7.5, 0.08);
   ring(5, i.r * 0.85, (x, y, z, k) => rock(g, x, y - 0.6, z, 0.9 + k % 2 * 0.5));
   ring(7, i.r * 0.6, (x, y, z, k) => { const b = mesh(new T.IcosahedronGeometry(0.9 + k % 3 * 0.25, 0), k % 2 ? leaf : leafLight, g, x, y + 0.3, z); b.scale.y = 0.7; });
  } else if (i.kind === 'rock') {
   rock(g, 0, h(0, 0) - 1, 0, 4.2, 2.2); rock(g, 3, h(3, 2) - 1, 2, 2.8, 1.8, true); rock(g, -3, h(-3, -1) - 1, -1.5, 2.6, 1.5);
   ring(6, i.r * 0.92, (x, y, z, k) => rock(g, x, y - 0.8, z, 1 + k % 3 * 0.4, 1, k % 2));
   palm(g, -2, h(-2, 4), 4, 5.5, -0.2);
  } else if (i.kind === 'harbor') buildHarbor(i, g, h);
 }
 // Reef rocks mark the edge of the sea.
 for (let k = 0; k < 40; k++) {
  const a = k / 40 * Math.PI * 2, r = EDGE + 12 + (k % 3) * 3;
  if (TEAMS.some(t => Math.abs(Math.sin(a)) < 0.2 && Math.sign(Math.cos(a)) === Math.sign(t.x))) continue;
  rock(scene, Math.cos(a) * r, -1.2, Math.sin(a) * r, 2.4 + (k % 4) * 0.7, 1.1, k % 2);
 }
 // Distant mountainous islands give the horizon depth.
 for (let k = 0; k < 8; k++) {
  const a = k / 8 * Math.PI * 2 + 0.35, r = 300 + (k % 3) * 45, isle = { x: Math.cos(a) * r, z: Math.sin(a) * r, r: 26 + (k % 3) * 12, kind: 'far' };
  const g = new T.Group(); g.position.set(isle.x, 0, isle.z); g.scale.y = 1 + (k % 2) * 0.6; scene.add(g); mesh(terrain(isle), landMat, g);
 }

 function buildWreck(g) {
  const hull = shipHull({ key: 'wreck', bottom: '#3a2a1e', wood: '#4a3423', stripe: '#3a2a1e', cap: '#5a4430', rail: '#2a1d12' }); hull.scale.setScalar(1.15); hull.position.set(0, -1.6, 0); hull.rotation.set(0.15, 0.6, 0.45); g.add(hull);
  rod(g, [0.5, -0.5, 0.3], [-2.4, 6, 1.5], 0.25, woodDark);
  const sailRag = mesh(new T.PlaneGeometry(2.4, 2.2), flat('#d8ccb0', { side: T.DoubleSide }), g, -1.6, 4.2, 1.2); sailRag.rotation.set(0.2, 0.6, 0.4);
  for (let k = 0; k < 6; k++) rock(g, Math.sin(k) * 5.5, -1.1, Math.cos(k) * 5.5, 1 + k % 2 * 0.5, 0.9, true);
 }
 function buildHarbor(i, g, h) {
  const team = TEAMS[i.team], dir = -Math.sign(i.x), tc = new T.Color(team.color);
  const banner = flat(team.color, { side: T.DoubleSide, emissive: team.color, emissiveIntensity: 0.2 });
  // Stone tower with a guard cannon on top.
  const tx = dir * 18, ty = h(tx, 0) - 0.4, tower = new T.Group(); tower.position.set(tx, ty, 0); g.add(tower);
  mesh(new T.CylinderGeometry(4.2, 5, 9, 10), stone, tower, 0, 4.5, 0);
  mesh(new T.CylinderGeometry(4.8, 4.6, 1.2, 10), stoneDark, tower, 0, 9.4, 0);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; mesh(new T.BoxGeometry(1.4, 1.3, 1), stone, tower, Math.sin(a) * 4.3, 10.6, Math.cos(a) * 4.3).rotation.y = a; }
  mesh(new T.BoxGeometry(1.4, 2.2, 0.3), woodDark, tower, dir * 4.9, 1.1, 0).rotation.y = Math.PI / 2;
  const gun = new T.Group(); gun.position.set(0, 10.4, 0); tower.add(gun);
  const barrel = rod(gun, [0, 0.6, 0], [0, 0.9, 3.2], 0.45, iron, 10); mesh(new T.BoxGeometry(1.6, 0.8, 1.8), woodDark, gun, 0, 0.3, 0.4);
  towers[i.team] = { gun, x: i.x + tx, z: i.z, barrel };
  rod(tower, [0, 9, -2.5], [0, 19, -2.5], 0.16, woodDark);
  const flagGeo = new T.PlaneGeometry(5, 3, 8, 1); const flag = mesh(flagGeo, banner, tower, 2.5, 17.4, -2.5); flag.userData.base = flagGeo.attributes.position.array.slice();
  // Huts, crates and palms behind the quay.
  for (const z of [-12, 11]) {
   const hut = new T.Group(); hut.position.set(dir * 7, h(dir * 7, z) - 0.2, z); g.add(hut);
   mesh(new T.BoxGeometry(5, 3.2, 4.4), plank, hut, 0, 1.6, 0);
   const roof = mesh(new T.ConeGeometry(4.2, 2.6, 4), banner, hut, 0, 4.4, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.1, 1, 1);
   mesh(new T.BoxGeometry(0.2, 1.8, 1.2), woodDark, hut, dir * 2.55, 0.9, 0);
  }
  for (const [x, z, s] of [[dir * 3, -20, 7], [dir * 12, 15, 8], [-dir * 4, 6, 6.5], [-dir * 2, -6, 7.5], [dir * 6, 20, 6]]) palm(g, x, h(x, z), z, s, 0.15 * Math.sign(z || 1));
  // Two piers frame the bay. Pilings run from the seabed up through the deck.
  for (const z of [-23, 23]) {
   const x0 = dir * 22, x1 = dir * 38;
   mesh(new T.BoxGeometry(Math.abs(x1 - x0), 0.35, 3.4), plank, g, (x0 + x1) / 2, 1.25, z);
   for (let k = 0; k <= 4; k++) { const x = x0 + (x1 - x0) * k / 4; for (const s of [-1.5, 1.5]) rod(g, [x, -3, z + s], [x, 1.9, z + s], 0.22, woodDark); }
   for (let k = 0; k < 3; k++) mesh(new T.BoxGeometry(1, 1, 1), wood, g, x0 + (x1 - x0) * (0.3 + k * 0.08), 1.9, z + 0.6 * (k % 2 ? 1 : -1)).rotation.y = k;
   const lamp = rod(g, [x1, 1.4, z], [x1, 4.4, z], 0.12, woodDark); void lamp;
   mesh(new T.SphereGeometry(0.45, 8, 6), glowMat('#ffd27a', 0.9), g, x1, 4.6, z);
  }
  // Floating buoys outline the bank ring on the open-water side.
  const buoys = [];
  for (let k = 0; k < 18; k++) {
   const a = k / 18 * Math.PI * 2, bx = team.x + Math.cos(a) * BANK_RADIUS, bz = team.z + Math.sin(a) * BANK_RADIUS;
   if (Math.abs(bx) > 120) continue;
   const b = new T.Group(); scene.add(b);
   mesh(new T.CylinderGeometry(0.55, 0.75, 1.3, 8), flat(team.color), b, 0, 0.1, 0);
   mesh(new T.CylinderGeometry(0.3, 0.55, 0.6, 8), flat('#f4efe2'), b, 0, 1, 0);
   rod(b, [0, 1.2, 0], [0, 2.6, 0], 0.06, iron);
   buoys.push({ o: b, x: bx, z: bz, k });
  }
  const label = textSprite(`${team.name.toUpperCase()} HARBOR`, team.color, 0.9); label.position.set(i.x + tx, 25, i.z); label.scale.set(22, 5.5, 1); scene.add(label);
  harbors.push({ team, flag, buoys, tc, label });
 }

 // ---------- Ships ----------
 // A brig: lofted hull with a sweeping sheer, copper bottom, a team-colored wale,
 // gunports, stern windows, two masts of billowed sails and a web of rigging.
 const H = {
  len: 11.2, stern: -5,
  beam: t => t < 0.42 ? 1.7 + 0.72 * Math.sin(t / 0.42 * Math.PI / 2) : 2.42 * Math.pow(Math.max(0, Math.cos((t - 0.42) / 0.58 * Math.PI / 2)), 0.75),
  sheer: t => 2.05 + 0.95 * smooth((0.28 - t) / 0.28) + 0.65 * smooth((t - 0.72) / 0.28),
  keel: t => -0.45 + 1.4 * smooth((t - 0.78) / 0.22) + 0.35 * smooth((0.12 - t) / 0.12),
 };
 const hullZ = t => H.stern + t * H.len;
 const hullCache = new Map();
 function hullGeometry(scheme) {
  if (hullCache.has(scheme.key)) return hullCache.get(scheme.key);
  const rows = 34, N = 14, p = [], col = [], idx = [];
  const bottom = new T.Color(scheme.bottom), wood = new T.Color(scheme.wood), stripe = new T.Color(scheme.stripe), cap = new T.Color(scheme.cap);
  const section = t => {
   const w = H.beam(t), h = H.sheer(t), k = H.keel(t), pts = [];
   for (let i = 0; i <= N; i++) {
    const u = i / N, x = w * (u < 0.22 ? 0.92 + 0.08 * (u / 0.22) : Math.pow(Math.max(0, Math.cos((u - 0.22) / 0.78 * Math.PI / 2)), 0.65));
    const y = h - (h - k) * (u < 0.22 ? u / 0.22 * 0.3 : 0.3 + 0.7 * Math.sin((u - 0.22) / 0.78 * Math.PI / 2));
    pts.push([x, y]);
   }
   return { pts, h };
  };
  for (let r = 0; r <= rows; r++) {
   const t = r / rows, z = hullZ(t), { pts, h } = section(t), ring = [...pts.map(([x, y]) => [x, y]), ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
   for (const [x, y] of ring) {
    p.push(x, y, z);
    const c = y < 0.8 ? bottom : y > h - 0.12 ? cap : (y > h - 0.62 && y < h - 0.3) ? stripe : wood;
    const shade = 0.92 + 0.08 * Math.sin(y * 9);
    col.push(c.r * shade, c.g * shade, c.b * shade);
   }
  }
  const per = 2 * N + 1;
  for (let r = 0; r < rows; r++) for (let k = 0; k < per - 1; k++) { const a = r * per + k, b = a + per; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // Close the transom.
  const c = p.length / 3, s0 = section(0); p.push(0, (s0.h + H.keel(0)) / 2, H.stern); col.push(wood.r * 0.8, wood.g * 0.8, wood.b * 0.8);
  for (let k = 0; k < per - 1; k++) idx.push(c, k + 1, k);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  hullCache.set(scheme.key, g); return g;
 }
 const deckTex = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#b98a57'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { g.fillStyle = x % 32 ? '#c79a64' : '#ad7f4e'; g.fillRect(x, 0, 15, h); g.fillStyle = '#6b4a2c'; g.fillRect(x + 15, 0, 1, h); g.fillRect(x, (x * 37) % h, 15, 1); }
 });
 deckTex.wrapS = deckTex.wrapT = T.RepeatWrapping;
 const deckMat = new T.MeshStandardMaterial({ map: deckTex, roughness: 0.9, side: T.DoubleSide });
 let DECK = null, BULWARK = null;
 function deckGeometries() {
  if (DECK) return;
  const rows = 34, dp = [], duv = [], di = [], bp = [], bi = [];
  for (let r = 0; r <= rows; r++) {
   const t = r / rows, z = hullZ(t), w = H.beam(t) * 0.92, h = H.sheer(t) - 0.12;
   dp.push(-w, h, z, w, h, z); duv.push(-w / 2, z / 2, w / 2, z / 2);
   // Bulwark: a low wall rising from the deck edge.
   for (const s of [-1, 1]) bp.push(s * w, h, z, s * w * 0.99, h + 0.55, z);
  }
  for (let r = 0; r < rows; r++) {
   const a = r * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
   for (const o of [0, 2]) { const b = r * 4 + o; bi.push(b, b + 4, b + 1, b + 1, b + 4, b + 5); }
  }
  DECK = new T.BufferGeometry(); DECK.setAttribute('position', new T.Float32BufferAttribute(dp, 3)); DECK.setAttribute('uv', new T.Float32BufferAttribute(duv, 2)); DECK.setIndex(di); DECK.computeVertexNormals();
  BULWARK = new T.BufferGeometry(); BULWARK.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); BULWARK.setIndex(bi); BULWARK.computeVertexNormals();
 }
 const SCHEMES = {};
 function scheme(color, galleon) {
  const key = color + (galleon ? 'g' : '');
  return SCHEMES[key] ||= galleon
   ? { key, bottom: '#3d2a20', wood: '#2c1e19', stripe: '#d7a43a', cap: '#e2b24a', rail: '#1d1411', sail: '#2a2526' }
   : { key, bottom: '#5c2a1c', wood: '#6a4426', stripe: color, cap: '#e8d8b0', rail: '#3b2616', sail: '#f3ead2' };
 }
 function shipHull(sc) {
  deckGeometries();
  const g = new T.Group(), rail = flat(sc.rail, { side: T.DoubleSide });
  mesh(hullGeometry(sc), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: T.DoubleSide }), g);
  mesh(DECK, deckMat, g); mesh(BULWARK, rail, g);
  return g;
 }
 const sailTex = new Map();
 function sailTexture(color, skull) {
  const key = color + skull; if (sailTex.has(key)) return sailTex.get(key);
  const t = canvasTexture(256, 256, (g, w, h) => {
   const base = g.createLinearGradient(0, 0, 0, h); base.addColorStop(0, skull ? '#3a3334' : '#fbf5e4'); base.addColorStop(1, skull ? '#221d1e' : '#e6dcc0');
   g.fillStyle = base; g.fillRect(0, 0, w, h);
   g.fillStyle = skull ? '#00000033' : '#9c8a6a33'; for (let x = 32; x < w; x += 32) g.fillRect(x, 0, 2, h);
   if (!skull) { g.fillStyle = color; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 30, w, 30); g.fillStyle = '#ffffff55'; g.fillRect(0, 26, w, 3); }
   g.save(); g.translate(128, 132); const ink = skull ? '#efe4c8' : color, back = skull ? '#2c2627' : '#f6efdc';
   g.strokeStyle = ink; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(-46, 22); g.lineTo(46, 62); g.moveTo(46, 22); g.lineTo(-46, 62); g.stroke();
   g.fillStyle = ink; g.beginPath(); g.ellipse(0, -10, 34, 38, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-20, 16, 40, 18);
   g.fillStyle = back; g.beginPath(); g.ellipse(-13, -10, 9, 11, 0.2, 0, Math.PI * 2); g.ellipse(13, -10, 9, 11, -0.2, 0, Math.PI * 2); g.fill();
   g.beginPath(); g.moveTo(0, 4); g.lineTo(-5, 13); g.lineTo(5, 13); g.fill(); for (const x of [-10, 0, 10]) g.fillRect(x - 1.5, 22, 3, 12);
   g.restore();
  });
  sailTex.set(key, t); return t;
 }
 // Square sail hanging from a yard, billowed forward by the wind.
 function sail(parent, top, bottom, h, y, z, material) {
  const geo = new T.PlaneGeometry(1, h, 8, 6), pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) {
   const u = pos.getX(k) + 0.5, v = pos.getY(k) / h + 0.5, w = bottom + (top - bottom) * v;
   pos.setX(k, (u - 0.5) * w); pos.setZ(k, Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.85 + 0.25) * w * 0.16);
  }
  geo.computeVertexNormals(); return mesh(geo, material, parent, 0, y, z);
 }
 function buildShip(color, galleon = false) {
  const root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root);
  const scale = galleon ? 1.6 : 1, sc = scheme(color, galleon);
  const hull = shipHull(sc); hull.scale.setScalar(scale); body.add(hull);
  const deck = new T.Group(); deck.scale.setScalar(scale); body.add(deck);
  const rail = flat(sc.rail), trim = galleon ? gold : flat(color), lamp = new T.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb340', emissiveIntensity: 1.2 });
  // Stern: windows and a lantern.
  for (const x of [-0.85, 0, 0.85]) mesh(new T.BoxGeometry(0.42, 0.42, 0.06), lamp, deck, x, 2.15, H.stern - 0.02);
  mesh(new T.BoxGeometry(3, 0.12, 0.1), trim, deck, 0, 2.6, H.stern - 0.04);
  rod(deck, [0, 2.9, H.stern + 0.2], [0, 4.1, H.stern - 0.2], 0.06, iron); mesh(new T.SphereGeometry(0.28, 8, 6), lamp, deck, 0, 4.15, H.stern - 0.25);
  // Gunports and cannons along both sides.
  const guns = [];
  for (const t of [0.3, 0.44, 0.58]) {
   const z = hullZ(t), w = H.beam(t), y = H.sheer(t) - 0.85;
   for (const side of [-1, 1]) {
    mesh(new T.BoxGeometry(0.08, 0.5, 0.6), iron, deck, side * w * 0.985, y, z);
    const c = rod(deck, [side * w * 0.8, y, z], [side * (w + 0.55), y, z], 0.17, iron, 10); guns.push({ c, side });
   }
  }
  // Bowsprit, figurehead and masts.
  rod(deck, [0, 2.7, 5.4], [0, 4.3, 9.2], 0.13, rail);
  mesh(new T.SphereGeometry(0.3, 8, 6), trim, deck, 0, 2.5, 6.15);
  const sailMat = new T.MeshStandardMaterial({ map: sailTexture(color, galleon), side: T.DoubleSide, roughness: 1 });
  const masts = galleon ? [[-2.2, 13], [0.8, 14.5], [3.4, 11]] : [[-0.5, 13], [2.7, 11.2]];
  const lines = [];
  for (const [z, top] of masts) {
   const base = H.sheer((z - H.stern) / H.len) - 0.1;
   rod(deck, [0, base - 0.2, z], [0, top, z], 0.19, rail, 8);
   const big = top / 13;
   rod(deck, [-3 * big, top * 0.47, z], [3 * big, top * 0.47, z], 0.09, rail); rod(deck, [-2.4 * big, top * 0.74, z], [2.4 * big, top * 0.74, z], 0.08, rail);
   sail(deck, 6 * big, 5.4 * big, top * 0.24, top * 0.47 - top * 0.12, z + 0.15, sailMat);
   sail(deck, 4.8 * big, 4.4 * big, top * 0.2, top * 0.74 - top * 0.1, z + 0.12, sailMat);
   mesh(new T.CylinderGeometry(0.75, 0.55, 0.45, 10), rail, deck, 0, top * 0.62, z);
   const flagGeo = new T.PlaneGeometry(2.4, 0.8, 6, 1); flagGeo.translate(1.2, 0, 0);
   mesh(flagGeo, flat(galleon ? '#1d1b1b' : color, { side: T.DoubleSide }), deck, 0, top - 0.4, z).rotation.y = Math.PI / 2;
   // Shrouds to both rails and a stay forward.
   for (const s of [-1, 1]) for (const dz of [-0.8, 0, 0.8]) { const t = (z + dz - H.stern) / H.len; lines.push(0, top * 0.72, z, s * H.beam(t) * 0.92, H.sheer(t) + 0.4, z + dz); }
  }
  const [fz, ftop] = masts[masts.length - 1];
  lines.push(0, ftop, fz, 0, 4.3, 9.2);
  for (let k = 0; k < masts.length - 1; k++) lines.push(0, masts[k][1], masts[k][0], 0, masts[k + 1][1] * 0.75, masts[k + 1][0]);
  lines.push(0, masts[0][1], masts[0][0], 0, 3.4, H.stern + 0.3);
  const rigging = new T.BufferGeometry(); rigging.setAttribute('position', new T.Float32BufferAttribute(lines, 3));
  deck.add(new T.LineSegments(rigging, new T.LineBasicMaterial({ color: '#2a1d12' })));
  const jib = new T.BufferGeometry(); jib.setAttribute('position', new T.Float32BufferAttribute([0, 4.1, 8.8, 0, ftop * 0.9, fz + 0.1, 0, 3.2, fz + 0.5], 3)); jib.computeVertexNormals();
  mesh(jib, new T.MeshStandardMaterial({ color: sc.sail, side: T.DoubleSide, roughness: 1 }), deck);
  // Treasure piled on deck grows with the gold you carry.
  const loot = new T.Group(); deck.add(loot);
  const pieces = [];
  for (let k = 0; k < 7; k++) {
   const p = k % 3 === 0 ? chestMesh(0.7) : coinPile(0.65 + (k % 2) * 0.2), z = 0.4 + Math.floor(k / 3) * 0.9;
   p.position.set(((k % 3) - 1) * 1.05, H.sheer((z - H.stern) / H.len) - 0.12, z); p.rotation.y = k * 1.3; p.visible = false; loot.add(p); pieces.push(p);
  }
  const shield = mesh(new T.SphereGeometry(7 * scale, 20, 14), new T.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: 0.18, depthWrite: false }), root, 0, 2, 0); shield.scale.set(0.75, 0.6, 1.1); shield.visible = false;
  const aura = mesh(new T.RingGeometry(5.5, 6.6, 32), glowMat('#ffffff', 0.45), root, 0, 1.3, 0); aura.rotation.x = -Math.PI / 2; aura.visible = false;
  shadowed(body);
  return { root, body, guns, pieces, shield, aura, galleon };
 }
 buildWreck(wreckSite);
 function coinPile(s) {
  const g = new T.Group(); g.scale.setScalar(s);
  const m = mesh(new T.ConeGeometry(0.9, 0.7, 9), gold, g, 0, 0.35, 0); void m;
  for (let k = 0; k < 4; k++) { const c = mesh(new T.CylinderGeometry(0.28, 0.28, 0.08, 10), gold, g, Math.cos(k * 1.6) * 0.8, 0.1, Math.sin(k * 1.6) * 0.8); c.rotation.set(k * 0.5, 0, k * 0.3); }
  return g;
 }
 function chestMesh(s) {
  const g = new T.Group(); g.scale.setScalar(s);
  mesh(new T.BoxGeometry(1.6, 0.9, 1.1), wood, g, 0, 0.45, 0);
  const lid = mesh(new T.CylinderGeometry(0.55, 0.55, 1.6, 10, 1, false, 0, Math.PI), woodDark, g, 0, 0.9, 0); lid.rotation.z = Math.PI / 2;
  for (const x of [-0.55, 0.55]) mesh(new T.BoxGeometry(0.14, 1.5, 1.16), gold, g, x, 0.75, 0);
  mesh(new T.BoxGeometry(0.3, 0.32, 0.1), gold, g, 0, 0.75, 0.58);
  return g;
 }

 // ---------- Labels ----------
 function textSprite(text, color, alpha = 1) {
  const t = canvasTexture(512, 128, (g, w, h) => { g.font = '900 64px Georgia, serif'; g.textAlign = 'center'; g.lineWidth = 12; g.strokeStyle = '#0b2530cc'; g.strokeText(text, w / 2, 86); g.fillStyle = color; g.fillText(text, w / 2, 86); });
  return new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, opacity: alpha, depthWrite: false, fog: false }));
 }
 function makeLabel() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.renderOrder = 10;
  s.scale.set(10, 3.75, 1); scene.add(s); return { s, c, t, key: '' };
 }
 function paintLabel(L, name, color, hp, max, goldAmount, mine, extra) {
  const key = `${name}|${Math.ceil(hp / max * 20)}|${goldAmount}|${extra}`; if (L.key === key) return; L.key = key;
  const g = L.c.getContext('2d'); g.clearRect(0, 0, 256, 96);
  g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#0a2029'; g.fillStyle = mine ? '#fff3c4' : color;
  const title = extra ? `${name} · ${extra}` : name; g.strokeText(title, 128, 28); g.fillText(title, 128, 28);
  g.fillStyle = '#0a2029cc'; g.fillRect(38, 40, 180, 14); g.fillStyle = hp / max > 0.35 ? color : '#ff4d3d'; g.fillRect(41, 43, 174 * Math.max(0, hp / max), 8);
  if (goldAmount > 0) { g.font = '900 28px system-ui, sans-serif'; g.strokeText(`◉ ${goldAmount}`, 128, 86); g.fillStyle = '#ffd34d'; g.fillText(`◉ ${goldAmount}`, 128, 86); }
  L.t.needsUpdate = true;
 }

 // ---------- Loot & power-ups ----------
 const glowTex = canvasTexture(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#ffffffff'); r.addColorStop(0.35, '#ffffff99'); r.addColorStop(1, '#ffffff00'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
 const beamGeo = new T.CylinderGeometry(0.35, 0.9, 14, 8, 1, true); beamGeo.translate(0, 7, 0);
 const POWER_COLORS = { triple: '#ff8a3d', gust: '#6fe3ff', repair: '#6dff8a' };
 const POWER_ICONS = { triple: '✹', gust: '➤', repair: '✚' };
 function lootObject(l) {
  const g = new T.Group(); scene.add(g);
  const body = l.kind === 'chest' ? chestMesh(1.1) : (() => { const p = new T.Group(); mesh(new T.BoxGeometry(1.6, 0.6, 1.6), wood, p, 0, 0, 0); const c = coinPile(0.8); c.position.y = 0.3; p.add(c); return p; })();
  g.add(body);
  const beam = mesh(beamGeo, glowMat('#ffd34d', l.kind === 'chest' ? 0.28 : 0.18), g); beam.scale.setScalar(l.kind === 'chest' ? 1 : 0.6);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#ffd34d', transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, fog: false })); halo.scale.setScalar(5); halo.position.y = 1; g.add(halo);
  return { g, body, x: l.x, z: l.z, seed: (l.id * 1.7) % 6 };
 }
 function powerObject(p) {
  const g = new T.Group(); scene.add(g); const color = POWER_COLORS[p.kind];
  const barrel = new T.Group(); g.add(barrel);
  mesh(new T.CylinderGeometry(0.9, 0.9, 1.9, 12), wood, barrel, 0, 0, 0);
  for (const y of [-0.6, 0.6]) mesh(new T.CylinderGeometry(0.95, 0.95, 0.3, 12), flat(color, { emissive: color, emissiveIntensity: 0.5 }), barrel, 0, y, 0);
  barrel.rotation.z = Math.PI / 2;
  mesh(beamGeo, glowMat(color, 0.3), g);
  const icon = textSprite(POWER_ICONS[p.kind], color); icon.scale.set(9, 2.25, 1); icon.position.y = 4; g.add(icon);
  return { g, barrel, x: p.x, z: p.z, seed: p.id % 5 };
 }

 // Gulls wheel over the islands.
 const gullMat = new T.MeshStandardMaterial({ color: '#f4f2ea', side: T.DoubleSide, roughness: 1 }), wingGeo = new T.BufferGeometry();
 wingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.35, 0, 0, -0.35, 1.6, 0.15, -0.2, 1.6, 0.15, -0.2, 2.5, -0.15, -0.55, 0, 0, -0.35], 3)); wingGeo.computeVertexNormals();
 const gulls = [];
 for (let k = 0; k < 9; k++) {
  const home = ISLANDS[2 + (k % 6)] || ISLANDS[2], g = new T.Group(); scene.add(g);
  mesh(new T.SphereGeometry(0.28, 6, 4), gullMat, g).scale.set(1, 0.8, 2.4);
  const l = mesh(wingGeo, gullMat, g), r2 = mesh(wingGeo, gullMat, g); r2.scale.x = -1;
  gulls.push({ g, l, r2, cx: home.x, cz: home.z, r: 14 + (k % 3) * 9, y: 16 + (k % 4) * 5, t: k * 1.9, speed: (k % 2 ? 1 : -1) * (0.18 + (k % 3) * 0.05), flap: 7 + (k % 3) });
 }
 shadowed(scene);

 // ---------- Particles ----------
 const parts = [];
 const puffTex = canvasTexture(64, 64, (g) => {
  for (let k = 0; k < 9; k++) { const x = 32 + Math.cos(k * 2.4) * 10 * (k % 3) / 2, y = 32 + Math.sin(k * 2.4) * 10 * (k % 3) / 2, r = 12 + (k % 4) * 4, gr = g.createRadialGradient(x, y - 3, 1, x, y, r);
   gr.addColorStop(0, '#ffffffcc'); gr.addColorStop(0.6, '#e8e8e866'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
 });
 const PART_MATS = { smoke: '#d8d4cc', splash: '#f2fbff', fire: '#ffb347', spark: '#ffe066', wood: '#8a5a35', dust: '#e9d7aa', foam: '#ffffff' };
 for (let k = 0; k < 420; k++) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s);
  parts.push({ s, life: 0, max: 1 });
 }
 let partAt = 0;
 function puff(kind, x, y, z, vx, vy, vz, size, life, grow = 1, gravity = 0) {
  const p = parts[partAt = (partAt + 1) % parts.length];
  p.kind = kind; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.size = size; p.life = p.max = life; p.grow = grow; p.gravity = gravity;
  const m = p.s.material, glow = kind === 'fire' || kind === 'spark'; m.color.set(PART_MATS[kind]); m.map = glow ? glowTex : puffTex; m.rotation = Math.random() * Math.PI * 2; m.blending = glow ? T.AdditiveBlending : T.NormalBlending; m.needsUpdate = true; p.s.visible = true;
 }
 function burst(kind, x, y, z, n, speed, size, life, up = 0.6, gravity = 0) {
  for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6); puff(kind, x, y, z, Math.cos(a) * s, up * speed * (0.5 + Math.random()), Math.sin(a) * s, size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.5), 1, gravity); }
 }
 function stepParticles(dt) {
  for (const p of parts) {
   if (p.life <= 0) continue;
   p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
   p.vy -= p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
   if (p.kind === 'smoke' || p.kind === 'dust') { p.vx *= 0.97; p.vz *= 0.97; }
   const k = p.life / p.max, sz = p.size * (1 + (1 - k) * p.grow);
   p.s.position.set(p.x, Math.max(p.y, -0.5), p.z); p.s.scale.set(sz, sz, 1); p.s.material.opacity = Math.min(1, k * 1.6) * (p.kind === 'smoke' ? 0.55 : p.kind === 'foam' ? 0.3 : 0.9);
  }
 }

 // ---------- Shots ----------
 const ballGeo = new T.SphereGeometry(0.42, 10, 8), ballMat = mat('#1d2226', { metalness: 0.6, roughness: 0.35 });
 const balls = [];
 function ball(k) { while (balls.length <= k) { const m = mesh(ballGeo, ballMat, scene); m.visible = false; balls.push(m); } return balls[k]; }

 // ---------- Home arrow ----------
 const arrowShape = new T.Shape(); arrowShape.moveTo(0, 2.6); arrowShape.lineTo(1.8, 0); arrowShape.lineTo(0.7, 0); arrowShape.lineTo(0.7, -1.8); arrowShape.lineTo(-0.7, -1.8); arrowShape.lineTo(-0.7, 0); arrowShape.lineTo(-1.8, 0); arrowShape.closePath();
 const arrowGeo = new T.ShapeGeometry(arrowShape); arrowGeo.rotateX(Math.PI / 2);
 const homeArrow = mesh(arrowGeo, new T.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: T.DoubleSide }), scene); homeArrow.renderOrder = 5; homeArrow.visible = false;

 // ---------- State ----------
 const ships = new Map(), lootObjs = new Map(), powerObjs = new Map();
 let galleonObj = null, time = 0, shake = 0, camReady = false;
 const cam = { x: 0, y: 40, z: -60, lx: 0, ly: 0, lz: 0 };

 function shipObject(s, w) {
  let o = ships.get(s.id);
  if (!o) {
   const color = s.galleon ? '#d9a93a' : TEAMS[s.team].color;
   o = { ...buildShip(color, !!s.galleon), label: makeLabel(), x: s.x, z: s.z, a: s.a, sinkT: 0, recoil: 0, roll: 0, wasDead: s.dead, wake: 0 };
   ships.set(s.id, o);
  }
  return o;
 }
 function placeShip(o, s, dt, mine, w) {
  const snap = o.wasDead && !s.dead;
  if (snap || Math.hypot(s.x - o.x, s.z - o.z) > 30) { o.x = s.x; o.z = s.z; o.a = s.a; o.sinkT = 0; }
  else { const k = damp(14, dt); o.x += (s.x - o.x) * k; o.z += (s.z - o.z) * k; o.a += angleDelta(s.a, o.a) * k; }
  o.wasDead = s.dead;
  const sinking = s.dead; o.sinkT = sinking ? o.sinkT + dt : 0;
  const scale = s.galleon ? 1.7 : 1, len = 4 * scale;
  const f = forward(o.a), y = waveHeight(o.x, o.z, time);
  const bow = waveHeight(o.x + f.x * len, o.z + f.z * len, time), stern = waveHeight(o.x - f.x * len, o.z - f.z * len, time);
  const sideX = -f.z, sideZ = f.x, port = waveHeight(o.x + sideX * 2.2 * scale, o.z + sideZ * 2.2 * scale, time), stb = waveHeight(o.x - sideX * 2.2 * scale, o.z - sideZ * 2.2 * scale, time);
  o.roll += ((s.yawRate || 0) * -0.12 - o.roll) * damp(4, dt);
  o.recoil = Math.max(0, o.recoil - dt * 3);
  // A ship swallowed by a whirlpool spirals round the eye as it goes down.
  const vortex = sinking && vortices.find(v => Math.hypot(o.x - v.x, o.z - v.z) < v.r * 0.5);
  o.whirlSpin = vortex ? (o.whirlSpin || 0) + (vortex.dir || 1) * dt * (1.5 + o.sinkT * 2.5) : 0;
  o.root.position.set(o.x, (y + bow + stern) / 3 - 0.75 * scale - o.sinkT * o.sinkT * (vortex ? 2.2 : 1.2), o.z);
  o.root.rotation.set(0, 0, 0); o.root.rotation.y = o.a + o.whirlSpin;
  o.body.rotation.x = Math.atan2(stern - bow, len * 2) + (sinking ? -o.sinkT * 0.25 : 0);
  o.body.rotation.z = (reduced ? 0 : Math.atan2(port - stb, 4.4 * scale)) + o.roll + o.recoil * 0.1 * (o.recoilSide || 0) + (sinking ? o.sinkT * 0.35 : 0);
  o.root.visible = !(sinking && o.sinkT > 3.2);
  // Your timbers groan near the eye.
  if (mine && !s.dead && vortices.some(v => Math.hypot(o.x - v.x, o.z - v.z) < v.r * 0.45)) shake = Math.max(shake, 0.7);
  if (!s.galleon) {
   const n = s.gold <= 0 ? 0 : Math.min(7, 1 + Math.floor(s.gold / 8));
   o.pieces.forEach((p, k) => p.visible = k < n);
   o.shield.visible = s.shield > 0 && !s.dead; if (o.shield.visible) o.shield.material.opacity = 0.12 + Math.sin(time * 10) * 0.05;
   o.aura.visible = !!s.power && !s.dead; if (o.aura.visible) { o.aura.material.color.set(POWER_COLORS[s.power]); o.aura.rotation.z = time * 2; }
  }
  // The sea shader draws the wake; boosting throws spray off the bow.
  o.wake -= dt;
  if (!s.dead && s.boost > 0 && o.wake <= 0 && !reduced) {
   o.wake = 0.04;
   for (const side of [-1, 1]) puff('splash', o.x + f.x * len * 1.25 - f.z * side, y + 0.8, o.z + f.z * len * 1.25 + f.x * side, -f.z * side * 4 + f.x * 3, 3.5, f.x * side * 4 + f.z * 3, 0.9, 0.55, 0.6, 12);
  }
  const L = o.label; L.s.visible = !mine && !(sinking && o.sinkT > 1.5);
  L.s.position.set(o.x, (s.galleon ? 24 : 15.5) + y, o.z);
  // Keep labels a steady size on screen instead of ballooning up close.
  const width = Math.max(5, Math.min(18, camera.position.distanceTo(L.s.position) * (s.galleon ? 0.2 : 0.14)));
  L.s.scale.set(width, width * 0.375, 1);
  if (s.galleon) { paintLabel(L, 'TREASURE GALLEON', '#ffd34d', s.hp, s.max, 0, false, ''); }
  else paintLabel(L, mine ? 'YOU' : s.name, TEAMS[s.team].color, s.hp, 100, s.gold, mine, s.dead ? 'SUNK' : '');
 }
 function removeShip(id) { const o = ships.get(id); if (!o) return; scene.remove(o.root); scene.remove(o.label.s); ships.delete(id); }

 function draw(w, me, dt, follow = me) {
  if (document.hidden) return;
  if (resolution?.sample(dt)) resize();
  time += dt; water.uniforms.time.value = time; water.uniforms.final.value = w.final ? 1 : 0;
  // Whirlpools and ship wakes are drawn by the sea shader itself.
  vortices = w.whirls || [];
  water.uniforms.whirls.value.forEach((u, k) => { const h = vortices[k]; if (h) u.set(h.x, h.z, h.r, h.spin); else u.set(0, 0, 0, 0); });
  water.uniforms.whirlDir.value = [0, 1].map(k => vortices[k]?.dir || 1);
  const boats = [...w.ships.filter(s => !s.dead), ...(w.galleon && !w.galleon.dead ? [w.galleon] : [])];
  water.uniforms.boats.value.forEach((u, k) => {
   const s = boats[k], o = s && ships.get(s.id);
   if (o) { u.set(o.x, o.z, o.a, Math.max(0.01, Math.abs(s.v || 0))); water.uniforms.boatScale.value[k] = s.galleon ? 1.6 : 1; } else u.set(0, 0, 0, 0);
  });
  const live = new Set();
  for (const s of w.ships) { const o = shipObject(s, w); placeShip(o, s, dt, s.id === me, w); live.add(s.id); }
  if (w.galleon) { const o = shipObject(w.galleon, w); placeShip(o, w.galleon, dt, false, w); live.add('galleon'); }
  for (const id of [...ships.keys()]) if (!live.has(id)) removeShip(id);
  // Loot bobs on the swell, half in the water.
  const seenLoot = new Set();
  for (const l of w.loot) {
   let o = lootObjs.get(l.id); if (!o) { o = lootObject(l); lootObjs.set(l.id, o); }
   o.x += (l.x - o.x) * damp(10, dt); o.z += (l.z - o.z) * damp(10, dt);
   const y = waveHeight(o.x, o.z, time);
   o.g.position.set(o.x, y - 0.25, o.z); o.body.rotation.set(Math.sin(time * 1.3 + o.seed) * 0.15, time * 0.3 + o.seed, Math.cos(time * 1.1 + o.seed) * 0.15);
   seenLoot.add(l.id);
  }
  for (const [id, o] of lootObjs) if (!seenLoot.has(id)) { scene.remove(o.g); lootObjs.delete(id); }
  const seenPower = new Set();
  for (const p of w.powers) {
   let o = powerObjs.get(p.id); if (!o) { o = powerObject(p); powerObjs.set(p.id, o); }
   const y = waveHeight(o.x, o.z, time); o.g.position.set(o.x, y - 0.1, o.z); o.barrel.rotation.y = time * 0.8 + o.seed; o.barrel.rotation.x = Math.sin(time + o.seed) * 0.2;
   seenPower.add(p.id);
  }
  for (const [id, o] of powerObjs) if (!seenPower.has(id)) { scene.remove(o.g); powerObjs.delete(id); }
  // Cannonballs with a thin smoke trail.
  w.shots.forEach((b, k) => { const m = ball(k); m.visible = true; m.position.set(b.x, Math.max(0, b.y), b.z); if (!reduced && Math.random() < 0.5) puff('smoke', b.x, b.y, b.z, 0, 0.3, 0, 0.7, 0.45, 1.2); });
  for (let k = w.shots.length; k < balls.length; k++) balls[k].visible = false;
  // Harbor flags and buoys.
  for (const h of harbors) {
   const far = camera.position.distanceTo(h.label.position);
   h.label.material.opacity = Math.max(0, Math.min(0.9, (far - 60) / 50));
   const pos = h.flag.geometry.attributes.position, base = h.flag.userData.base;
   for (let k = 0; k < pos.count; k++) { const x = base[k * 3]; pos.setZ(k, Math.sin(x * 1.4 - time * 5) * 0.25 * (x + 2.5) / 5); }
   pos.needsUpdate = true;
   for (const b of h.buoys) { const y = waveHeight(b.x, b.z, time); b.o.position.set(b.x, y - 0.3, b.z); b.o.rotation.set(Math.sin(time * 1.5 + b.k) * 0.12, 0, Math.cos(time * 1.2 + b.k) * 0.12); }
  }
  // Tower guns track the nearest raider.
  for (const [team, tw] of towers.entries()) {
   if (!tw) continue;
   const raider = w.ships.filter(s => !s.dead && s.team !== team).sort((a, b) => Math.hypot(a.x - tw.x, a.z - tw.z) - Math.hypot(b.x - tw.x, b.z - tw.z))[0];
   const want = raider ? Math.atan2(raider.x - tw.x, raider.z - tw.z) : (team ? -Math.PI / 2 : Math.PI / 2);
   tw.gun.rotation.y += angleDelta(want, tw.gun.rotation.y) * damp(4, dt);
  }
  stepParticles(dt);
  // Home arrow when carrying gold.
  const mine = w.ships.find(s => s.id === me), mo = mine && ships.get(me);
  if (mine && mo && !mine.dead && mine.gold > 0) {
   const home = TEAMS[mine.team], d = Math.hypot(home.x - mo.x, home.z - mo.z);
   homeArrow.visible = d > BANK_RADIUS + 4;
   const a = Math.atan2(home.x - mo.x, home.z - mo.z), r = 10;
   homeArrow.position.set(mo.x + Math.sin(a) * r, waveHeight(mo.x, mo.z, time) + 1.2 + Math.sin(time * 4) * 0.2, mo.z + Math.cos(a) * r);
   homeArrow.rotation.set(0, a, 0);
   homeArrow.material.opacity = 0.65 + Math.sin(time * 6) * 0.25;
  } else homeArrow.visible = false;
  updateCamera(w, follow, dt);
  sun.target.position.set(cam.lx, 0, cam.lz); sun.position.copy(sun.target.position).add(SUN_OFFSET);
  for (const b of gulls) { b.t += dt * b.speed; const x = b.cx + Math.cos(b.t) * b.r, z = b.cz + Math.sin(b.t) * b.r; b.g.position.set(x, b.y + Math.sin(b.t * 2.3) * 2, z); b.g.rotation.set(0, -b.t + (b.speed > 0 ? Math.PI : 0), Math.sin(b.t * 1.7) * 0.25); const flap = Math.sin(time * b.flap) * 0.55; b.l.rotation.z = flap; b.r2.rotation.z = -flap; }
  renderer.render(scene, camera);
 }

 function updateCamera(w, id, dt) {
  const s = id === 'galleon' ? w.galleon : w.ships.find(s => s.id === id), o = s && ships.get(id);
  let tx, tz, a, back = 25, up = 13;
  if (o) { tx = o.x; tz = o.z; a = o.a; if (s.dead) { back = 34; up = 24; } }
  else { tx = 0; tz = 0; a = time * 0.05; back = 120; up = 70; }
  const f = forward(a);
  const want = { x: tx - f.x * back, y: up, z: tz - f.z * back, lx: tx + f.x * 9, ly: 2, lz: tz + f.z * 9 };
  const k = camReady ? damp(o ? 5 : 1, dt) : 1; camReady = true;
  for (const key of Object.keys(want)) cam[key] += (want[key] - cam[key]) * k;
  shake = Math.max(0, shake - dt * 2.5);
  const j = reduced ? 0 : shake * shake;
  camera.position.set(cam.x + (Math.random() - 0.5) * j, cam.y + (Math.random() - 0.5) * j, cam.z + (Math.random() - 0.5) * j);
  camera.lookAt(cam.lx, cam.ly, cam.lz);
 }

 function event(e, w, me) {
  const ship = id => id === 'galleon' ? w.galleon : w.ships.find(s => s.id === id);
  const y0 = (x, z) => waveHeight(x, z, time);
  if (e.type === 'fire') {
   const s = ship(e.id), o = ships.get(e.id); if (!s || !o) return;
   o.recoil = 1; o.recoilSide = e.side || 0;
   const f = forward(o.a), sideX = -f.z * (e.side || 1), sideZ = f.x * (e.side || 1);
   const scale = s.galleon ? 1.7 : 1;
   for (const k of [-1.8, 0, 1.8]) {
    const x = o.x + sideX * 3 * scale + f.x * k * scale, z = o.z + sideZ * 3 * scale + f.z * k * scale;
    puff('fire', x, 2.6, z, sideX * 6, 0.5, sideZ * 6, 1.6, 0.18, 1);
    for (let n = 0; n < 3; n++) puff('smoke', x, 2.6, z, sideX * (3 + n * 2) + (Math.random() - 0.5) * 2, 1 + Math.random(), sideZ * (3 + n * 2) + (Math.random() - 0.5) * 2, 2.2, 1.4 + n * 0.3, 2.2);
   }
   if (e.id === me) shake = Math.max(shake, 0.6);
  }
  if (e.type === 'hit') {
   const y = 2.5; burst('fire', e.x, y, e.z, 6, 6, 2, 0.35, 0.5); burst('wood', e.x, y, e.z, 8, 9, 0.5, 0.9, 1.2, 18); burst('smoke', e.x, y, e.z, 4, 2, 2.4, 1.2, 0.6);
   if (e.id === me) shake = Math.max(shake, 1.2);
  }
  if (e.type === 'splash') { const y = y0(e.x, e.z); burst('splash', e.x, y, e.z, 9, 4, 0.9, 0.8, 2.6, 16); puff('foam', e.x, y + 0.2, e.z, 0, 0, 0, 1.4, 0.8, 1.2); }
  if (e.type === 'thud') burst('dust', e.x, 2, e.z, 8, 4, 1.6, 0.9, 0.5, 2);
  if (e.type === 'sink') { const y = y0(e.x, e.z); burst('fire', e.x, 3, e.z, 14, 10, 3, 0.6, 0.6); burst('wood', e.x, 2, e.z, 20, 12, 0.6, 1.4, 1.2, 16); burst('splash', e.x, y, e.z, 20, 6, 1.4, 1.2, 2.4, 14); burst('smoke', e.x, 3, e.z, 10, 3, 4, 2.5, 0.8); if (e.id === me) shake = 2; }
  if (e.type === 'galleonsunk') { burst('fire', e.x, 4, e.z, 30, 16, 4, 0.9, 0.6); burst('spark', e.x, 4, e.z, 40, 14, 1, 1.6, 1.4, 10); burst('smoke', e.x, 4, e.z, 16, 4, 6, 3, 0.8); shake = Math.max(shake, 1); }
  if (e.type === 'loot') burst('spark', e.x, 1.5, e.z, e.kind === 'chest' ? 16 : 8, 5, 0.8, 0.8, 1.6, 8);
  if (e.type === 'power') burst('spark', e.x, 1.5, e.z, 18, 6, 1, 0.9, 1.4, 6);
  if (e.type === 'bank') { const s = ship(e.id); if (s) burst('spark', s.x, 3, s.z, 30, 7, 1.1, 1.3, 2.2, 10); }
  if (e.type === 'tower') { const tw = towers[e.team]; if (tw) { burst('smoke', tw.x, 12, tw.z, 6, 3, 3, 1.4, 0.6); puff('fire', tw.x, 12, tw.z, 0, 0, 0, 3, 0.2); } }
 }

 const v3 = new T.Vector3();
 function project(x, y, z) { v3.set(x, y, z).project(camera); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, visible: v3.z < 1 }; }
 function resize() { renderer.setPixelRatio(resolution?.ratio(innerWidth, innerHeight) ?? Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 70 : 55; camera.updateProjectionMatrix(); }
 addEventListener('resize', resize); resize();
 function reset() { for (const id of [...ships.keys()]) removeShip(id); for (const o of lootObjs.values()) scene.remove(o.g); lootObjs.clear(); for (const o of powerObjs.values()) scene.remove(o.g); powerObjs.clear(); camReady = false; }
 return { draw, event, project, resize, reset, shipPosition: id => { const o = ships.get(id); return o ? { x: o.x, z: o.z } : null; } };
}
