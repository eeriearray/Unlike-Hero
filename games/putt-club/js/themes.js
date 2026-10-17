/* Putt Club — art direction per course: palette, light, sky, water and the material set. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;

  // Shared brand palette: forest green, warm cream, muted turquoise, coral, golden yellow, navy, stone, wood.
  PC.PALETTE = { forest: '#24493b', cream: '#f6ecd8', turquoise: '#5fb8b0', coral: '#ef6a43', gold: '#f2bd47', navy: '#1c2a43', stone: '#bdb5a6', wood: '#a8774d' };

  var THEMES = {
    cove: {
      sky: { top: '#6fb0d4', horizon: '#ffdcb0', bottom: '#f6c79a', sun: '#ffd49a' },
      fog: { color: '#f2d4b0', near: 34, far: 95 },
      sun: { color: '#ffdcae', intensity: 1.25, dir: [-0.55, 0.62, 0.56] },
      hemi: { sky: '#cfe4f2', ground: '#c9a678', intensity: 0.42 },
      ambient: 0.06,
      water: { shallow: '#36b8b3', deep: '#145f86', foam: true, level: -0.42 },
      base: 'water', sideDepth: 1.4,
      grass: '#3e9a4f', grassVariant: 'cove', side: 'sandstone', flag: '#ef6a43',
      rail: { body: '#9c6a42', cap: '#d8b78a', tex: 'wood' }, bridge: 'pale',
      bumper: '#ef6a43', accent: '#f2bd47',
      music: 'cove'
    },
    garden: {
      sky: { top: '#9ec6d6', horizon: '#f3ecd6', bottom: '#d9d6b8', sun: '#fff1cf' },
      fog: { color: '#e8e4cd', near: 36, far: 100 },
      sun: { color: '#fff0d6', intensity: 1.2, dir: [0.48, 0.78, 0.38] },
      hemi: { sky: '#dcebe4', ground: '#6f8a4c', intensity: 0.42 },
      ambient: 0.06,
      water: { shallow: '#7cc7b7', deep: '#2f6f6a', foam: false },
      base: 'lawn', sideDepth: 0.85,
      grass: '#2c8a43', grassVariant: 'garden', side: 'brick', flag: '#f2bd47',
      rail: { body: '#c9c1b2', cap: '#c8a160', tex: 'stone' }, bridge: 'mid',
      bumper: '#c8a160', accent: '#c27a4f',
      music: 'garden'
    },
    neon: {
      sky: { top: '#05080f', horizon: '#0e1726', bottom: '#04060b', sun: '#1d3252' },
      fog: { color: '#0a111d', near: 26, far: 80 },
      sun: { color: '#bcd4ff', intensity: 0.8, dir: [0.3, 0.85, 0.42] },
      hemi: { sky: '#3a5480', ground: '#0b0f18', intensity: 0.55 },
      ambient: 0.16,
      water: null,
      base: 'void', sideDepth: 0.55,
      grass: null, side: 'metalDark', flag: '#ffb547',
      rail: { body: '#2b3446', cap: '#4fe3f0', tex: 'metal', emissive: '#37d6e6' },
      bumper: '#ffb547', accent: '#4fe3f0',
      music: 'neon'
    }
  };

  function color(c) { return new THREE.Color(c); }

  function skyMaterial(th) {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: color(th.sky.top) }, horizon: { value: color(th.sky.horizon) }, bottom: { value: color(th.sky.bottom) },
        sunColor: { value: color(th.sky.sun) }, sunDir: { value: new THREE.Vector3().fromArray(th.sun.dir).normalize() }
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;',
        'void main(){',
        '  float h = vDir.y;',
        '  vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.85, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.4, h));',
        '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  c += sunColor * (pow(s, 12.0) * 0.45 + pow(s, 220.0) * 0.8);',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });
  }

  /** Stylised animated water: soft waves, depth tint around the course, sun glints. */
  function waterMaterial(th, center, radius) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: { value: 0 }, shallow: { value: color(th.water.shallow) }, deep: { value: color(th.water.deep) },
        sunDir: { value: new THREE.Vector3().fromArray(th.sun.dir).normalize() }, sunColor: { value: color(th.sun.color) },
        center: { value: new THREE.Vector2(center[0], center[1]) }, radius: { value: radius }
      }]),
      vertexShader: [
        '#include <fog_pars_vertex>',
        'varying vec3 vWorld; uniform float time;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  wp.y += sin(wp.x * 0.35 + time * 0.9) * 0.025 + cos(wp.z * 0.3 + time * 0.7) * 0.025;',
        '  vWorld = wp.xyz;',
        '  vec4 mvPosition = viewMatrix * wp;',
        '  gl_Position = projectionMatrix * mvPosition;',
        '  #include <fog_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <fog_pars_fragment>',
        'uniform float time; uniform vec3 shallow; uniform vec3 deep; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec2 center; uniform float radius;',
        'varying vec3 vWorld;',
        'float wave(vec2 p){ return sin(p.x*1.3 + time*1.1)*0.5 + sin(p.y*1.7 - time*0.9)*0.5 + sin((p.x+p.y)*2.3 + time*1.7)*0.25; }',
        'void main(){',
        '  vec2 p = vWorld.xz;',
        '  float e = 0.08;',
        '  vec3 n = normalize(vec3(wave(p+vec2(e,0.0)) - wave(p-vec2(e,0.0)), 6.0, wave(p+vec2(0.0,e)) - wave(p-vec2(0.0,e))));',
        '  float d = clamp((length(p - center) - radius * 0.55) / (radius * 1.6), 0.0, 1.0);',
        '  vec3 col = mix(shallow, deep, smoothstep(0.0, 1.0, d));',
        '  col += (wave(p * 0.6) * 0.03);',
        '  vec3 v = normalize(cameraPosition - vWorld);',
        '  vec3 h = normalize(normalize(sunDir) + v);',
        '  float spec = pow(max(dot(n, h), 0.0), 140.0);',
        '  float glint = step(0.985, fract(sin(dot(floor(p*6.0), vec2(12.9898,78.233))) * 43758.5453 + time*0.15)) * spec * 4.0;',
        '  col += sunColor * (spec * 0.6 + glint);',
        '  float fres = pow(1.0 - max(dot(v, vec3(0.0,1.0,0.0)), 0.0), 3.0);',
        '  col = mix(col, col * 0.75 + vec3(0.08,0.12,0.16), fres * 0.5);',
        '  gl_FragColor = vec4(col, 0.93);',
        '  #include <fog_fragment>',
        '}'
      ].join('\n')
    });
  }

  /** The material kit for a theme. Cached per theme so holes share GPU resources. */
  var kits = {};
  function materials(themeId) {
    if (kits[themeId]) return kits[themeId];
    var th = THEMES[themeId], T = PC.tex;
    function std(o) { return new THREE.MeshStandardMaterial(o); }
    function rep(t, r) { t = t.clone(); t.needsUpdate = true; t.repeat.set(r[0], r[1]); return t; }
    var k = {};
    if (themeId === 'neon') {
      k.floor = { metal: std({ map: T.panel('plate'), color: '#c8d2e4', roughness: 0.42, metalness: 0.55 }), tile: std({ map: T.panel('tile'), color: '#cfe0ea', roughness: 0.35, metalness: 0.5 }), glass: std({ color: '#7fd8e8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, emissive: '#0d4d5a', emissiveIntensity: 0.6 }) };
      k.side = std({ map: T.metal('plate'), color: '#5b6577', roughness: 0.5, metalness: 0.6 });
      k.edgeGlow = new THREE.MeshBasicMaterial({ color: '#4fe3f0', toneMapped: false });
    } else {
      k.floor = {
        grass: std({ map: T.grass(th.grassVariant), color: th.grass, roughness: 0.92, metalness: 0 }),
        sand: std({ map: T.sand(), color: '#ffffff', roughness: 1 }),
        stone: std({ map: T.stone(themeId === 'garden' ? 'light' : 'warm'), color: '#ffffff', roughness: 0.85 }),
        bridge: std({ map: T.wood('pale'), color: '#ffffff', roughness: 0.8 }),
        wood: std({ map: T.wood('mid'), color: '#ffffff', roughness: 0.8 })
      };
      k.side = themeId === 'cove' ? std({ map: T.sandstone(), color: '#ffffff', roughness: 0.95 }) : std({ map: T.brick(), color: '#ffffff', roughness: 0.92 });
    }
    k.rail = std({ map: themeId === 'neon' ? T.metal('dark') : themeId === 'cove' ? T.wood('mid') : T.stone('light'), color: th.rail.body, roughness: themeId === 'neon' ? 0.4 : 0.75, metalness: themeId === 'neon' ? 0.6 : 0 });
    k.railCap = themeId === 'neon' ? new THREE.MeshBasicMaterial({ color: th.rail.cap, toneMapped: false }) : std({ color: th.rail.cap, roughness: themeId === 'garden' ? 0.35 : 0.7, metalness: themeId === 'garden' ? 0.85 : 0 });
    k.rope = std({ color: '#d9c39a', roughness: 1 });
    k.post = std({ map: T.wood('dark'), color: '#ffffff', roughness: 0.8 });
    k.brass = std({ map: T.metal('brass'), color: '#ffffff', roughness: 0.32, metalness: 0.9 });
    k.copper = std({ map: T.metal('copper'), color: '#ffffff', roughness: 0.38, metalness: 0.85 });
    k.metal = std({ map: T.metal('dark'), color: '#9aa6bb', roughness: 0.35, metalness: 0.75 });
    k.wood = std({ map: T.wood('mid'), color: '#ffffff', roughness: 0.75 });
    k.hedge = std({ map: T.hedge(), color: '#ffffff', roughness: 1 });
    k.stone = std({ map: T.stone('light'), color: '#d8d2c6', roughness: 0.9 });
    k.rock = std({ color: themeId === 'cove' ? '#b9a58a' : '#9b978d', roughness: 0.95, flatShading: true });
    k.bumper = std({ color: themeId === 'neon' ? '#c9782a' : th.bumper, roughness: 0.38, metalness: themeId === 'garden' ? 0.8 : 0.2, emissive: themeId === 'neon' ? '#ff9a2e' : '#000000', emissiveIntensity: themeId === 'neon' ? 0.22 : 0 });
    k.bumperRing = themeId === 'neon' ? new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false }) : std({ color: PC.PALETTE.cream, roughness: 0.5 });
    k.neonCyan = new THREE.MeshBasicMaterial({ color: '#4fe3f0', toneMapped: false });
    k.neonAmber = new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false });
    k.blob = new THREE.MeshBasicMaterial({ map: T.blob(), transparent: true, depthWrite: false, opacity: 0.55, color: '#000000' });
    k.ao = new THREE.MeshBasicMaterial({ map: T.aoStrip(), transparent: true, depthWrite: false, opacity: themeId === 'neon' ? 0.6 : 0.42, color: '#000000', polygonOffset: true, polygonOffsetFactor: -2 });
    k.cup = new THREE.MeshBasicMaterial({ map: T.cup(), transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
    k.flag = std({ map: T.flag(th.flag), side: THREE.DoubleSide, roughness: 0.9 });
    k.pole = std({ color: '#f4f0e6', roughness: 0.4, metalness: 0.3 });
    k.crate = std({ map: T.crate(), roughness: 0.6, emissive: '#3a2410', emissiveIntensity: 0.15 });
    k.pad = new THREE.MeshBasicMaterial({ map: T.pad(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
    k.ringCyan = new THREE.MeshBasicMaterial({ map: T.ring(), transparent: true, depthWrite: false, color: '#4fe3f0', opacity: 0.55, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
    k.ringAmber = new THREE.MeshBasicMaterial({ map: T.ring(), transparent: true, depthWrite: false, color: '#ffb547', opacity: 0.55, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
    k.foam = new THREE.MeshBasicMaterial({ map: T.foam(), transparent: true, depthWrite: false, opacity: 0.8 });
    k.leaf = std({ color: '#25793a', roughness: 0.8, side: THREE.DoubleSide });
    k.leafDark = std({ color: '#195c2f', roughness: 0.85, side: THREE.DoubleSide });
    k.trunk = std({ color: '#8a6a4a', roughness: 1 });
    k.cream = std({ color: PC.PALETTE.cream, roughness: 0.7 });
    k.coral = std({ color: PC.PALETTE.coral, roughness: 0.6 });
    k.gold = std({ color: PC.PALETTE.gold, roughness: 0.5, metalness: 0.2 });
    k.navy = std({ color: PC.PALETTE.navy, roughness: 0.6 });
    k.turq = std({ color: PC.PALETTE.turquoise, roughness: 0.6 });
    k.lawn = std({ map: rep(T.sand(), [40, 40]), color: themeId === 'garden' ? '#8e9a74' : '#3f6f3a', roughness: 1 });
    k.gravel = std({ map: rep(T.sand(), [10, 10]), color: '#d8cfbd', roughness: 1 });
    kits[themeId] = k;
    return k;
  }

  PC.themes = { THEMES: THEMES, skyMaterial: skyMaterial, waterMaterial: waterMaterial, materials: materials };
})(window);
