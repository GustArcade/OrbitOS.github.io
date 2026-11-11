const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');

(async () => {
  const socks = net.createServer(socket => {
    let isConnected = false;
    let handshakeData = Buffer.alloc(0);
    socket.on('data',chunk=>{
      if(!isConnected) {
        handshakeData = Buffer.concat([handshakeData,chunk]);
        if(handshakeData.length<9)return;
        assert.equal(handshakeData[0],4,'SOCKS protocol must be v4');
        assert.equal(handshakeData[1],1,'SOCKS operation must be CONNECT');
        socket.write(Buffer.from([0,90,0,0,0,0,0,0]));
        isConnected=true;
        return;
      }
      const req=chunk.toString();
      if(req.includes('\r\n\r\n')){
        const html='<html><head><link rel="stylesheet" href="/style.css"><style>div{background:url(/bg.png)}</style></head><body><a href="/about">About</a><img src="https://1.1.1.1/logo.png"><script src="/js/app.js"></script></body></html>';
        socket.end('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: '+Buffer.byteLength(html)+'\r\nConnection: close\r\n\r\n'+html);
      }
    });
  });
  await new Promise(resolve=>socks.listen(0,'127.0.0.1',resolve));
  const presets=require('./proxy-list.json');presets[0].host='127.0.0.1';presets[0].port=socks.address().port;presets[0].protocol='socks4';
  const {createServer,parseTarget,rewriteHtml,isUnsafeIP} = require('./server.js');
  assert.throws(()=>parseTarget('http://127.0.0.1:3000'),/Private/);
  assert.throws(()=>parseTarget('http://localhost'),/Local/);
  assert.throws(()=>parseTarget('file:///etc/passwd'),/Only HTTP/);
  assert.ok(isUnsafeIP('10.1.2.3'));
  assert.ok(!isUnsafeIP('1.1.1.1'));
  const server = createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const check=await fetch(base+'/api/proxy-status');
  assert.equal(check.status,200);
  const htmlResponse=await fetch(base+'/proxy?url='+encodeURIComponent('http://1.1.1.1/test'));
  const html=await htmlResponse.text();
  console.log('proxy response',htmlResponse.status,html.slice(0,130));
  assert.equal(htmlResponse.status,200,html);
  assert.ok(html.includes('/proxy?url=http%3A%2F%2F1.1.1.1%2Fabout&amp;proxy=0') || html.includes('/proxy?url=http%3A%2F%2F1.1.1.1%2Fabout&proxy=0'));
  assert.ok(html.includes('/proxy?url=http%3A%2F%2F1.1.1.1%2Fstyle.css'));
  assert.ok(html.includes('SOCKS4')===false);
  assert.ok(html.includes('XMLHttpRequest.prototype.open'));
  const domainResp=await fetch(base+'/proxy?url='+encodeURIComponent('http://example.org/'));
  assert.equal(domainResp.status,200,'SOCKS4a hostname routing failed');
  const protectedResp=await fetch(base+'/proxy?url='+encodeURIComponent('http://127.0.0.1/'));
  assert.equal(protectedResp.status,400);
  socks.close();
  server.close();
  console.log('PASS: proxy handshake, HTML rewriting, private-IP blocking, status endpoint');
})().catch(e=>{console.error(e);process.exit(1)})
