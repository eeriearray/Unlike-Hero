/* Requires Playwright in NODE_PATH and the canonical hub at :8081.
   The test-only app injection lets us pose the actual HUD/renderer deterministically. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const out='output/crownfall-readability';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('hub.crownfall-kart.graphics.v1',JSON.stringify('performance')));
 const source=fs.readFileSync('games/crownfall-kart/app.js','utf8').replace(/\}\)\(\);\s*$/,`window.__drivingTest={renderer,hud,setWorld(w){world=w;playerId='player';setScreen('race');}};})();`);
 await page.route('**/games/crownfall-kart/app.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:source}));
 try{
  await page.goto('http://localhost:8081/games/crownfall-kart/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__drivingTest,{},{timeout:30000});
  await page.evaluate(()=>window.requestAnimationFrame=()=>0);
  await page.waitForTimeout(200);
  async function pose(track,kind){
   return page.evaluate(({track,kind})=>{
    const T=CrownTrack,S=CrownSim,v=__drivingTest,t=T.makeTrack(track),w=S.createWorld({mode:'sprint',track});
    w.phase='racing';w.time=12;
    const g=t.gaps[0],turn=t.turns[0];
    const s=kind==='gap'&&g?g.start*t.length-24:turn.s-40,p=T.sample(t,s),k=w.racers[0];
    Object.assign(k,{x:p.x,y:p.y+.65,z:p.z,yaw:p.heading,s:p.s,segment:p.segment,distance:s,gate:Math.floor(s/(t.length/t.gates)),speed:35,vx:Math.sin(p.heading)*35,vz:Math.cos(p.heading)*35});
    v.setWorld(w);v.renderer.readyCamera=false;v.renderer.lastMotion.clear();
    for(let i=0;i<2;i++)v.renderer.render(w,k.id,1/60);
    v.hud();
    return {name:t.name,turns:t.turns.length,gaps:t.gaps.length,markers:v.renderer.routeMarkerCounts,cue:document.getElementById('route-title').textContent};
   },{track,kind});
  }
  const results=[];
  for(let track=0;track<(process.env.HUD_ONLY?0:8);track++){
   const result=await pose(track,'gap');
   assert.ok(result.markers.arrows>30&&result.markers.bends>0,result.name);
   assert.equal(result.markers.gaps,result.gaps);
   if(result.gaps)assert.ok(result.cue.startsWith('GAP'),result.name+': gap called before the edge');
   await page.screenshot({timeout:60000,path:`${out}/track-${track}-approach.png`});
   results.push(result);
  }
  await pose(0,'gap');
  for(const [width,height] of [[320,568],[390,844],[844,320],[768,1024],[1024,680]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(500);await pose(0,'gap');
   const layout=await page.evaluate(()=>{
    const route=document.getElementById('route-cue').getBoundingClientRect();
    const overlap=[];
    for(const el of document.querySelectorAll('.race-top>*,#rival,.telemetry,.item-area,#touch-controls button')){
     const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden')continue;
     if(Math.min(route.right,r.right)-Math.max(route.left,r.left)>1&&Math.min(route.bottom,r.bottom)-Math.max(route.top,r.top)>1)overlap.push({element:el.id||el.className,route:route.toJSON(),bounds:r.toJSON()});
    }
    return {fits:route.left>=0&&route.right<=innerWidth&&route.top>=0&&route.bottom<=innerHeight,overlap};
   });
   assert.ok(layout.fits,`${width}x${height}: route visible`);assert.deepEqual(layout.overlap,[],`${width}x${height}: route must not cover driving controls`);
   await page.screenshot({timeout:60000,path:`${out}/hud-${width}x${height}.png`});
  }
  assert.deepEqual(errors,[],'no browser runtime errors');
  fs.writeFileSync(`${out}/visual-report.json`,JSON.stringify(results,null,2));
  console.log(process.env.HUD_ONLY?'PASS: five phone/tablet/desktop HUD sizes.':'PASS: eight marked courses, jump/landing cues, and five phone/tablet/desktop HUD sizes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
