import { config } from "./config.js?v=0.27.1";
import {confirmAction} from './feedback.js';
let token = null;
const pendingDeletes=new Set();
async function request(path, options = {}) {
  if (!config.url) throw new Error("系統尚未設定雲端服務，請聯絡管理員。");
  const bulk=/^\/school\/(?:grades|homework|records)-bulk$/.test(path)&&options.method==='PATCH'?JSON.parse(options.body||'{}'):null;
  const deletion=!options.silent&&((options.method==='DELETE'&&!/^\/(?:account\/providers\/|school\/(?:push-subscription|security-sessions|chat-blocks)(?:\/|$))/.test(path))||bulk?.action==='delete');
  const deleteKey=deletion?path+'\n'+(options.body||''):null;
  if(deleteKey&&pendingDeletes.has(deleteKey))throw Object.assign(new Error(''),{name:'AbortError',code:'USER_CANCELLED'});
  if(deletion){
    pendingDeletes.add(deleteKey);
    const labels=[[/^\/admin\/accounts\//,'帳號'],[/\/comments\//,'評論'],[/^\/announcements\//,'公告'],[/^\/countdowns\//,'倒數活動'],[/\/backups\//,'備份'],[/\/board\//,'便利貼'],[/\/grades(?:\/|-bulk)/,'成績'],[/\/homework(?:\/|-bulk)/,'作業'],[/\/records(?:\/|-bulk)/,'學生紀錄'],[/\/messages\//,'訊息'],[/\/mailboxes\//,'電子郵件信箱']];
    const label=labels.find(([pattern])=>pattern.test(path))?.[1]||'項目';
    const message=`確定刪除${bulk?.ids?.length?`這 ${bulk.ids.length} 筆`:'這個'}${label}？刪除後無法復原。`;
    let confirmed=false;
    try{confirmed=await confirmAction(message);}finally{if(!confirmed)pendingDeletes.delete(deleteKey);}
    if(!confirmed)throw Object.assign(new Error(''),{name:'AbortError',code:'USER_CANCELLED'});
  }
  const mutation=!!options.method && options.method!=='GET' && !options.silent;
  if(mutation)window.dispatchEvent(new Event('operation-start'));
  try {
  let response;
  try {
    response = await fetch(config.url.replace(/\/$/, "") + path, {
      ...options,
      credentials: "include",
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
        "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  } catch { throw new Error("無法連接公告服務，請確認網路或聯絡管理員。"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if(response.status===401&&!path.startsWith('/auth/email/')&&!['/login','/auth/firebase','/public/auth-config'].includes(path)){token=null;window.dispatchEvent(new Event("session-expired"));}
    if(data.code==="PASSWORD_CHANGE_REQUIRED")window.dispatchEvent(new Event("password-required"));
    throw Object.assign(new Error(data.message || "雲端操作失敗，請稍後重試。"),{code:data.code,status:response.status});
  }
  if(mutation)window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:true,path,deleted:deletion}}));
  return data;
  } catch(error) {if(mutation)window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:false,path,message:error.message}}));throw error;} finally { if(mutation)window.dispatchEvent(new Event('operation-end'));if(deleteKey)pendingDeletes.delete(deleteKey); }
}
export const cloud = {
  emailAction(action,data){return request('/auth/email/'+action,{method:'POST',body:JSON.stringify(data),silent:true});},
  async loginData(profile,onAccess=()=>{}){
    const restricted=profile.must_change_password||profile.must_add_email||profile.must_change_email;
    const accessReady=cloud.school('permissions').catch(()=>null).then(access=>{onAccess(access);return access;});
    try{
    const [access,preferences,mailboxes,announcements,countdowns]=await Promise.all([
      accessReady,
      cloud.school('preferences').catch(()=>null),
      profile.must_change_password?null:cloud.school('mailboxes').catch(()=>null),
      restricted?[]:cloud.list(),
      restricted?[]:cloud.countdowns(),
    ]);
    return {access,preferences,mailboxes,announcements,countdowns};
    }catch(error){await accessReady;throw error;}
  },
  authConfig(){return request('/public/auth-config');},
  providers(){return request('/account/providers');},
  bindProvider(provider,value){return request('/account/providers/'+encodeURIComponent(provider),{method:'POST',body:JSON.stringify(value)});},
  unlinkProvider(provider,value){return request('/account/providers/'+encodeURIComponent(provider),{method:'DELETE',body:JSON.stringify(value)});},
  async loginFirebase(firebaseToken,portal,remember=false,provider='google'){
    token=null;
    const result=await request('/auth/firebase',{method:'POST',body:JSON.stringify({token:firebaseToken,portal,remember,provider})});
    token=result.token;
    return result.profile;
  },
  presence(value={}){return request('/school/presence',{method:'POST',body:JSON.stringify(value),silent:true});},
  school(path,method='GET',value){return request('/school/'+path,{method,...(value===undefined?{}:{body:JSON.stringify(value)})});},
  async downloadBackup(id){
    window.dispatchEvent(new Event('operation-start'));
    try{
      const response=await fetch(config.url.replace(/\/$/,'')+'/school/backups/'+encodeURIComponent(id)+'/download',{credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{})},cache:'no-store'});
      if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.message||'備份下載失敗');}
      const blob=await response.blob(),disposition=response.headers.get('Content-Disposition')||'',match=disposition.match(/filename="([^"]+)"/),url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=match?.[1]||'704-backup.json.gz';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:true}}));
    }catch(error){window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:false,message:error.message}}));throw error;}
    finally{window.dispatchEvent(new Event('operation-end'));}
  },
  attachments(post){return request('/school/attachments?post='+encodeURIComponent(post));},
  async uploadAttachment(post,file,onProgress=()=>{}){if(file.size>400*1024*1024)throw new Error('單一公告附件不能超過 400 MB');const entry=await request('/school/attachments',{method:'POST',body:JSON.stringify({announcement_id:post,name:file.name,type:file.type||'application/octet-stream',size:file.size})});try{const chunkSize=4*1024*1024;for(let offset=0;offset<file.size||offset===0;offset+=chunkSize){const part=file.slice(offset,Math.min(file.size,offset+chunkSize)),complete=offset+part.size>=file.size;const response=await fetch(config.url.replace(/\/$/,'')+'/school/attachments/'+entry.id+'?complete='+complete,{method:'PATCH',credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/octet-stream'},body:part});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'公告附件上傳失敗');onProgress(file.size?Math.min(100,Math.floor((offset+part.size)/file.size*100)):100);}}catch(e){await request('/school/attachments/'+entry.id,{method:'DELETE',silent:true}).catch(()=>{});throw e;}},
  downloadAttachment(id){const anchor=document.createElement('a');anchor.href=config.url.replace(/\/$/,'')+'/school/attachments/'+encodeURIComponent(id);anchor.rel='noopener';document.body.append(anchor);anchor.click();anchor.remove();},
  async uploadChatAttachment(messageId,file,onProgress=()=>{}){
    if(!(file instanceof File))throw new Error('請選擇要傳送的檔案');
    if(file.size>400*1024*1024)throw new Error('單一聊天檔案上限為 400 MB');
    const entry=await request('/school/chat-attachments',{method:'POST',body:JSON.stringify({message_id:messageId,name:file.name,type:file.type||'application/octet-stream',size:file.size})});
    try{
      const chunkSize=4*1024*1024;
      for(let offset=0;offset<file.size||offset===0;offset+=chunkSize){
        const part=file.slice(offset,Math.min(file.size,offset+chunkSize));
        const complete=offset+part.size>=file.size;
        const response=await fetch(config.url.replace(/\/$/,'')+'/school/chat-attachments/'+entry.id+'?complete='+complete,{method:'PATCH',credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/octet-stream'},body:part});
        const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'檔案上傳失敗');
        onProgress(file.size?Math.min(100,Math.floor((offset+part.size)/file.size*100)):100);
      }
      return entry;
    }catch(error){
      await request('/school/chat-attachments/'+entry.id,{method:'DELETE',silent:true}).catch(()=>{});
      throw error;
    }
  },
  async downloadChatAttachment(id,onProgress=()=>{}){
    const response=await fetch(config.url.replace(/\/$/,'')+'/school/chat-attachments/'+encodeURIComponent(id),{credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{})},cache:'no-store'});
    if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.message||'聊天附件下載失敗');}
    let blob,name;
    onProgress(null);
    if(response.headers.get('Content-Type')?.includes('application/json')&&!response.headers.get('Content-Disposition')?.includes('attachment')){const file=await response.json();name=file.name;const data=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));blob=new Blob([data],{type:file.type||'application/octet-stream'});}
    else{
      const length=response.headers.get('Content-Encoding')?0:Number(response.headers.get('Content-Length')),reader=response.body?.getReader();
      if(reader){const chunks=[];let received=0;try{while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;if(length>0)onProgress(Math.min(100,received/length*100));}}finally{reader.releaseLock();}blob=new Blob(chunks,{type:response.headers.get('Content-Type')||'application/octet-stream'});}
      else blob=await response.blob();
      const disposition=response.headers.get('Content-Disposition')||'',match=disposition.match(/filename\*=UTF-8''([^;]+)/i);try{name=match?decodeURIComponent(match[1]):'聊天附件';}catch{name='聊天附件';}
    }
    onProgress(100);
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name||'聊天附件';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  async uploadProfileFile(kind,file,onProgress=()=>{}){
    if(!['avatar','wallpaper'].includes(kind)||!(file instanceof File))throw new Error('圖片上傳格式錯誤');
    if(file.size>400*1024*1024)throw new Error('圖片檔案不能超過 400 MB');
    const entry=await request('/school/profile-files',{method:'POST',body:JSON.stringify({kind,type:file.type,size:file.size})}),chunkSize=4*1024*1024;
    for(let offset=0;offset<file.size||offset===0;offset+=chunkSize){const part=file.slice(offset,Math.min(file.size,offset+chunkSize)),complete=offset+part.size>=file.size,response=await fetch(config.url.replace(/\/$/,'')+'/school/profile-files/'+entry.id+'?complete='+complete,{method:'PATCH',credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/octet-stream'},body:part}),result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'圖片上傳失敗');onProgress(file.size?Math.min(100,Math.floor((offset+part.size)/file.size*100)):100);if(complete)return result.url;}
  },
  async login(email, password, portal, remember=false) {
    token = null;
    const result = await request("/login", { method: "POST", body: JSON.stringify({ email, password, portal, remember }) });
    token = result.token;
    return result.profile;
  },
  logout() {
    request("/logout", { method: "POST" }).catch(() => {});
    token = null;
  },
  async changePassword(value){const result=await request("/account/password",{method:"POST",body:JSON.stringify(value)});token=result.token;return result.profile;},
  async list() {
    const rows = await request("/announcements");
    return rows.map(row => ({ ...row, authorInitial: row.author.charAt(0) }));
  },
  async save(item, editing) {
    const row = await request("/announcements" + (editing ? "/" + encodeURIComponent(item.id) : ""), {
      method: editing ? "PATCH" : "POST", body: JSON.stringify(item),
    });
    Object.assign(item, row, { authorInitial: row.author.charAt(0) });
  },
  async remove(id) {
    await request("/announcements/" + encodeURIComponent(id), { method: "DELETE" });
  },
  status() { return request("/admin/status"); },
  me(signal){return request("/me",{signal});},
  saveProfile(value){return request("/me",{method:"PATCH",body:JSON.stringify(value)});},
  comments(id){return request("/announcements/"+encodeURIComponent(id)+"/comments");},
  addComment(id,content){return request("/announcements/"+encodeURIComponent(id)+"/comments",{method:"POST",body:JSON.stringify({content})});},
  deleteComment(post,id){return request("/announcements/"+encodeURIComponent(post)+"/comments/"+encodeURIComponent(id),{method:"DELETE"});},
  countdowns() { return request("/countdowns"); },
  saveCountdown(value,id) { return request("/countdowns"+(id?"/"+encodeURIComponent(id):""),{method:id?"PATCH":"POST",body:JSON.stringify(value)}); },
  deleteCountdown(id) { return request("/countdowns/"+encodeURIComponent(id),{method:"DELETE"}); },
  publicBanner() { return request("/public/banner"); },
  bannerSettings() { return request("/settings/banner"); },
  saveBanner(value) { return request("/settings/banner", { method: "PUT", body: JSON.stringify(value) }); },
  marqueeSettings() { return request("/settings/marquee"); },
  saveMarquee(value) { return request("/settings/marquee", { method: "PUT", body: JSON.stringify(value) }); },
  accounts() { return request("/admin/accounts"); },
  createAccount(value) { return request("/admin/accounts", { method: "POST", body: JSON.stringify(value) }); },
  updateAccount(id, value) { return request("/admin/accounts/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(value) }); },
  bulkAccounts(value) { return request("/admin/accounts/bulk", { method: "PATCH", body: JSON.stringify(value) }); },
  deleteAccount(id) { return request("/admin/accounts/" + encodeURIComponent(id), { method: "DELETE" }); },
};
