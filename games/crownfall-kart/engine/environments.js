(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CrownEnvironments=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Profiles are presentation-only. Track IDs are the stable join key; physics never reads these values.
  const profiles=[
    {id:'shattered-crown',title:'Crown Skybridge',identity:'Gothic citadels above a moonlit abyss',architecture:'castles',terrain:'slate',border:'gothic',trees:0,seed:101,
      sky:{zenith:'#070f2e',horizon:'#626a91',ground:'#080d20',sun:[-.5,.42,-.75],disc:12,stars:1,moon:.035,clouds:.58},
      light:{color:'#c3d4ff',intensity:1.4,ambient:'#8096c4',ground:'#252838',fill:.5,exposure:1.08},
      surface:{color:'#969baa',roughness:.78,metalness:.02,normal:.65},rock:'#566077',accent:'#a9bfff',foliage:'#405561',
      atmosphere:{color:'#61729b',density:.007,height:18,falloff:.035,grade:[.9,.98,1.13],contrast:1.1,saturation:.82,bloom:.23,rays:.05,wet:0},weather:{type:'mist',count:180,wind:[1.5,.5],size:3.5,speed:.12}},
    {id:'ember-keep',title:'Ember Keep',identity:'Sunset fortress in an ember-filled red-rock desert',architecture:'fortress',terrain:'sandstone',border:'sandstone',trees:0,seed:211,
      sky:{asset:'golden-hour.hdr',zenith:'#597a9b',horizon:'#ffae64',ground:'#51342b',sun:[-.65,.24,-.7],disc:32,stars:0,moon:0,clouds:.32},
      light:{color:'#ffbd76',intensity:3.5,ambient:'#b8c3ce',ground:'#77513b',fill:.42,exposure:.92},
      surface:{color:'#b4aaa0',roughness:.98,metalness:0,normal:.7},rock:'#bd8763',accent:'#ffad54',foliage:'#74714b',
      atmosphere:{color:'#b99069',density:.003,height:5,falloff:.018,grade:[1.08,1,.88],contrast:1.04,saturation:1.05,bloom:.25,rays:.55,wet:0},weather:{type:'embers',secondary:'dust',count:220,wind:[2.5,1],size:.1,speed:1.1}},
    {id:'moonveil',title:'Moonveil Ruins',identity:'Silver ruins in a deep blue moonlit valley',architecture:'ruins',terrain:'limestone',border:'gothic',trees:.65,seed:307,
      sky:{zenith:'#050b22',horizon:'#324f70',ground:'#101b2c',sun:[.55,.6,-.55],disc:9,stars:.9,moon:.055,clouds:.23},
      light:{color:'#b4dcff',intensity:1.65,ambient:'#6994b2',ground:'#202c3e',fill:.42,exposure:1.15},
      surface:{color:'#8c9fac',roughness:.58,metalness:.04,normal:.4},rock:'#a0a9ae',accent:'#76d8ff',foliage:'#344b55',
      atmosphere:{color:'#527b91',density:.01,height:20,falloff:.045,grade:[.83,.98,1.16],contrast:1.12,saturation:.76,bloom:.25,rays:.08,wet:.15},weather:{type:'mist',count:240,wind:[-.8,.5],size:4.5,speed:.08}},
    {id:'void-cathedral',title:'Void Cathedral',identity:'Black spires beneath an eclipsed violet sky',architecture:'cathedral',terrain:'obsidian',border:'gothic',trees:0,seed:409,
      sky:{zenith:'#10091f',horizon:'#5d3d68',ground:'#120d1b',sun:[-.3,.34,.9],disc:16,stars:.55,moon:.075,eclipse:true,clouds:.45},
      light:{color:'#ddbcff',intensity:1.55,ambient:'#8d79aa',ground:'#231c2c',fill:.4,exposure:1.1},
      surface:{color:'#85788c',roughness:.42,metalness:.15,normal:.35},rock:'#302c3b',accent:'#ce7bff',foliage:'#3f3549',
      atmosphere:{color:'#70517d',density:.005,height:35,falloff:.022,grade:[1.03,.87,1.14],contrast:1.16,saturation:.86,bloom:.32,rays:.16,wet:0},weather:{type:'ash',count:220,wind:[-.7,1.7],size:.08,speed:.5}},
    {id:'frostgrave',title:'Frostgrave Pass',identity:'Snow-covered alpine peaks under a green aurora',architecture:'alpine',terrain:'snow',border:'ice',trees:1,seed:503,
      sky:{zenith:'#0d2644',horizon:'#96bed0',ground:'#4a6578',sun:[.6,.28,.7],disc:14,stars:.35,moon:.025,aurora:true,clouds:.3},
      light:{color:'#c5eaff',intensity:2.2,ambient:'#bfdbed',ground:'#7995ad',fill:.55,exposure:.94},
      surface:{color:'#aebfc8',roughness:.43,metalness:.02,normal:.24},rock:'#e6eff1',accent:'#92edff',foliage:'#739494',
      atmosphere:{color:'#b0cbd8',density:.004,height:15,falloff:.018,grade:[.91,1,1.1],contrast:1.06,saturation:.8,bloom:.17,rays:.14,wet:.22},weather:{type:'snow',count:720,wind:[-2.2,.6],size:.09,speed:1.4}},
    {id:'bloodroot',title:'Bloodroot Fen',identity:'Ancient forest silhouettes in a copper swamp dusk',architecture:'forest',terrain:'moss',border:'timber',trees:1.35,seed:607,
      sky:{zenith:'#29382d',horizon:'#c89b70',ground:'#222d25',sun:[-.8,.17,.45],disc:18,stars:0,moon:0,clouds:.75},
      light:{color:'#f9c08a',intensity:1.8,ambient:'#9eac8b',ground:'#35412b',fill:.5,exposure:1.04},
      surface:{color:'#95977f',roughness:.62,metalness:0,normal:.9},rock:'#596348',accent:'#c9d585',foliage:'#3e593a',
      atmosphere:{color:'#77866a',density:.012,height:12,falloff:.06,grade:[1.03,1.04,.86],contrast:1.05,saturation:.9,bloom:.2,rays:.35,wet:.3},weather:{type:'leaves',count:260,wind:[1.2,-.5],size:.16,speed:.4}},
    {id:'stormspire',title:'Stormspire Causeway',identity:'Rain-soaked neon megacity under a storm ceiling',architecture:'city',terrain:'concrete',border:'neon',trees:0,seed:701,
      sky:{zenith:'#080e1a',horizon:'#29485f',ground:'#101c28',sun:[.4,.25,-.85],disc:5,stars:0,moon:0,clouds:.95},
      light:{color:'#9bbdd6',intensity:1.1,ambient:'#93b5cb',ground:'#18323b',fill:.7,exposure:1.1},
      surface:{color:'#596570',roughness:.16,metalness:.12,normal:.17},rock:'#525e68',accent:'#48e5ff',foliage:'#354e53',
      atmosphere:{color:'#426079',density:.004,height:20,falloff:.02,grade:[.88,1.02,1.13],contrast:1.15,saturation:1.12,bloom:.42,rays:0,wet:1},weather:{type:'rain',count:1000,wind:[2,-1],size:.035,speed:19}},
    {id:'observatory',title:'Sunken Observatory',identity:'Tidal observatory domes beneath a ringed planet',architecture:'observatory',terrain:'coral',border:'brass',trees:0,seed:809,
      sky:{zenith:'#132542',horizon:'#ca9991',ground:'#244451',sun:[-.6,.19,.77],disc:20,stars:.35,moon:.085,rings:true,clouds:.18},
      light:{color:'#ffd1b7',intensity:2.3,ambient:'#8dc2cb',ground:'#36545a',fill:.55,exposure:1},
      surface:{color:'#9ca8a1',roughness:.3,metalness:.08,normal:.4},rock:'#9dada3',accent:'#70f3dc',foliage:'#3e706b',
      atmosphere:{color:'#769eaa',density:.0045,height:10,falloff:.028,grade:[.97,1.04,1.03],contrast:1.03,saturation:1.02,bloom:.3,rays:.22,wet:.45},weather:{type:'spray',count:380,wind:[-1.8,1.2],size:.12,speed:.6}}
  ];
  const freeze=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return o;};profiles.forEach(freeze);Object.freeze(profiles);
  const get=track=>{const id=typeof track==='object'?track?.id:track;if(typeof id==='number')return profiles[id]||profiles[0];return profiles.find(p=>p.id===id||p.title.toLowerCase()===String(id).toLowerCase())||profiles[0];};
  return Object.freeze({profiles,get});
});
