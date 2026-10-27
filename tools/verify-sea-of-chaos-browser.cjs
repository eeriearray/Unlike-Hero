// Run with Playwright available in NODE_PATH and the hub running on port 8080.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const url=process.env.SOC_URL||'http://localhost:8080/games/sea-of-chaos/';
const out=path.join(__dirname,'../output/sea-of-chaos-redesign');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const errors=[],failures=[],requests=[];const contexts=[];
 async function open(viewport={width:1440,height:960},touch=false){const ctx=await browser.newContext({viewport,hasTouch:touch,isMobile:touch});contexts.push(ctx);const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))requests.push({url:r.url(),status:r.status()});});await p.goto(url);await p.evaluate(()=>localStorage.setItem('soc-rules-v7','1'));return p;}
 try{
  const host=await open();await host.locator('#name').fill('Harbor Host');await host.locator('#format').selectOption('2');await host.locator('#host').click();console.log('host created');const code=(await host.locator('#room-code').innerText()).trim();assert.match(code,/^[A-Z]{4}$/);
  const guest=await open({width:390,height:844},true);await guest.locator('#name').fill('Pearl Runner');await guest.locator('#code').fill(code);await guest.locator('#join').click();await guest.locator('#roster').getByText('Harbor Host',{exact:false}).waitFor();await host.locator('#roster').getByText('Pearl Runner',{exact:false}).waitFor();console.log('guest joined');await host.locator('#start').click();console.log('match started');await guest.locator('#hud').waitFor({state:'visible'});await guest.waitForFunction(()=>document.getElementById('wallet').textContent!=='12 gold',{},{timeout:20000}).catch(async e=>{console.log('host hud',await host.locator('#hud').innerText(),'guest hud',await guest.locator('#hud').innerText(),errors);throw e;});console.log('snapshots live');
  assert.match(await guest.locator('#objective-title').innerText(),/Collect pearls/);assert.match(await host.locator('#mode-title').innerText(),/2v2/);
  await guest.locator('#dock-shop').click();await guest.locator('[data-category=supplies]').click();await guest.locator('[data-buy=repair]').click();await guest.waitForFunction(()=>document.getElementById('shop-feedback').textContent.includes('fitted'));await guest.locator('#shop-close').click();assert.match(await guest.locator('#utility-button').innerText(),/Repair/);
  await guest.locator('#crew-command').selectOption('help');await guest.waitForFunction(()=>document.getElementById('crew-intent').textContent.includes('Pearl Runner: Need help'));assert.ok(!(await host.locator('#crew-intent').innerText()).includes('Pearl Runner: Need help'),'enemy crew does not receive team signals');
  await host.screenshot({path:path.join(out,'desktop.png')});await guest.screenshot({path:path.join(out,'phone.png')});
  // Essential touch controls must remain reachable and never cover one another.
  for(const [width,height,label]of [[390,844,'phone'],[375,667,'small-phone'],[768,1024,'tablet'],[844,390,'landscape'],[667,375,'small-landscape']]){
   await guest.setViewportSize({width,height});await guest.waitForTimeout(700);
   const layout=await guest.evaluate(()=>{const ids=['stick','dock-shop','weapons','crew-tools','treasure-hud','mission-card','map','team-status','raid-phase','health-panel'];const rects=ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height};});const overlaps=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.w&&b.w&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2)overlaps.push([a.id,b.id]);}return {rects,overlaps,viewport:{w:innerWidth,h:innerHeight},scroll:document.documentElement.scrollWidth>innerWidth};});
   if(layout.overlaps.length||layout.scroll||layout.rects.some(r=>r.x<0||r.y<0||r.x+r.w>width+1||r.y+r.h>height+1))failures.push({label,...layout});
   await guest.screenshot({path:path.join(out,`${label}.png`)});
  }
  // Customization remains usable and persistent in a separate solo session.
  const solo=await open();await solo.locator('#customize').click();await solo.locator('#ship-paint').selectOption('#3d9c9b');await solo.locator('#ship-sail').selectOption('night');await solo.locator('#yard-close').click();assert.equal(await solo.evaluate(()=>JSON.parse(localStorage.getItem('soc-ship-v1')).paint),'#3d9c9b');await solo.locator('#solo').click();await solo.locator('#hud').waitFor({state:'visible'});await solo.keyboard.press('q');await solo.waitForTimeout(120);assert.ok((await solo.locator('#hp-txt').innerText()).includes('/100'));
  assert.deepEqual(errors,[],'No browser exceptions');assert.deepEqual(failures,[],'No essential HUD overlaps');
  const report={multiplayer:'Host + touch client joined, started, bought a host-authorized tool and sent a team command',solo:'Started after persistent paint/sail customization',layouts:['390×844','375×667','768×1024','844×390','667×375'],errors,failures,requests};fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){console.log('browser exceptions',errors,'layout failures',JSON.stringify(failures));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
