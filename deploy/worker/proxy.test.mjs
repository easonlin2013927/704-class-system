import test from 'node:test';
import assert from 'node:assert/strict';
import {proxyRequest} from './proxy.mjs';
const origin='https://easonlin2013927.github.io',base='https://example.workers.dev';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=3600','Set-Cookie':'never=forward'}});
test('preflight is local and permits credentials only for the exact origin',async()=>{
 let hits=0;const request=new Request(base+'/login',{method:'OPTIONS',headers:{Origin:origin}});
 const r=await proxyRequest(request,{fetchUpstream:()=>{hits++;throw Error('unexpected');}});
 assert.equal(r.status,204);assert.equal(hits,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(r.headers.get('Access-Control-Allow-Credentials'),'true');
 const denied=await proxyRequest(new Request(base+'/login',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}}));assert.equal(denied.status,403);
});
test('login forwards to fixed HTTPS destination and does not cache tokens/cookies',async()=>{
 const body=JSON.stringify({email:'fixture',password:'test-only'});
 const r=await proxyRequest(new Request(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'private=not-forwarded'},body}),{fetchUpstream:async(url,options)=>{assert.equal(url,'https://api704.easonlin2013927.dpdns.org/login');assert.equal(new TextDecoder().decode(options.body),body);assert.equal(options.headers.get('Cookie'),null);assert.equal(options.headers.get('Origin'),origin);assert.equal(options.redirect,'manual');return json({token:'fixture-token'});}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{token:'fixture-token'});assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Set-Cookie'),null);
});
test('authenticated request keeps authorization and history cursor; query cannot select another host',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const r=await proxyRequest(new Request(`${base}/school/rooms/${id}/messages?before=${id}&url=https://other.example`,{headers:{Authorization:'Bearer fixture'}}),{fetchUpstream:async(url,options)=>{assert.equal(new URL(url).host,'api704.easonlin2013927.dpdns.org');assert.equal(new URL(url).searchParams.get('before'),id);assert.equal(options.headers.get('Authorization'),'Bearer fixture');return json([]);}});assert.equal(r.status,200);
});
test('reject oversized bodies, unknown paths, redirects, HTML challenges, and network failures',async()=>{
 let hits=0;const upstream=async()=>{hits++;return json({});};
 const huge=await proxyRequest(new Request(base+'/login',{method:'POST',body:'x'.repeat(4*1024*1024+1)}),{fetchUpstream:upstream});assert.equal(huge.status,413);assert.equal(hits,0);
 assert.equal((await proxyRequest(new Request(base+'/arbitrary/proxy'))).status,404);
 for(const response of [new Response(null,{status:302,headers:{Location:'https://other.example'}}),new Response('<html>challenge</html>',{status:403,headers:{'Content-Type':'text/html'}})])assert.equal((await proxyRequest(new Request(base+'/health'),{fetchUpstream:async()=>response})).status,502);
 assert.equal((await proxyRequest(new Request(base+'/health'),{fetchUpstream:async()=>{throw Error('network secret');}})).status,502);
});
test('API permission failures keep status and JSON message',async()=>{const r=await proxyRequest(new Request(base+'/admin/accounts',{headers:{Origin:origin,Authorization:'Bearer fixture'}}),{fetchUpstream:async()=>json({message:'沒有權限'},403)});assert.equal(r.status,403);assert.equal((await r.json()).message,'沒有權限');});
test('streams large file downloads without converting them to JSON',async()=>{const id='11111111-1111-4111-8111-111111111111',payload=new Uint8Array([1,2,3,4]);const r=await proxyRequest(new Request(`${base}/school/chat-attachments/${id}`,{headers:{Origin:origin}}),{fetchUpstream:async()=>new Response(payload,{headers:{'Content-Type':'application/octet-stream','Content-Length':'4','Content-Disposition':"attachment; filename*=UTF-8''file.bin"}})});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Length'),'4');assert.equal(r.headers.get('Content-Disposition'),"attachment; filename*=UTF-8''file.bin");assert.deepEqual(new Uint8Array(await r.arrayBuffer()),payload);});
