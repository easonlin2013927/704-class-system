import { config } from "./config.js?v=0.25.1";
let token = null;
async function request(path, options = {}) {
  if (!config.url) throw new Error("系統尚未設定雲端服務，請聯絡管理員。");
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
    if(response.status===401&&(token||path!=="/login")){token=null;window.dispatchEvent(new Event("session-expired"));}
    if(data.code==="PASSWORD_CHANGE_REQUIRED")window.dispatchEvent(new Event("password-required"));
    throw Object.assign(new Error(data.message || "雲端操作失敗，請稍後重試。"),{code:data.code});
  }
  if(mutation)window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:true}}));
  return data;
  } catch(error) {if(mutation)window.dispatchEvent(new CustomEvent('operation-result',{detail:{ok:false,message:error.message}}));throw error;} finally { if(mutation)window.dispatchEvent(new Event('operation-end')); }
}
export const cloud = {
  presence(){return request('/school/presence',{method:'POST',silent:true});},
  school(path,method='GET',value){return request('/school/'+path,{method,...(value===undefined?{}:{body:JSON.stringify(value)})});},
  attachments(post){return request('/school/attachments?post='+encodeURIComponent(post));},
  async uploadAttachment(post,file,onProgress=()=>{}){if(file.size>400*1024*1024)throw new Error('單一公告附件不能超過 400 MB');const entry=await request('/school/attachments',{method:'POST',body:JSON.stringify({announcement_id:post,name:file.name,type:file.type||'application/octet-stream',size:file.size})});try{const chunkSize=4*1024*1024;for(let offset=0;offset<file.size||offset===0;offset+=chunkSize){const part=file.slice(offset,Math.min(file.size,offset+chunkSize)),complete=offset+part.size>=file.size;const response=await fetch(config.url.replace(/\/$/,'')+'/school/attachments/'+entry.id+'?complete='+complete,{method:'PATCH',credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/octet-stream'},body:part});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'公告附件上傳失敗');onProgress(file.size?Math.min(100,Math.round((offset+part.size)/file.size*100)):100);}}catch(e){await request('/school/attachments/'+entry.id,{method:'DELETE'}).catch(()=>{});throw e;}},
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
        onProgress(file.size?Math.min(100,Math.round((offset+part.size)/file.size*100)):100);
      }
      return entry;
    }catch(error){
      await request('/school/chat-attachments/'+entry.id,{method:'DELETE',silent:true}).catch(()=>{});
      throw error;
    }
  },
  async downloadChatAttachment(id){
    const anchor=document.createElement('a');anchor.href=config.url.replace(/\/$/,'')+'/school/chat-attachments/'+encodeURIComponent(id);anchor.rel='noopener';document.body.append(anchor);anchor.click();anchor.remove();
  },
  async uploadProfileFile(kind,file,onProgress=()=>{}){
    if(!['avatar','wallpaper'].includes(kind)||!(file instanceof File))throw new Error('圖片上傳格式錯誤');
    if(file.size>400*1024*1024)throw new Error('圖片檔案不能超過 400 MB');
    const entry=await request('/school/profile-files',{method:'POST',body:JSON.stringify({kind,type:file.type,size:file.size})}),chunkSize=4*1024*1024;
    for(let offset=0;offset<file.size||offset===0;offset+=chunkSize){const part=file.slice(offset,Math.min(file.size,offset+chunkSize)),complete=offset+part.size>=file.size,response=await fetch(config.url.replace(/\/$/,'')+'/school/profile-files/'+entry.id+'?complete='+complete,{method:'PATCH',credentials:'include',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/octet-stream'},body:part}),result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'圖片上傳失敗');onProgress(file.size?Math.min(100,Math.round((offset+part.size)/file.size*100)):100);if(complete)return result.url;}
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
  me(){return request("/me");},
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
  deleteAccount(id) { return request("/admin/accounts/" + encodeURIComponent(id), { method: "DELETE" }); },
};
