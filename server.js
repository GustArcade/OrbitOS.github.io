#!/usr/bin/env node
'use strict';
/**
 * OrbitOS local web proxy backend. Zero npm dependencies.
 * Only the 26 uploaded proxy endpoints are available.
 * Default protocol is HTTP CONNECT; individual selections may override it.
 * A failed proxy connection returns an error; it never silently uses direct networking.
 * This is a basic document/asset rewriting proxy, not a full browser VPN.
 */
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const {URL} = require('node:url');
const {promisify} = require('node:util');
const zlib = require('node:zlib');
const root = path.join(__dirname,'dist');
const PORT = Number(process.env.PORT || 4173);
// For an existing hosted Node environment set ORBIT_BIND_HOST=0.0.0.0,
// ideally behind an authenticated HTTPS reverse proxy.
const BIND_HOST = process.env.ORBIT_BIND_HOST || '127.0.0.1';
const ALLOWED_ORIGIN = process.env.ORBIT_ALLOWED_ORIGIN || '';
const SOCKS_TIMEOUT = 8500;
const MAX_RESPONSE_BYTES = 18 * 1024 * 1024;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const lookup = promisify(dns.lookup);
const {AsyncLocalStorage}=require('node:async_hooks');
const proxyContext=new AsyncLocalStorage();
const PROXY_LIST=require('./proxy-list.json');
const PROXY_BY_ID=new Map(PROXY_LIST.map(p=>[p.id,p]));
const SUPPORTED_PROTOCOLS=new Set(['socks4','socks5','http-connect','https-connect']);
function activeProxy(){return proxyContext.getStore() || PROXY_LIST[0]}
function selectedProxy(route){
  const id=route.searchParams.get('proxy') || '0';
  const found=PROXY_BY_ID.get(id);
  if(!found)throw new Error('Unknown proxy selection; update OrbitOS backend and proxy-list.json');
  const protocol=route.searchParams.get('protocol') || found.protocol;
  if(!SUPPORTED_PROTOCOLS.has(protocol))throw new Error('Unsupported proxy protocol');
  return {...found,protocol};
}


function isUnsafeIP(address) {
  // Disallow internal, loopback, reserved, multicast and link-local network destinations.
  if (net.isIP(address) !== 4) return true;
  const [a,b,c] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 ||
    a === 192 && b === 0 && c === 0 || a === 192 && b === 0 && c === 2 ||
    a === 198 && b === 18 || a === 198 && b === 19 ||
    a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113;
}
function parseTarget(input) {
  if (!input || typeof input !== 'string' || input.length > 4096) throw new Error('Invalid web address');
  const target = new URL(input);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP and HTTPS websites are supported');
  if (target.username || target.password) throw new Error('URLs with embedded passwords are not allowed');
  if (target.hostname.length > 253 || !target.hostname || target.hostname.includes('%')) throw new Error('Invalid hostname');
  const host = target.hostname.toLowerCase().replace(/\.$/, '');
  if (['localhost', 'localhost.localdomain'].includes(host) || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) throw new Error('Local network addresses are blocked');
  if (net.isIP(host) === 6 || net.isIP(host) === 4 && isUnsafeIP(host)) throw new Error('Private and reserved IP addresses are blocked');
  target.hash = '';
  return target;
}
async function resolvePublicIPv4(hostname) {
  const found = await lookup(hostname, {family:4, all:true, verbatim:true});
  const safe = found.find(x => !isUnsafeIP(x.address));
  if (!safe) throw new Error('No permitted public IPv4 destination found');
  return safe.address;
}
function dialSocks4(hostname,destinationPort,ip,use4a=false){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:activeProxy().host,port:activeProxy().port});
    let settled=false;
    const timeout=setTimeout(()=>finish(new Error('The public SOCKS4 proxy timed out')),SOCKS_TIMEOUT);
    const destination=use4a ? '0.0.0.1' : ip;
    const request=Buffer.alloc(9);
    request[0]=4;request[1]=1;request.writeUInt16BE(Number(destinationPort),2);
    Buffer.from(destination.split('.').map(Number)).copy(request,4);request[8]=0;
    function finish(error,connected){
      if(settled)return;settled=true;clearTimeout(timeout);
      socket.off('error',onError);socket.off('data',onData);
      if(error){socket.destroy();reject(error)}
      else{socket.setTimeout(0);resolve(connected)}
    }
    function onError(error){finish(new Error('SOCKS4 relay connection failed: '+error.message))}
    let reply=Buffer.alloc(0);
    function onData(chunk){
      reply=Buffer.concat([reply,chunk]);
      if(reply.length<8)return;
      if(reply[1]!==0x5a)return finish(new Error('SOCKS4 relay rejected request (code '+reply[1]+')'));
      if(reply.length>8)socket.unshift(reply.subarray(8));
      finish(null,socket);
    }
    socket.once('error',onError);
    socket.on('data',onData);
    socket.once('connect',()=>{
      socket.write(use4a?Buffer.concat([request,Buffer.from(hostname,'ascii'),Buffer.from([0])]):request);
    });
  });
}
function dialConnect(hostname,destinationPort){
  const proxy=activeProxy();
  return new Promise((resolve,reject)=>{
    const raw=net.createConnection({host:proxy.host,port:proxy.port});
    let settled=false, reply=Buffer.alloc(0), socket=raw;
    const timeout=setTimeout(()=>finish(new Error('Proxy CONNECT timed out')),SOCKS_TIMEOUT);
    function finish(error,connected){if(settled)return;settled=true;clearTimeout(timeout);socket.removeAllListeners('error');socket.removeAllListeners('data');if(error){socket.destroy();reject(error)}else{socket.setTimeout(0);resolve(connected)}}
    function onData(chunk){reply=Buffer.concat([reply,chunk]);if(reply.length>16384)return finish(new Error('Invalid proxy CONNECT response'));const end=reply.indexOf('\r\n\r\n');if(end<0)return;const first=reply.toString('latin1',0,end).split('\r\n')[0];if(!/^HTTP\/1\.[01] 200\b/.test(first))return finish(new Error('Proxy refused CONNECT: '+first));if(reply.length>end+4)socket.unshift(reply.subarray(end+4));finish(null,socket)}
    raw.on('error',e=>finish(e));raw.on('data',onData);
    raw.on('connect',()=>{
      if(proxy.protocol==='https-connect'){
        socket=tls.connect({socket:raw,servername:net.isIP(proxy.host)?undefined:proxy.host,rejectUnauthorized:true});
        socket.on('error',e=>finish(e));socket.on('data',onData);
        socket.once('secureConnect',()=>socket.write(`CONNECT ${hostname}:${destinationPort} HTTP/1.1\r\nHost: ${hostname}:${destinationPort}\r\nProxy-Connection: close\r\n\r\n`));
      }else socket.write(`CONNECT ${hostname}:${destinationPort} HTTP/1.1\r\nHost: ${hostname}:${destinationPort}\r\n\r\n`);
    });
  });
}
function socks5Connect(hostname,destinationPort){
  // SOCKS5 without authentication. Domain names are resolved by the proxy.
  return new Promise((resolve,reject)=>{
    const proxy=activeProxy();
    const socket=net.createConnection({host:proxy.host,port:proxy.port});
    let settled=false, step='greeting', data=Buffer.alloc(0);
    const timeout=setTimeout(()=>finish(new Error('SOCKS5 proxy timed out')),SOCKS_TIMEOUT);
    function finish(error){
      if(settled)return;settled=true;clearTimeout(timeout);
      socket.removeListener('data',onData);
      socket.removeListener('error',onError);
      if(error){socket.destroy();reject(error)}else{socket.setTimeout(0);resolve(socket)}
    }
    function onError(e){finish(new Error('SOCKS5 connection failed: '+e.message))}
    function onData(chunk){
      data=Buffer.concat([data,chunk]);
      if(step==='greeting'){
        if(data.length<2)return;
        if(data[0]!==5 || data[1]!==0)return finish(new Error('SOCKS5 proxy refused unauthenticated connection'));
        data=data.subarray(2); step='reply';
        let addr;
        if(net.isIP(hostname)===4){
          if(isUnsafeIP(hostname))return finish(new Error('Private IP destinations are blocked'));
          addr=Buffer.from([1,...hostname.split('.').map(Number)]);
        }else{
          const name=Buffer.from(hostname,'utf8');
          if(name.length>253)return finish(new Error('Target hostname is too long'));
          addr=Buffer.concat([Buffer.from([3,name.length]),name]);
        }
        const port=Buffer.alloc(2);port.writeUInt16BE(Number(destinationPort),0);
        socket.write(Buffer.concat([Buffer.from([5,1,0]),addr,port]));
      }
      if(step==='reply'){
        if(data.length<5)return;
        if(data[0]!==5)return finish(new Error('Invalid SOCKS5 response'));
        if(data[1]!==0)return finish(new Error('SOCKS5 relay rejected request ('+data[1]+')'));
        let length;
        if(data[3]===1)length=10;
        else if(data[3]===4)length=22;
        else if(data[3]===3){if(data.length<5)return;length=7+data[4]}
        else return finish(new Error('Unknown SOCKS5 address type'));
        if(data.length<length)return;
        if(data.length>length){socket.pause();socket.unshift(data.subarray(length));}
        finish();
        if(!socket.destroyed)socket.resume();
      }
    }
    socket.on('error',onError);socket.on('data',onData);
    socket.once('connect',()=>socket.write(Buffer.from([5,1,0])));
  });
}
async function socks4Connect(hostname,destinationPort){
  // SOCKS4a gives the proxy the hostname and avoids a local DNS lookup.
  // If a SOCKS4-only relay rejects it, retry with classic SOCKS4 and a safe IPv4 lookup.
  if(net.isIP(hostname)===4){
    if(isUnsafeIP(hostname))throw new Error('Private IP destinations are blocked');
    return dialSocks4(hostname,destinationPort,hostname);
  }
  try {return await dialSocks4(hostname,destinationPort,null,true)}
  catch(error){
    // Connection failures/timeouts indicate an offline relay; don't retry them needlessly.
    if(!/rejected request/.test(error.message))throw error;
    const ip=await resolvePublicIPv4(hostname);
    return dialSocks4(hostname,destinationPort,ip);
  }
}
class HttpSocks4Agent extends http.Agent {
  createConnection(options, callback) {
    (activeProxy().protocol==='socks4'?socks4Connect:activeProxy().protocol==='socks5'?socks5Connect:dialConnect)(options.hostname || options.host, options.port || 80)
      .then(socket => callback(null, socket),callback);
  }
}
class HttpsSocks4Agent extends https.Agent {
  createConnection(options, callback) {
    (activeProxy().protocol==='socks4'?socks4Connect:activeProxy().protocol==='socks5'?socks5Connect:dialConnect)(options.hostname || options.host, options.port || 443).then(socket => {
      let called = false;
      const finish = (e, s) => { if(called) return; called=true; callback(e,s); };
      const secure = tls.connect({socket, servername:options.servername || options.hostname || options.host, rejectUnauthorized:true});
      secure.once('secureConnect', () => finish(null, secure));
      secure.once('error', e => finish(e));
    },callback);
  }
}
const agentHttp = new HttpSocks4Agent({keepAlive:false});
const agentHttps = new HttpsSocks4Agent({keepAlive:false});
function encodeProxy(url) {
  const proxy=activeProxy();
  return '/proxy?url='+encodeURIComponent(url)+'&proxy='+encodeURIComponent(proxy.id)+'&protocol='+encodeURIComponent(proxy.protocol);
}
function skipUrl(value) { return !value || /^(?:#|data:|blob:|javascript:|mailto:|tel:|about:|chrome:)/i.test(value.trim()); }
function rewriteUrl(value, base) {
  const v = String(value || '').trim();
  if (skipUrl(v)) return v;
  try {
    const u = new URL(v,base);
    if (!['http:','https:'].includes(u.protocol)) return v;
    const frag = u.hash;
    u.hash = '';
    return encodeProxy(u.href)+(frag || '');
  } catch { return v; }
}
function rewriteCss(css, base) {
  return String(css)
    .replace(/url\(\s*(["']?)([^'"\)]+)\1\s*\)/gi, (m,q,u)=>'url("'+rewriteUrl(u,base).replace(/"/g,'%22')+'")')
    .replace(/@import\s+(["'])([^'"\n]+)\1/gi,(_,quote,url)=>'@import '+quote+rewriteUrl(url,base)+quote);
}
function rewriteHtml(html, base) {
  let s = String(html);
  // The upstream site may forbid framing with a meta CSP. It's being hosted in a sandboxed iframe.
  s = s.replace(/<meta\b[^>]*http-equiv\s*=\s*['"]?content-security-policy['"]?[^>]*>/gi, '');
  s = s.replace(/<base\b[^>]*>/gi, '');
  s = s.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,(m,css)=>m.replace(css,rewriteCss(css,base)));
  // Rebase HTML links, scripts, images, form actions, iframes, and other resources.
  s = s.replace(/<\/?[a-z][^>]*>/gi, tag => {
    if(/^<\//.test(tag)) return tag;
    return tag.replace(/\b(href|src|action|poster|formaction|data-src|data-href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,(whole,attr,dq,sq,bare)=>{
      const value = dq ?? sq ?? bare;
      let next;
      if(attr.toLowerCase()==='srcset') next=value.split(',').map(part=>{const match=part.trim().match(/^(\S+)(\s+.*)?$/);return match?rewriteUrl(match[1],base)+(match[2]||''):part}).join(', ');
      else next=rewriteUrl(value,base);
      return attr+'="'+next.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"';
    }).replace(/\bintegrity\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  });
  s = s.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi,(m,q,css)=>'style='+q+rewriteCss(css,base)+q);
  const startup = `<script>(function(){
    const base=${JSON.stringify(base)};
    const current=${JSON.stringify(base)};
    function proxied(value){try{const u=new URL(String(value),base);if(!/^https?:$/.test(u.protocol))return value;u.hash='';return encodeProxy(u.href)}catch(e){return value}}
    const oldFetch=window.fetch;
    if(oldFetch) window.fetch=function(input,init){return oldFetch.call(this,typeof input==='string'?proxied(input):input,init)};
    const oldOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url,...args){return oldOpen.call(this,method,proxied(url),...args)};
    try{window.parent.postMessage({type:'orbitos-proxy-navigation',url:current},'*')}catch(e){}
  })();</script>`;
  if(/<head\b[^>]*>/i.test(s)) return s.replace(/<head\b[^>]*>/i,m=>m+'\n'+startup);
  return startup+s;
}
function replyJSON(res, status, data) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
}
function replyError(res, status, msg, asHtml=true) {
  if (!asHtml) return replyJSON(res,status,{error:msg});
  const escaped=String(msg).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:40px 24px;font:16px system-ui;background:#f4f3ff;color:#222}main{max-width:600px;margin:50px auto;background:white;padding:32px;border-radius:20px;box-shadow:0 12px 40px #c4c0da44}h1{font-size:24px}p{line-height:1.6}</style><main><h1>OrbitOS Proxy Web</h1><p>${escaped}</p><p>The selected proxy may be offline or the website may not support proxy viewing. OrbitOS won't send this request directly as a fallback.</p></main>`);
}
function getBody(req,max) {
  return new Promise((resolve,reject)=>{
    let total=0; const chunks=[];
    req.on('data',c=>{total+=c.length;if(total>max){reject(new Error('Request too large'));req.destroy();return;} chunks.push(c)});
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
async function fetchViaSocks(target, method='GET', body=Buffer.alloc(0), incomingHeaders={}) {
  const safeTarget=parseTarget(target.href);
  const secure=safeTarget.protocol==='https:';
  return new Promise((resolve,reject)=>{
    const headers = {
      'user-agent': 'Mozilla/5.0 (compatible; OrbitOS ProxyWeb/4.1)',
      'accept': incomingHeaders.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': incomingHeaders['accept-language'] || 'en-GB,en;q=0.8',
      'accept-encoding': 'identity',
      'connection': 'close',
    };
    if(body.length) {
      headers['content-length']=body.length;
      if(incomingHeaders['content-type']) headers['content-type']=incomingHeaders['content-type'];
    }
    const request=(secure?https:http).request({
      protocol:safeTarget.protocol, hostname:safeTarget.hostname,
      port:Number(safeTarget.port)|| (secure?443:80),
      path:safeTarget.pathname+safeTarget.search, method,
      agent:secure?agentHttps:agentHttp, headers, timeout:20000,
    },upstream=>{
      let length=0;const chunks=[];
      upstream.on('data',part=>{length+=part.length;if(length>MAX_RESPONSE_BYTES){upstream.destroy(new Error('Site response is too large for embedded proxy mode'));return;}chunks.push(part)});
      upstream.on('end',()=>resolve({status:upstream.statusCode||502,headers:upstream.headers,body:Buffer.concat(chunks)}));
      upstream.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('Upstream website timed out')));
    request.on('error',reject);
    if(body.length)request.write(body);
    request.end();
  });
}
function decodeBody(buffer, encoding) {
  const e=(encoding||'').toLowerCase();
  try {if(e.includes('gzip'))return zlib.gunzipSync(buffer);if(e.includes('br'))return zlib.brotliDecompressSync(buffer);if(e.includes('deflate'))return zlib.inflateSync(buffer)}catch{}
  return buffer;
}
async function handleProxy(req,res, route) {
  const target=parseTarget(route.searchParams.get('url'));
  if(!['GET','HEAD','POST'].includes(req.method)) return replyError(res,405,'Method not supported');
  const body=req.method==='POST'?await getBody(req,MAX_REQUEST_BYTES):Buffer.alloc(0);
  let upstream;
  try {upstream=await fetchViaSocks(target,req.method,body,req.headers)}
  catch(e){return replyError(res,502,'Proxy connection failed: '+e.message)}
  let url=target.href;
  const contentType=String(upstream.headers['content-type']||'application/octet-stream');
  if([301,302,303,307,308].includes(upstream.status) && upstream.headers.location) {
    let next;
    try {next=parseTarget(new URL(upstream.headers.location,target.href).href)}
    catch(e){return replyError(res,502,'The destination redirected to an unsupported or local-network address');}
    res.writeHead(302, {'Location':encodeProxy(next.href), 'Cache-Control':'no-store'});
    return res.end();
  }
  let bytes=decodeBody(upstream.body,upstream.headers['content-encoding']);
  const responseHeaders={
    'Content-Type':contentType,
    'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*', // required by sandboxed frame JS (opaque origin)
  };
  if(/^text\/html\b|application\/xhtml\+xml/i.test(contentType)) {
    bytes=Buffer.from(rewriteHtml(bytes.toString('utf8'),url),'utf8');
    responseHeaders['Content-Type']='text/html; charset=utf-8';
  } else if(/^text\/css\b/i.test(contentType)) {
    bytes=Buffer.from(rewriteCss(bytes.toString('utf8'),url),'utf8');
    responseHeaders['Content-Type']='text/css; charset=utf-8';
  }
  res.writeHead(upstream.status,responseHeaders);
  if(req.method==='HEAD')return res.end();
  res.end(bytes);
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
function staticFile(req,res,route) {
  if(req.method!=='GET'&&req.method!=='HEAD')return replyJSON(res,405,{error:'Method not supported'});
  let pathname;
  try {pathname=decodeURIComponent(route.pathname)} catch{return replyJSON(res,400,{error:'Bad path'});}
  const filePath=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filePath.startsWith(root+path.sep))return replyJSON(res,403,{error:'Blocked path'});
  fs.readFile(filePath,(e,data)=>{
    if(e) return replyJSON(res,404,{error:'File not found'});
    res.writeHead(200,{'Content-Type':types[path.extname(filePath)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  });
}
// Mount these routes inside an existing Node/Express web server without
// starting another listener. Returns true when a request was handled.
async function handleOrbitProxyRequest(req,res) {
  let route;
  try { route=new URL(req.url,'http://orbitos.local'); }
  catch { replyJSON(res,400,{error:'Invalid URL'});return true; }
  if(!['/api/proxy-status','/api/proxy-test','/api/proxy-list','/proxy'].includes(route.pathname))return false;
  try {
    if(ALLOWED_ORIGIN && req.headers.origin===ALLOWED_ORIGIN &&
        ['/api/proxy-status','/api/proxy-test','/api/proxy-list'].includes(route.pathname)) {
      res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGIN);
      res.setHeader('Vary','Origin');
    }
    if(route.pathname==='/api/proxy-list'){replyJSON(res,200,{proxies:PROXY_LIST});return true;}
    const selected=selectedProxy(route);
    return await proxyContext.run(selected,async()=>{
    if(route.pathname==='/api/proxy-status'){
      replyJSON(res,200,{configured:true,protocol:selected.protocol,host:selected.host,port:selected.port,mode:'hosted-http-bridge',totalProxies:PROXY_LIST.length});
      return true;
    }
    if(route.pathname==='/api/proxy-test'){
      try{
        const target=parseTarget('https://example.com/');
        const result=await fetchViaSocks(target,'GET');
        replyJSON(res,200,{ok:result.status>=200&&result.status<400,httpStatus:result.status,proxy:selected.host+':'+selected.port});
      }catch(e){replyJSON(res,502,{ok:false,error:e.message,proxy:selected.host+':'+selected.port})}
      return true;
    }
    await handleProxy(req,res,route);
    return true;
    });
  } catch(e) {
    if(!res.headersSent)replyError(res,400,e.message,route.pathname==='/proxy');
    else res.destroy();
    return true;
  }
}
function createServer() {
  return http.createServer(async(req,res)=>{
    if(req.url.startsWith('/api/orbitos/')||req.url.startsWith('/api/orbit-cloud/')){
      try{
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>6000000){replyJSON(res,413,{error:'This request is too large.'});return}chunks.push(chunk)}
        const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
        const scheme=req.headers['x-forwarded-proto']==='https'?'https':'http';const request=new Request(scheme+'://'+(req.headers.host||'orbitos.local')+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
        const cloud=req.url.startsWith('/api/orbit-cloud/'),service=await import(cloud?'./services/cloud-service.mjs':'./services/orbit-service.mjs');const response=await (cloud?service.handleCloudApi:service.handleOrbitApi)(request);
        res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const {Readable}=require('node:stream');Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res)}else res.end();
      }catch{if(!res.headersSent)replyJSON(res,502,{error:'OrbitOS could not connect to the service.'});else res.destroy()}
      return;
    }
    if(await handleOrbitProxyRequest(req,res))return;
    let route;
    try{route=new URL(req.url,'http://orbitos.local')}
    catch{return replyJSON(res,400,{error:'Invalid URL'});}
    return staticFile(req,res,route);
  });
}
if (require.main===module) {
  const server=createServer();
  server.listen(PORT,BIND_HOST,()=>{
    console.log('\nOrbitOS HTTP bridge is listening on '+BIND_HOST+':'+PORT);
    console.log('Proxy endpoints loaded: '+PROXY_LIST.length+' (connection not verified)');
    console.log('If deployed publicly, put this service behind HTTPS access control.\n');
  });
}
module.exports={createServer,handleOrbitProxyRequest,parseTarget,rewriteUrl,rewriteHtml,rewriteCss,isUnsafeIP,socks4Connect};
