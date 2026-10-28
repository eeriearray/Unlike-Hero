import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../shared/sdk/performance.js',import.meta.url),'utf8');
function runtime({cores=8,memory=8,coarse=false,dpr=2,saveData=false}={}) {
 const document={hidden:false};
 const window={navigator:{hardwareConcurrency:cores,deviceMemory:memory,connection:{saveData}},matchMedia:()=>({matches:coarse}),devicePixelRatio:dpr,innerWidth:1920,innerHeight:1080,document,performance:{now:()=>0}};
 vm.runInNewContext(source,{window});return{P:window.HubPerformance,document,window};
}
test('device defaults use conservative budgets for phones, low memory and data-saving mode',()=>{
 assert.equal(runtime({cores:2}).P.tier,'low');
 assert.equal(runtime({memory:2}).P.tier,'low');
 assert.equal(runtime({saveData:true}).P.tier,'low');
 assert.equal(runtime({coarse:true}).P.tier,'balanced');
 assert.equal(runtime({cores:4}).P.tier,'balanced');
 assert.equal(runtime().P.tier,'high');
});
test('retina and large displays stay inside the framebuffer budget on every tier',()=>{
 for(const options of [{cores:2},{coarse:true},{}]){
  const{P}=runtime(options);
  for(const[w,h]of[[390,844],[1920,1080],[3840,2160],[7680,4320]]){
   const ratio=P.pixelRatio(w,h,2);
   assert.ok(ratio>0&&ratio<=2);
   assert.ok(w*h*ratio*ratio<=P.maxPixels+1);
  }
 }
});
test('small drawing canvases stay sharp and explicit lower caps are respected',()=>{
 const{P}=runtime();assert.equal(P.pixelRatio(256,256,2),2);assert.equal(P.pixelRatio(256,256,1),1);
 assert.equal(runtime({dpr:1}).P.pixelRatio(256,256,2),1);
});
test('decorative render gates stop in hidden tabs and wake immediately when visible',()=>{
 const{P,document}=runtime(),gate=P.frameGate(30);
 assert.equal(gate(0),true);assert.equal(gate(10),false);assert.equal(gate(34),true);
 document.hidden=true;assert.equal(gate(1000),false);
 document.hidden=false;assert.equal(gate(1001),true);
});
test('sustained slow rendering lowers resolution; a single pause never does',()=>{
 const{P,document}=runtime(),budget=P.createResolutionBudget(2),initial=budget.ratio(1920,1080);
 assert.equal(budget.sample(2),false);assert.equal(budget.ratio(1920,1080),initial);
 for(let i=0;i<80;i++)budget.sample(1/30);
 assert.ok(budget.ratio(1920,1080)<initial);
 document.hidden=true;const before=budget.ratio(1920,1080);for(let i=0;i<200;i++)budget.sample(.05);assert.equal(budget.ratio(1920,1080),before);
 document.hidden=false;for(let i=0;i<5000;i++)budget.sample(.05);assert.ok(budget.ratio(1920,1080)>=initial*.55-1e-8);
});
test('missing hardware APIs and storage access are harmless',()=>{
 const window={innerWidth:800,innerHeight:600,performance:{now:()=>0}};
 vm.runInNewContext(source,{window});assert.ok(window.HubPerformance.pixelRatio()>0);assert.equal(window.HubPerformance.frameGate()(0),true);
});
test('only the eleven other hub games load the opt-in helper, before their application scripts',()=>{
 const{games}=JSON.parse(readFileSync(new URL('../games/registry.json',import.meta.url),'utf8'));
 for(const g of games){
  const html=readFileSync(new URL(`../games/${g.id}/index.html`,import.meta.url),'utf8');
  const at=html.indexOf('shared/sdk/performance.js');
  if(g.id==='chronolink'){assert.equal(at,-1);continue;}
  assert.ok(at>=0,g.id);assert.ok(at<html.indexOf('<script',at),`${g.id}: helper precedes the next script`);
 }
});
