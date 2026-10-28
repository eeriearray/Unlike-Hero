import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
const between = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
function game(role) {
  const nodes = {}, timers = [], reports = [], saved = {};
  const G = { L:{exit:{x:9,y:2},W:12,H:6,n:1,name:'Test chamber'},
    A:{x:8,y:2,rx:8,ry:2}, E:{x:8,y:2,rx:8,ry:2},
    t:30,levelStart:0,won:false,shocks:[],shake:{},rewinds:0,hints:0 };
  const $ = id => nodes[id] ||= {hidden:true};
  const context = vm.createContext({G,$,Math,Number,C:{MAX_LEVEL:19},
    controls:who=>who===(role==='ANCHOR'?'A':'E'),
    clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
    trackStand(){}, Sound:{solve(){}}, FX:{spawn(){}},rnd:a=>a,
    store:{get:(k,d)=>saved[k]??d,set:(k,v)=>{saved[k]=v;}},
    hub:{report:(...v)=>reports.push(v)},later:(delay,fn)=>timers.push({delay,fn}),
  });
  vm.runInContext(between('function applyRemotePos(', 'function applyRemoteWorld('),context);
  vm.runInContext(between('function checkVictory()', 'function nextLevel()'),context);
  return {G,$,timers,reports,step:(who,x=9)=>{context.who=who;context.pos={x,y:2,px:x,pz:2};vm.runInContext('applyRemotePos(who,pos)',context);}};
}
for(const role of ['ANCHOR','ECHO']) {
  test(`${role} sees victory when the stationary player receives the partner's final step`,()=>{
    const g=game(role), mine=role==='ANCHOR'?'A':'E', partner=mine==='A'?'E':'A';
    g.G[mine].x=9;
    g.step(partner);
    assert.equal(g.G.won,true);
    assert.equal(g.reports.length,1);
    assert.equal(g.timers[0].delay,2.6);
    g.timers[0].fn();
    assert.equal(g.$('victory').hidden,false);
    assert.match(g.$('vicSub').textContent,/Chamber 01/);
    g.step(partner);
    assert.equal(g.reports.length,1,'duplicate position cannot trigger victory twice');
  });
}
test('partner position updates do not award victory until both players reach the exit',()=>{
  const g=game('ECHO');
  g.step('A');
  assert.equal(g.G.won,false);
  assert.equal(g.timers.length,0);
});
