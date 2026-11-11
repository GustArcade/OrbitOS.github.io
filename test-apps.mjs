import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {handleOrbitApi,upstreamRoute} from './services/orbit-service.mjs';
const require=createRequire(import.meta.url),core=require('./dist/apps/apps-core.js');
const song={id:'abc-1',source:'ytm',title:'Song',artist:'Artist',artwork:'https://example.com/image.jpg',duration:123};
assert.equal(core.tracks([song,song,null,{...song,id:'../bad'}]).length,1);
assert.equal(core.track({...song,artwork:'javascript:alert(1)'}).artwork,'');
assert.equal(core.track({...song,source:'https://evil.test'}),null);
assert.equal(core.playlists([{id:'a',name:'Mix',tracks:[song,null]}])[0].tracks.length,1);
assert.equal(core.chats([{id:'c',messages:[{role:'system',content:'unsafe'},{role:'assistant',content:'Safe <script> text'}]}])[0].messages.length,1);
assert.deepEqual(core.lyrics('[00:01.50]First\n[00:12]Second'),[{time:1.5,text:'First'},{time:12,text:'Second'}]);
assert.equal(core.nextIndex(1,2,'off'),-1);assert.equal(core.nextIndex(1,2,'all'),0);assert.equal(core.nextIndex(0,0,'all'),-1);
let called=0;
const rejectFetch=async()=>{called++;throw Error('should not fetch')};
for(const path of ['/api/orbitos/../admin','/api/orbitos/music/stream?url=https://evil.test','/api/orbitos/music/artist/../../private']){
 const r=await handleOrbitApi(new Request('https://orbitos.test'+path),{fetcher:rejectFetch});assert.ok(r.status>=400);
}
assert.equal(called,0);
const blocked=await handleOrbitApi(new Request('https://orbitos.test/api/orbitos/ai/chat',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),{fetcher:rejectFetch});assert.equal(blocked.status,403);
let forwarded;
const jsonFetch=async(url,options)=>{forwarded={url:String(url),options};return new Response(JSON.stringify({items:[song]}),{headers:{'content-type':'application/json'}})};
const search=await handleOrbitApi(new Request('https://orbitos.test/api/orbitos/music/search?q=hello&limit=999&url=https://evil.test'),{fetcher:jsonFetch});assert.equal(search.status,200);assert.ok(forwarded.url.startsWith('https://kristenblackburnvolleyballcamps.com/api/music/search'));assert.equal(new URL(forwarded.url).searchParams.get('limit'),'40');assert.equal(new URL(forwarded.url).searchParams.has('url'),false);
const stream=await handleOrbitApi(new Request('https://orbitos.test/api/orbitos/music/stream?id=abc&source=ytm',{headers:{Range:'bytes=0-100'}}),{fetcher:async(url,options)=>{assert.equal(options.headers.get('Range'),'bytes=0-100');return new Response('audio',{status:206,headers:{'content-type':'audio/mpeg','content-range':'bytes 0-4/5'}})}});assert.equal(stream.status,206);assert.equal(stream.headers.get('content-range'),'bytes 0-4/5');assert.equal(await stream.text(),'audio');
const limited=await handleOrbitApi(new Request('https://orbitos.test/api/orbitos/ai/chat',{method:'POST',body:JSON.stringify({model:'dynamic/primary',messages:[{role:'user',content:'Hello'}]})}),{fetcher:async()=>new Response(JSON.stringify({error:'Daily limit reached'}),{status:429,headers:{'content-type':'application/json'}})});assert.equal(limited.status,429);assert.equal((await limited.json()).error,'Daily limit reached');
assert.equal(upstreamRoute(new URL('https://orbitos.test/api/orbitos/music/search'),'POST'),null);
console.log('PASS: imported track/chat validation, saved libraries, lyrics, playback boundaries, fixed service routes, request limits, range streaming and provider rate limits');
