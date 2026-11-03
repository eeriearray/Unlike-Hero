/*
 * The image pipeline: the scene renders to an HDR target, then gets ambient occlusion from depth, bloom, a slight
 * miniature-style focus falloff and a colour grade. Written by hand because the vendored three.js has no composer.
 * Low quality skips all of it and renders straight to the screen.
 */
(function () {
  var TR = window.TR = window.TR || {};
  var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  var AO_FRAG = [
    'varying vec2 vUv; uniform sampler2D tDepth; uniform float near, far, tanX, tanY; uniform vec2 px;',
    'float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near * far) / ((far - near) * d - far); }',
    'vec3 viewPos(vec2 uv){ float z = viewZ(uv); return vec3((uv.x * 2.0 - 1.0) * tanX * -z, (uv.y * 2.0 - 1.0) * tanY * -z, z); }',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    '  float d = texture2D(tDepth, vUv).x;',
    '  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }',
    '  vec3 P = viewPos(vUv);',
    '  vec3 N = normalize(cross(dFdx(P), dFdy(P)));',
    '  float dist = -P.z, R = 2.6, rad = R / (dist * tanY) * 0.5;',
    '  rad = clamp(rad, px.y * 3.0, 0.12);',
    '  float occ = 0.0, a = hash(vUv * 917.0) * 6.2832;',
    '  for (int i = 0; i < 12; i++) {',
    '    float fi = float(i) + 0.5, r = sqrt(fi / 12.0) * rad, t = a + fi * 2.39996;',
    '    vec2 uv2 = vUv + vec2(cos(t), sin(t)) * r * vec2(tanY / tanX, 1.0);',
    '    vec3 v = viewPos(uv2) - P;',
    '    float l2 = dot(v, v);',
    '    occ += max(0.0, dot(N, v) - 0.06 * dist * 0.03) / (l2 + 0.6) * step(l2, R * R * 4.0);',
    '  }',
    '  float ao = clamp(1.0 - occ / 12.0 * 2.6, 0.0, 1.0);',
    '  ao = mix(ao, 1.0, smoothstep(180.0, 420.0, dist));',
    '  gl_FragColor = vec4(vec3(ao), 1.0);',
    '}'
  ].join('\n');

  var BRIGHT_FRAG = 'varying vec2 vUv; uniform sampler2D tScene; void main(){ vec3 c = texture2D(tScene, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722)); float k = smoothstep(1.02, 1.9, l); gl_FragColor = vec4(min(c, vec3(6.0)) * k, 1.0); }';
  var BLUR_FRAG = 'varying vec2 vUv; uniform sampler2D tMap; uniform vec2 dir; void main(){ vec3 c = texture2D(tMap, vUv).rgb * 0.227; c += (texture2D(tMap, vUv + dir * 1.385).rgb + texture2D(tMap, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(tMap, vUv + dir * 3.231).rgb + texture2D(tMap, vUv - dir * 3.231).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }';

  var COMP_FRAG = [
    'varying vec2 vUv; uniform sampler2D tScene, tAO, tBloomA, tBloomB; uniform vec2 px; uniform float useAO, bloom, tilt, night;',
    'vec3 toSRGB(vec3 c){ return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }',
    'void main(){',
    '  vec3 c = texture2D(tScene, vUv).rgb;',
    // the miniature look: the top and bottom of the frame drift gently out of focus
    '  float off = abs(vUv.y - 0.48), blur = smoothstep(0.34, 0.56, off) * tilt;',
    '  if (blur > 0.01) { vec3 s = vec3(0.0); for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; s += texture2D(tScene, vUv + vec2(cos(a), sin(a)) * px * blur * 2.2).rgb; } c = mix(c, s / 8.0, min(1.0, blur * 1.3)); }',
    '  if (useAO > 0.5) { float ao = 0.0; for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) ao += texture2D(tAO, vUv + vec2(float(x), float(y)) * px * 2.0).r; ao /= 9.0; c *= mix(1.0, ao, 0.92); }',
    '  c += (texture2D(tBloomA, vUv).rgb * 0.55 + texture2D(tBloomB, vUv).rgb * 0.75) * bloom;',
    // soft highlights, a touch more colour, slightly warm lights and cool shadows
    '  c = c / (1.0 + max(c - 0.75, 0.0) * 0.45);',
    '  float l = dot(c, vec3(0.2126,0.7152,0.0722));',
    '  c = mix(vec3(l), c, 1.16);',
    '  c *= mix(vec3(0.97, 0.99, 1.05), vec3(1.03, 1.0, 0.96), smoothstep(0.05, 0.6, l));',
    '  c = max(c, 0.0);',
    '  vec3 o = toSRGB(min(c, vec3(1.0)));',
    '  o = mix(o, o * o * (3.0 - 2.0 * o), 0.22);',
    '  gl_FragColor = vec4(o, 1.0);',
    '}'
  ].join('\n');

  function pass(frag, uniforms) { return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: uniforms, depthTest: false, depthWrite: false }); }

  var post = TR.post = {
    on: false, ao: false, samples: 4, w: 0, h: 0,
    init: function (renderer) {
      post.r = renderer;
      renderer.info.autoReset = false;
      post.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      post.scene = new THREE.Scene();
      post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
      post.quad.frustumCulled = false;
      post.scene.add(post.quad);
      post.mAO = pass(AO_FRAG, { tDepth: { value: null }, near: { value: 0.5 }, far: { value: 800 }, tanX: { value: 1 }, tanY: { value: 1 }, px: { value: new THREE.Vector2() } });
      post.mBright = pass(BRIGHT_FRAG, { tScene: { value: null } });
      post.mBlur = pass(BLUR_FRAG, { tMap: { value: null }, dir: { value: new THREE.Vector2() } });
      post.mComp = pass(COMP_FRAG, { tScene: { value: null }, tAO: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, px: { value: new THREE.Vector2() }, useAO: { value: 1 }, bloom: { value: 1 }, tilt: { value: 1 }, night: { value: 0 } });
    },
    configure: function (opts) {
      post.on = opts.on; post.ao = opts.ao; post.samples = opts.samples || 0; post.tilt = opts.tilt ? 1 : 0;
      post.dispose();
    },
    dispose: function () {
      ['main', 'aoRT', 'b1', 'b2', 'b3', 'b4'].forEach(function (k) { if (post[k]) { post[k].dispose(); post[k] = null; } });
      post.w = 0;
    },
    build: function (w, h) {
      post.w = w; post.h = h;
      var hf = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      post.main = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: post.samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      if (post.ao) {
        post.main.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
        post.aoRT = new THREE.WebGLRenderTarget(w >> 1, h >> 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      }
      post.b1 = new THREE.WebGLRenderTarget(w >> 2, h >> 2, hf);
      post.b2 = new THREE.WebGLRenderTarget(w >> 2, h >> 2, hf);
      post.b3 = new THREE.WebGLRenderTarget(w >> 4, h >> 4, hf);
      post.b4 = new THREE.WebGLRenderTarget(w >> 4, h >> 4, hf);
    },
    draw: function (mat, target) {
      post.quad.material = mat;
      post.r.setRenderTarget(target);
      post.r.render(post.scene, post.cam);
    },
    blur: function (src, a, b, w, h) {
      var u = post.mBlur.uniforms;
      u.tMap.value = src.texture; u.dir.value.set(1 / w, 0); post.draw(post.mBlur, a);
      u.tMap.value = a.texture; u.dir.value.set(0, 1 / h); post.draw(post.mBlur, b);
    },
    render: function (scene, camera) {
      var r = post.r;
      r.info.reset();
      // shadows redraw every other frame: half the triangles, and the eye cannot tell
      post.tick = (post.tick || 0) + 1;
      r.shadowMap.needsUpdate = post.tick % 2 === 0;
      if (!post.on) { r.setRenderTarget(null); r.render(scene, camera); return; }
      var s = r.getDrawingBufferSize(new THREE.Vector2()), w = s.x, h = s.y;
      if (w !== post.w || h !== post.h) { post.dispose(); post.build(w, h); }
      r.setRenderTarget(post.main);
      r.render(scene, camera);
      var c = post.mComp.uniforms;
      if (post.ao) {
        var a = post.mAO.uniforms, tanY = Math.tan(camera.fov * Math.PI / 360);
        a.tDepth.value = post.main.depthTexture; a.near.value = camera.near; a.far.value = camera.far; a.tanY.value = tanY; a.tanX.value = tanY * camera.aspect; a.px.value.set(2 / w, 2 / h);
        post.draw(post.mAO, post.aoRT);
        c.tAO.value = post.aoRT.texture;
      }
      post.mBright.uniforms.tScene.value = post.main.texture;
      post.draw(post.mBright, post.b1);
      post.blur(post.b1, post.b2, post.b1, w >> 2, h >> 2);
      post.blur(post.b1, post.b3, post.b4, w >> 4, h >> 4);
      c.tScene.value = post.main.texture; c.tBloomA.value = post.b1.texture; c.tBloomB.value = post.b4.texture;
      c.px.value.set(1 / w, 1 / h); c.useAO.value = post.ao ? 1 : 0; c.tilt.value = post.tilt;
      post.draw(post.mComp, null);
    }
  };

  // ───── procedural surface detail: no textures, just world-space patterns in the shader ─────
  var NOISE = [
    'float tq(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tq(i), tq(i + vec2(1,0)), f.x), mix(tq(i + vec2(0,1)), tq(i + vec2(1,1)), f.x), f.y); }',
    'float tf(vec2 p){ return tn(p) * 0.6 + tn(p * 2.3) * 0.28 + tn(p * 5.1) * 0.12; }'
  ].join('\n');

  /** Adds world-space grain, stone courses, panel lines and weathering to a merged-city material. */
  TR.surfaceDetail = function (mat) {
    mat.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; varying float vDist;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normal; vDist = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; varying float vDist;\n' + NOISE)
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'float fade = 1.0 - smoothstep(60.0, 240.0, vDist);',
          'if (vWN.y > 0.7) {',
          // ground: broad mottling everywhere, fine grain up close
          '  float m = tf(vWPos.xz * 0.13); float g = tn(vWPos.xz * 3.1);',
          '  diffuseColor.rgb *= 0.9 + 0.2 * m + 0.06 * fade * (g - 0.5);',
          '} else if (abs(vWN.y) < 0.3) {',
          // walls: stone courses with staggered joints, plus rain streaks from the top
          '  vec2 uvw = vec2(abs(vWN.x) > 0.5 ? vWPos.z : vWPos.x, vWPos.y);',
          '  float row = floor(uvw.y / 0.62), ox = mod(row, 2.0) * 0.8;',
          '  float cx = fract((uvw.x + ox) / 1.6), cy = fract(uvw.y / 0.62);',
          '  float joint = 1.0 - min(smoothstep(0.0, 0.05, cy) * smoothstep(1.0, 0.95, cy), smoothstep(0.0, 0.03, cx) * smoothstep(1.0, 0.97, cx));',
          '  float block = tq(vec2(floor((uvw.x + ox) / 1.6), row));',
          '  float streak = tf(vec2(uvw.x * 0.5, uvw.y * 0.05));',
          '  diffuseColor.rgb *= 1.0 + fade * fade * (0.04 * (block - 0.5) - 0.07 * joint) + 0.08 * (streak - 0.5);',
          '} else if (vWN.y > 0.3) {',
          // pitched roofs: overlapping rows of tiles
          '  float rowt = fract(vWPos.y / 0.42), colt = fract((abs(vWN.x) > abs(vWN.z) ? vWPos.z : vWPos.x) / 0.9 + floor(vWPos.y / 0.42) * 0.5);',
          '  diffuseColor.rgb *= 1.0 + fade * (0.16 * (rowt - 0.5) - 0.12 * step(colt, 0.05));',
          '}'
        ].join('\n'))
        // the same courses dent the surface normal, so low sun picks out real relief
        .replace('#include <normal_fragment_maps>', [
          '#include <normal_fragment_maps>',
          'if (abs(vWN.y) < 0.3 && vDist < 90.0) {',
          '  vec2 uvn = vec2(abs(vWN.x) > 0.5 ? vWPos.z : vWPos.x, vWPos.y);',
          '  float rn = floor(uvn.y / 0.62), oxn = mod(rn, 2.0) * 0.8, cyn = fract(uvn.y / 0.62);',
          '  float bump = smoothstep(0.0, 0.06, cyn) - smoothstep(0.94, 1.0, cyn);',
          '  normal = normalize(normal + (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz * (cyn < 0.5 ? -0.2 : 0.2) * (1.0 - bump) * (1.0 - vDist / 90.0));',
          '}'
        ].join('\n'));
    };
    return mat;
  };

  /** Glass picks up the sky at grazing angles and catches the sun. */
  TR.glassDetail = function (mat, horizon) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.skyHor = horizon;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 skyHor;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= step(0.42, vColor.g);')
        .replace('#include <opaque_fragment>', 'float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.5);\n outgoingLight = mix(outgoingLight, skyHor, fr * 0.75);\n#include <opaque_fragment>')
        .replace('#include <output_fragment>', 'float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.5);\n outgoingLight = mix(outgoingLight, skyHor, fr * 0.75);\n#include <output_fragment>');
    };
    return mat;
  };
})();
