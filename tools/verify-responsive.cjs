/* Run against the canonical hub: NODE_PATH=<Playwright packages> node tools/verify-responsive.cjs
   Screenshots and the machine-readable audit are written to ignored output/responsive/. */
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const sizes = [[320,568],[390,844],[844,320],[768,1024],[1024,680]];
const out = process.env.AUDIT_DIR || (process.env.BROWSER === 'webkit' ? 'output/responsive-webkit' : process.env.LIVE_RENDER ? 'output/responsive-live' : 'output/responsive');
const report = [];
const only = process.env.GAMES?.split(',');
let browser;
async function click(page, name) {
  const target = name.startsWith('#') || name.startsWith('[') || name.startsWith('.') ? page.locator(name) : page.getByRole('button', {name, exact:false}).first();
  await target.click({timeout:10000});
  await page.waitForTimeout(450);
}
async function audit(page, game, stage) {
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(350);
    const issues = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button,input,select,textarea,summary')) {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        if (!r.width || !r.height || s.visibility === 'hidden' || el.closest('[inert]')) continue;
        // Cards and character rails intentionally scroll sideways. Their offscreen children are reachable through that local scroller.
        let scrollX = false, scrollY = false, clipped = '';
        for (let par = el.parentElement; par && par !== document.body && par !== document.documentElement; par = par.parentElement) {
          const ps = getComputedStyle(par), pr = par.getBoundingClientRect();
          if (/auto|scroll/.test(ps.overflowX) && par.scrollWidth > par.clientWidth + 2) scrollX = true;
          if (/auto|scroll/.test(ps.overflowY)) scrollY = true;
          if (!scrollY && /hidden|clip/.test(ps.overflowY) && (r.top < pr.top - 3 || r.bottom > pr.bottom + 3)) clipped = par.id || par.className || par.tagName;
        }
        const label = (el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0,60);
        if (!scrollX && (r.left < -3 || r.right > innerWidth + 3)) bad.push({label,reason:'outside viewport horizontally',x:r.x,width:r.width});
        if (clipped) bad.push({label,reason:'clipped vertically by '+clipped,y:r.y,height:r.height});
      }
      return bad;
    });
    report.push({game,stage,width,height,issues});
    fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
    if (width === 390 || width === 844) await page.screenshot({path:`${out}/${game}-${stage}-${width}.png`,timeout:15000});
  }
  await page.setViewportSize({width:390,height:844});
}
async function open(game, path = '') {
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8081/'+(game === 'hub' ? '' : `games/${game}/`)+path,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(1100);
  // Freeze continuous canvas rendering after the initial scene. DOM, networking and resize handlers stay live;
  // this is a layout audit, and avoids software WebGL saturating headless browsers.
  if (game !== 'hub' && !process.env.LIVE_RENDER) await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  page.auditErrors = errors;
  return page;
}
async function auditHubFrames(page) {
  const games = await page.evaluate(()=>GAMES.map(g=>g.id));
  for (const id of games) {
    await page.evaluate(id=>openGame(id),id);
    await page.waitForFunction(id=>{
      const f = document.getElementById('frame');
      try { return f.contentWindow.location.pathname.includes('/games/'+id+'/') && f.contentDocument.readyState !== 'loading'; }
      catch { return false; }
    },id,{timeout:60000,polling:100});
    if (!process.env.LIVE_RENDER) await page.locator('#frame').contentFrame().locator('body').evaluate(()=>{window.requestAnimationFrame=()=>0});
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(([w,h])=>Math.abs(innerWidth-w)<2 && Math.abs(innerHeight-h)<2,[width,height],{polling:100,timeout:10000});
      await page.waitForTimeout(200);
      const frame = await page.locator('#frame').boundingBox();
      const bar = await page.locator('.pbar').boundingBox();
      assert.ok(frame.height > 160 && frame.width <= width + 1, id+': usable iframe size '+JSON.stringify({width,height,frame,bar}));
      assert.ok(frame.y >= bar.y + bar.height - 1, id+': toolbar must not cover game');
      assert.ok(frame.y + frame.height <= height + 1, id+': game must fit above screen bottom '+JSON.stringify({width,height,frame,bar,viewport:await page.evaluate(()=>({w:innerWidth,h:innerHeight,dvh:document.querySelector("#player").getBoundingClientRect().height,scroll:scrollY}))}));
      report.push({game:id,stage:'hub-frame',width,height,issues:[]});
    }
    await page.evaluate(()=>closeGame());
    await page.waitForTimeout(100);
    console.log('Checked hub frame '+id);
  }
}
async function flow(game) {
  const p = await open(game);
  p.on('dialog',d=>d.accept());
  try {
    await audit(p,game,'menu');
    if (game === 'hub') await auditHubFrames(p);
    if (game === 'crownfall-kart') {
      await click(p,'#solo');await audit(p,game,'race');await click(p,'#pause-button');await audit(p,game,'pause');
    } else if (game === 'sea-of-chaos') {
      await click(p,'#solo');await audit(p,game,'game');await click(p,'#pause');await audit(p,game,'pause');
    } else if (game === 'dragon-clash') {
      await click(p,'Versus');await audit(p,game,'setup');
      await click(p,'← Back');await click(p,'Training');await click(p,'Start training');await audit(p,game,'training');
    } else if (game === 'putt-club') {
      await p.getByPlaceholder('Name',{exact:true}).fill('Phone tester');
      await click(p,'Practice solo');await audit(p,game,'lobby');await click(p,'Start game');await audit(p,game,'game');
    } else if (game === 'riftbreak') {
      await click(p,'Quick Play vs bots');await audit(p,game,'game');await click(p,'Settings');await audit(p,game,'settings');
    } else if (game === 'casino') {
      await click(p,'Host a casino night');await audit(p,game,'lobby');await click(p,'Deal everyone in');await audit(p,game,'room');
      await p.getByRole('button',{name:'Open table',exact:true}).first().click();await audit(p,game,'blackjack');
    } else if (game === 'mafia') {
      await p.getByPlaceholder('Your alias').fill('Phone tester');await click(p,'Play offline vs bots');await audit(p,game,'lobby');
      await click(p,'Deal the cards');await audit(p,game,'roles');
    } else if (game === 'recess') {
      await click(p,'Start a new room');await audit(p,game,'lobby');
      const games = await (await import('../games/recess/shared/catalog.js')).CATALOG;
      await p.evaluate(ids=>ids.forEach(id=>localStorage.setItem('recess_seen_'+id,'1')),games.map(g=>g.id));
      for (const g of games.filter(g=>g.bots||g.solo)) {
        if (g.bots) {
          await p.getByRole('button',{name:'Play '+g.name+' with bots',exact:true}).click();
          if (g.min !== g.max) await click(p,g.min+' players');
        } else await p.locator('.game-card').filter({has:p.getByRole('heading',{name:g.name,exact:true})}).getByRole('button',{name:'Open',exact:true}).click();
        await p.locator('#match.active .game-'+g.id).waitFor();
        await audit(p,game,g.id);
        await click(p,'Lobby');
      }
      const code = await p.locator('#lobby .code').textContent();
      const partner = await open('recess','?room='+code.trim());
      try {
        await partner.evaluate(()=>localStorage.setItem('recess_seen_npat','1'));
        await click(partner,'Join');
        const card = page=>page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Name Place Animal Thing',exact:true})});
        await card(p).getByRole('button',{name:'Play',exact:true}).click();
        await card(partner).getByRole('button',{name:/Join/}).click();
        await click(p,'Start game');await click(p,'Ring the bell!');
        await audit(p,game,'npat');
      } finally { await partner.close(); }
    } else if (game === 'signal-pair') {
      await click(p,'#host');await audit(p,game,'caller');
    } else if (game === 'short-fuse') {
      await click(p,'#go-expert');await audit(p,game,'manual');
      await click(p,'#man-close');await click(p,'#go-defuser');await click(p,'[data-level="1"]');await p.locator('body.cine').waitFor({state:'attached'});await p.keyboard.press('Space');await p.waitForTimeout(700);await audit(p,game,'case');
    } else if (game === 'the-hollow') {
      await click(p,'[data-act="solo"]');await audit(p,game,'characters');
      await click(p,'CHOOSE THE OCCULTIST');await audit(p,game,'lobby');
      await click(p,'SET OUT');await audit(p,game,'opening');
      if(await p.locator('[aria-label="Skip opening"]').count()) await click(p,'[aria-label="Skip opening"]');
      if(await p.locator('[data-chapter="skip-intro"]').count()) await click(p,'[data-chapter="skip-intro"]');
      if(await p.locator('.letter-close').count()) await click(p,'.letter-close');
      await audit(p,game,'game');
    } else if (game === 'party-pack') {
      await p.locator('a[href="#host"]').click();await audit(p,game,'host');
      const modes = await p.locator('[data-game]').evaluateAll(els=>els.map(el=>el.dataset.game));
      for (const key of modes) {
        await click(p,'[data-game="'+key+'"]');await audit(p,game,key);
        await click(p,'[data-act="end"]');
      }
      await p.goto('http://localhost:8081/games/party-pack/#play',{waitUntil:'domcontentloaded',timeout:60000});await audit(p,game,'controller');
    }
    assert.deepEqual(p.auditErrors,[],`${game}: runtime errors`);
    console.log(`Checked ${game}`);
  } finally { await p.close(); }
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
  browser = await engine.launch({headless:true,...(engine===chromium?{channel:'chrome',args:['--use-angle=swiftshader']}: {})});
  try {
    const games = ['hub',...fs.readdirSync('games').filter(id => fs.existsSync(`games/${id}/game.json`))];
    for (const game of games.filter(id=>!only||only.includes(id))) await flow(game);
    const failures = report.filter(r=>r.issues.length);
    assert.equal(failures.length,0,JSON.stringify(failures,null,2));
    console.log(`PASS: ${report.length} responsive screen/viewport checks.`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
