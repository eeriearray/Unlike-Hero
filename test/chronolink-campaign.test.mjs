import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],ctx);
const C=ctx.ChronoCore;
function relaxedGallery(L) {
  const cut=L.gallery.cut, dx=1-cut, cy=L.supports[0].y;
  const p=q=>({...q,x:q.x+dx});
  const map=Array.from({length:L.H},(_,y)=>'#'+L.base.slice(y*L.W+cut,(y+1)*L.W).join(''));
  const def={name:'relaxed gallery',map,objs:L.objs0.filter(o=>o.x>=cut).map(p),
    gates:Object.entries(L.gates).filter(([i])=>i%L.W>=cut).map(([i,id])=>({id,x:i%L.W+dx,y:Math.floor(i/L.W)})),
    wheels:L.wheels.filter(w=>w.x>=cut).map(p),
    bars:L.bars.filter(i=>i%L.W>=cut).map(i=>({x:i%L.W+dx,y:Math.floor(i/L.W)})),
    porous:L.porous.map(i=>({x:i%L.W+dx,y:Math.floor(i/L.W)})),
    supports:L.supports.map(s=>({...p(s),span:s.span.map(p),fall:s.fall.map(p)})),
    deposits:L.deposits.map(d=>({feed:p(d.feed),fill:d.fill.map(p),bury:d.bury.map(p)})),
    relays:L.relays.filter(r=>r.receiver.x>=cut).map(r=>({...r,gate:r.gate.column!=null?{column:r.gate.column+dx}:p(r.gate),receiver:p(r.receiver)})),pins:L.pinsMax};
  const g=C.parseChamber(def,0);g.startA={x:1,y:cy};g.startE={x:1,y:cy};g.exit=p(L.exit);return g;
}

// Use a fully supplied gallery (all pins free) to get a conservative lower bound.
// Courtyard timber cannot cross rubble; gallery water cannot affect the courtyard.
// This avoids claiming that a greedy chapter boundary proves a global optimum.
// Since the Echo can topple crates, A Building on Loan's courtyard is three actions shorter (28 in all).
test('each gallery chamber requires at least 28 scored actions even with a fully supplied gallery',()=>{
  const seeds=[18,5,9,15,7,16],prefix=new Map();
  for(let n=20;n<=25;n++){
    const seed=seeds[n-20];
    if(!prefix.has(seed)){
      const r=C.solve(C.courtyard(seed),{realMoves:true,noPath:true,maxStates:400000});
      assert.equal(r.ok,true,`courtyard ${seed}: ${r.why}`);prefix.set(seed,r.depth);
    }
    const L=C.getChamber(n),g=relaxedGallery(L),r=C.solve(g,{realMoves:true,maxStates:400000});
    assert.equal(r.ok,true,`gallery ${n}: ${r.why}`);
    const turns=r.path.filter(p=>p.startsWith('A wheel ')),wheels=new Set(turns.map(p=>p.split(' ')[2]));
    const actions=r.path.filter(p=>!/^E (go|scan) /.test(p)&&!p.startsWith('A unlock ')&&!p.startsWith('A wheel '));
    assert.equal(r.depth,actions.length+wheels.size,`gallery ${n}: repeats must be free`);
    assert.ok(turns.length>wheels.size,`gallery ${n}: exercise a repeated setting`);
    assert.ok(prefix.get(seed)+r.depth>=28,`chamber ${n}: ${prefix.get(seed)} + ${r.depth}`);
  }
});

test('the three teaching galleries require their respective new mechanic even without placement pruning',()=>{
  for(const [n,option] of [[20,'noCapillary'],[21,'noSediment'],[22,'noSupports']]){
    const L=relaxedGallery(C.getChamber(n));
    const r=C.solve(L,{[option]:true,prune:false,noPath:true,maxStates:400000});
    assert.equal(r.ok,false,`gallery ${n} bypasses ${option}`);assert.equal(r.why,'exhausted',`gallery ${n}: ${r.why}`);
  }
});

// Replay actual solver macros through the public actions, including the exact
// positions from which actions are made. Check hint recovery inside each gallery.
function replay(L,path){
  let s=C.initState(L),a={...L.startA},e={...L.startE},stand=null;
  const W=L.W,idx=p=>p.y*W+p.x;
  const region=(who,fut)=>who==='A'?C.regionOf(L,a,(x,y)=>C.walkPast(L,s,x,y,C.flowing(L,s))):C.regionOf(L,e,(x,y)=>C.walkFuture(fut,L,x,y));
  for(const label of path){
    const fut=C.deriveFuture(L,s,stand),[who,verb,target,arg]=label.split(' '),point=v=>{const [x,y]=v.replace('@','').split(',').map(Number);return{x,y};};
    const at=label.match(/@(\d+),(\d+)/),from=at?{x:+at[1],y:+at[2]}:null;
    let next;
    if(who==='A'){
      if(from){assert.ok(region('A',fut).seen[idx(from)],label);a=from;}
      if(verb==='pick'||verb==='drop'){const p=point(target);next=verb==='pick'?C.actPick(L,s,p.x,p.y):C.actDrop(L,s,p.x,p.y);}
      else if(verb==='wheel'){
        const turns=+(label.match(/turns=(\d+)/)?.[1]||1);next=s;
        for(let j=0;j<turns;j++){next=C.actWheel(L,next,+target);assert.ok(next,label);assert.equal(C.crushes(L,s,next,stand?.i),false,label);}
      }else if(verb==='unlock'){
        const p=point(target),r=L.relays.find(r=>r.label===arg);assert.ok(C.regionOf(L,a,(x,y)=>C.walkPast(L,s,x,y,C.flowing(L,s))).cells.some(i=>Math.abs(i%W-p.x)+Math.abs(Math.floor(i/W)-p.y)===1),label);
        next=C.unlockRelay(L,s,r.id,r.code);
      }else if(verb==='shove'){
        const p=point(target),[dx,dy]=arg.split(',').map(Number),behind={x:p.x-dx,y:p.y-dy};assert.ok(region('A',fut).seen[idx(behind)],label);next=C.actShove(L,s,p.x,p.y,dx,dy);a=p;
      }
      assert.ok(next&&next.paradox==null,label);assert.equal(C.crushes(L,s,next,stand?.i),false,label);s=next;
    }else{
      const p=point(target),i=idx(p);
      if(verb==='go'||verb==='stand'||verb==='scan'){
        assert.ok(region('E',fut).seen[i],label);e=p;stand=verb==='stand'||(verb==='scan'&&C.volatile(L,i,fut[i]))?{i,rec:fut[i]}:null;
        if(verb==='scan'){const r=L.relays.find(r=>r.label===arg);next=C.readRelay(L,s,r.id);assert.ok(next,label);s=next;}
      }else{
        assert.ok(from&&region('E',fut).seen[idx(from)],label);
        const keep=stand&&(verb==='topple'?stand.i===idx(from):stand.i===i||Math.abs(stand.i%W-p.x)+Math.abs(Math.floor(stand.i/W)-p.y)===1);
        e=from;if(!keep)stand=null;
        const view=C.deriveFuture(L,s,stand),[dx,dy]=verb==='topple'?arg.split(',').map(Number):[0,0];
        const r=verb==='pin'||verb==='unpin'?C.echoPin(L,s,view,i):verb==='topple'?(assert.equal(from.x+dx,p.x,label),assert.equal(from.y+dy,p.y,label),C.echoTopple(L,s,view,i,dx,dy)):C.echoAct(L,s,view,i);
        assert.ok(r,label);assert.equal(r.kind,verb,label);s=r.s;
      }
    }
  }
  return{s,a,e,stand};
}

test('gallery plans replay through shared actions and hints recover from actual mid-gallery states',()=>{
  for(let n=20;n<=25;n++){
    const L=relaxedGallery(C.getChamber(n)),r=C.solve(L,{maxStates:400000});assert.equal(r.ok,true,`gallery ${n}`);
    for(const length of [Math.floor(r.path.length/2),r.path.length-2,r.path.length]){
      const start=replay(L,r.path.slice(0,length)),hint=C.solve(L,{start,noPath:true,maxStates:400000});assert.equal(hint.ok,true,`gallery ${n}, step ${length}: ${hint.why}`);
    }
  }
});

test('a live courtyard hint keeps the gallery boundary while its local shore is still inaccessible',()=>{
  const L=C.getChamber(20),start={s:C.initState(L),a:{...L.startA},e:{...L.startE},stand:null};
  const r=C.solve(L,{start,noPath:true,maxStates:400000});
  assert.equal(r.ok,true,r.why);assert.equal(r.segmented,true);assert.ok(r.explored<400000);
});

// The Undercroft's plans are real: every shove, stand and unlock replays through the same actions the game
// uses, both chrononauts can then walk to the exit, and a hint from halfway through still finds the rest.
test('Undercroft plans replay through shared actions and finish with both chrononauts at the exit',()=>{
  for(let n=12;n<=19;n++){
    const L=C.getChamber(n),r=C.solve(L,{maxStates:400000});assert.equal(r.ok,true,`chamber ${n}`);
    const end=replay(L,r.path),X=L.exit.y*L.W+L.exit.x;
    assert.ok(C.regionOf(L,end.a,(x,y)=>C.walkPast(L,end.s,x,y,C.flowing(L,end.s))).seen[X],`chamber ${n}: Anchor reaches the exit`);
    const fut=C.deriveFuture(L,end.s,end.stand);
    assert.ok(C.regionOf(L,end.e,(x,y)=>C.walkFuture(fut,L,x,y)).seen[X],`chamber ${n}: Echo reaches the exit`);
    const mid=replay(L,r.path.slice(0,Math.floor(r.path.length/2))),hint=C.solve(L,{start:mid,noPath:true,maxStates:400000});
    assert.equal(hint.ok,true,`chamber ${n} halfway: ${hint.why}`);
  }
});
