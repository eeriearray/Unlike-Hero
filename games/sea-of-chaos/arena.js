export const ARENA=150,BOUNDARY=144,BUOY_RADIUS=126,SPAWN_RADIUS=118;
export const ISLANDS=[{x:-55,z:-40,r:18,name:'Cinder Lighthouse'},{x:54,z:44,r:20,name:'Fort Bonny'}];
export const WHIRLPOOLS=[{x:-38,z:18,r:7},{x:45,z:-35,r:7}];
// Gentle looping migration: starts at the familiar positions, stays clear of land and homes.
export function whirlpoolAt(index,t){const h=WHIRLPOOLS[index],phase=t*(index?.048:.055),spin=index?-1:1;return {...h,x:h.x+Math.sin(phase)*12,z:h.z+spin*(1-Math.cos(phase))*8};}
export const PICKUPS=[{x:-84,z:4,kind:'repair'},{x:75,z:-6,kind:'ammo'},{x:3,z:-92,kind:'repair'},{x:-6,z:88,kind:'ammo'},{x:-38,z:-82,kind:'ammo'},{x:87,z:70,kind:'repair'}];
export function tideAt(t){const flow=Math.sin(t*Math.PI/45);return {flow,strength:.4+Math.abs(flow)*1.1,name:flow>=0?'FLOOD TIDE':'EBB TIDE'};}
export function sectorAt(x,z){if(Math.hypot(x,z)<32)return 'SKULL WRECK';if(x< -28&&z<0)return 'CINDER LIGHTHOUSE';if(x>28&&z>12)return 'FORT BONNY';if(z< -50)return 'SMUGGLER’S REACH';if(z>55)return 'RUNNER’S PASS';return 'THE CROSSING';}
