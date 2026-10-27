import {waypoint} from './navigation.js';
import {cargoCount,capacity} from './economy.js';
import {openingProtected,layerFor,structureTargets} from './defenses.js';
import {BOARD_SECONDS} from './team-rules.js';
import {buoy} from './simulation.js';
export function missionFor(w,s){
 if(w.rules){const m=teamMission(w,s);if(!s.dead&&!s.eliminated&&!m.goal.siege)m.goal=waypoint(w,s,m.goal);return m;}
 const carrier=w.ships.find(e=>e.id===w.flag.carrier),home=buoy(s),base={phase:1,goal:w.flag,label:carrier?'FLAG CARRIER':'SKULL FLAG'};
 if(s.dead)return {...base,title:'Ship sunk · back soon',detail:`Respawning at your gold buoy in ${Math.ceil(s.dead)} seconds. Sinking does not remove your stashes.`,status:'RESPAWNING'};
 if(s.whirl>=0)return {...base,title:'Caught in the maelstrom!',detail:'The current has your ship. You will resurface at your buoy after sinking.',status:'DRAGGED UNDER'};
 if(s.drag>.03){const h=w.whirl.reduce((a,b)=>Math.hypot(s.x-a.x,s.z-a.z)<Math.hypot(s.x-b.x,s.z-b.z)?a:b);return {...base,goal:{x:s.x+(s.x-h.x)*5,z:s.z+(s.z-h.z)*5},label:'SAFE WATER',title:'Boost out of the whirlpool',detail:'Turn away from the dark funnel and hold Boost before the current catches you.',status:'WHIRLPOOL PULL'};}
 if(w.flag.carrier===s.id){if(s.capture>0)return {...base,phase:3,goal:home,label:'YOUR STASH BUOY',title:'Stay here · stashing!',detail:`Release the stick or W/S. Hold this circle for ${Math.max(0,2-s.capture).toFixed(1)} more seconds to score.`,status:'STASHING'};return {...base,phase:2,goal:home,label:'YOUR GOLD BUOY',title:'Bring the flag HOME',detail:'Follow the gold arrow to YOUR glowing buoy. Stop inside its circle for 2 seconds.',status:'FLAG CARRIER'};}
 if(carrier)return {...base,title:`Steal it from ${carrier.name}`,detail:'Put the carrier alongside your ship. Fire Q/Port or E/Starboard, then sail into the dropped flag.',status:'HUNT THE CARRIER'};
 if(w.flag.returnAt>0)return {...base,title:`Next flag in ${Math.ceil(w.flag.returnAt)} seconds`,detail:'Head toward the central wreck. A new Skull Flag appears there after every stash.',status:'FLAG RETURNING'};
 return {...base,title:w.flag.dropped>0?'Grab the dropped flag':'Steal the Skull Flag',detail:w.flag.dropped>0?`Sail into the flag before it returns in ${Math.ceil(w.flag.dropped)} seconds. Then deliver it to YOUR gold buoy.`:'Follow the gold arrow to the central wreck. Sail into the flag to pick it up automatically.',status:'FIND THE FLAG'};
}

function teamMission(w,s){const home=w.teams[s.team],enemy=w.teams[1-s.team],base={phase:1,goal:enemy,label:'ENEMY FORT'},hold=Math.ceil(w.overtime?.target||12);
 if(w.series.phase==='intermission')return {...base,title:`Round ${w.series.round} over`,detail:`${w.series.replay?'Both fleets sank · replaying the round.':w.teams[w.series.roundWinner].name+' take the round.'} Next round in ${Math.ceil(w.series.nextIn)}s.`,status:'BEST OF THREE'};
 if(s.eliminated)return {...base,title:'Sunk for good · spectating',detail:'Your crewmates can still win this round.',status:'OUT'};
 if(s.dead)return {...base,goal:home,title:`Rebuilding · ${Math.ceil(s.dead)}s`,detail:'Your fort’s core is alive, so you respawn at home.',status:'RESPAWNING'};
 if(s.whirl>=0)return {...base,title:'Caught in the whirlpool!',detail:'Hold Boost to fight the current next time.',status:'TRAPPED'};
 const boarder=w.ships.find(p=>p.attack>0);if(boarder)return {...base,goal:boarder,label:boarder.team===s.team?'BOARDING ALLY':'ENEMY BOARDER',title:boarder.team===s.team?`Cover the boarding · ${boarder.attack.toFixed(1)}/${BOARD_SECONDS}s`:`STOP THEM · ${boarder.attack.toFixed(1)}/${BOARD_SECONDS}s`,detail:boarder.team===s.team?'Keep enemies off your crewmate until the ring fills.':'Shoot the boarding ship. Every hit knocks a second off.',status:'BOARDING'};
 if(w.overtime.active)return {...base,goal:w.nodes[2],label:'CENTER BEACON',title:`Hold the center · ${w.overtime.progress[s.team].toFixed(0)}/${hold}s`,detail:w.overtime.finalWater>0?'The storm is closing in. Stay inside the safe ring.':`Sit in the center ring with no enemies inside for ${hold}s to win.`,status:w.overtime.contested?'CONTESTED':'OVERTIME'};
 if(s.hp<s.maxHp*.35)return {...base,goal:home,label:'HOME DOCK',title:'Low hull · sail home',detail:'Your home water repairs you fast.',status:'LOW HULL'};
 if(home.core<=0)return {...base,title:'Your core is gone · last life',detail:'No more respawns. Sink their fleet or win the beacon.',status:'LAST LIFE'};
 if(home.alarmUntil>w.t&&Math.hypot(s.x-home.x,s.z-home.z)<Math.hypot(s.x-enemy.x,s.z-enemy.z))return {...base,goal:home,label:'YOUR FORT',title:'Raiders at your fort!',detail:'Head home and sink them.',status:'DEFEND'};
 if(openingProtected(w)?(s.cargo.relics||s.cargo.pearls>=3||cargoCount(s)>=capacity(s)*.65):cargoCount(s)>=capacity(s))return {...base,goal:home,label:'BANK AT HOME',title:'Sail home to bank',detail:'Reach your dock to bank treasure and get upgrades. Sinking drops it.',status:'TREASURE ABOARD'};
 if(openingProtected(w)){const node=w.nodes[0];return {...base,goal:node,label:node.name.toUpperCase(),title:'Grab treasure',detail:`Forts are shielded for ${Math.ceil(w.defense.endsAt-w.t)}s. Collect pearls, then bank them at home.`,status:'GEAR UP'};}
 if(enemy.core<=0)return {...base,goal:w.ships.find(p=>p.team!==s.team&&!p.dead)||enemy,label:'LAST RIVALS',title:'Sink their last ships!',detail:'Their core is gone, so they can’t respawn.',status:'FINAL HUNT'};
 const layer=layerFor(enemy);if(layer==='shield')return {...base,title:'Step 1 · Shoot their shield',detail:`${Math.ceil(enemy.shieldHP)} shield left. Point at the dome and fire.`,status:'RAID'};
 if(layer==='turrets'){const left=enemy.turrets.filter(t=>t.hp>0).length;return {...base,goal:structureTargets(w,s.team)[0],label:'ENEMY TURRET',title:`Step 2 · Sink ${left} turret${left>1?'s':''}`,detail:'Point at a tower and fire. They shoot back!',status:'RAID'};}
 return {...base,phase:3,label:'ENEMY CORE',title:s.attack>0?`Boarding · ${(BOARD_SECONDS-s.attack).toFixed(1)}s`:`Step 3 · Board their core`,detail:`Sail slowly into the glowing ring for ${BOARD_SECONDS}s. Hits knock you back a second.`,status:s.attack>0?'BOARDING':'CORE OPEN'};
}
