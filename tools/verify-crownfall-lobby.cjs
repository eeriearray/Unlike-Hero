/* Run against the canonical hub at :8081 with Playwright available in NODE_PATH. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-webgl']});
  const errors=[],context=await browser.newContext({viewport:{width:1280,height:800}});
  context.setDefaultTimeout(90000);
  await context.addInitScript(()=>{window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),100);});
  const source=fs.readFileSync('games/crownfall-kart/app.js','utf8').replace(/\}\)\(\);\s*$/,`window.__lobbyTest={renderer};})();`);
  await context.route('**/games/crownfall-kart/app.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:source}));
  const host=await context.newPage(),guest=await context.newPage();
  for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
  try{
    for(const page of [host,guest]){
      console.log('Opening browser player');await page.goto('http://localhost:8081/games/crownfall-kart/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!window.Crownfall);
    }
    console.log('Checking two-player lobby');await host.locator('#host').click();await host.locator('#lobby').waitFor({state:'visible'});
    const code=await host.locator('#copy-code').textContent();
    await guest.locator('#room-code').fill(code);await guest.locator('#join').click();await guest.locator('#lobby').waitFor({state:'visible'});
    assert.equal(await guest.locator('#lobby-track').isDisabled(),true);
    assert.equal(await guest.locator('#lobby-difficulty').isDisabled(),true);
    await guest.locator('#lobby-car').selectOption('heavy');
    await host.waitForFunction(()=>document.getElementById('seats').textContent.includes('Colossus'));
    await host.locator('#lobby-mode-select').selectOption('battle');
    await host.waitForFunction(()=>document.getElementById('lobby-track').disabled);
    await host.locator('#lobby-mode-select').selectOption('sprint');
    await host.locator('#lobby-track').selectOption('3');
    await host.locator('#lobby-difficulty').selectOption('hard');
    await guest.waitForFunction(()=>document.getElementById('lobby-difficulty').value==='hard'&&document.getElementById('lobby-track').value==='3');
    await host.locator('#lobby-car').selectOption('light');
    await host.waitForFunction(()=>document.getElementById('lobby-car').value==='light'&&document.getElementById('seats').textContent.includes('Wisp'));
    fs.mkdirSync('output/crownfall-lobby',{recursive:true});
    await host.screenshot({path:'output/crownfall-lobby/host.png'});
    await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:'output/crownfall-lobby/guest-mobile.png'});
    await host.locator('#start-online').click();
    await guest.waitForFunction(()=>Crownfall.getScreen()==='race');
    const state=await guest.evaluate(()=>Crownfall.getState());
    assert.equal(state.trackIndex,3);assert.equal(state.difficulty,'hard');assert.equal(state.mode,'sprint');
    assert.deepEqual(state.racers.filter(k=>k.human).map(k=>k.classId).sort(),['heavy','light']);
    await guest.locator('#pause-button').click();await guest.locator('#quit').click();
    await guest.waitForFunction(()=>Crownfall.getScreen()==='menu');
    assert.equal(await guest.locator('[data-class="heavy"]').getAttribute('aria-pressed'),'true');await guest.close();
    await host.locator('#pause-button').click();
    // Compare visible scene geometry at one race state without compiling costly high-quality shaders in software WebGL.
    await host.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__lobbyTest.renderer;r.testPostRender=r.post.render;r.post.render=()=>{};});
    console.log('Checking graphics presets');const samples=[];
    for(const quality of ['balanced','performance','high','performance']){
      await host.locator('#pause-graphics').selectOption(quality);
      console.log('Checking '+quality);const sample=await host.evaluate(()=>{
        const r=__lobbyTest.renderer;r.render(Crownfall.getState(),Crownfall.getState().racers.find(k=>k.human).id,1/60);
        let triangles=0;r.scene.traverseVisible(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1);});
        return {quality:r.quality,triangles,shadows:r.renderer.shadowMap.enabled,weather:r.ambientWeather.group.visible,smoke:r.smokeMesh.visible,postWidth:r.post.sceneTarget?.width,scale:r.renderScale};
      });samples.push(sample);
    }
    const balanced=samples[0],simple=samples[1];assert.equal(simple.shadows,false);assert.equal(simple.weather,false);assert.equal(simple.smoke,false);
    assert.ok(simple.triangles<balanced.triangles*.5,JSON.stringify(samples));
    if(simple.postWidth!==undefined)assert.equal(simple.postWidth,1);
    await host.evaluate(()=>{const r=__lobbyTest.renderer;r.post.render=r.testPostRender;r.render(Crownfall.getState(),Crownfall.getState().racers.find(k=>k.human).id,1/60);});
    await host.locator('#resume').click();await host.screenshot({path:'output/crownfall-lobby/race-performance.png'});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({lobby:'passed',raceSettings:'passed',graphicsSwitching:'passed',samples},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
