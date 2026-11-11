'use strict';
const assert=require('node:assert/strict');
const net=require('node:net');
const presets=require('./proxy-list.json');
const fs=require('node:fs');
const uploaded=fs.readFileSync(__dirname+'/imported-proxies.txt','utf8').trim().split(/\r?\n/).filter(Boolean);
const newPresets=presets.filter(p=>p.source==='Uploaded TXT');
assert.equal(presets.length,26);
assert.equal(newPresets.length,26);
assert.deepEqual(newPresets.map(p=>`${p.host}:${p.port}`),uploaded);
assert.equal(new Set(presets.map(p=>`${p.host}:${p.port}`)).size,26);
assert.ok(presets.every((p,i)=>p.id===String(i)));
assert.ok(presets.every(p=>p.source==='Uploaded TXT'));
assert.ok(newPresets.every(p=>p.protocol==='http-connect'));

async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
function fakeRelay(protocol){
  return net.createServer(socket=>{
    let stage=protocol==='socks5'?'greeting':'connect';
    let body='';
    socket.on('data',chunk=>{
      if(stage==='greeting'){
        assert.deepEqual([...chunk],[5,1,0]);
        stage='request';socket.write(Buffer.from([5,0]));return;
      }
      if(stage==='request'){
        assert.equal(chunk[0],5);assert.equal(chunk[1],1);
        stage='http';socket.write(Buffer.from([5,0,0,1,1,1,1,1,0,80]));return;
      }
      if(stage==='connect'){
        body+=chunk.toString('utf8');
        if(!body.includes('\r\n\r\n'))return;
        assert.match(body,/CONNECT 1\.1\.1\.1:80 HTTP\/1\.1/);
        body='';stage='http';socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');return;
      }
      if(stage==='http'){
        body+=chunk.toString('utf8');
        if(!body.includes('\r\n\r\n'))return;
        assert.match(body,/GET \/test HTTP\/1\.1/);
        const html='<html><body><a href="/ok">Hello</a></body></html>';
        socket.end('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: '+Buffer.byteLength(html)+'\r\nConnection: close\r\n\r\n'+html);
      }
    });
  });
}
(async()=>{
  const httpProxy=fakeRelay('http-connect');
  const socksProxy=fakeRelay('socks5');
  const httpPort=await listen(httpProxy), socksPort=await listen(socksProxy);
  // Mutate in-memory allowlist only during tests, before loading server module.
  presets[0].host='127.0.0.1';presets[0].port=httpPort;
  presets[1].host='127.0.0.1';presets[1].port=socksPort;
  const {createServer}=require('./server.js');
  const server=createServer(), port=await listen(server);
  const base='http://127.0.0.1:'+port;
  try{
    const list=await (await fetch(base+'/api/proxy-list')).json();
    assert.equal(list.proxies.length,26);
    const status=await (await fetch(base+'/api/proxy-status?proxy=0')).json();
    assert.equal(status.protocol,'http-connect');assert.equal(status.port,httpPort);
    const status2=await (await fetch(base+'/api/proxy-status?proxy=1&protocol=socks5')).json();
    assert.equal(status2.protocol,'socks5');assert.equal(status2.port,socksPort);
    const bad=await fetch(base+'/api/proxy-status?proxy=99999');
    assert.equal(bad.status,400);
    const badProto=await fetch(base+'/api/proxy-status?proxy=0&protocol=ftp');
    assert.equal(badProto.status,400);
    const target=encodeURIComponent('http://1.1.1.1/test');
    const h=await fetch(base+'/proxy?url='+target+'&proxy=0');
    const ht=await h.text();
    assert.equal(h.status,200,ht);
    assert.ok(ht.includes('proxy=0&amp;protocol=http-connect')||ht.includes('proxy=0&protocol=http-connect'),ht);
    const sock=await fetch(base+'/proxy?url='+target+'&proxy=1&protocol=socks5');
    const sockText=await sock.text();
    assert.equal(sock.status,200,sockText);
    assert.ok(sockText.includes('proxy=1'),sockText);
    const secure=await fetch(base+'/proxy?url='+encodeURIComponent('http://127.0.0.1/admin')+'&proxy=0');
    assert.equal(secure.status,400);
    console.log('PASS: 26 uploaded-only proxies, protocol override, HTTP CONNECT, SOCKS5, selected-link rewriting, private-IP block');
  }finally{
    await new Promise(r=>server.close(r));
    await new Promise(r=>httpProxy.close(r));
    await new Promise(r=>socksProxy.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
