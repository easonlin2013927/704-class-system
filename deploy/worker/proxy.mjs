const UPSTREAM='https://api704.easonlin2013927.dpdns.org';
const ORIGIN='https://easonlin2013927.github.io';
const MAX_BODY=4*1024*1024;
const METHODS=['GET','POST','PUT','PATCH','DELETE','OPTIONS'];
const ID='[0-9a-fA-F-]{36}';
const paths=new RegExp(`^(?:/(?:health|login|logout|me)|/account/password|/public/banner|/settings/(?:banner|marquee)|/admin/(?:accounts(?:/${ID})?|status)|/(?:announcements|countdowns)(?:/${ID}(?:/comments(?:/${ID})?)?)?|/school/[a-z-]+(?:/${ID}(?:/(?:check|messages|members|leave|report|download))?)?)$`);
function responseHeaders(origin){const h=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Content-Type':'application/json; charset=utf-8'});if(origin===ORIGIN){h.set('Access-Control-Allow-Origin',ORIGIN);h.set('Access-Control-Allow-Credentials','true');h.set('Access-Control-Allow-Methods',METHODS.join(', '));h.set('Access-Control-Allow-Headers','Content-Type, Authorization');h.set('Access-Control-Expose-Headers','Content-Disposition, Content-Length');h.set('Access-Control-Max-Age','600');}return h;}
function error(status,message,headers){return new Response(JSON.stringify({message}),{status,headers});}
async function readBody(request){
 if(Number(request.headers.get('content-length'))>MAX_BODY)throw Object.assign(new Error('內容過長'),{status:413});
 if(!request.body)return undefined;
 const reader=request.body.getReader(),chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BODY){await reader.cancel();throw Object.assign(new Error('內容過長'),{status:413});}chunks.push(value);}
 const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}return body;
}
export async function proxyRequest(request,{fetchUpstream=fetch}={}){
 const origin=request.headers.get('origin'),headers=responseHeaders(origin);
 if(origin&&origin!==ORIGIN)return error(403,'來源不被允許',headers);
 const url=new URL(request.url);
 if(!paths.test(url.pathname))return error(404,'找不到此功能',headers);
 if(!METHODS.includes(request.method))return error(405,'不支援此方法',headers);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const upstreamHeaders=new Headers();
 for(const key of ['Authorization','Content-Type'])if(request.headers.has(key))upstreamHeaders.set(key,request.headers.get(key));
 const cookie=request.headers.get('Cookie')||'';const session=cookie.match(/(?:^|;\s*)__Host-704session=([0-9a-f]{64})(?:;|$)/)?.[1];
 if(!upstreamHeaders.has('Authorization')&&session)upstreamHeaders.set('Authorization','Bearer '+session);
 if(origin)upstreamHeaders.set('Origin',origin);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const body=['GET','HEAD'].includes(request.method)?undefined:await readBody(request);
  const target=new URL(url.pathname+url.search,UPSTREAM);
  const upstream=await fetchUpstream(target.href,{method:request.method,headers:upstreamHeaders,body,redirect:'manual',signal:controller.signal,cf:{cacheTtl:0,cacheEverything:false}});
  if(upstream.status>=300&&upstream.status<400)return error(502,'公告服務網址發生重新導向，請聯絡管理員',headers);
  const fileDownload=request.method==='GET'&&(new RegExp(`^/school/(?:(?:chat-)?attachments|profile-files)/${ID}$`).test(url.pathname)||new RegExp(`^/school/backups/${ID}/download$`).test(url.pathname));
  if(!upstream.headers.get('content-type')?.includes('application/json')&&!fileDownload)return error(502,'公告主機暫時沒有提供正常回應，請稍後再試',headers);
  if(fileDownload&&upstream.ok){headers.set('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');for(const key of ['Content-Disposition','Content-Length'])if(upstream.headers.has(key))headers.set(key,upstream.headers.get(key));return new Response(upstream.body,{status:upstream.status,headers});}
  if((url.pathname==='/login'||url.pathname==='/account/password')&&upstream.ok){const result=await upstream.json();if(/^[0-9a-f]{64}$/.test(result.token||'')){headers.append('Set-Cookie','__Host-704session=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0');headers.append('Set-Cookie',`__Host-704session=${result.token}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned${result.remembered?'; Max-Age=34560000':''}`);}return new Response(JSON.stringify(result),{status:upstream.status,headers});}
  if(url.pathname==='/logout'){headers.append('Set-Cookie','__Host-704session=; Path=/; Secure; HttpOnly; SameSite=None; Partitioned; Max-Age=0');headers.append('Set-Cookie','__Host-704session=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0');}
  return new Response(upstream.body,{status:upstream.status,headers});
 }catch(e){return error(e.status===413?413:502,e.status===413?'內容過長':'無法連接公告主機，請稍後再試',headers);}
 finally{clearTimeout(timeout);}
}
export default {fetch(request){return proxyRequest(request);}};
