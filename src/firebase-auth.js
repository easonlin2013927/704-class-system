import { cloud } from './cloud.js';

let loading;
export function googleButtonLabel(button,label){
  const logo=document.createElement('img');
  logo.src='./src/google-logo.png';logo.alt='';logo.width=20;logo.height=20;
  button.classList.add('google-auth-button');
  button.replaceChildren(logo,document.createTextNode(label));
}
function loadFirebase(config) {
  if (!loading) loading = (async () => {
    const base = 'https://www.gstatic.com/firebasejs/12.6.0/';
    const [app, sdk] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js')]);
    const auth = sdk.initializeAuth(app.initializeApp(config, '704-google-login'), {
      persistence: sdk.inMemoryPersistence,
      popupRedirectResolver: sdk.browserPopupRedirectResolver,
    });
    return { sdk, auth };
  })().catch(error => { loading = null; throw error; });
  return loading;
}

export function googleLoginError(error) {
  const messages = {
    'auth/popup-blocked': '瀏覽器已封鎖 Google 登入視窗，請允許此網站開啟彈出式視窗後重試。',
    'auth/popup-closed-by-user': '已取消 Google 登入。',
    'auth/cancelled-popup-request': 'Google 登入視窗已取消，請重試。',
    'auth/unauthorized-domain': '此網址尚未獲准使用 Google 登入，請聯絡管理員。',
    'auth/network-request-failed': '無法連接 Google 登入服務，請確認網路後重試。',
    'auth/operation-not-allowed': 'Google 登入尚未啟用，請聯絡管理員。',
  };
  return new Error(messages[error.code] || error.message || 'Google 登入失敗，請稍後重試。');
}

export async function prepareGoogleAuth(config){
  config ||= await cloud.authConfig();
  if(!config?.firebase?.enabled)throw new Error('Google 登入服務尚未啟用，請聯絡管理員');
  let timer;
  try{return await Promise.race([loadFirebase(config.firebase.config),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Google 登入服務載入逾時，請稍後再試')),15000);})]);}
  finally{clearTimeout(timer);}
}

export async function authorizeGoogleAccount(sdk, auth, exchange) {
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await sdk.signInWithPopup(auth, provider);
    const token = await result.user.getIdToken();
    return await exchange(token);
  } finally {
    await sdk.signOut(auth).catch(() => {});
  }
}

export function exchangeGoogleLogin(sdk, auth, portal, remember, exchange, onStage=()=>{}) {
  return authorizeGoogleAccount(sdk,auth,async token=>{
    onStage('正在驗證班級系統帳號…');
    const profile=await exchange(token,portal,remember);
    onStage('已驗證，正在載入操作權限…');
    return profile;
  });
}

export async function mountGoogleLogin(button, portal, onProfile, onError) {
  const config = await cloud.authConfig().catch(() => null);
  if (!button.isConnected || !config?.firebase?.enabled || config.firebase.bindingRequired!==true) return;
  // Prepare the SDK on the login page so the click can open its popup immediately.
  let firebase;
  button.hidden = false;
  button.disabled = true;
  googleButtonLabel(button,'正在準備 Google 登入…');
  try {
    firebase = await prepareGoogleAuth(config);
  } catch (error) {
    if (button.isConnected) {
      button.textContent = 'Google 登入暫時無法使用';
      button.title = error.message;
    }
    return;
  }
  if (!button.isConnected) return;
  button.hidden = false;
  button.disabled = false;
  googleButtonLabel(button,'使用 Google 登入');
  button.onclick = async () => {
    button.disabled = true;
    const passwordButton = document.querySelector('#login-form [type="submit"]');
    if (passwordButton) passwordButton.disabled = true;
    try {
      const remember = !!document.querySelector('#login-form [name="remember"]')?.checked;
      const profile = await exchangeGoogleLogin(firebase.sdk, firebase.auth, portal, remember,
        (token, role, save) => cloud.loginFirebase(token, role, save),message=>{if(button.isConnected)button.textContent=message;});
      if (button.isConnected) await onProfile(profile);
    } catch (error) { onError(googleLoginError(error)); }
    finally {
      button.disabled = false;
      googleButtonLabel(button,'使用 Google 登入');
      if (passwordButton) passwordButton.disabled = false;
    }
  };
}
