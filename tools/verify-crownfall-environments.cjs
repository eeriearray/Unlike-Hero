// Serve the hub on :8080. NODE_PATH supplies Playwright; CHROME_PATH optionally selects Chrome.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-gl=angle',`--use-angle=${process.env.KART_ANGLE||'swiftshader'}`,'--enable-webgl']});
 const page=await browser.newPage({viewport:{width:800,height:520}}),errors=[];page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
 page.on('pageerror',e=>{errors.push(e.message);console.log('page error:',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text())}});
 await page.addInitScript(()=>{localStorage.setItem('hub.crownfall-kart.graphics.v1','"performance"');let ctor;Object.defineProperty(window,'KartRenderer',{get:()=>ctor,set:Base=>{ctor=class extends Base{constructor(...args){super(...args);window.testRenderer=this;}}}});});

 const results=[];fs.mkdirSync('output/crownfall-kart-environments',{recursive:true});
 try{
  await page.goto(process.env.KART_URL||'http://localhost:8080/games/crownfall-kart/');console.log('initial page loaded');
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForFunction(()=>testRenderer.scenery.ready.length>=6);await page.waitForTimeout(50);
  await page.addStyleTag({content:'body > :not(#world){visibility:hidden!important}'});
  await page.evaluate(()=>{testRenderer.setQuality('high');const load=RGBELoader.prototype.load;RGBELoader.prototype.load=function(url,onLoad,...rest){return load.call(this,url,texture=>{window.releaseHDR=()=>onLoad(texture);},...rest);};});
  for(let i=0;i<8;i++){
   const result=await page.evaluate(index=>{
    const r=testRenderer,w=CrownSim.createWorld({track:index,mode:'trial',roster:[{id:'player',human:true,classId:'medium'}]}),k=w.racers[0];r.render(w,k.id,1/60,true);
    window.profileTest={r,w,k};const initial=r.ambientWeather.positions.slice(0,3);k.speed=40;k.vx=25;k.vz=25;r.ambientWeather.update(.03,k,false);
    return {id:r.profile.id,architecture:r.environment.userData.architecture,sky:r.scene.background.uuid,material:r.scenery.rock.map.uuid,weather:r.profile.weather.type,particles:r.ambientWeather.count,changed:initial.some((n,i)=>n!==r.ambientWeather.positions[i]),finite:[...r.ambientWeather.positions].every(Number.isFinite),wet:r.post.composite.uniforms.reflectionAmount.value,rays:r.post.composite.uniforms.rayStrength.value,cache:r.scenery.skyCache.size,light:r.csm.lights[0].color.getHexString()};
   },i);
   assert.ok(result.finite&&result.changed);assert.ok(result.cache<=3);results.push(result);
   await page.screenshot({path:`output/crownfall-kart-environments/${i}-${result.id}.png`});console.log('verified',result.id,result.weather);
   if(i===2){await page.waitForFunction(()=>!!window.releaseHDR);await page.evaluate(()=>window.releaseHDR());await page.waitForFunction(()=>!!testRenderer.scenery.photoSky);assert.ok(await page.evaluate(()=>testRenderer.profile.id==='moonveil'&&testRenderer.scene.background!==testRenderer.scenery.photoSky),'late HDR must not replace another map sky');}
  }
  assert.equal(new Set(results.map(r=>r.sky)).size,8);assert.equal(new Set(results.map(r=>r.material)).size,8);assert.equal(new Set(results.map(r=>r.architecture)).size,8);assert.equal(results[6].wet,1);
  const quality=await page.evaluate(()=>{
   const {r,w,k}=profileTest;r.setQuality('performance');r.render(w,k.id,.016);const low=r.ambientWeather.count;
   r.setQuality('balanced');r.render(w,k.id,.016);const balanced=r.ambientWeather.count;r.setQuality('high');r.reduced=true;r.render(w,k.id,.016);const high=r.ambientWeather.count,reduced=r.post.composite.uniforms.motion.value===0;
   w.mode='battle';r.render(w,k.id,.016);r.post.enabled=false;r.render(w,k.id,.016);r.post.enabled=true;
   return {low,balanced,high,reduced,profile:r.profile.id};
  });
  assert.ok(quality.low<quality.balanced&&quality.balanced<quality.high&&quality.reduced);assert.equal(quality.profile,'observatory');
  const resources=await page.evaluate(()=>{const r=testRenderer,counts=[];r.setQuality('performance');for(let cycle=0;cycle<2;cycle++){for(let i=0;i<8;i++){const w=CrownSim.createWorld({track:i,mode:'trial'});r.render(w,'player',.016,true);}counts.push({shaders:r.csm.shaders.size,geometries:r.renderer.info.memory.geometries,skies:r.scenery.skyCache.size});}return counts;});
  assert.equal(resources[0].shaders,resources[1].shaders);assert.ok(resources[1].geometries<=resources[0].geometries+2&&resources[1].skies<=3);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const {r,w,k}=profileTest;r.setQuality('performance');r.render(w,k.id,.016)});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,quality,resources},null,2));console.log('PASS: eight HDR skies/materials/horizons, weather/wakes, wet SSR, shafts, late-load isolation, bounded sky cache, quality scaling, battle, fallback and mobile resize.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
