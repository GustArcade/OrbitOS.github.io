const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('dist/index.html','utf8'),microtasks=[];
const context=vm.createContext({queueMicrotask:fn=>microtasks.push(fn),placeholderCover:name=>'data:placeholder:'+name});
vm.runInContext(html.slice(html.indexOf('function wireCover('),html.indexOf('// Missing-file checks')),context);
function image(src='primary.png',complete=false,width=0){const listeners=new Set();return {src,complete,naturalWidth:width,dataset:{},getAttribute(name){return name==='src'?this.src:null},addEventListener(type,fn){if(type==='load')listeners.add(fn)},removeEventListener(type,fn){listeners.delete(fn)},loaded(width=512){this.complete=true;this.naturalWidth=width;for(const fn of [...listeners])fn()}}}
const game={name:'Test Game',image:'primary.png',backupImage:'backup.png'};
let ready=0;const cached=image('primary.png',true,512);context.wireCover(cached,game,()=>ready++);
assert.equal(ready,1,'a cached cover must become visible without a new load event');
assert.equal(cached.dataset.coverState,'ready');
const failed=image();let fallbackReady=0;context.wireCover(failed,game,()=>fallbackReady++);
failed.onerror();assert.equal(failed.src,'backup.png','failed primary must try the real backup artwork');
failed.onerror();assert.equal(failed.src,'data:placeholder:Test Game');assert.equal(failed.onerror,null,'placeholder must not retry forever');
failed.loaded();assert.equal(failed.dataset.coverState,'placeholder');assert.equal(fallbackReady,1);
const alreadyFailed=image('primary.png',true,0);context.wireCover(alreadyFailed,game);microtasks.splice(0).forEach(fn=>fn());assert.equal(alreadyFailed.src,'backup.png','cached failures must also retry');
const reused=image();let oldReady=0,newReady=0;context.wireCover(reused,game,()=>oldReady++);context.wireCover(reused,{...game,name:'New Game'},()=>newReady++);reused.loaded();assert.equal(oldReady,0,'old callbacks must not fire for a reused image');assert.equal(newReady,1);
const fast=image('');context.wireCover(fast,game,()=>ready++);fast.src='primary.png';fast.loaded();assert.equal(ready,2,'listeners must be available before assigning a cached image');
const near=image(),next=image(),far=image();let primed=0;
for(const [img,left] of [[near,0],[next,600],[far,1100]]){img.parentElement={getBoundingClientRect:()=>({left,right:left+200})};img.loading='lazy';img.orbitCoverReady=()=>primed++}
const strip={clientWidth:0,getBoundingClientRect:()=>({left:0,right:400}),querySelectorAll:()=>[near,next,far]};context.$=()=>strip;
vm.runInContext(html.slice(html.indexOf('function hydrateGameCovers('),html.indexOf('function renderGames(')),context);
context.hydrateGameCovers();assert.equal(primed,0,'hidden layouts must not preload the entire library');
strip.clientWidth=400;context.hydrateGameCovers();assert.equal(near.loading,'eager');assert.equal(next.loading,'eager');assert.equal(far.loading,'lazy');assert.equal(primed,2);
context.hydrateGameCovers();assert.equal(primed,2,'already primed covers must not be repeatedly scheduled');
console.log('PASS: cached cover visibility, real artwork failover, terminal placeholders, reused-image listeners and visible-carousel preloading');
