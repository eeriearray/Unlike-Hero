(function(root){
  'use strict';
  // Pure camera math for the renderer. Presentation only: nothing here feeds the shared simulation.
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const MODES=['chase','close','cockpit','hood'];
  const LABELS={chase:'Chase',close:'Close chase',cockpit:'Cockpit',hood:'Hood'};
  // Third-person rigs: base distance, extra distance per m/s, height above the kart and how far ahead to look.
  const RIGS={chase:{distance:6.5,perSpeed:.045,height:2.65,look:10},close:{distance:4.3,perSpeed:.03,height:1.8,look:9}};
  // First-person eye points in the kart model's local space (+z is forward, y is up from the model origin).
  const EYES={cockpit:{x:0,y:.7,z:-.24,down:.07},hood:{x:0,y:.58,z:1.05,down:.05}};
  const MAX_CHASE_FOV=72;
  const validMode=mode=>MODES.includes(mode)?mode:'chase';
  const nextMode=mode=>MODES[(MODES.indexOf(validMode(mode))+1)%MODES.length];
  const firstPerson=mode=>mode==='cockpit'||mode==='hood';
  // Exact critically damped spring for one axis; stable at any frame time. Returns [position, velocity].
  function spring(x,v,target,omega,dt){
    const e=Math.exp(-omega*dt),d=x-target,k=(v+omega*d)*dt;
    return [target+(d+k)*e,(v-omega*k)*e];
  }
  function springVector(position,velocity,target,omega,dt){
    for(const axis of ['x','y','z']){const [p,v]=spring(position[axis],velocity[axis],target[axis],omega,dt);position[axis]=p;velocity[axis]=v;}
    return position;
  }
  function chaseFov(speed,boosting,reduced){
    if(reduced)return 60;
    return Math.min(MAX_CHASE_FOV,60+Math.min(4,speed*.11)+clamp((speed*3.6-120)/40,0,1)*4+(boosting?6:0));
  }
  // First-person views widen from 75 to 85 degrees with speed. Reduced motion holds a steady 78.
  function firstPersonFov(speed,topSpeed,reduced){return reduced?78:75+10*clamp(speed/Math.max(1,topSpeed),0,1);}
  // Positive yaw rate is a left turn; positive roll banks the view left, into the corner.
  function cornerRoll(yawRate,speed,reduced,max=.055){return reduced?0:clamp(yawRate*speed*.0032,-max,max);}
  // A short nose-down dip under hard braking (deceleration beyond 8 m/s²).
  function brakeDip(acceleration,reduced){return reduced?0:clamp((-acceleration-8)*.004,0,.05);}
  // Keep the camera short of whatever the ray from the kart hit.
  function pullIn(desired,hit,margin=.35,minimum=1.1){return hit==null?desired:clamp(hit-margin,Math.min(minimum,desired),desired);}
  function headBob(time,speed,topSpeed,bump,reduced){
    if(reduced)return 0;const pace=clamp(speed/Math.max(1,topSpeed),0,1.2);
    return Math.sin(time*(7+pace*9))*.012*pace+Math.sin(time*31.7)*bump*pace;
  }
  const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  root.KartCamera={MODES,LABELS,RIGS,EYES,MAX_CHASE_FOV,validMode,nextMode,firstPerson,spring,springVector,chaseFov,firstPersonFov,cornerRoll,brakeDip,pullIn,headBob,ease};
})(typeof window!=='undefined'?window:globalThis);
