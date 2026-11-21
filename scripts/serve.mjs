import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { extname, join, normalize } from "node:path";

const root = process.env.PREVIEW_SOURCE === "1" ? process.cwd() : join(process.cwd(), "dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

createServer(async (request, response) => {
  try {
    const localUrl = new URL(request.url, "http://127.0.0.1:4173");
    const pathname = decodeURIComponent(localUrl.pathname);
    if (!['127.0.0.1:4173','localhost:4173'].includes(request.headers.host)) {
      response.writeHead(403);response.end('Local preview only');return;
    }
    if (pathname.startsWith('/preview-api/')) {
      if (request.headers.origin && !['http://127.0.0.1:4173','http://localhost:4173'].includes(request.headers.origin)) {
        response.writeHead(403);response.end('Origin not allowed');return;
      }
      const apiPath=pathname.slice('/preview-api'.length)+localUrl.search;
      const headers={};
      for(const key of ['authorization','content-type']) if(request.headers[key]) headers[key]=request.headers[key];
      const session=(request.headers.cookie||'').match(/(?:^|;\s*)preview704=([0-9a-f]{64})(?:;|$)/)?.[1];
      if(!headers.authorization&&session) headers.authorization='Bearer '+session;
      const upstream=httpsRequest('https://704-announcement-api.easonlin2013927.workers.dev'+apiPath,{method:request.method,headers,timeout:30000},remote=>{
        response.statusCode=remote.statusCode;
        response.setHeader('Cache-Control','no-store');
        for(const key of ['content-type','content-disposition'])if(remote.headers[key])response.setHeader(key,remote.headers[key]);
        if(['/login','/account/password','/auth/firebase'].includes(apiPath)&&remote.statusCode===200){
          const chunks=[];remote.on('data',chunk=>chunks.push(chunk));remote.on('end',()=>{
            const body=Buffer.concat(chunks);try{const data=JSON.parse(body);if(/^[0-9a-f]{64}$/.test(data.token||''))response.setHeader('Set-Cookie',`preview704=${data.token}; HttpOnly; SameSite=Strict; Path=/preview-api${data.remembered?'; Max-Age=34560000':''}`);}catch{}
            response.end(body);
          });
        }else{
          if(apiPath==='/logout')response.setHeader('Set-Cookie','preview704=; HttpOnly; SameSite=Strict; Path=/preview-api; Max-Age=0');
          remote.pipe(response);
        }
      });
      upstream.on('timeout',()=>upstream.destroy());
      upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json'});response.end(JSON.stringify({message:'本機預覽無法連接正式 API，請稍後重試。'}));});
      request.pipe(upstream);return;
    }
    if(pathname==='/src/config.js'){
      response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
      response.end('export const config = {url: location.origin + "/preview-api"};');return;
    }
    if(pathname.split('/').some(part=>part.startsWith('.'))||!(/^\/(?:src\/|student\/|teacher\/|admin\/|assets\/|downloads\/|index\.html$)/.test(pathname)||pathname==='/')){
      response.writeHead(404);response.end('Not found');return;
    }
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, safePath === "/" ? "index.html" : safePath);
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("Local preview: http://127.0.0.1:4173"));
