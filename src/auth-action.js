import {cloud} from './cloud.js';
import {notify} from './feedback.js';
import {initUIMotion} from './ui-motion.js';

initUIMotion(document);
const params=new URLSearchParams(location.search),mode=params.get('mode'),code=params.get('oobCode');
let state=params.get('state');
try{const continuation=new URL(params.get('continueUrl'));if(continuation.origin===location.origin&&continuation.pathname===location.pathname)state??=continuation.searchParams.get('state');}catch{}
// Keep one-time credentials in memory, outside the address bar and referrer.
history.replaceState(null,'',location.pathname);
const title=document.querySelector('#action-title'),description=document.querySelector('#action-description'),form=document.querySelector('#action-form'),status=document.querySelector('#action-status'),button=document.querySelector('#action-submit');
const reset=mode==='resetPassword';
if(!['verifyEmail','resetPassword'].includes(mode)||!state||!code||state.length>256||code.length>2048){
 title.textContent='連結無效';description.textContent='請使用最新郵件中的完整連結，或重新要求寄送驗證／重設密碼郵件。';
}else{
 title.textContent=reset?'重設系統密碼':'驗證電子郵件';
 description.textContent=reset?'設定新的 704 班級系統密碼，至少 8 個字元。完成後請使用系統帳號與新密碼登入。':'按下確認，完成此電子郵件地址的驗證。';
 form.hidden=false;button.textContent=reset?'儲存新密碼':'確認驗證';
 if(reset){document.querySelector('#password-fields').hidden=false;for(const input of form.querySelectorAll('input'))input.required=true;}
 form.onsubmit=async event=>{
  event.preventDefault();if(button.disabled)return;
  const data=Object.fromEntries(new FormData(form));
  if(reset&&data.password!==data.confirmation){status.dataset.error='';status.textContent='兩次輸入的新密碼不相同。';return;}
  button.disabled=true;button.setAttribute('aria-busy','true');delete status.dataset.error;status.textContent='正在處理…';
  try{
   await cloud.emailAction(reset?'password-reset/confirm':'verify-confirm',{state,oobCode:code,...(reset?{password:data.password}:{})});
   form.hidden=true;status.textContent=reset?'系統密碼已更新，舊登入狀態已登出。請返回對應入口登入。':'電子郵件驗證成功，可返回系統繼續操作。';
   notify(status.textContent,'success',{presentation:'dialog',title:reset?'密碼重設成功':'驗證成功'});
  }catch(error){status.dataset.error='';status.textContent=error.message;}
  finally{button.disabled=false;button.removeAttribute('aria-busy');}
 };
}
