import {cloud} from './cloud.js';
import {openDialog,closeDialog} from './dialog-motion.js';
import {notify} from './feedback.js';

export function mountPasswordRecovery(host,portal){
 if(!host)return;
 const trigger=document.createElement('button');
 trigger.type='button';trigger.className='secondary-button wide';trigger.dataset.passwordReset='';trigger.textContent='忘記密碼／重設密碼';
 host.append(trigger);
 trigger.addEventListener('click',()=>{
  const dialog=document.createElement('dialog');dialog.className='form-dialog password-recovery-dialog';
  dialog.setAttribute('aria-labelledby','password-recovery-title');
  dialog.innerHTML='<section class="editor-card"><h2 id="password-recovery-title">重設系統密碼</h2><p>輸入系統帳號與已驗證的通知信箱。符合條件時，Firebase 會寄送重設連結；不需要安裝應用程式即可完成。</p><form><label>系統帳號<input name="account" autocomplete="username" required maxlength="254"></label><label>已驗證的電子郵件地址<input name="address" type="email" autocomplete="email" required maxlength="254"></label><button type="submit" class="primary-button">寄送重設密碼郵件</button><p role="status" data-recovery-status></p></form><button type="button" class="secondary-button" data-recovery-close>取消</button></section>';
  const form=dialog.querySelector('form'),status=dialog.querySelector('[role=status]');
  const previous=document.activeElement;
  dialog.querySelector('[data-recovery-close]').onclick=()=>closeDialog(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  form.onsubmit=async event=>{
   event.preventDefault();const button=form.querySelector('[type=submit]');
   if(button.disabled)return;
   const data=Object.fromEntries(new FormData(form));button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='正在處理寄送要求…';
   try{
    await cloud.emailAction('password-reset/request',{account:data.account.trim(),address:data.address.trim(),portal});
    await closeDialog(dialog);
    notify('若帳號與已驗證信箱符合，Firebase 將寄送重設密碼連結。請檢查收件匣與垃圾郵件。','success',{presentation:'dialog',title:'已受理重設要求'});
   }catch(error){status.textContent=error.message;}
   finally{button.disabled=false;button.removeAttribute('aria-busy');}
  };
  document.body.append(dialog);openDialog(dialog);form.querySelector('input').focus();
 });
}
