// NODE_PATH must contain Playwright. Optional CHROME_PATH and KART_URL.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{errors.push(e.message);console.log('page error',e.message)});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))errors.push(`${r.status()} ${r.url()}`)});
 await page.addInitScript(()=>{let implementation;Object.defineProperty(window,'KartRenderer',{get:()=>implementation,set:Base=>{implementation=class extends Base{constructor(...args){super(...args);window.testRenderer=this;}};}});});
 fs.mkdirSync('output/crownfall-kart-canyon',{recursive:true});
 try{
  await page.goto(process.env.KART_URL||'http://localhost:8080/games/crownfall-kart/');
  console.log('loaded');await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(100);
  await page.waitForFunction(()=>window.testRenderer?.scenery.ready.length>=6);console.log('assets ready');
  await page.selectOption('#graphics-quality','high');
  assert.equal(await page.evaluate(()=>testRenderer.csm.lights.length),3);
  await page.evaluate(()=>{testRenderer.render(CrownSim.createWorld({mode:'sprint'}),'player',.016,true);});console.log('high rendered');
  await page.screenshot({path:'output/crownfall-kart-canyon/high-menu.png'});console.log('menu screenshot');
  await page.selectOption('#graphics-quality','performance');assert.equal(await page.evaluate(()=>testRenderer.csm.lights.length),1);
  await page.reload();await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForFunction(()=>window.testRenderer?.scenery.ready.length>=6);
  assert.equal(await page.locator('#graphics-quality').inputValue(),'performance','preference persists');
  await page.selectOption('#graphics-quality','balanced');assert.equal(await page.evaluate(()=>testRenderer.csm.lights.length),2);
  // Deterministic render states using the actual game renderer and simulation.
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
   const r=testRenderer,w=CrownSim.createWorld({mode:'trial',roster:[{id:'player',classId:'medium',human:true}]}),k=w.racers[0];
   r.setQuality('high');r.render(w,k.id,.016);k.visualSteer=1;k.speed=42;k.boost=1;k.drift=true;k.driftLevel=3;k.grounded=true;k.surface='mud';k.vz=42;
   for(let i=0;i<15;i++)r.render(w,k.id,.05);
   const visual=r.karts.get(k.id).userData;let triangles=0;visual.visual.traverse(m=>{if(m.geometry)triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;});
   const result={textures:r.scenery.ready,failures:r.scenery.failed,cascades:r.csm.lights.length,triangles,lean:visual.lean,fov:r.camera.fov,ssao:!!r.post.aoTarget,motion:r.post.composite.uniforms.motion.value,dust:r.smoke.filter(p=>p.dust&&p.life>0).length,trees:r.scenery.treeCount,drawCalls:r.renderer.info.render.calls};
   window.canyonTest={r,w,k};return result;
  });
  console.log('race state',result);assert.ok(result.triangles>15000);assert.ok(result.lean>0);assert.ok(result.dust>0);assert.ok(result.ssao&&result.motion>0);assert.deepEqual(result.failures,[]);
  await page.evaluate(()=>{document.getElementById('menu').classList.add('hidden');});
  await page.screenshot({path:'output/crownfall-kart-canyon/high-race.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const {r,w,k}=canyonTest;r.setQuality('performance');r.render(w,k.id,.016);});
  await page.screenshot({path:'output/crownfall-kart-canyon/mobile-performance.png'});
  const modes=await page.evaluate(()=>{
   const {r,w,k}=canyonTest;
   for(let i=0;i<8;i++){w.trackIndex=i;r.render(w,k.id,.016);}w.mode='battle';r.render(w,k.id,.016);
   r.setQuality('high');r.reduced=true;r.render(w,k.id,.016);const reduced=r.post.composite.uniforms.motion.value===0&&r.post.composite.uniforms.cinematic.value===0;
   r.post.enabled=false;r.render(w,k.id,.016);r.post.enabled=true;
   r.setQuality('performance');for(let i=0;i<105;i++)r.adaptResolution(.03,false);
   return {reduced,scale:r.renderScale,cascades:r.csm.lights.length};
  });
  assert.ok(modes.reduced&&modes.scale<.85);assert.equal(modes.cascades,1);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result,modes},null,2));console.log('PASS: local assets, car mesh, CSM presets/persistence, SSAO, motion blur, dust, every course, battle, mobile resize, reduced motion, fallback, adaptive resolution.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
