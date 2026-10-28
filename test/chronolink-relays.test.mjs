import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],c);const C=c.ChronoCore;

test('every chamber blocks the Anchor until the Echo supplies a receiver frequency',()=>{
  for(let n=1;n<=C.MAX_LEVEL;n++) {
    const L=C.getChamber(n),s=C.initState(L);
    assert.ok(L.relays.length>=1);
    for(const r of L.relays) {
      assert.equal(C.unlockRelay(L,s,r.id,r.code),null,'an unread receiver cannot be brute-forced');
      const read=C.readRelay(L,s,r.id);
      assert.equal(C.unlockRelay(L,read,r.id,'wrong'),null);
      const opened=C.unlockRelay(L,read,r.id,r.code);
      assert.equal(opened.locks[r.id],true);
      assert.equal(s.echo.reads[r.id],undefined,'reading and opening preserve the previous rewind state');
    }
  }
});
test('the first chamber requires Anchor assistance, Echo exploration and a reply before the next bridge',()=>{
  const L=C.getChamber(1),r=C.solve(L);
  assert.equal(r.ok,true);
  const path=Array.from(r.path);
  assert.ok(path.indexOf('A drop 4,1')<path.indexOf('E scan 6,2 A'));
  assert.ok(path.indexOf('E scan 6,2 A')<path.findIndex(s=>s.startsWith('A unlock')));
  assert.ok(path.findIndex(s=>s.startsWith('A unlock'))<path.indexOf('A drop 8,1'));
  assert.equal(C.solve(L,{noRelayReads:true}).why,'exhausted','Anchor cannot complete it without an Echo read');
});
test('Rust and Erosion require two exchanges separated by world changes',()=>{
  for(const n of [5,6,18,19]) {
    const r=C.solve(C.getChamber(n));assert.equal(r.ok,true);
    const p=Array.from(r.path),first=p.findIndex(s=>s.startsWith('A unlock'));
    const last=p.findLastIndex(s=>s.startsWith('A unlock'));
    assert.ok(last>first+2,`chamber ${n} needs another exchange`);
    assert.ok(p.slice(first+1,last).some(s=>s.startsWith('A wheel')));
  }
});
test('signal readouts reveal the frequency only to the Echo; Anchor must enter it',()=>{
  const L=C.getChamber(1),r=L.relays[0],G={L,s:C.initState(L)};
  const nodes={},$=id=>nodes[id]||={focus(){},hidden:false,value:'',textContent:''};
  const ctx=vm.createContext({C,G,$,held:{A:[],E:[]},taps:{A:{},E:{}},Sound:{deny(){},chime(){}},log(){},focusControls(){},commit:n=>{G.s=n;},relay:r});
  vm.runInContext(html.slice(html.indexOf('let activeSignal = null;'),html.indexOf('function describeStep(')),ctx);
  vm.runInContext("openSignal('E',relay,relay.receiver)",ctx);
  assert.equal($('signalFrequency').textContent,r.code);
  vm.runInContext("openSignal('A',relay,{x:7,y:2})",ctx);
  assert.equal($('signalFrequency').hidden,true);assert.equal($('signalFrequency').textContent,'');assert.equal($('signalCode').value,'');
  $('signalCode').value='000';vm.runInContext('submitSignal()',ctx);assert.equal(G.s.locks.r0,undefined);
  $('signalCode').value=r.code;vm.runInContext('submitSignal()',ctx);assert.equal(G.s.locks.r0,true);
  const restored=C.cloneState(C.initState(L));assert.deepEqual(Object.keys(restored.locks),[]);assert.deepEqual(Object.keys(restored.echo.reads),[]);
});
