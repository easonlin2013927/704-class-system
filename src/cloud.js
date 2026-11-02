import { config } from "./config.js?v=0.19.8";
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
  async uploadAttachment(post,file){if(file.size>200000)throw new Error('單一附件不能超過 200 KB');const entry=await request('/school/attachments',{method:'POST',body:JSON.stringify({announcement_id:post,name:file.name})});try{const bytes=new Uint8Array(await file.arrayBuffer());for(let i=0;i<bytes.length||i===0;i+=100000){const part=bytes.subarray(i,i+100000);let binary='';for(const byte of part)binary+=String.fromCharCode(byte);await request('/school/attachments/'+entry.id,{method:'PATCH',body:JSON.stringify({data:btoa(binary),complete:i+part.length>=bytes.length})});}}catch(e){await request('/school/attachments/'+entry.id,{method:'DELETE'}).catch(()=>{});throw e;}},
  attachment(id){return request('/school/attachments/'+encodeURIComponent(id));},
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
