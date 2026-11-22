import {cloud} from './cloud.js';
import {prepareGoogleAuth,authorizeGoogleAccount,googleLoginError,googleButtonLabel} from './firebase-auth.js';

export function mountAccountProviders(host,onSignOut){
 host.innerHTML=`<h2>登入服務</h2><p>第一次請用系統帳密登入，再綁定你想用來登入的 Google 帳戶。通知信箱不會因此變更。</p><div class="provider-row"><img class="provider-logo" src="./src/google-logo.png" alt="" width="40" height="40"><div class="provider-info"><strong>Google</strong><p data-provider-state>正在讀取綁定狀態…</p></div><button type="button" class="secondary-button" data-provider-action disabled>載入中…</button></div><p role="status" data-provider-status></p><dialog class="form-dialog" data-provider-dialog aria-labelledby="provider-dialog-title"><form class="editor-card"><h2 id="provider-dialog-title">綁定 Google 帳戶</h2><p data-provider-explanation></p><label for="provider-system-password">704 系統目前密碼</label><input id="provider-system-password" name="current_password" type="password" autocomplete="current-password" maxlength="1024" required><p role="status" data-provider-dialog-status></p><div class="school-actions"><button type="submit" class="primary-button" data-provider-confirm>連接 Google 帳戶</button><button type="button" class="secondary-button" data-provider-cancel>取消</button></div></form></dialog>`;
 const dialog=host.querySelector('dialog'),form=host.querySelector('form'),action=host.querySelector('[data-provider-action]'),confirm=host.querySelector('[data-provider-confirm]'),cancel=host.querySelector('[data-provider-cancel]'),status=host.querySelector('[data-provider-status]'),dialogStatus=host.querySelector('[data-provider-dialog-status]');
 let linked=false,firebase=null,busy=false;
 const setBusy=value=>{busy=value;confirm.disabled=value;cancel.disabled=value;confirm.setAttribute('aria-busy',String(value));};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else form.reset();});
 cancel.onclick=()=>{form.reset();dialog.close();};
 action.onclick=()=>{
  form.reset();dialogStatus.textContent='';
  host.querySelector('#provider-dialog-title').textContent=linked?'解除 Google 綁定':'綁定 Google 帳戶';
  host.querySelector('[data-provider-explanation]').textContent=linked?'解除後，使用這個 Google 帳戶登入的裝置將登出。你仍可使用系統帳密登入。':'請先確認 704 系統密碼，再選擇你要用於登入的 Google 帳戶。每個 Google 帳戶只能綁定一個系統帳號。';
  if(linked){confirm.classList.remove('google-auth-button');confirm.textContent='確認解除綁定';}
  else googleButtonLabel(confirm,'連接 Google 帳戶');
  dialog.showModal();
 };
 async function refresh(){
  const data=await cloud.providers();if(!host.isConnected)return;
  const provider=data.providers.find(item=>item.id==='google');
  if(!provider)throw new Error('目前沒有可用的登入服務');
  linked=Boolean(provider.linked);
  host.querySelector('[data-provider-state]').textContent=linked?'已綁定：'+provider.linked.email:'尚未綁定';
  action.textContent=linked?'解除綁定':'綁定 Google';action.disabled=!linked;
  if(linked)return;
  if(!provider.enabled){status.textContent='Google 登入服務尚未啟用，請聯絡管理員。';return;}
  status.textContent='正在準備 Google 帳戶連接…';
  firebase=await prepareGoogleAuth();if(!host.isConnected)return;
  status.textContent='';action.disabled=false;
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;setBusy(true);dialogStatus.textContent=linked?'正在解除綁定…':'請在 Google 視窗選擇帳戶…';
  const current_password=form.elements.current_password.value;
  try{
   if(linked){
    const result=await cloud.unlinkGoogle({current_password});
    form.reset();dialog.close();
    if(result.sign_out){onSignOut?.();return;}
    status.textContent='Google 綁定已解除。';
   }else{
    if(!firebase)throw new Error('Google 服務尚未準備完成，請稍後再試');
    await authorizeGoogleAccount(firebase.sdk,firebase.auth,token=>{dialogStatus.textContent='正在綁定 Google 帳戶…';return cloud.bindGoogle({token,current_password});});
    form.reset();dialog.close();status.textContent='Google 帳戶已綁定，下次可直接使用 Google 登入。';
   }
   await refresh();
  }catch(error){if(host.isConnected)(dialog.open?dialogStatus:status).textContent=googleLoginError(error).message;}
  finally{form.elements.current_password.value='';setBusy(false);}
 };
 refresh().catch(error=>{if(host.isConnected)status.textContent=error.message;});
}
