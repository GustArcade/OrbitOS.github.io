const assert=require('node:assert/strict'),core=require('./dist/fullscreen-core.js');
(async()=>{
 let entered=false,options=null,exited=false;
 const doc={fullscreenEnabled:true,fullscreenElement:null,documentElement:{requestFullscreen(opts){entered=true;options=opts;doc.fullscreenElement=this;return Promise.resolve()}},exitFullscreen(){exited=true;doc.fullscreenElement=null;return Promise.resolve()}};
 const pending=core.toggle(doc);assert.equal(entered,true,'request must occur immediately inside the user click, before yielding');await pending;
 assert.deepEqual(options,{navigationUI:'hide'});assert.equal(core.active(doc),true);assert.equal(core.supported(doc),true);
 await core.toggle(doc);assert.equal(exited,true);assert.equal(core.active(doc),false);
 let webkitEnter=0,webkitExit=0;const safari={documentElement:{webkitRequestFullscreen(){webkitEnter++;safari.webkitFullscreenElement=this}},webkitExitFullscreen(){webkitExit++;safari.webkitFullscreenElement=null}};
 await core.toggle(safari);assert.equal(webkitEnter,1);assert.equal(core.active(safari),true);await core.toggle(safari);assert.equal(webkitExit,1);
 assert.equal(core.supported({documentElement:{}}),false);await assert.rejects(core.toggle({documentElement:{}}),{code:'FULLSCREEN_UNAVAILABLE'});
 let blockedCalls=0;const blocked={fullscreenEnabled:false,documentElement:{requestFullscreen(){blockedCalls++}}};await assert.rejects(core.toggle(blocked),{code:'FULLSCREEN_UNAVAILABLE'});assert.equal(blockedCalls,0);
 const denied=new Error('Permission denied');await assert.rejects(core.toggle({documentElement:{requestFullscreen(){return Promise.reject(denied)}}}),error=>error===denied);
 console.log('PASS: native page fullscreen, hidden navigation request, synchronous user activation, exit, WebKit fallback and unavailable/denied browsers');
})().catch(error=>{console.error(error);process.exitCode=1});
