import test from 'node:test';import assert from 'node:assert/strict';
import {createWorld,step,buoy} from '../games/sea-of-chaos/simulation.js';
import {broadside,cannonMuzzles,broadsideAim,hullContact,collideShips} from '../games/sea-of-chaos/combat.js';
import {ARENA,ISLANDS,tideAt,whirlpoolAt} from '../games/sea-of-chaos/arena.js';
import {missionFor} from '../games/sea-of-chaos/objectives.js';import {shipPose} from '../games/sea-of-chaos/ship-pose.js';
function setup(){const w=createWorld([{id:'me'},{id:'rival'}]);for(const s of w.ships){s.ai=false;s.shield=0;}return w;}
function boat(id,x,z,a=0,v=0){return {id,x,z,a,v,slip:0,hp:100,dead:0,drag:0,bump:0,ramStrike:0};}
test('each trigger fires exactly one side cannon and cycles the three actual muzzles',()=>{for(const side of [1,-1]){const w=setup(),s=w.ships[0];Object.assign(s,{x:0,z:0,a:0});w.ships=[s];const muzzles=cannonMuzzles(s,side);
 for(let i=0;i<6;i++){s.fire=0;broadside(w,s,{side,ammo:i%3+1},()=>{});assert.equal(w.shots.length,i+1);const shot=w.shots[i];assert.equal(shot.x,muzzles[i%3].x);assert.equal(shot.z,muzzles[i%3].z);assert.ok(Math.abs(Math.cos(shot.a))<1e-6);assert.ok(Math.sin(shot.a)*side>.99);assert.equal(s.fireGun,i%3);broadside(w,s,{side,ammo:1},()=>{});assert.equal(w.shots.length,i+1,'reload prevents duplicate shots');}
 assert.equal(s.ammo[1],10);assert.equal(s.ammo[2],16);
}});
test('side guns cannot auto-aim at enemies ahead; selected side stays selected',()=>{const s=boat('a',0,0),front=boat('b',0,30),port=boat('c',30,0);assert.equal(broadsideAim(s,[s,front]).target,null);assert.equal(broadsideAim(s,[s,port],1).target,'c');assert.equal(broadsideAim(s,[s,port],-1).target,null);});
test('one side cannonball deals one hit to a rival on the beam',()=>{const w=setup(),a=w.ships[0],b=w.ships[1];Object.assign(a,{x:0,z:40,a:0});Object.assign(b,{x:35,z:40,a:0});w.ships=[a,b];for(let i=0;i<18;i++)step(w,{me:{fire:i===0,side:1}});assert.equal(b.hp,86);assert.equal(a.hp,100);});
test('capsule hull contacts separate ships without damaging gentle nudges',()=>{const a=boat('a',0,40),b=boat('b',4,40),w={ships:[a,b]};let hits=0;collideShips(w,()=>hits++,()=>{});assert.equal(hullContact(a,b),null);assert.ok(b.x-a.x>=4.8);assert.equal(hits,0);});
test('head-on collisions exchange momentum and damage only once per impact',()=>{const a=boat('a',0,40,0,16),b=boat('b',0,49,Math.PI,16),w={ships:[a,b]};let events=0;const hurt=(_,s,d)=>s.hp-=d;collideShips(w,hurt,()=>events++);assert.ok(a.v<0&&b.v<0);assert.equal(a.hp,95);assert.equal(b.hp,95);assert.equal(events,1);const hp=a.hp;collideShips(w,hurt,()=>events++);assert.equal(a.hp,hp);assert.equal(events,1);});
test('a ram deals extra damage on hull contact, not to a distant nearby ship',()=>{const a=boat('a',0,40),b=boat('b',4,40),w={ships:[a,b]};a.ramStrike=.5;collideShips(w,(_,s,d)=>s.hp-=d,()=>{});assert.equal(b.hp,80);assert.equal(a.ramStrike,0);const distant=boat('c',20,40);a.ramStrike=.5;collideShips({ships:[a,distant]},()=>assert.fail('no contact'),()=>{});});
test('whirlpool capture spirals inward, sinks visibly and resets on respawn',()=>{const w=setup(),s=w.ships[0],h=w.whirl[0];w.ships=[s];Object.assign(s,{x:h.x+3,z:h.z,a:0});w.flag.carrier=s.id;step(w);assert.equal(s.whirl,0);assert.equal(w.flag.carrier,null);const radius=s.swirlRadius,initial=shipPose(s,w.t),angle=s.a;for(let i=0;i<20;i++)step(w);const next=shipPose(s,w.t);assert.ok(s.swirlRadius<radius);assert.ok(Math.abs(Math.hypot(s.x-h.x,s.z-h.z)-s.swirlRadius)<1e-8);assert.ok(next.y<initial.y);assert.ok(next.scale<initial.scale);assert.ok(Math.abs(s.a-angle)>.5);for(let i=0;i<60&&!s.dead;i++)step(w);assert.ok(s.dead>0);assert.equal(s.hp,0);for(let i=0;i<242;i++)step(w);assert.equal(s.whirl,-1);assert.equal(s.drag,0);assert.equal(s.dead,0);assert.equal(shipPose(s,w.t).scale,1);});
test('an early boost can escape the outer whirlpool pull',()=>{const w=setup(),s=w.ships[0],h=w.whirl[0];w.ships=[s];Object.assign(s,{x:h.x+6.7,z:h.z,a:Math.PI/2});for(let i=0;i<20;i++)step(w,{me:{throttle:1,boost:true}});assert.equal(s.whirl,-1);assert.ok(s.x>h.x+10);assert.ok(s.hp>0);});
test('persistent mission tells the player how to steal, return, hold and win',()=>{const w=setup(),s=w.ships[0];let m=missionFor(w,s);assert.equal(m.phase,1);assert.match(m.detail,/pick it up automatically/);w.flag.carrier=s.id;m=missionFor(w,s);assert.equal(m.phase,2);assert.deepEqual(m.goal,buoy(s));assert.match(m.detail,/2 seconds/);s.capture=1;m=missionFor(w,s);assert.equal(m.phase,3);assert.match(m.detail,/Release the stick/);s.whirl=0;assert.match(missionFor(w,s).title,/maelstrom/);});
test('larger sea keeps safe starts and routes; tides genuinely reverse',()=>{const w=setup();assert.equal(ARENA,150);assert.ok(w.pickups.length>=6);for(const s of w.ships.filter(s=>!s.raider)){const home=buoy(s);assert.ok(Math.hypot(home.x,home.z)>120);assert.ok(ISLANDS.every(i=>Math.hypot(home.x-i.x,home.z-i.z)>i.r+12));}assert.ok(tideAt(20).flow>0);assert.ok(tideAt(65).flow<0);});

test('cruising bumps are harmless and a pileup cannot stack hard collision damage',()=>{
 const a=boat('a',0,40,0,4),b=boat('b',0,49,Math.PI,4);collideShips({ships:[a,b]},()=>assert.fail('gentle impact hurts'),()=>{});
 const w=setup(),s=w.ships[0];Object.assign(s,{x:0,z:40,a:0,v:16,shield:0});w.ships=[s];
 for(let i=0;i<3;i++){const enemy=boat(`impact${i}`,s.x,s.z+9,Math.PI,16);collideShips({ships:[s,enemy]},(_,ship,d)=>ship.hp-=d,()=>{});s.v=16;}
 assert.equal(s.hp,95);assert.equal(s.bump,2);
 const rammer=boat('rammer',s.x+4,s.z);rammer.ramStrike=.5;collideShips({ships:[s,rammer]},(_,ship,d)=>ship.hp-=d,()=>{});assert.equal(s.hp,95);assert.equal(rammer.ramStrike,0);
});
test('whirlpools migrate continuously and remain clear of islands, wreck and home lanes',()=>{
 for(let i=0;i<2;i++){const start=whirlpoolAt(i,0);assert.ok(Math.hypot(whirlpoolAt(i,25).x-start.x,whirlpoolAt(i,25).z-start.z)>10);
  for(let t=0;t<600;t+=.5){const h=whirlpoolAt(i,t),next=whirlpoolAt(i,t+1/30);assert.ok(Math.hypot(h.x-next.x,h.z-next.z)<.03);assert.ok(Math.hypot(h.x,h.z)>h.r+12);assert.ok(Math.hypot(h.x,h.z)<100);assert.ok(ISLANDS.every(land=>Math.hypot(h.x-land.x,h.z-land.z)>h.r+land.r+8));}
 }
 const w=setup();w.ships=[];for(let i=0;i<90;i++)step(w);assert.deepEqual(w.whirl[0],whirlpoolAt(0,w.t));assert.deepEqual(w.whirl[1],whirlpoolAt(1,w.t));
});
