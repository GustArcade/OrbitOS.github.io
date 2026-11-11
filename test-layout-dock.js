const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dist/layouts.js','utf8');
const originalIds=['online','news','library','shop','album','web','shelf','arcade','files','controllers','device','settings','sleep'];
const all=[...originalIds,'movies','music','ai','collections','queue'].map(id=>[id,id,'#fff']);
const context=vm.createContext({layout:'galaxy',apps:all.slice(),allInstalledApps:all.slice(),originalDockApps:all.slice(0,13),state:{dockIndex:14},renderDock:()=>{context.renders++},renders:0});
vm.runInContext(source.slice(source.indexOf('function setDockForLayout('),source.indexOf('function sync(')),context);
context.setDockForLayout();
assert.deepEqual(Array.from(context.apps,app=>app[0]),originalIds,'Switch UI must show exactly the original icons and order');
assert.ok(context.state.dockIndex>=0&&context.state.dockIndex<context.apps.length,'removing an extra icon must leave a valid keyboard/gamepad selection');
assert.equal(context.apps[context.state.dockIndex][0],'shop');
context.setDockForLayout();assert.equal(context.renders,1,'the original dock must not be repeatedly rebuilt');
context.layout='selfhost';context.setDockForLayout();
assert.deepEqual(Array.from(context.apps,app=>app[0]),all.map(app=>app[0]),'OrbitOS must regain its unchanged installed apps');
assert.equal(context.apps[context.state.dockIndex][0],'shop','selection must remain on the same app when changing UI');
context.layout='galaxy';context.setDockForLayout();
assert.equal(context.apps.length,13,'repeated UI switches must not leak extra dock icons');
console.log('PASS: original Switch UI dock/order, valid keyboard selection, idempotent rendering and unchanged OrbitOS app restoration');
const setup=source.slice(source.indexOf('const valid='),source.indexOf('const make='));
for(const saved of ['webos','invalid','selfhost','galaxy']){
 const writes=[];const migration=vm.createContext({load:()=>saved,save:(...args)=>writes.push(args)});
 const result=vm.runInContext(setup+'\nlayout',migration);
 assert.equal(result,['selfhost','galaxy'].includes(saved)?saved:'selfhost');
 assert.deepEqual(writes,['selfhost','galaxy'].includes(saved)?[]:[['layout','selfhost']],'only an obsolete home choice is migrated; appearance preferences are untouched');
}
console.log('PASS: removed desktop selections return to OrbitOS without changing saved themes or cursors');
