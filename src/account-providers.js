import {openDialog,closeDialog} from './dialog-motion.js';
import {cloud} from './cloud.js';
import {prepareFirebaseAuth,authorizeProviderAccount,providerLoginError,providerButtonLabel,loginProviders} from './firebase-auth.js';

export function mountAccountProviders(host,onSignOut){
 host.innerHTML=`<h2>登入服務</h2><p>第一次請用系統帳密登入，再綁定 Google、GitHub 或 Microsoft 帳戶。每個外部帳戶只能綁定一個系統帳號，通知信箱不會因此變更。</p>${Object.entries(loginProviders).map(([id,provider])=>`<div class="provider-row" data-provider-card="${id}"><img class="provider-logo" src="${provider.logo}" alt="" width="40" height="40"><div class="provider-info"><strong>${provider.name}</strong><p data-provider-state>正在讀取綁定狀態…</p></div><button type="button" class="secondary-button" data-provider-action disabled>載入中…</button></div>`).join('')}<p role="status" data-provider-status></p><dialog class="form-dialog" data-provider-dialog aria-labelledby="provider-dialog-title"><form class="editor-card"><h2 id="provider-dialog-title"></h2><p data-provider-explanation></p><label for="provider-system-password">704 系統目前密碼</label><input id="provider-system-password" name="current_password" type="password" autocomplete="current-password" maxlength="1024" required><p role="status" data-provider-dialog-status></p><div class="school-actions"><button type="submit" class="primary-button" data-provider-confirm></button><button type="button" class="secondary-button" data-provider-cancel>取消</button></div></form></dialog>`;
 const dialog=host.querySelector('dialog'),form=host.querySelector('form'),confirm=host.querySelector('[data-provider-confirm]'),cancel=host.querySelector('[data-provider-cancel]'),status=host.querySelector('[data-provider-status]'),dialogStatus=host.querySelector('[data-provider-dialog-status]');
 let selected,firebase=null,busy=false,providers=[];
 const setBusy=value=>{busy=value;confirm.disabled=value;cancel.disabled=value;confirm.setAttribute('aria-busy',String(value));};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else form.reset();});
 cancel.onclick=()=>{form.reset();closeDialog(dialog);};
 host.querySelectorAll('[data-provider-card]').forEach(card=>card.querySelector('[data-provider-action]').onclick=()=>{
  selected=providers.find(provider=>provider.id===card.dataset.providerCard);if(!selected)return;
  form.reset();dialogStatus.textContent='';
  host.querySelector('#provider-dialog-title').textContent=selected.linked?`解除 ${selected.name} 綁定`:`綁定 ${selected.name} 帳戶`;
  host.querySelector('[data-provider-explanation]').textContent=selected.linked?`解除後，使用這個 ${selected.name} 帳戶登入的裝置將登出。你仍可使用系統帳密登入。`:`請確認 704 系統密碼，再授權你要用於登入的 ${selected.name} 帳戶。`;
  if(selected.linked){confirm.classList.remove('google-auth-button');confirm.textContent='確認解除綁定';}
  else providerButtonLabel(confirm,`連接 ${selected.name} 帳戶`,selected.id);
  openDialog(dialog);
 });
 async function refresh(){
  const data=await cloud.providers();if(!host.isConnected)return;
  providers=data.providers.filter(provider=>Object.hasOwn(loginProviders,provider.id)).map(provider=>({...provider,name:loginProviders[provider.id].name}));
  for(const [id,{name}] of Object.entries(loginProviders)){
   const provider=providers.find(item=>item.id===id),card=host.querySelector(`[data-provider-card="${id}"]`),action=card.querySelector('[data-provider-action]');
   card.querySelector('[data-provider-state]').textContent=provider?.linked?'已綁定：'+(provider.linked.email||`${name} 帳戶（未提供信箱）`):provider?.enabled?'尚未綁定':'服務尚未啟用，請聯絡管理員。';
   action.textContent=provider?.linked?'解除綁定':`綁定 ${name}`;action.disabled=!provider?.linked;
  }
  if(!providers.some(provider=>provider.enabled&&!provider.linked))return;
  status.textContent='正在準備帳戶連接…';firebase=await prepareFirebaseAuth();if(!host.isConnected)return;
  status.textContent='';providers.filter(provider=>provider.enabled&&!provider.linked).forEach(provider=>host.querySelector(`[data-provider-card="${provider.id}"] [data-provider-action]`).disabled=false);
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!selected)return;setBusy(true);dialogStatus.textContent=selected.linked?'正在解除綁定…':`請在 ${selected.name} 視窗授權帳戶…`;
  const current_password=form.elements.current_password.value;
  try{
   if(selected.linked){
    const result=await cloud.unlinkProvider(selected.id,{current_password});form.reset();await closeDialog(dialog);
    if(result.sign_out){onSignOut?.();return;}
    status.textContent=`${selected.name} 綁定已解除。`;
   }else{
    if(!firebase)throw new Error('登入服務尚未準備完成，請稍後再試');
    await authorizeProviderAccount(firebase.sdk,firebase.auth,token=>{dialogStatus.textContent=`正在綁定 ${selected.name} 帳戶…`;return cloud.bindProvider(selected.id,{token,current_password});},selected.id);
    form.reset();await closeDialog(dialog);status.textContent=`${selected.name} 帳戶已綁定，下次可直接使用此服務登入。`;
   }
   await refresh();
  }catch(error){if(host.isConnected)(dialog.open?dialogStatus:status).textContent=providerLoginError(error,selected.id).message;}
  finally{form.elements.current_password.value='';setBusy(false);}
 };
 refresh().catch(error=>{if(host.isConnected)status.textContent=error.message;});
}
