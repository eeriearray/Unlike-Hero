import {OPENING_SECONDS,openingProtected,updateDefenses,layerFor,structureTargets} from './defenses.js';
import {normalizeLoadout,PARTS,allied,SHOP} from './loadout.js';
import {setupEconomy,tickEconomy,cargoCount,useTool,overtimeTick} from './economy.js';
import {RAID_ISLANDS,RAID_WHIRLPOOLS,raidHeightAt} from './raid-map.js';
export const TEAM_COLORS=['#ffc75b','#67d9ef'];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function teamOptions(value={}){value=value&&typeof value==='object'?value:{};return {size:[1,2,3].includes(+value.size)?+value.size:2,mode:'core'};}
export function configureTeams(w,captains,options){const config=teamOptions(options);w.rules='core';w.teamSize=config.size;w.duration=240;w.roundStartedAt=w.t;w.remaining=240;w.sudden=false;w.income=0;w.defense={endsAt:w.t+OPENING_SECONDS,active:true,remaining:OPENING_SECONDS,count:0};
 w.series??={round:1,wins:[0,0],target:2,max:3,phase:'live',nextIn:0,results:[]};w.series.phase='live';w.series.nextIn=0;
 w.teams=[0,1].map(id=>{const x=id?-118:118,shield=160+(config.size-1)*60,turretHull=80+(config.size-1)*25;return {id,name:id?'Moon Raiders':'Sun Corsairs',color:TEAM_COLORS[id],x,z:0,height:0,core:100,maxCore:100,shieldHP:shield,maxShield:shield,shieldLevel:0,shieldBrokenAt:-1,turretArmor:0,turretPower:0,healLevel:0,rebuildLevel:0,forgeLevel:0,turrets:[0,1].map(index=>({id:`sentry-${id}-${index}`,index,x:x+(id?5:-5),z:index?10:-10,hp:turretHull,maxHp:turretHull,cooldown:.5+index*.8,aim:id?Math.PI/2:-Math.PI/2,firedAt:-10,destroyedAt:-1}))};});
 w.ships=w.ships.filter(s=>!s.raider).slice(0,config.size*2);
 for(const [i,s]of w.ships.entries()){const p=captains[i],team=i%2,slot=Math.floor(i/2),loadout=normalizeLoadout(p.loadout),stats=PARTS[loadout.part];Object.assign(s,{name:p.name||s.name,ai:!!p.ai,team,teamColor:TEAM_COLORS[team],loadout,color:loadout.paint,weapons:['ball',loadout.special,loadout.utility],speed:stats.speed,damageTaken:stats.damageTaken,ramPower:stats.ram,coins:12,power:0,sailLevel:0,kills:0,hullLevel:0,platingLevel:0,rudderLevel:0,loaderLevel:0,boostLevel:0,siegeLevel:0,ramLevel:0,magazineLevel:0,fireproofLevel:0,regenLevel:0,maxHp:100,ammoCap:12,lastHitAt:-10,burn:0,sticky:0,jam:0,slow:0,attack:0,eliminated:false,spawnX:team?-105:105,spawnZ:(slot-(config.size-1)/2)*6,buoyA:team?Math.PI:0,ammo:[999,6,6],v:0,slip:0,rudder:0,yawRate:0,drag:0,whirl:-1,swirlRadius:0,bump:0,ramStrike:0,recoil:0,hp:100,dead:0,capture:0,fire:0,ram:0,boost:0,dash:0,shield:2,buyCooldown:0,motion:0,retreat:false,command:null,commandAt:-10,movementInput:false});s.x=s.spawnX;s.z=s.spawnZ;s.height=raidHeightAt(s.x,s.z);s.a=team?Math.PI/2:-Math.PI/2;}
 w.flag={x:0,z:0,carrier:null,dropped:0,returnAt:999999};w.forge={x:0,z:0,height:5,bank:8,timer:0,contested:false};w.shots=[];w.islands=RAID_ISLANDS;w.whirl=RAID_WHIRLPOOLS.map(p=>({...p}));w.pickups=[{x:72,z:-24,kind:'ammo'},{x:-72,z:24,kind:'ammo'},{x:72,z:24,kind:'repair'},{x:-72,z:-24,kind:'repair'},{x:0,z:76,kind:'gold'},{x:0,z:-76,kind:'gold'}].map(p=>({...p,homeX:p.x,homeZ:p.z,cooldown:0}));setupEconomy(w);return w;
}
export function teamAI(w,s){const enemy=w.teams[1-s.team],home=w.teams[s.team],friends=w.ships.filter(p=>p.team===s.team),slot=friends.indexOf(s),dock={x:home.x+(home.id?16:-16),z:0,repair:true};
 const rivals=w.ships.filter(p=>!allied(p,s)&&!p.dead&&!p.eliminated),threat=rivals.sort((a,b)=>dist(a,home)-dist(b,home))[0];
 if(w.overtime.active){const rival=rivals.find(p=>dist(p,w.nodes[2])<28);if(rival&&dist(s,w.nodes[2])<23)return {...rival,skirmish:true};return {...w.nodes[2],opening:true};}
 if(s.hp<s.maxHp*.38)s.retreat=true;if(s.hp>s.maxHp*.82)s.retreat=false;if(s.retreat&&home.core>0)return dock;
 if(!openingProtected(w)&&layerFor(enemy)==='core'&&dist(s,enemy)<55)return {x:enemy.x+(enemy.id?10:-10),z:0,attack:true};
 if(cargoCount(s)>=(s.holdLevel?24:14)||s.cargo.relics>=4||(s.cargo.relics>0&&(openingProtected(w)||slot===1))||s.cargo.pearls>=4)return dock;
 if(threat&&dist(threat,home)<47&&(slot===1||threat.attack>0||w.teamSize===1))return {...threat,skirmish:true};
 const call=friends.find(p=>p!==s&&p.command&&w.t-p.commandAt<8);if(call?.command==='help'){const pursuer=rivals.find(p=>dist(p,call)<45);if(pursuer)return {...pursuer,skirmish:true};return {x:call.x+(s.team?-12:12),z:call.z,opening:true};}if(call?.command==='defend'&&threat&&dist(threat,home)<70)return {...threat,skirmish:true};
 const boarding=friends.find(p=>p!==s&&p.attack>0);if(boarding){const attacker=rivals.sort((a,b)=>dist(a,boarding)-dist(b,boarding))[0];return attacker?{...attacker,skirmish:true}:{x:boarding.x+18,z:boarding.z,opening:true};}
 if(enemy.core<=0)return {...(rivals[0]||enemy),skirmish:true};
 const gather=openingProtected(w)||(s.power<1&&s.coins<18)||(slot===1&&s.power<2&&w.t%40<18);
 if(gather){const pickups=w.loot.filter(p=>dist(p,home)>25),preferred=pickups.filter(p=>p.kind===(slot%2?'pearls':'relics'));
 const target=(preferred.length?preferred:pickups).sort((a,b)=>dist(a,s)-dist(b,s))[0];if(target)return {...target,opening:true};
 if(s.coins>=18&&s.power<2)return dock;return {...w.nodes[slot%2?(s.team?1:0):2],opening:true};}
 const target=structureTargets(w,s.team)[0];if(target){if(Math.abs(s.z)>6&&dist(s,enemy)>32)return {x:enemy.x+(enemy.id?38:-38),z:0,opening:true};return {...target,siege:true};}
 return {x:enemy.x+(enemy.id?10:-10),z:0,attack:true};
}
export function upgradeInfo(w,s,item){if(!Object.hasOwn(SHOP,item))return null;const def=SHOP[item],home=w.teams[s.team],holder=def.team?home:s,level=def.key?(holder[def.key]||0):0,cost=def.cost*(def.max?level+1:1),currency=def.currency||'gold',balance=currency==='gold'?s.coins:home.bank[currency];let reason='';
 if(s.dead||s.eliminated||w.series.phase!=='live')reason='Ship unavailable';else if(dist(s,home)>24)reason='Return to your dock';else if(def.max&&level>=def.max)reason='Fully upgraded';else if(def.tool&&s.toolCharges>0&&s.tool!==def.tool)reason='Use your equipped tool first';else if(def.tool&&s.toolCharges>=2)reason='Tool rack full (2)';else if(item==='ammo'&&s.ammo[1]>=s.ammoCap&&s.ammo[2]>=s.ammoCap)reason='Racks full';else if(item==='shield'&&home.shieldHP<=0)reason='Shield destroyed this round';else if(['turretArmor','turretPower'].includes(item)&&!home.turrets.some(t=>t.hp>0))reason='Turrets destroyed';else if(item==='turretRepair'&&!home.turrets.some(t=>t.hp>0&&t.hp<t.maxHp))reason='No surviving damaged turret';else if(balance<cost)reason=`Need ${cost-balance} more ${currency}`;
 return {def,level,cost,currency,balance,reason};}
export function buyUpgrade(w,s,item,emit){const info=typeof item==='string'?upgradeInfo(w,s,item):null;if(!info||info.reason||s.buyCooldown>0){if(info?.reason&&!s.ai)emit(w,'purchasefailed',s.id,item,{reason:info.reason});return false;}const {def,cost,currency}=info,home=w.teams[s.team];if(def.key){const holder=def.team?home:s;holder[def.key]=(holder[def.key]||0)+1;}
 if(def.tool){s.tool=def.tool;s.toolCharges++;}
 if(item==='ammo'){s.ammo[1]=Math.min(s.ammoCap,s.ammo[1]+4);s.ammo[2]=Math.min(s.ammoCap,s.ammo[2]+4);}
 if(item==='hull'){s.maxHp+=20;s.hp+=20;}if(item==='plating')s.damageTaken=PARTS[s.loadout.part].damageTaken*(1-s.platingLevel*.06);if(item==='ram')s.ramPower=PARTS[s.loadout.part].ram*(1+s.ramLevel*.15);if(item==='magazine')s.ammoCap=12+s.magazineLevel*3;
 if(item==='shield'){home.maxShield+=40;home.shieldHP+=40;}if(item==='turretArmor')for(const t of home.turrets)if(t.hp>0){t.maxHp+=25;t.hp+=25;}if(item==='turretRepair')for(const t of home.turrets)if(t.hp>0)t.hp=Math.min(t.maxHp,t.hp+35);
 if(currency==='gold')s.coins-=cost;else home.bank[currency]-=cost;s.buyCooldown=.35;emit(w,'purchase',s.id,item);return true;
}
export function damageCore(w,team,amount,by,emit,moored=false){if(!moored||team.core<=0||openingProtected(w)||layerFor(team)!=='core')return false;team.core=0;team.coreBrokenAt=w.t;w.firstBreach??=1-team.id;for(const s of w.ships)if(s.team===team.id&&s.dead)s.eliminated=true;emit(w,'corebroken',by,team.id);return true;}
export function teamTick(w,inputs,dt,hurt,emit){w.remaining=Math.max(0,w.duration-(w.t-w.roundStartedAt));updateDefenses(w,dt,emit);tickEconomy(w,dt,emit);
 for(const s of w.ships){s.buyCooldown=Math.max(0,(s.buyCooldown||0)-dt);if(inputs[s.id]?.buy)buyUpgrade(w,s,inputs[s.id].buy,emit);if(inputs[s.id]?.utility)useTool(w,s,emit);if(['attack','defend','help','return'].includes(inputs[s.id]?.command)&&w.t-(s.commandAt||-10)>3){s.command=inputs[s.id].command;s.commandAt=w.t;emit(w,'command',s.id,s.command);}if(w.overtime.finalWater>0&&s.dead)s.eliminated=true;if(s.dead||s.eliminated)continue;const home=w.teams[s.team];
  if(dist(s,home)<24&&home.core>0){s.hp=Math.min(s.maxHp,s.hp+(3+home.healLevel*2)*dt);s.burn=0;}else if(s.regenLevel&&w.t-s.lastHitAt>8&&s.burn<=0)s.hp=Math.min(s.maxHp,s.hp+s.regenLevel*.8*dt);
  if(s.burn>0){const elapsed=Math.min(dt,s.burn);s.burn=Math.max(0,s.burn-dt);hurt(w,s,2*elapsed*(1-s.fireproofLevel*.3),s.burnBy,'burn');}s.sticky=Math.max(0,s.sticky-dt);s.jam=Math.max(0,s.jam-dt);if(inputs[s.id]?.boost&&s.boost<=0){s.sticky=0;s.slow=0;s.ccImmune=2;}
  if(s.ai&&s.toolCharges&&((s.tool==='repair'&&s.hp<s.maxHp*.65)||(s.tool==='smoke'&&s.retreat)||(s.tool==='decoy'&&dist(s,w.teams[1-s.team])<48)))useTool(w,s,emit);
  if(w.overtime.finalWater>0&&dist(s,w.nodes[2])>Math.max(22,100-w.overtime.finalWater*1.3)){hurt(w,s,8*dt,'sea','storm');}
  const intruder=w.ships.find(p=>p.team!==home.id&&!p.dead&&dist(p,home)<40);if(intruder){home.alarmUntil=w.t+2;if(w.t>=home.alarmCooldown){home.alarmCooldown=w.t+12;emit(w,'alarm',intruder.id,home.id);}}
  if(s.ai&&dist(s,home)<24){if(s.ammo[1]<2)buyUpgrade(w,s,'ammo',emit);else if(s.power<2)buyUpgrade(w,s,'power',emit);else if(s.siegeLevel<2)buyUpgrade(w,s,'siege',emit);else if(s.hullLevel<2)buyUpgrade(w,s,'hull',emit);if(home.bank.pearls>=6)buyUpgrade(w,s,home.forgeLevel<1?'forge':'turretPower',emit);if(home.bank.relics>=2&&!s.toolCharges)buyUpgrade(w,s,s.power>=1?'decoy':'smoke',emit);}
 }
}
export function awardRound(w,team,emit,reason='Fleet eliminated'){if(w.series.phase!=='live'||w.over)return;w.series.wins[team]++;w.series.results.push({round:w.series.round,team,reason});w.series.roundWinner=team;w.shots=[];emit(w,'roundwin',null,team,{round:w.series.round,reason});if(w.series.wins[team]>=2){w.over=true;w.winnerTeam=team;w.winner=w.ships.find(s=>s.team===team).id;w.series.phase='complete';emit(w,'victory',w.winner);}else{w.series.phase='intermission';w.series.nextIn=8;}}
export function advanceSeries(w,dt,emit){if(w.series.phase!=='intermission')return false;w.series.nextIn=Math.max(0,w.series.nextIn-dt);if(w.series.nextIn<=0){const players=w.ships.map(({id,name,ai,loadout})=>({id,name,ai,loadout}));if(!w.series.replay)w.series.round++;w.series.replay=false;delete w.firstBreach;configureTeams(w,players,{size:w.teamSize});emit(w,'roundstart',null,w.series.round);}return true;}
export function teamAfter(w,dt,emit){
 for(const s of w.ships){const enemy=w.teams[1-s.team],stationary=Math.abs(s.v)<.3&&Math.abs(s.slip)<.2&&Math.abs(s.yawRate)<.08&&(s.motion||0)<.4;
  if(!s.dead&&!s.eliminated&&s.whirl<0&&!openingProtected(w)&&s.shield<=0&&layerFor(enemy)==='core'&&dist(s,enemy)<14&&stationary&&s.burn<=0&&s.dash<=0&&w.t-s.lastHitAt>dt*1.1&&!s.movementInput){if(!s.attack)emit(w,'boarding',s.id,enemy.id);s.attack+=dt;if(s.attack>=5-1e-7){s.attack=0;damageCore(w,enemy,100,s.id,emit,true);}}else s.attack=0;
 }
 const winners=w.teams.filter(team=>(w.teams[1-team.id].core<=0||w.overtime.finalWater>0)&&w.ships.filter(s=>s.team!==team.id).every(s=>s.dead||s.eliminated));if(winners.length===2){w.series.phase='intermission';w.series.nextIn=8;w.series.replay=true;w.series.roundWinner=null;w.shots=[];emit(w,'rounddraw',null,null);return;}if(winners.length){awardRound(w,winners[0].id,emit);return;}
 overtimeTick(w,dt,emit,awardRound);
}
