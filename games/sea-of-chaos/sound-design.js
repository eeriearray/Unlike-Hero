// Small layered synthesis recipes: no audio downloads, one-shot nodes clean up.
const tone=(frequency,end,length,wave='sine',gain=.1,offset=0)=>({frequency,end,length,wave,gain,offset});
const noise=(length,gain,frequency,offset=0)=>({length,gain,frequency,offset});
const make=(tones,air=null,cooldown=.14)=>({tones,noise:air,cooldown});
const coin=make([tone(880,880,.09,'sine',.07),tone(1320,1320,.16,'sine',.065,.065),tone(1760,1760,.18,'sine',.04,.12)],null,.22);
const cannon=make([tone(90,35,.26,'sine',.2),tone(1500,450,.035,'triangle',.045,.015)],noise(.22,.22,1300),.07);
const recipes={
 'shot-ball':cannon,
 'shot-fire':make([tone(110,38,.34,'triangle',.15),tone(550,110,.22,'sine',.07,.03)],noise(.42,.15,2700),.08),
 'shot-sticky':make([tone(340,55,.3,'sine',.14),tone(150,70,.2,'triangle',.08,.06)],noise(.2,.07,420),.08),
 'shot-chain':make([tone(1400,580,.18,'sine',.07),tone(940,330,.22,'sine',.06,.035),tone(100,40,.18,'triangle',.1)],noise(.13,.14,1900),.08),
 'shot-heavy':make([tone(65,24,.46,'sine',.23),tone(150,40,.15,'triangle',.1)],noise(.3,.24,900),.08),
 'shot-shock':make([tone(1100,180,.13,'sawtooth',.045),tone(1650,300,.19,'sine',.07,.04)],noise(.13,.12,3600),.08),
 hit:make([tone(180,60,.13,'triangle',.11),tone(920,220,.07,'sine',.04)],noise(.12,.13,1700),.12),
 collision:make([tone(95,38,.26,'triangle',.1)],noise(.19,.09,530),.3),
 splash:make([tone(130,45,.2,'sine',.04)],noise(.32,.1,2200),.3),
 shieldhit:make([tone(620,1350,.19,'sine',.075),tone(930,1900,.26,'sine',.035,.02)],noise(.09,.045,3500),.18),
 sentry:make([tone(380,90,.2,'triangle',.065),tone(1200,500,.1,'sine',.04)],noise(.14,.08,1800),.12),
 defensecount:make([tone(660,660,.11,'sine',.09)],null,.8),
 defenseend:make([tone(220,330,.7,'triangle',.09),tone(330,440,.65,'triangle',.07,.13),tone(440,660,.8,'sine',.08,.26)],noise(.7,.07,1700),2),
 sink:make([tone(85,27,.9,'triangle',.15),tone(140,35,.55,'sine',.08,.15)],noise(.95,.15,700),.3),
 corebroken:make([tone(150,30,1.2,'sawtooth',.07),tone(900,140,.55,'sine',.1,.05),tone(620,90,.7,'sine',.07,.17)],noise(1,.2,2300),.5),
 corehit:make([tone(360,100,.23,'triangle',.08)],noise(.14,.07,1200),.3),
 boost:make([tone(110,460,.42,'triangle',.065)],noise(.45,.1,3000),.25),
 ram:make([tone(160,50,.28,'triangle',.13)],noise(.22,.12,1000),.2),
 respawn:make([tone(330,440,.22,'sine',.07),tone(440,660,.25,'sine',.07,.1),tone(660,880,.36,'sine',.06,.2)],noise(.3,.04,2400),.3),
 purchase:make([tone(540,540,.07,'triangle',.07),tone(810,810,.12,'sine',.08,.09),tone(1080,1080,.25,'sine',.06,.17)],noise(.07,.035,2000),.2),
 goal:make([tone(523,523,.22,'triangle',.08),tone(659,659,.25,'sine',.09,.12),tone(784,784,.45,'triangle',.08,.24),tone(1046,1046,.55,'sine',.06,.36)],noise(.22,.06,2400,.3),.5),
 warning:make([tone(294,262,.22,'triangle',.075),tone(294,262,.22,'triangle',.075,.28)],null,3),
 sudden:make([tone(220,220,.4,'triangle',.09),tone(277,277,.4,'triangle',.07,.16),tone(330,330,.65,'triangle',.08,.3)],noise(.2,.05,2100),1),
 whirlpool:make([tone(180,38,.7,'sine',.09)],noise(.7,.075,600),.8),
 gold:coin,ammo:coin,pickup:coin,repair:coin,
 ui:make([tone(600,850,.055,'sine',.035)],null,.06),
 defeat:make([tone(392,392,.35,'triangle',.065),tone(330,330,.4,'triangle',.065,.25),tone(262,220,.7,'sine',.075,.5)],null,2),
 victory:make([tone(523,523,.3,'triangle',.075),tone(659,659,.35,'sine',.075,.15),tone(784,784,.45,'triangle',.075,.3),tone(1046,1046,.75,'sine',.07,.45),tone(1318,1318,.6,'sine',.04,.6)],noise(.25,.06,2500,.45),2)
};
export function effectFor(kind){return recipes[kind]||({fire:recipes['shot-ball'],stash:recipes.goal,return:coin,drop:recipes.warning}[kind])||recipes.ui;}
