import {openDialog,closeDialog} from './dialog-motion.js';
import {cloud} from './cloud.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountMailboxes(host,accountId=null,onVerified=null,forcedId=null){
 const admin=Boolean(accountId);
 host.innerHTML=`<h2>電子郵件地址</h2><p>預設信箱由管理員管理；自行新增的信箱透過 Firebase 郵件連結驗證後，才能接收通知。</p><div data-mail-list>載入中…</div><button type="button" class="secondary-button" data-mail-add>新增電子郵件</button><dialog class="form-dialog" data-mail-dialog><section class="editor-card"><h2 data-mail-title>新增電子郵件</h2><div data-mail-enter><label>電子郵件地址<input type="email" maxlength="254" data-mail-input></label><button type="button" class="primary-button" data-mail-send>${admin?'儲存':'寄送驗證郵件'}</button></div><div data-mail-verify hidden><p>Firebase 已受理驗證郵件。請開啟信件中的連結完成驗證，再回到這裡重新檢查。</p><button type="button" class="primary-button" data-mail-confirm>我已完成驗證，重新檢查</button></div><button type="button" class="secondary-button" data-mail-close>關閉</button><p role="status" data-mail-status></p></section></dialog>`;
 const dialog=host.querySelector('[data-mail-dialog]'),input=host.querySelector('[data-mail-input]'),status=host.querySelector('[data-mail-status]'),enter=host.querySelector('[data-mail-enter]'),verify=host.querySelector('[data-mail-verify]');let editId=null,verificationId=null,busy=false;
 const open=(address='',id=null)=>{editId=id;input.value=address;enter.hidden=false;verify.hidden=true;status.textContent='';host.querySelector('[data-mail-title]').textContent=id?'變更電子郵件':'新增電子郵件';openDialog(dialog);};
 async function refresh(){
  const rows=await cloud.school(admin?'mail-admin/'+accountId:'mailboxes');
  if(!host.isConnected)return rows;
  host.querySelector('[data-mail-list]').innerHTML=rows.map(x=>`<div class="account-row" data-motion="item" data-motion-key="${esc(x.id)}"><div><strong>${esc(x.address)}</strong><small>${x.locked?'預設信箱 · 已鎖定':'自行新增'} · ${x.verified?'可接收通知':'待驗證'}${x.id===forcedId?' · 管理員要求變更':''}</small></div>${!x.locked||admin||x.id===forcedId?`<button type="button" class="secondary-button" data-mail-edit="${x.id}">編輯</button>`:''}${!admin&&!x.locked?`<button type="button" class="danger-button" data-mail-delete="${x.id}">刪除</button>`:''}${!admin&&!x.verified?`<button type="button" class="secondary-button" data-mail-request="${x.id}">驗證</button>`:''}</div>`).join('')||'<p>尚無信箱，請新增信箱。</p>';
  host._mailRows=rows;return rows;
 }
 async function run(button,action){if(busy)return;busy=true;button.disabled=true;button.setAttribute('aria-busy','true');try{await action();}catch(error){if(error.code==='USER_CANCELLED')return;if(!dialog.open)openDialog(dialog);status.textContent=error.message;}finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy');}}
 async function request(id){
  const result=await cloud.school('mailbox-request','POST',{id});
  if(result.delivery!=='firebase')throw Error('伺服器尚未更新 Firebase 驗證功能，請聯絡管理員更新 API。');
  verificationId=id;enter.hidden=true;verify.hidden=false;host.querySelector('[data-mail-title]').textContent='驗證電子郵件';status.textContent='驗證郵件已交由 Firebase 寄送，請檢查收件匣與垃圾郵件。';
 }
 host.querySelector('[data-mail-add]').onclick=()=>open();
 host.querySelector('[data-mail-close]').onclick=()=>closeDialog(dialog);
 host.querySelector('[data-mail-send]').onclick=event=>run(event.currentTarget,async()=>{
  if(!input.value.trim()){status.textContent='請輸入電子郵件地址。';return;}
  if(!input.reportValidity())return;
  const box=editId?await cloud.school('mailboxes/'+editId,'PATCH',{address:input.value.trim()}):await cloud.school(admin?'mail-admin/'+accountId:'mailboxes','POST',{address:input.value.trim()});
  editId=box.id;
  if(admin){await closeDialog(dialog);await refresh();await onVerified?.();return;}
  await request(box.id);await refresh();
 });
 host.querySelector('[data-mail-confirm]').onclick=event=>run(event.currentTarget,async()=>{
  const rows=await refresh();
  if(!rows.some(row=>row.id===verificationId&&row.verified)){status.textContent='尚未確認驗證完成。請先開啟 Firebase 郵件中的連結並按下確認，再重新檢查。';return;}
  await closeDialog(dialog);await onVerified?.();
 });
 host.addEventListener('click',event=>{
  const edit=event.target.closest('[data-mail-edit]'),del=event.target.closest('[data-mail-delete]'),send=event.target.closest('[data-mail-request]');
  if(edit){const box=host._mailRows.find(row=>row.id===edit.dataset.mailEdit);open(box.address,box.id);}
  if(del)run(del,async()=>{await cloud.school('mailboxes/'+del.dataset.mailDelete,'DELETE');await refresh();});
  if(send)run(send,async()=>{open();await request(send.dataset.mailRequest);await refresh();});
 });
 refresh().catch(error=>{if(host.isConnected)host.querySelector('[data-mail-list]').textContent=error.message;});
}