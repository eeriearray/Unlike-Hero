import {stickAxis} from './sailing.js';
export function createInput(canvas,unlock,pauseAudio) {
 const keys=new Set(),touch=new Set();let ammo=1,fire=false,utility=false,pointerSide=0,stickId=null,sx=0,sy=0,mode='menu',escape=()=>{};
 const gameplay=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','Digit1','Digit2','Digit3','KeyF','KeyQ','KeyE','KeyR']);
 function select(n){ammo=n;document.querySelectorAll('[data-ammo]').forEach(b=>b.classList.toggle('on',+b.dataset.ammo===n));}
 addEventListener('keydown',e=>{if(mode!=='game'||e.target.matches('input,textarea'))return;if(gameplay.has(e.code)){e.preventDefault();keys.add(e.code);if(!e.repeat&&['KeyF','KeyQ','KeyE'].includes(e.code)){fire=true;pointerSide=e.code==='KeyE'?-1:1;}if(!e.repeat&&e.code==='KeyR')utility=true;if(e.code.startsWith('Digit'))select(+e.code.slice(-1));}if(e.code==='Escape')escape();});
 addEventListener('keyup',e=>keys.delete(e.code));
 canvas.addEventListener('pointerdown',e=>{if(mode==='game'){e.preventDefault();unlock();canvas.setPointerCapture(e.pointerId);fire=true;const r=canvas.getBoundingClientRect();pointerSide=e.clientX-r.left<r.width/2?1:-1;}});
 for(const b of document.querySelectorAll('[data-act]')){const act=b.dataset.act;
  b.addEventListener('pointerdown',e=>{if(mode!=='game')return;e.preventDefault();unlock();b.setPointerCapture(e.pointerId);touch.add(act);if(act==='fire'||act==='fire-port'||act==='fire-starboard'){fire=true;pointerSide=act==='fire-port'?1:-1;}if(act==='utility')utility=true;b.classList.add('on');});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{e.preventDefault();touch.delete(act);b.classList.remove('on');});
 }
 document.querySelectorAll('[data-ammo]').forEach(b=>b.onclick=()=>select(+b.dataset.ammo));
 const stick=document.getElementById('stick'),knob=document.getElementById('knob');
 function move(e){const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,l=Math.hypot(x,y),k=Math.min(40,l);sx=l?x/l*k/40:0;sy=l?y/l*k/40:0;knob.style.transform=`translate(${sx*40}px,${sy*40}px)`;}
 stick.addEventListener('pointerdown',e=>{if(mode!=='game'||stickId!==null)return;e.preventDefault();unlock();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)move(e);});
 function resetStick(){stickId=null;sx=sy=0;knob.style.transform='';}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,resetStick);
 function reset(){keys.clear();touch.clear();fire=false;utility=false;resetStick();document.querySelectorAll('[data-act]').forEach(b=>b.classList.remove('on'));}
 addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{reset();pauseAudio(document.hidden);});
 // Looking along +Z, screen-right is local -X: right input decreases yaw.
 return {read(consume=true){if(mode!=='game')return{};const shot=fire,tool=utility;if(consume){fire=false;utility=false;}return {throttle:Math.abs(sy)>.08?-stickAxis(sy):Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),turn:Math.abs(sx)>.08?-stickAxis(sx):Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight')),fire:shot,utility:tool,side:shot?pointerSide:0,boost:touch.has('boost')||keys.has('ShiftLeft')||keys.has('ShiftRight'),ram:touch.has('ram')||keys.has('Space'),ammo};},setMode(m){mode=m;reset();},onEscape(fn){escape=fn;}};
}
