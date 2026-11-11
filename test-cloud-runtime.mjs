import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {observe,readPlayer}=createRequire(import.meta.url)('./dist/cloud-session.js');
const base='https://achromaon.top/astra',startURL=base+'/api/coursework/start',progressURL=id=>base+'/api/coursework/progress?enrollmentId='+id;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const tick=()=>new Promise(setImmediate);

// The provider's status endpoint can fail without emitting any SDK event.
{
 const calls=[],states=[];let response=json({ok:true,enrollmentId:'own-1'});
 const target={fetch:async(...args)=>{calls.push(args);return response}};
 const observer=observe(target,(attempt,phase,message)=>states.push({attempt,phase,message})),attempt=observer.begin();
 const init={method:'POST',headers:{'X-Coursework-Uid':'normal-existing-device'},body:'unchanged-provider-body'};
 assert.deepEqual(await(await target.fetch(startURL,init)).json(),{ok:true,enrollmentId:'own-1'});
 assert.equal(calls[0][1],init,'Observation must not change the SDK request, identity or body');
 response=json({ok:true,note:'Waiting for a server',completed:false});await target.fetch(progressURL('own-1'));
 assert.equal(states.at(-1).phase,'queue');assert.equal(states.at(-1).message,'Waiting for a server');
 response=json({ok:true,completed:true});await target.fetch(progressURL('own-1'));
 assert.equal(states.at(-1).phase,'connecting','Ready metadata is not evidence of video playback');
 response=json({ok:true,error:'Something went wrong — please try again.'});
 const original=await target.fetch(progressURL('own-1'));assert.equal((await original.json()).error,'Something went wrong — please try again.');
 assert.equal(states.at(-1).phase,'error');assert.equal(states.at(-1).attempt,attempt);
 const before=states.length;
 await target.fetch(progressURL('someone-else'));await target.fetch('https://other.test/astra/api/coursework/progress?enrollmentId=own-1');assert.equal(states.length,before,'Foreign sessions and hosts must not affect this player');
 response=json({ok:true});await attempt.release();await attempt.release();
 const stops=calls.filter(([url])=>url===base+'/api/cg/stop');assert.equal(stops.length,1);assert.deepEqual(JSON.parse(stops[0][1].body),{sessionId:'own-1'});
 await target.fetch(progressURL('own-1'));assert.equal(states.length,before,'Closed attempts must not change the status');
}

// Cancel while the provider is still allocating a session. Its late response
// must be released, and an old progress response must not affect a new retry.
{
 const allocation=deferred(),oldProgress=deferred(),calls=[],states=[];let allocations=0;
 const target={fetch:async(url,options)=>{calls.push([url,options]);if(url===startURL)return ++allocations===1?allocation.promise:json({ok:true,enrollmentId:'new-2'});if(url===progressURL('new-2'))return oldProgress.promise;return json({ok:true})}};
 const observer=observe(target,(...state)=>states.push(state)),old=observer.begin(),request=target.fetch(startURL,{method:'POST'}),released=old.release();
 allocation.resolve(json({ok:true,enrollmentId:'late-1'}));await Promise.all([request,released]);
 assert.ok(calls.some(([url,options])=>url===base+'/api/cg/stop'&&JSON.parse(options.body).sessionId==='late-1'));
 const next=observer.begin();await target.fetch(startURL,{method:'POST'});const progress=target.fetch(progressURL('new-2'));await next.release();
 const newest=observer.begin();oldProgress.resolve(json({ok:true,error:'stale failure'}));await progress;
 assert.equal(states.length,0);assert.equal(calls.filter(([url])=>url===base+'/api/cg/stop').length,2);await newest.release();
}

// SDK-managed launch verification retries are left intact; malformed responses
// remain available to the SDK instead of becoming a false successful launch.
{
 const states=[];let response=json({ok:false,code:'QUIZ_FAILED'},403);
 const target={fetch:async()=>response},observer=observe(target,(...state)=>states.push(state)),attempt=observer.begin();
 assert.equal((await target.fetch(startURL,{method:'POST'})).status,403);assert.equal(states.length,0);
 response=new Response('<html>unavailable</html>',{status:503});assert.equal(await(await target.fetch(startURL,{method:'POST'})).text(),'<html>unavailable</html>');
 target.fetch=target.fetch.bind(target);await attempt.release();
}

// DOM fallback covers SDK timeouts and video failures that lack control events.
{
 let nodes={},paragraphs=[];const root={querySelector:selector=>nodes[selector],querySelectorAll:()=>paragraphs};
 assert.equal(readPlayer(root),null);nodes['#remoteVideo']={readyState:1,videoWidth:0};assert.equal(readPlayer(root),null);
 nodes['.eb-status']={textContent:'Finding a nearby server…'};assert.equal(readPlayer(root).phase,'queue');
 nodes={'.eb-error':{textContent:'This is taking longer than expected. Please try again.'}};assert.equal(readPlayer(root).phase,'error');
 nodes={video:{readyState:4,videoWidth:1280,videoHeight:720},'#remoteVideo':{readyState:4,videoWidth:2,videoHeight:2}};assert.equal(readPlayer(root),null,'A promotional video or tiny keepalive must never establish gameplay');
 nodes={'#remoteVideo':{readyState:2,videoWidth:1920,videoHeight:1080}};assert.equal(readPlayer(root).phase,'playing');nodes['#remoteVideo'].error={code:2};assert.equal(readPlayer(root).phase,'error');
 const card=label=>({querySelector:()=>({textContent:label})});
 paragraphs=[{textContent:'Your session has ended',parentElement:{parentElement:card('Start a new session')}}];assert.match(readPlayer(root).message,/ended this session/);
 paragraphs=[{textContent:'Connection failed',nextElementSibling:{textContent:'Input connection timed out.'},parentElement:{parentElement:card('Go back')}}];assert.equal(readPlayer(root).message,'Input connection timed out.');
}
console.log('PASS: silent provider failures, honest queue/video states, own-session release, late cancellation, stale retry isolation and unmodified SDK verification');

// Run the actual isolated client against a provider/SDK fixture: fail after
// mount, recover, retry, ignore stale errors, receive video, then close.
{
 const elements=new Map(),listeners=new Map(),messages=[],intervals=new Map(),instances=[],stopped=[];let nodes={},counter=0;
 function element(id){return {id,hidden:false,textContent:'',dataset:{},setAttribute(name,value){this[name]=value},replaceChildren(){},remove(){}}}
 for(const id of ['cloud-mount','cloud-message','cloud-status','cloud-heading','cloud-start','cloud-close','cloud-alternate','cloud-browser','cloud-account'])elements.set(id,element(id));
 const mount=elements.get('cloud-mount');mount.shadowRoot={querySelector:selector=>nodes[selector],replaceChildren(){nodes={}}};
 const origin='https://orbitos.test',parent={postMessage(data){messages.push(data);if(data.type==='orbit-cloud-launch')queueMicrotask(()=>dispatch({type:'orbit-cloud-launch-result',requestId:data.requestId,data:{test:true}}))}};
 function dispatch(data,{source=parent,eventOrigin=origin}={}){for(const listener of listeners.get('message')||[])listener({data,source,origin:eventOrigin})}
 const target={parent,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener)},removeEventListener(type,listener){listeners.get(type)?.delete(listener)},fetch:async(url,options)=>{
  if(url===startURL)return json({ok:true,enrollmentId:'client-'+counter});
  if(url===base+'/api/cg/stop'){stopped.push(JSON.parse(options.body).sessionId);return json({ok:true})}
  return json({ok:true,error:'Something went wrong — please try again.'});
 }};
 class Astra{
  constructor(){this.events={};counter++;instances.push(this)}
  on(type,listener){this.events[type]=listener}
  async play(){this.events.connecting?.();await target.fetch(startURL,{method:'POST'});nodes={'.eb-status':{textContent:'Preparing your session…'}}}
  async end(){this.events.ended?.()}
  destroy(){this.destroyed=true;nodes={}}
 }
 target.Astra=Astra;
 const context={window:target,parent,location:{href:origin+'/cloud-client.html?game=as0112',search:'?game=as0112'},document:{getElementById:id=>elements.get(id)},OrbitCloudSession:{observe,readPlayer},Astra,URL,URLSearchParams,crypto,console,setTimeout,clearTimeout,setInterval(fn){const id=intervals.size+1;intervals.set(id,fn);return id},clearInterval(id){intervals.delete(id)}};
 vm.runInNewContext(await fs.readFile('dist/cloud-client.js','utf8'),context);
 dispatch({type:'orbit-cloud-options',hasAlternative:true,hasBrowser:true});
 await elements.get('cloud-start').onclick();
 assert.equal(messages.some(message=>message.phase==='playing'),false);assert.equal(messages.some(message=>message.message?.includes('player is ready')),false);
 await target.fetch(progressURL('client-1'));await tick();
 assert.equal(elements.get('cloud-heading').textContent,'Cloud connection failed');assert.equal(elements.get('cloud-start').hidden,false);assert.equal(elements.get('cloud-start').textContent,'Retry connection');assert.equal(elements.get('cloud-alternate').hidden,false);assert.equal(elements.get('cloud-browser').hidden,false);assert.deepEqual(stopped,['client-1']);
 elements.get('cloud-alternate').onclick();assert.equal(messages.at(-1).action,'alternate');
 await elements.get('cloud-start').onclick();assert.equal(instances.length,2);assert.ok(instances[0].destroyed);
 instances[0].events.error?.({message:'stale instance error'});assert.equal(elements.get('cloud-message').hidden,true);
 nodes={'#remoteVideo':{readyState:2,videoWidth:1280,videoHeight:720}};for(const fn of intervals.values())fn();assert.equal(messages.at(-1).phase,'playing');
 dispatch({type:'orbit-cloud-stop'},{eventOrigin:'https://attacker.test'});assert.equal(instances[1].destroyed,undefined);
 dispatch({type:'orbit-cloud-stop'});await tick();
 assert.ok(instances[1].destroyed);assert.deepEqual(stopped,['client-1','client-2']);assert.equal(messages.filter(message=>message.type==='orbit-cloud-ended').length,1);assert.equal(intervals.size,0);
}
console.log('PASS: actual cloud client displays failure, offers recovery, retries cleanly, ignores old errors, confirms real video and releases on close');
