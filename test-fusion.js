const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Exercise the actual 2048 engine, including double-merge prevention and score accounting.
function element(){return {style:{},append(){},replaceChildren(){},setAttribute(){},setPointerCapture(){}}}
const elements=new Map();const document={querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll(){return []},createElement:element};
const context=vm.createContext({document,window:{},Math});vm.runInContext(fs.readFileSync('dist/games/2048.js','utf8'),context);
const merge=a=>JSON.parse(vm.runInContext('JSON.stringify(mergeLine('+JSON.stringify(a)+'))',context));
assert.deepEqual(merge([2,2,2,2]),{line:[4,4,0,0],gain:8});
assert.deepEqual(merge([2,2,4,0]),{line:[4,4,0,0],gain:4});
assert.deepEqual(merge([0,4,0,4]),{line:[8,0,0,0],gain:8});
assert.deepEqual(merge([2,4,8,16]),{line:[2,4,8,16],gain:0});
vm.runInContext('cells=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]',context);assert.equal(vm.runInContext('canMove()',context),false);
vm.runInContext('cells[0]=0',context);assert.equal(vm.runInContext('canMove()',context),true);
// All local entrypoints are self-contained under the opaque game sandbox.
for(const name of ['snake','2048','memory']){const page=fs.readFileSync('dist/games/'+name+'.html','utf8');assert.ok(page.includes('<style>'));assert.ok(page.includes('<script>'));assert.ok(fs.readFileSync('dist/sw.js','utf8').includes('./games/'+name+'.html'))}
const html=fs.readFileSync('dist/index.html','utf8');const catalogue=JSON.parse(html.match(/const GN_CATALOGUE=(\[.*?\]);/s)[1]);assert.equal(new Set(catalogue.map(g=>g.id)).size,catalogue.length);assert.ok(catalogue.every(g=>!g.url.includes('wasm.rip')));
console.log('PASS: 2048 merge rules, scoring, blocked-board detection, built-in offline cache, unique GN IDs');
const {cleanCollections,discover}=require('./dist/orbit-core.js');
const sample=[{id:'a',category:'Puzzle'},{id:'b',category:'Action'},{id:'c',category:'Puzzle'}];
const picks=discover(sample,new Set(['a']),{a:1},'2026-11-03');
assert.equal(picks[0].id,'c','unplayed favourite genre should rank first');
assert.equal(picks.at(-1).id,'a','played games follow unplayed games');
assert.deepEqual(discover(sample,new Set(),{},'day'),discover(sample,new Set(),{},'day'),'daily picks must be stable');
assert.deepEqual(cleanCollections([{id:'x',name:'  Fun  ',games:['a','a','invalid']},{id:'x',name:'duplicate',games:['b']},null],new Set(['a','b'])),[{id:'x',name:'Fun',games:['a']}]);
assert.deepEqual(cleanCollections({name:'wrong shape'},new Set()),[]);
assert.equal(cleanCollections([{id:'n',name:'N'.repeat(100),games:[]}],new Set())[0].name.length,40);
for(const asset of ['orbit-core.js','elite.js','elite.css'])assert.ok(fs.readFileSync('dist/sw.js','utf8').includes('./'+asset),'offline shell should include '+asset);
console.log('PASS: discovery priority and determinism, safe collection imports, Ultimate offline assets');
const {cleanQueue,cleanProgress,nativeSave}=require('./dist/orbit-core.js');
assert.deepEqual(cleanQueue(['b','a','b','bad',null],new Set(['a','b'])),['b','a'],'queue preserves order and removes invalid duplicates');
assert.deepEqual(cleanProgress({a:'completed',b:'injected',bad:'playing'},new Set(['a','b'])),{a:'completed'});
assert.equal(nativeSave('2048',{best:2,score:2,cells:Array(16).fill(3)}),null,'tiles must be powers of two');
assert.equal(nativeSave('2048',{best:2,score:2,cells:Array(15).fill(2)}),null,'board must have 16 cells');
assert.equal(nativeSave('snake',{best:Infinity}),null);assert.equal(nativeSave('memory',{best:7}),null);assert.equal(nativeSave('unknown',{best:20}),null);
assert.deepEqual(nativeSave('2048',{best:64,score:32,cells:[4,4,...Array(14).fill(0)]}),{best:64,score:32,cells:[4,4,...Array(14).fill(0)]});
assert.deepEqual(nativeSave('breakout',{best:400,untrusted:'removed'}),{best:400});
for(const path of ['supernova.js','supernova.css','games/breakout.html','games/breakout.svg'])assert.ok(fs.readFileSync('dist/sw.js','utf8').includes('./'+path),'offline cache missing '+path);
const breakout=fs.readFileSync('dist/games/breakout.html','utf8');assert.ok(breakout.includes('orbit-local-load'));assert.ok(breakout.includes('requestAnimationFrame(loop)'));assert.ok(breakout.includes('data-orbit-game="breakout"'));
console.log('PASS: Up Next ordering, progress validation, native record/board validation, Supernova offline shell');
const parentMessages=[],bridgeListeners={};const parentWindow={postMessage:data=>parentMessages.push(data)};
const bridgeWindow={parent:parentWindow,addEventListener:(type,fn)=>bridgeListeners[type]=fn};
const bridgeContext=vm.createContext({window:bridgeWindow,parent:parentWindow,document:{documentElement:{dataset:{orbitGame:'2048'}}},localStorage:{},JSON});
vm.runInContext(fs.readFileSync('dist/games/local-state.js','utf8'),bridgeContext);
let received=null;bridgeWindow.OrbitLocal.save({best:4});assert.equal(parentMessages.length,0,'save must wait for load handshake');
bridgeWindow.OrbitLocal.load(data=>received=data);assert.equal(parentMessages[0].type,'orbit-local-load');
bridgeListeners.message({source:{},data:{type:'orbit-local-state',game:'2048',data:{best:99}}});assert.equal(received,null,'unrelated source must not restore a board');
bridgeListeners.message({source:parentWindow,data:{type:'orbit-local-state',game:'snake',data:{best:99}}});assert.equal(received,null,'another game must not restore a board');
bridgeListeners.message({source:parentWindow,data:{type:'orbit-local-state',game:'2048',data:{best:4}}});assert.equal(received.best,4);
bridgeWindow.OrbitLocal.save({best:8});assert.equal(parentMessages.at(-1).type,'orbit-local-save');
console.log('PASS: native save handshake, parent-source check and game identity isolation');
