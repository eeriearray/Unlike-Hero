import test from 'node:test';import assert from 'node:assert/strict';
import {createTeamWorld,step} from '../games/sea-of-chaos/simulation.js';
import {broadside,bowAim} from '../games/sea-of-chaos/combat.js';
import {autoOutfit,BOARD_SECONDS} from '../games/sea-of-chaos/team-rules.js';
import {OPENING_SECONDS} from '../games/sea-of-chaos/defenses.js';
import {OVERTIME} from '../games/sea-of-chaos/economy.js';
import {missionFor} from '../games/sea-of-chaos/objectives.js';
const emit=(w,type,id,by,detail={})=>w.events.push({type,id,by,...detail});
function fixture(size=1,options={}){const w=createTeamWorld(Array.from({length:size*2},(_,i)=>({id:`c${i}`,name:`C${i}`,ai:i>0})),{size,...options},7);w.t=60;w.defense.active=false;w.pickups=[];for(const [i,s]of w.ships.entries())Object.assign(s,{shield:0,x:80-i*20,z:70});return w;}

test('rounds are paced for short raids',()=>{assert.equal(OPENING_SECONDS,25);assert.equal(BOARD_SECONDS,3);assert.ok(OVERTIME.beacon<OVERTIME.final);assert.equal(fixture().duration,OVERTIME.beacon);});

test('auto fire uses the bow gun for a rival dead ahead, but Q/E never do',()=>{const w=fixture(),a=w.ships[0],b=w.ships[1];b.ai=false;Object.assign(a,{x:0,z:40,a:0});Object.assign(b,{x:0,z:75,a:0});
 assert.equal(bowAim(a,[a,b],w)?.target,b.id);
 broadside(w,a,{fire:true,side:0},emit);assert.equal(w.shots.length,1);assert.ok(Math.abs(w.shots[0].a)<.05,'bow shot flies forward');
 a.fire=0;w.shots=[];broadside(w,a,{fire:true,side:1},emit);assert.ok(Math.abs(Math.abs(w.shots[0].a)-Math.PI/2)<.05,'Q keeps the beam');});

test('auto fire falls back to the side the player clicked when nothing is in reach',()=>{const w=fixture(),a=w.ships[0];w.ships[1].x=500;Object.assign(a,{x:0,z:40,a:0});
 broadside(w,a,{fire:true,side:0,fallback:-1},emit);assert.equal(a.fireSide,-1);});

test('auto-upgrade saves for core upgrades evenly before extras',()=>{const w=fixture(),s=w.ships[0],home=w.teams[0];Object.assign(s,{x:home.x-16,z:0,coins:14});
 assert.equal(autoOutfit(w,s,home,emit),null,'14 gold is not spent on a minor extra');
 s.coins=200;const order=[];for(let i=0;i<4;i++){s.buyCooldown=0;order.push(autoOutfit(w,s,home,emit));}
 assert.deepEqual(new Set(order),new Set(['power','hull','loader','siege']));});

test('players get auto-upgrades at the dock unless they switch it off',()=>{const w=fixture(),s=w.ships[0],home=w.teams[0];w.ships[1].x=500;Object.assign(s,{x:home.x-16,z:0,coins:60});
 step(w,{[s.id]:{autobuy:false}});assert.equal(s.coins,60);step(w,{[s.id]:{autobuy:true}});assert.ok(s.coins<60);});

test('practice raids soften only the bots on crews without a human',()=>{const w=fixture(2,{practice:true});const me=w.ships[0];
 assert.equal(me.handicap,1);assert.equal(w.ships[2].handicap,1,'your bot wingmate is full strength');assert.ok(w.ships[1].handicap<1&&w.ships[3].handicap<1);
 assert.ok(fixture(2).ships.every(s=>s.handicap===1),'rooms and plain matches are even');});

test('the beacon outranks low hull so the arrow never sends you away from the deciding fight',()=>{const w=fixture(),s=w.ships[0];w.overtime.active=true;s.hp=5;assert.match(missionFor(w,s).title,/center/);});

test('a raid objective stays put while you carry a little treasure',()=>{const w=fixture(),s=w.ships[0];s.cargo={gold:4,pearls:3,relics:1};assert.match(missionFor(w,s).title,/shield/);s.cargo={gold:16,pearls:0,relics:0};assert.match(missionFor(w,s).title,/bank/);});
