export const PARTS={
 balanced:{name:'Corsair keel',perk:'Steady handling · no weaknesses',speed:1,damageTaken:1,ram:1},
 swift:{name:'Racing rig',perk:'+14% speed · take 15% more damage',speed:1.14,damageTaken:1.15,ram:1},
 armor:{name:'Iron plating',perk:'18% less damage · 10% slower',speed:.9,damageTaken:.82,ram:1},
 ram:{name:'Boarding prow',perk:'+40% ram damage · 6% slower',speed:.94,damageTaken:1,ram:1.4}
};
export const WEAPONS={
 ball:{name:'Ball',damage:14,reload:.55,color:'#f7dfac',perk:'Unlimited · steady 14 damage'},
 fire:{name:'Fireball',damage:8,reload:1.15,color:'#ff843c',perk:'8 impact + 8 burn · ignites nearby enemies · home extinguishes'},
 sticky:{name:'Sticky',damage:6,reload:1.3,color:'#9ee879',perk:'6 damage · slow movement for 3s · Boost clears it'},
 chain:{name:'Chain',damage:8,reload:.95,color:'#b8daee',perk:'8 damage · slow for 1.8s'},
 heavy:{name:'Heavy',damage:24,reload:1.4,color:'#cfadff',perk:'24 damage · long reload'},
 shock:{name:'Storm',damage:10,reload:1.25,color:'#6fe4ff',perk:'10 damage · jams cannons for 1.2s'}
};
export const PAINTS=['#df9c4c','#be514b','#3d9c9b','#6654a0','#437a50','#334c75','#d6cab2','#403d44'];
export const SAILS={ivory:'#fff4d4',crimson:'#e7a49a',ocean:'#b1dce7',night:'#a4a0ba'};
export function normalizeLoadout(value={}){const v=value&&typeof value==='object'?value:{};const part=Object.hasOwn(PARTS,v.part)?v.part:'balanced',paint=PAINTS.includes(v.paint)?v.paint:PAINTS[0],sail=Object.hasOwn(SAILS,v.sail)?v.sail:'ivory';let special=Object.hasOwn(WEAPONS,v.special)&&v.special!=='ball'?v.special:'fire',utility=Object.hasOwn(WEAPONS,v.utility)&&v.utility!=='ball'?v.utility:'sticky';if(utility===special)utility=special==='heavy'?'sticky':'heavy';return {part,paint,sail,special,utility};}
export function allied(a,b){return a?.team!==undefined&&a.team===b?.team;}
export function weaponFor(s,slot){return WEAPONS[s.weapons?.[slot-1]]||WEAPONS[['ball','chain','heavy'][slot-1]]||WEAPONS.ball;}
export function weaponId(s,slot){return s.weapons?.[slot-1]||['ball','chain','heavy'][slot-1]||'ball';}
export const SHOP={
 repair:{name:'Repair kit',description:'Equip 1 kit: +40 hull, extinguish; use after 3s without damage',tool:'repair',cost:8,category:'supplies'},
 ammo:{name:'Special ammunition',description:'+4 rounds to both equipped specials',cost:8,category:'supplies'},
 power:{name:'Cannon power',description:'+10% impact damage per level',cost:18,max:3,key:'power',category:'ship'},
 sails:{name:'Racing canvas',description:'+8% speed; +4% incoming damage per level',cost:16,max:3,key:'sailLevel',category:'ship'},
 hull:{name:'Reinforced hull',description:'+20 maximum and current hull; 3% slower per level',cost:22,max:3,key:'hullLevel',category:'ship'},
 plating:{name:'Armor plates',description:'6% less damage per level',cost:24,max:3,key:'platingLevel',category:'ship'},
 rudder:{name:'Precision rudder',description:'+8% turn response and +10% braking response per level',cost:14,max:2,key:'rudderLevel',category:'ship'},
 loader:{name:'Quick loader',description:'8% shorter reload per level',cost:22,max:2,key:'loaderLevel',category:'ship'},
 boost:{name:'Boost engine',description:'0.5s less cooldown; longer burst',cost:20,max:2,key:'boostLevel',category:'ship'},
 siege:{name:'Siege barrels',description:'+30% structure damage; 12% longer reload per level',cost:24,max:3,key:'siegeLevel',category:'ship'},
 ram:{name:'Ram bracing',description:'+15% ram damage per level',cost:18,max:2,key:'ramLevel',category:'ship'},
 magazine:{name:'Ammo racks',description:'+3 special capacity; +2 rebuild ammo',cost:14,max:2,key:'magazineLevel',category:'ship'},
 fireproof:{name:'Fireproof coating',description:'30% less burn damage per level',cost:16,max:2,key:'fireproofLevel',category:'ship'},
 hold:{name:'Expanded hold',description:'+12 cargo capacity per level; loaded treasure visible on deck',cost:16,max:2,key:'holdLevel',category:'ship'},
 smoke:{name:'Smoke barrel',description:'Equip 1: conceal an 11m ring for 5s; blocks aim assist, not cannonballs',cost:2,currency:'relics',tool:'smoke',category:'supplies'},
 decoy:{name:'Decoy buoy',description:'Equip 1: distract nearby automated turrets for 6s; can be shot down',cost:2,currency:'relics',tool:'decoy',category:'supplies'},
 regen:{name:'Repair crew',description:'+0.8 hull/s after 8s without damage',cost:24,max:2,key:'regenLevel',category:'ship'},
 shield:{name:'Shield reinforcement',description:'+40 shield capacity and health; cannot revive',cost:5,currency:'pearls',max:3,key:'shieldLevel',team:true,category:'fortress'},
 turretArmor:{name:'Turret armor',description:'+25 hull to each surviving turret',cost:4,currency:'pearls',max:3,key:'turretArmor',team:true,category:'fortress'},
 turretPower:{name:'Turret cannons',description:'+15% sentry damage per level',cost:5,currency:'pearls',max:2,key:'turretPower',team:true,category:'fortress'},
 turretRepair:{name:'Repair sentries',description:'+35 hull to surviving turrets only',cost:3,currency:'pearls',category:'fortress'},
 dockRepair:{name:'Dock medics',description:'+2 hull/s healing in home water',cost:4,currency:'pearls',max:2,key:'healLevel',team:true,category:'fortress'},
 rebuild:{name:'Rebuild workshop',description:'0.75s faster rebuild per level',cost:5,currency:'pearls',max:2,key:'rebuildLevel',team:true,category:'fortress'},
 forge:{name:'Gold refinery',description:'+1 gold at home generator / 3s',cost:6,currency:'pearls',max:2,key:'forgeLevel',team:true,category:'fortress'}
};
