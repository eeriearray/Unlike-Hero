// All treasure is host-authoritative. The sea holds bounded piles, not one object per coin.
// Round clock (seconds): treasure speeds up, then the Crownfall beacon opens, then the safe sea closes.
export const OVERTIME={faster:120,warn:150,beacon:180,final:225};
export const RESOURCES={gold:{name:'Gold',color:'#ffd16a'},pearls:{name:'Pearls',color:'#8de9df'},relics:{name:'Relics',color:'#c6a1ff'}};
export const cargoCount=s=>Object.values(s.cargo||{}).reduce((a,b)=>a+b,0);
export const capacity=s=>16+(s.holdLevel||0)*12;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function addLoot(w,x,z,kind,amount,ttl=45){if(amount<=0)return;const pile=w.loot.find(p=>p.kind===kind&&distance(p,{x,z})<6);if(pile){pile.amount=Math.min(99,pile.amount+amount);pile.ttl=Math.max(pile.ttl,ttl);return;}if(w.loot.length>=36)w.loot.shift();w.loot.push({id:++w.lootSeq,x,z,kind,amount,ttl});}
export function dropCargo(w,s,emit){if(!w.loot)return;const lost=cargoCount(s);for(const [kind,n]of Object.entries(s.cargo))addLoot(w,s.x,s.z,kind,n,50);s.cargo={gold:0,pearls:0,relics:0};if(lost)emit(w,'loottoss',s.id,null,{amount:lost});}
export function setupEconomy(w){w.loot=[];w.lootSeq=0;w.fields=[];w.nodes=[{id:'tideglass',name:'Tideglass Mine',x:0,z:74,kind:'pearls',amount:4,period:10,next:3},{id:'verdant',name:'Verdant Grotto',x:0,z:-74,kind:'pearls',amount:4,period:10,next:3},{id:'temple',name:'Crownfall Temple',x:0,z:0,kind:'relics',amount:2,period:16,next:6}];w.overtime={active:false,progress:[0,0],target:12,warned:false};for(const t of w.teams){t.bank={pearls:0,relics:0};t.alarmUntil=0;t.alarmCooldown=0;}for(const s of w.ships){s.cargo={gold:0,pearls:0,relics:0};s.holdLevel=0;s.tool=null;s.toolCharges=0;s.toolCooldown=0;s.ccImmune=0;}}
export function tickEconomy(w,dt,emit){const elapsed=w.t-w.roundStartedAt,fast=elapsed>=OVERTIME.faster?.65:1;
 for(const node of w.nodes){node.next-=dt;if(node.next<=0){node.next+=node.period*fast;addLoot(w,node.x,node.z,node.kind,node.amount,35);emit(w,'treasurespawn',null,node.id,{kind:node.kind,x:node.x,z:node.z});}}
 w.income+=dt;if(w.income>=3){w.income-=3;for(const t of w.teams)addLoot(w,t.x+(t.id?17:-17),0,'gold',2+t.forgeLevel,15);}
 for(const p of w.loot)p.ttl-=dt;w.loot=w.loot.filter(p=>p.ttl>0&&p.amount>0);
 for(const field of w.fields)field.ttl-=dt;w.fields=w.fields.filter(f=>f.ttl>0);
 for(const p of w.loot){const candidates=w.ships.filter(s=>!s.dead&&!s.eliminated&&s.whirl<0&&distance(s,p)<=7&&cargoCount(s)<capacity(s)).sort((a,b)=>distance(a,p)-distance(b,p)||((a.team+p.id+w.series.round)%2)-((b.team+p.id+w.series.round)%2)||a.id.localeCompare(b.id));for(const s of candidates){const n=Math.min(p.amount,capacity(s)-cargoCount(s));if(n<=0)break;s.cargo[p.kind]+=n;p.amount-=n;emit(w,'collect',s.id,null,{kind:p.kind,amount:n});}}
 for(const s of w.ships){s.toolCooldown=Math.max(0,s.toolCooldown-dt);s.ccImmune=Math.max(0,s.ccImmune-dt);if(s.dead||s.eliminated||s.whirl>=0)continue;
  const home=w.teams[s.team];if(distance(s,home)<24&&cargoCount(s)>0){const haul={...s.cargo};s.coins=Math.min(999,s.coins+haul.gold);home.bank.pearls=Math.min(99,home.bank.pearls+haul.pearls);home.bank.relics=Math.min(99,home.bank.relics+haul.relics);s.cargo={gold:0,pearls:0,relics:0};emit(w,'bank',s.id,null,{...haul});}
 }
 w.loot=w.loot.filter(p=>p.amount>0);
 const temple=w.nodes[2];w.forge={x:0,z:0,height:0,bank:w.loot.filter(p=>p.kind==='relics'&&distance(p,temple)<15).reduce((n,p)=>n+p.amount,0),timer:temple.period-temple.next,contested:new Set(w.ships.filter(s=>!s.dead&&distance(s,temple)<18).map(s=>s.team)).size>1};
 if(elapsed>=OVERTIME.warn&&!w.overtime.warned){w.overtime.warned=true;emit(w,'overtimewarning',null,null);}
 if(elapsed>=OVERTIME.final-15&&!w.overtime.finalWarned){w.overtime.finalWarned=true;emit(w,'finalwarning',null);}
 if(elapsed>=OVERTIME.final&&!w.overtime.finalAnnounced){w.overtime.finalAnnounced=true;emit(w,'finalwater',null);}
 if(elapsed>=OVERTIME.beacon&&!w.overtime.active){w.overtime.active=true;w.sudden=true;emit(w,'sudden',null);}
}
export function useTool(w,s,emit){if(!s.toolCharges||s.toolCooldown>0||s.dead||s.eliminated)return false;
 if(s.tool==='repair'){if(w.t-s.lastHitAt<3||s.hp>=s.maxHp)return false;s.hp=Math.min(s.maxHp,s.hp+40);s.burn=0;}
 else if(s.tool==='smoke'||s.tool==='decoy'){if(w.fields.length>=12)return false;w.fields.push({id:++w.lootSeq,kind:s.tool,x:s.x,z:s.z,team:s.team,ttl:s.tool==='smoke'?5:6});}else return false;
 s.toolCharges--;s.toolCooldown=8;emit(w,'tool',s.id,s.tool);return true;
}
export function inSmoke(w,s){return w.fields?.some(f=>f.kind==='smoke'&&distance(s,f)<11);}
export function overtimeTick(w,dt,emit,award){if(!w.overtime.active)return;const occupants=w.ships.filter(s=>!s.dead&&!s.eliminated&&s.whirl<0&&distance(s,w.nodes[2])<20),teams=[...new Set(occupants.map(s=>s.team))];w.overtime.contested=teams.length>1;
 if(teams.length===1){const id=teams[0];w.overtime.progress[id]+=dt;w.overtime.progress[1-id]=Math.max(0,w.overtime.progress[1-id]-dt*2);if(w.overtime.progress[id]>=w.overtime.target)award(w,id,emit,'Held the Crownfall beacon');}
 // At 5:00 the same marked ring becomes final water: rebuilding stops and the
 // outer sea deals gradual, visible damage. A surviving crew still has to act.
 w.overtime.finalWater=Math.max(0,elapsedFinal(w));
}
function elapsedFinal(w){return w.t-w.roundStartedAt-OVERTIME.final;}
