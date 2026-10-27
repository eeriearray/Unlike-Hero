// Rudder inertia, speed-sensitive turning and a small outward slip. Right input
// remains negative yaw, matching the chase camera's screen-right direction.
const damp=(rate,dt)=>1-Math.exp(-rate*dt);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
export function sail(s,u,dt,carrying=false){
 const turn=clamp(u.turn,-1,1),throttle=clamp(u.throttle,-1,1);
 s.rudder=(s.rudder||0)+(turn-(s.rudder||0))*damp(15,dt);
 const handling=(1+.08*(s.rudderLevel||0))*1.7+.45*Math.min(1,Math.abs(s.v)/16);
 const targetYaw=s.rudder*handling*(s.dash>0?.88:1);
 s.yawRate=(s.yawRate||0)+(targetYaw-(s.yawRate||0))*damp(13,dt);
 s.a+=s.yawRate*dt;
 const top=(carrying?12:16)*(s.slow>0?.55:s.sticky>0?.6:1)*(s.speed||1)*(1+(s.sailLevel||0)*.08)*Math.max(.8,1-(s.hullLevel||0)*.03)+(s.dash>0?12:0);
 const desired=throttle*(throttle<0?Math.min(top,7):top);
 const braking=u.brake||throttle*s.v<0,rate=braking?8+.8*(s.rudderLevel||0):throttle===0?3.8:4.6;
 s.v+=(desired-s.v)*damp(rate,dt);
 s.slip=(s.slip||0)+(-s.rudder*Math.abs(s.v)*.035-(s.slip||0))*damp(7,dt);
 s.x+=(Math.sin(s.a)*s.v+Math.cos(s.a)*s.slip)*dt;
 s.z+=(Math.cos(s.a)*s.v-Math.sin(s.a)*s.slip)*dt;
}
export function stickAxis(v){const n=Math.abs(v);return n<.08?0:Math.sign(v)*Math.pow((Math.min(1,n)-.08)/.92,1.15);}
