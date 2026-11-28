import {resolve,relative,isAbsolute} from 'node:path';
import {isAllowedApiPath} from '../deploy/worker/proxy.mjs';

export function previewApiPath(pathname,search=''){
 if(!pathname.startsWith('/preview-api/'))return null;
 const path=pathname.slice('/preview-api'.length);
 if(!isAllowedApiPath(path)||/[\\\u0000-\u001f]/.test(search)||search&&!search.startsWith('?'))return null;
 return path+search;
}
export function previewFilePath(root,pathname){
 if(/[\\:\u0000-\u001f]/.test(pathname)||pathname.split('/').some(part=>part.startsWith('.')))return null;
 if(pathname!=='/'&&!/^\/(?:src\/|student\/|teacher\/|admin\/|about\/|privacy\/|terms\/|auth-action\/|assets\/|downloads\/|index\.html$)/.test(pathname))return null;
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 const child=relative(resolve(root),file);
 return child==='..'||child.startsWith('../')||child.startsWith('..\\')||isAbsolute(child)?null:file;
}
