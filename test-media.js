const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const media=require('./dist/media/media-core.js');

for(const bad of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://user:pass@example.com/song.mp3','not a URL'])assert.equal(media.httpURL(bad),null);
assert.equal(media.soundcloudURL('https://www.soundcloud.com/forss/flickermood?utm_source=test#comments'),'https://soundcloud.com/forss/flickermood');
for(const bad of ['https://soundcloud.com.evil.example/a/b','https://soundcloud.com@evil.example/a/b','http://soundcloud.com/a/b','https://soundcloud.com/search/sounds?q=music','https://soundcloud.com/forss'])assert.equal(media.soundcloudURL(bad),null);
const queue=media.cleanQueue([
 {kind:'soundcloud',url:'https://soundcloud.com/forss/flickermood',title:'Track'},
 {kind:'soundcloud',url:'https://www.soundcloud.com/forss/flickermood?share=yes'},
 {kind:'audio',url:'blob:https://example.com/local',title:'Expired local file'},
 {kind:'audio',url:'https://example.com/music.mp3',title:'x'.repeat(200)},
 {kind:'unknown',url:'https://example.com/untrusted'},null
]);
assert.equal(queue.length,2);
assert.equal(queue[1].title.length,120);
assert.equal(media.cleanQueue(Array.from({length:110},(_,n)=>({kind:'audio',url:'https://example.com/'+n}))).length,100);
assert.deepEqual(media.cleanQueue({}),[]);
const history=media.cleanHistory([{id:'v',position:4,title:'Movie',url:'javascript:bad'}, {id:'v',position:6}, {id:'bad',position:Infinity}, {id:'negative',position:-1}]);
assert.deepEqual(history,[{id:'v',title:'Movie',position:4,url:null,time:0}]);
assert.equal(media.format(3661),'1:01:01');
assert.equal(media.format(NaN),'0:00');

const html=fs.readFileSync('dist/index.html','utf8');
const adapter=fs.readFileSync('dist/media/media.js','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'HTML IDs must be unique');
for(const match of adapter.matchAll(/\$id\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),'Missing media control: '+match[1]);
for(const match of html.matchAll(/<script\b[^>]*src="([^"]+)"/g)){
 const src=match[1];
 if(!/^https?:/.test(src))assert.ok(fs.existsSync('dist/'+src.split('?')[0]),'Missing script '+src);
}
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
const home=html.slice(html.indexOf('id="selfhost-ui"'),html.indexOf('id="page-profile"'));
for(const page of ['music','movies'])assert.ok(home.includes('data-sh-page="'+page+'"'),'Persistent '+page+' launcher missing');
console.log('PASS: media URL validation, queue and history imports, complete media controls, local scripts and persistent home shortcuts');
