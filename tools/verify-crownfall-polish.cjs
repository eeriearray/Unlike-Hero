// Requires Playwright in NODE_PATH and a static server on :8080.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
  const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('http://localhost:8080/games/crownfall-kart/');
    // Stop the app loop and drive real renderer states deterministically.
    await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(100);
    const result=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.id='verification';canvas.style='position:fixed;inset:0;z-index:9999;width:100%;height:100%';document.body.append(canvas);
      const renderer=new KartRenderer(canvas),world=CrownSim.createWorld({mode:'trial',roster:[{id:'player',classId:'medium',human:true}]}),k=world.racers[0];
      const frame=(n=1)=>{for(let i=0;i<n;i++)renderer.render(world,k.id,1/30);};frame();
      k.visualSteer=1;k.speed=35;k.vz=35;frame(20);const u=renderer.karts.get(k.id).userData;
      const steering=u.wheels.filter(w=>w.userData.front).map(w=>w.rotation.y),lean=u.visual.rotation.z;
      k.grounded=false;k.hopUntil=.12;k.vy=3.7;frame(1);const squash=u.visual.scale.y/u.baseScale.y;
      k.grounded=true;k.vy=0;k.boost=1;k.speed=48;k.vz=48;frame(50);const boostFov=renderer.camera.fov;
      k.grounded=false;k.vy=-12;frame();k.grounded=true;k.vy=0;frame();const landingShake=renderer.shake;
      k.surface='mud';k.lane=5;frame(20);const dust=renderer.smoke.filter(p=>p.life>0&&p.dust).length;
      const exhaust=renderer.smoke.filter(p=>p.life>0&&!p.dust).length;
      k.drift=true;k.driftLevel=3;frame(5);
      const sparkColor=u.sparks[0].material.color.getHexString();
      const size=[renderer.post.sceneTarget.width,renderer.post.sceneTarget.height];
      window.verification={renderer,world,k,frame};
      return {hdr:renderer.post.enabled,steering,lean,squash,boostFov,landingShake,dust,exhaust,sparkColor,expectedSpark:new THREE.Color('#bd73ff').getHexString(),size};
    });
    assert.ok(result.hdr,'HDR pipeline exercised');assert.ok(result.steering.every(n=>n<-.3));assert.ok(result.lean>.1);assert.ok(result.squash<1);assert.ok(result.boostFov>85);assert.ok(result.landingShake>0);assert.ok(result.dust>0&&result.exhaust>0);assert.equal(result.sparkColor,result.expectedSpark);
    await page.screenshot({path:'output/crownfall-kart-polish/boost-drift.png'});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{const v=verification;v.renderer.reduced=true;v.frame(70);});
    assert.ok(await page.evaluate(()=>verification.renderer.camera.fov<61),'reduced motion removes FOV surge');
    await page.screenshot({path:'output/crownfall-kart-polish/mobile.png'});
    await page.evaluate(()=>{const v=verification;for(let i=0;i<8;i++){v.world.trackIndex=i;v.frame();}v.world.mode='battle';v.frame();v.renderer.post.enabled=false;v.frame();});
    assert.deepEqual(errors,[],'no runtime or shader errors');console.log(JSON.stringify(result,null,2));console.log('PASS: shaders, steering, hop, boost FOV, landing shake, smoke, dust, drift tier, resize, reduced motion, all tracks, battle and fallback.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
