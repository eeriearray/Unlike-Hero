import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {HollowGame,catalog}=createRequire(import.meta.url)('../games/the-hollow/engine/index.js');
const root=new URL('../games/the-hollow/',import.meta.url);
function setup(){
 const game=new HollowGame({seed:19,code:'GUIDE',now:()=>1000});
 game.addPlayer({id:'p',name:'Reader'});game.command('p',{t:'pick',cls:'hunter'});game.command('p',{t:'ready'});game.command('p',{t:'start',opening:true});game.command('p',{t:'interact'});
 const window={HollowArt:{esc:x=>String(x),glyph:()=>'',itemArt:()=>''},HollowStage:{objectFor:()=>null},HollowUI:{S:{ui:{}},howtoModal:()=>'',item:()=>({name:'item'})}};
 for(const file of ['cards','guidance'])vm.runInNewContext(fs.readFileSync(new URL('js/'+file+'.js',root),'utf8'),{window});
 return {game,window,view:()=>game.viewFor('p')};
}
test('first playable view explains the expedition and offers one highlighted next action',()=>{
 const {window,view}=setup(),v=view();
 const mission=window.HollowGuidance.mission(v),tray=window.HollowCards.tray(v);
 assert.match(mission,/Shared expedition objective/);assert.match(mission,/before the bell learns your name/);assert.match(mission,/Why now:/);assert.match(mission,/Read the notice board/);
 assert.equal((tray.match(/class="acard st-ok recommended/g)||[]).length,1);
 assert.match(tray,/data-v="board"/);assert.doesNotMatch(tray,/data-v="well"/);assert.match(tray,/Other actions/);
 window.HollowUI.S.ui.more=true;
 const expanded=window.HollowCards.tray(v);assert.match(expanded,/data-v="well"/);assert.match(expanded,/data-v="travel"/);
});
test('a failed first check advances the recommendation to travel and keeps its result readable',()=>{
 const {game,window,view}=setup();game.d20=()=>1;
 const result=game.command('p',{t:'choose',enc:game.turn.enc.id,opt:'board'});assert.ok(result.ok);
 const v=view();assert.equal(v.opening.id,'record');
 const rec=window.HollowGuidance.recommend(v);assert.equal(rec.id,'travel');
 assert.match(window.HollowCards.tray(v),/data-v="travel"/);assert.doesNotMatch(window.HollowCards.tray(v),/class="result-next"/);
 assert.match(window.HollowGuidance.mission(v),/Choose Travel, then go to the Chapel/);
});
test('level-up choices replace action cards and repeated help until the upgrade is picked',()=>{
 const {window,view}=setup(),v=view();v.me.pendingLevels=1;v.me.offer=[{id:'vitality',name:'+3 Max Vitality',text:'More health'}];
 const tray=window.HollowCards.tray(v);
 assert.match(tray,/data-act="levelup"/);assert.match(tray,/Choose one improvement/);
 assert.doesNotMatch(tray,/class="tray"|guide-support|result-next|morecards|endturn/);
 assert.match(window.HollowGuidance.mission(v),/<details class="mission-context"><summary>/);
 assert.doesNotMatch(window.HollowGuidance.mission(v),/mission-context" open/);
});
test('guidance follows shared progress and never recommends an action during a blocking choice',()=>{
 const {window,view}=setup(),v=view();
 assert.equal(window.HollowGuidance.recommend({...v,me:{...v.me,pendingLevels:1}}),null);
 assert.equal(window.HollowGuidance.recommend({...v,enc:{kind:'enemy'}}),null);
 assert.equal(window.HollowGuidance.recommend({...v,game:{...v.game,ap:0}}),null);
 assert.match(window.HollowGuidance.mission({...v,game:{...v.game,active:'companion'}}),/Your companion is acting/);
 assert.equal(window.HollowGuidance.recommend({...v,opening:{...v.opening,complete:true}}),null);
});

test('the location caption leads with purpose and travel highlights the actual next destination',()=>{
 const {game,window,view}=setup();
 window.HollowUI.S.cat=catalog();window.HollowUI.S.view=view();window.HollowArt.scene=()=>'';
 vm.runInNewContext(fs.readFileSync(new URL('js/story.js',root),'utf8'),{window});
 assert.match(window.HollowStory.caption(),/Shared expedition objective/);assert.equal(window.HollowStory.coach(),'');
 game.d20=()=>1;game.command('p',{t:'choose',enc:game.turn.enc.id,opt:'board'});
 window.HollowUI.S.view=view();
 const panel=window.HollowStory.travelPanel();
 assert.match(panel,/recommended-road/);assert.match(panel,/Next objective/);
 assert.ok(panel.indexOf('data-to="chapel"')<panel.indexOf('data-to="belltower"'));
 assert.match(window.HollowStory.caption(),/Critical failure/);assert.doesNotMatch(window.HollowStory.caption(),/mission-focus/);
 const result=window.HollowUI.S.view.enc.result;
 result.lines=[{k:'story',t:'You find the certificate. '+ 'The keeper recorded the route beneath the bell. '.repeat(8)}];
 const caption=window.HollowStory.caption();
 assert.match(caption,/class="discovery-preview">You find the certificate\./);
 assert.match(caption,/<details class="discovery-reading"><summary>Read the full discovery/);
 assert.match(caption,/The keeper recorded the route/);
 assert.doesNotMatch(caption,/discovery-reading" open/);
});

test('the expedition letter explains scene interaction, solo pacing and can be closed or reopened',()=>{
 const {window,view}=setup();const solo=window.HollowUI.fieldLetterModal(view());
 assert.match(solo,/aria-modal="true"/);assert.match(solo,/aria-labelledby="field-letter-title"/);
 assert.match(solo,/Click or tap the marked objects/);assert.match(solo,/There is no reading deadline/);
 assert.match(solo,/private character objective is a bonus/);assert.match(solo,/data-act="closemodal"/);
 assert.match(window.HollowCards.tray(view()),/data-act="fieldletter"/);
 const v=view();const party=window.HollowUI.fieldLetterModal({...v,game:{...v.game,readingTime:false},opening:null});
 assert.match(party,/active turn also has a timer/);assert.doesNotMatch(party,/There is no reading deadline/);
 assert.match(party,/Examine a marked object where you stand/);
});
