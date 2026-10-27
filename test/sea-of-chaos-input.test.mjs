import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../games/sea-of-chaos/input.js';
import {createWorld,step} from '../games/sea-of-chaos/simulation.js';
class Surface extends EventTarget {
 constructor(){super();this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};}
 matches(){return false;}
 setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:120,height:120};}
 send(type,values={}){const e=new Event(type,{cancelable:true});for(const [k,v]of Object.entries(values))Object.defineProperty(e,k,{value:v});this.dispatchEvent(e);return e;}
}
function harness(run){const win=new Surface(),doc=new Surface(),canvas=new Surface(),stick=new Surface(),knob=new Surface(),fire=new Surface();fire.dataset.act='fire';
 doc.getElementById=id=>id==='stick'?stick:knob;doc.querySelectorAll=q=>q==='[data-act]'?[fire]:[];
 const oldDocument=globalThis.document,oldListener=globalThis.addEventListener;
 globalThis.document=doc;globalThis.addEventListener=win.addEventListener.bind(win);
 try{const input=createInput(canvas,()=>{},()=>{});input.setMode('game');run({win,doc,canvas,stick,knob,fire,input});}
 finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldListener===undefined)delete globalThis.addEventListener;else globalThis.addEventListener=oldListener;}
}
// This assertion projects actual simulated motion into the chase camera's right
// vector, rather than equating a key to a particular internal angle convention.
function screenMotion(input,heading){const w=createWorld([{id:'me'}]),s=w.ships[0];w.ships=w.ships.slice(0,1);Object.assign(s,{x:0,z:55,a:heading});const x=s.x,z=s.z;
 for(let i=0;i<15;i++)step(w,{me:input});return {right:(s.x-x)*-Math.cos(heading)+(s.z-z)*Math.sin(heading),forward:(s.x-x)*Math.sin(heading)+(s.z-z)*Math.cos(heading)};
}
test('D and Right turn screen-right; A and Left turn screen-left at every heading',()=>harness(({win,input})=>{
 for(const heading of [0,.9,-2])for(const [key,expected]of [['KeyD',1],['ArrowRight',1],['KeyA',-1],['ArrowLeft',-1]]){
  win.send('keydown',{code:'KeyW'});win.send('keydown',{code:key});assert.ok(screenMotion(input.read(),heading).right*expected>.2,key);win.send('keyup',{code:key});win.send('keyup',{code:'KeyW'});
 }
}));
test('W travels toward the bow and S reverses relative to the chase camera',()=>harness(({win,input})=>{
 for(const [code,sign]of [['KeyW',1],['KeyS',-1]]){win.send('keydown',{code});assert.ok(screenMotion(input.read(),0).forward*sign>1);win.send('keyup',{code});}
}));
test('stick right/left matches keyboard and cancellation releases steering',()=>harness(({stick,knob,input})=>{
 for(const [x,sign]of [[100,1],[20,-1]]){const e=stick.send('pointerdown',{pointerId:1,clientX:x,clientY:20});assert.ok(e.defaultPrevented);assert.ok(screenMotion(input.read(),0).right*sign>.2);stick.send('pointercancel',{pointerId:1});assert.equal(input.read().turn,0);assert.equal(input.read().throttle,0);assert.equal(knob.style.transform,'');}
}));
test('blur releases held fire and keys; menus keep normal keyboard behavior',()=>harness(({win,fire,input})=>{
 win.send('keydown',{code:'KeyW'});fire.send('pointerdown',{pointerId:2});assert.equal(input.read().fire,true);win.send('blur');assert.equal(input.read().throttle,0);assert.equal(input.read().fire,false);input.setMode('menu');const e=win.send('keydown',{code:'Space'});assert.equal(e.defaultPrevented,false);assert.deepEqual(input.read(),{});
}));
test('Q and E select port and starboard while mouse halves fire the matching side',()=>harness(({win,canvas,input})=>{
 for(const [code,side]of [['KeyQ',1],['KeyE',-1]]){win.send('keydown',{code});const press=input.read();assert.equal(press.fire,true);assert.equal(press.side,side);assert.equal(input.read().fire,false,'one press produces one shot');win.send('keyup',{code});assert.ok(!input.read().fire);}
 for(const [clientX,side]of [[10,1],[110,-1]]){canvas.send('pointerdown',{pointerId:3,clientX});const press=input.read();assert.equal(press.side,side);assert.equal(press.fire,true);assert.equal(input.read().fire,false);canvas.send('pointercancel',{pointerId:3});assert.ok(!input.read().fire);}
}));
