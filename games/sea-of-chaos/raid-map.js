// Sea-level channels cut through elevated masonry. Boats never climb water.
export const RAID_ISLANDS=[{x:-52,z:-52,r:16,h:12,name:'Sunwatch Spire'},{x:52,z:52,r:16,h:12,name:'Moonwatch Keep'},{x:-52,z:52,r:14,h:9,name:'Jade Reef'},{x:52,z:-52,r:14,h:9,name:'Amethyst Reef'}];
export const RAID_HUBS=[{x:118,z:0,h:0,team:0},{x:-118,z:0,h:0,team:1},{x:0,z:0,h:0,team:-1}];
export const RAID_WHIRLPOOLS=[{x:-58,z:22,r:6},{x:58,z:-22,r:6}];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function reefHeightAt(island,x,z){const q=Math.hypot(x,z)/island.r;return q<.55?island.h+Math.sin(x*.7)*Math.cos(z*.6)*.25:q<.84?island.h*(1-smooth((q-.55)/.29))+.4:.4-(q-.84)*4;}
export function raidHeightAt(x,z){return 0;}
export function collideRaidTerrain(s,previousHeight=0){for(const island of RAID_ISLANDS){const dx=s.x-island.x,dz=s.z-island.z,d=Math.hypot(dx,dz),r=island.r+3;if(d<r){s.x=island.x+(d?dx/d:1)*r;s.z=island.z+(d?dz/d:0)*r;s.v*=.6;}}
 for(const sign of [-1,1]){const dx=s.x,dz=s.z-sign*94,d=Math.hypot(dx,dz);if(d<16){s.x=(d?dx/d:1)*16;s.z=sign*94+(d?dz/d:0)*16;s.v*=.5;}}
 for(const h of RAID_HUBS){const dx=s.x-h.x,dz=s.z-h.z,d=Math.hypot(dx,dz),channel=Math.abs(dz)<8||(h.team<0&&Math.abs(dx)<8);if(d>19&&d<29&&!channel){const r=d<24?18.8:29.1;s.x=h.x+dx/d*r;s.z=h.z+dz/d*r;s.v*=.35;}}
 s.height=raidHeightAt(s.x,s.z);
}
export function raidShotBlocked(p){const y=p.y??2.1;if([-94,94].some(z=>Math.hypot(p.x,p.z-z)<12)&&y<6)return true;for(const island of RAID_ISLANDS)if(Math.hypot(p.x-island.x,p.z-island.z)<island.r&&y<reefHeightAt(island,p.x-island.x,p.z-island.z)+.6)return true;for(const h of RAID_HUBS){const dx=Math.abs(p.x-h.x),dz=Math.abs(p.z-h.z),d=Math.hypot(dx,dz);if(d>19&&d<29&&dz>9&&(h.team>=0||dx>9)&&y<9)return true;}return false;}
export function raidWhirlpoolAt(i,t){const h=RAID_WHIRLPOOLS[i],phase=t*(i?.042:.048);return {...h,x:h.x+Math.sin(phase)*5,z:h.z+(i?-1:1)*Math.sin(phase*.8)*3};}

export function lineOfSight(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2);for(let i=1;i<n;i++){const t=i/n;if(raidShotBlocked({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:(a.height||0)+2.1+((b.height||0)-(a.height||0))*t}))return false;}return true;}
