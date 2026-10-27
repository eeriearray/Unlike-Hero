(function(root){
  'use strict';
  class KartInput {
    constructor(){this.keys=new Set();this.pointers=new Map();this.hop=false;this.use=false;this.reset=false;this.active=false;this.auto=false;this.assist=true;this.padUse=false;this.padDrift=false;this.onPause=()=>{};
      window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();this.onPause();return;}if(!this.active||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Escape'].includes(e.code))e.preventDefault();
        if(e.code==='Space'&&!e.repeat)this.hop=true;if(e.code==='KeyE'&&!e.repeat)this.use=true;if(e.code==='KeyR'&&!e.repeat)this.reset=true;this.keys.add(e.code);});
      window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.clear());
      for(const button of document.querySelectorAll('[data-control]')){
        button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,button.dataset.control);if(button.dataset.control==='drift')this.hop=true;button.classList.add('pressed');});
        const release=e=>{this.pointers.delete(e.pointerId);button.classList.remove('pressed');};
        button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
      }
    }
    clear(){this.steerValue=0;this.keys.clear();this.pointers.clear();this.hop=false;this.use=false;this.reset=false;this.padUse=false;this.padDrift=false;for(const b of document.querySelectorAll('.pressed'))b.classList.remove('pressed');}
    read(consume=true){
      if(!this.active)return CrownSim.emptyInput();
      const touch=new Set(this.pointers.values()),has=(...codes)=>codes.some(c=>this.keys.has(c));
      let throttle=(this.auto||has('KeyW','ArrowUp')||touch.has('accelerate')?1:0)-(has('KeyS','ArrowDown')||touch.has('brake')?1.6:0);
      // Digital steering ramps in over a few frames and snaps back quickly, so key taps make small corrections.
      const target=(has('KeyD','ArrowRight')||touch.has('right')?1:0)-(has('KeyA','ArrowLeft')||touch.has('left')?1:0),now=Date.now(),dt=Math.min(.1,(now-(this.lastRead||now))/1000);
      if(consume){this.lastRead=now;if(target&&target*(this.steerValue||0)<=.35)this.steerValue=target*.35;const rate=target===0?12:target*this.steerValue<0?14:6.5;this.steerValue=(this.steerValue||0)+Math.max(-rate*dt,Math.min(rate*dt,target-(this.steerValue||0)));}
      let steer=target===0&&Math.abs(this.steerValue||0)<.06?0:(this.steerValue||0);
      let drift=has('Space')||touch.has('drift');
      let pad;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch{}
      if(pad){if(Math.abs(pad.axes[0])>.16)steer=pad.axes[0];if(pad.buttons[7]?.value>.1)throttle=pad.buttons[7].value;if(pad.buttons[6]?.value>.1)throttle-=pad.buttons[6].value*1.6;drift||=pad.buttons[0]?.pressed;
        const used=pad.buttons[2]?.pressed;if(used&&!this.padUse)this.use=true;this.padUse=!!used;const padHeld=!!pad.buttons[0]?.pressed;if(padHeld&&!this.padDrift)this.hop=true;this.padDrift=padHeld;}
      const value=CrownSim.cleanInput({throttle,steer,drift:!!drift,hop:this.hop,use:this.use,reset:this.reset,assist:this.assist});if(consume){this.hop=false;this.use=false;this.reset=false;}return value;
    }
  }
  root.KartInput=KartInput;
})(window);
