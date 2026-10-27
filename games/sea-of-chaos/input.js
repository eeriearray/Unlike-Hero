export function createInput(canvas, sound, pauseAudio) {
 const keyMap={KeyW:['throttle',1],ArrowUp:['throttle',1],KeyS:['throttle',-1],ArrowDown:['throttle',-1],KeyA:['turn',-1],ArrowLeft:['turn',-1],KeyD:['turn',1],ArrowRight:['turn',1],ShiftLeft:['boost',1],ShiftRight:['boost',1],Space:['boost',1],KeyF:['fire',1],KeyJ:['fire',1]};
 const keys={};let firePointer=false,stickId=null,stick={x:0,y:0},mode='menu',onEscape=()=>{};
 window.addEventListener('keydown',e=>{if(mode==='game'&&keyMap[e.code]){e.preventDefault();keys[e.code]=true}if(e.code==='Escape'&&mode==='game')onEscape()});
 window.addEventListener('keyup',e=>keys[e.code]=false);
 window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;firePointer=false});
 canvas.addEventListener('pointerdown',e=>{if(mode==='game'&&e.pointerType==='mouse'){canvas.setPointerCapture(e.pointerId);firePointer=true}});canvas.addEventListener('pointerup',()=>firePointer=false);canvas.addEventListener('pointercancel',()=>firePointer=false);
 for(const b of document.querySelectorAll('[data-act]')){const act=b.dataset.act;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('on');keys[`touch-${act}`]=true});const release=e=>{e.preventDefault();b.classList.remove('on');keys[`touch-${act}`]=false};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release)}
 const stickEl=document.getElementById('stick'),knob=document.getElementById('knob');stickEl.addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);moveStick(e)});stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e)});
 function moveStick(e){const r=stickEl.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.hypot(x,y),k=Math.min(42,l),dx=l?x/l*k:0,dy=l?y/l*k:0;stick.x=dx/42;stick.y=dy/42;knob.style.transform=`translate(${dx}px,${dy}px)`}
 function resetStick(){stickId=null;stick.x=stick.y=0;knob.style.transform=''}stickEl.addEventListener('pointerup',resetStick);stickEl.addEventListener('pointercancel',resetStick);document.addEventListener('visibilitychange',()=>pauseAudio(document.hidden));
 return {read(){let throttle=0,turn=0,boost=false,fire=false;for(const [code,[k,v]]of Object.entries(keyMap))if(keys[code]){if(k==='throttle')throttle=v;if(k==='turn')turn=v;if(k==='boost')boost=true;if(k==='fire')fire=true}
  // Touch: the stick steers and pushing it at all means "sail"; pulling straight back reverses.
  const sl=Math.hypot(stick.x,stick.y);if(sl>.18){turn=Math.abs(stick.x)>.12?stick.x:0;throttle=stick.y>.75&&Math.abs(stick.x)<.4?-.6:Math.min(1,sl*1.2)}
  return{throttle,turn,fire:fire||firePointer||!!keys['touch-fire'],boost:boost||!!keys['touch-boost']}},setMode(m){mode=m;if(m!=='game'){for(const k in keys)keys[k]=false;firePointer=false}},onEscape(fn){onEscape=fn}};
}
