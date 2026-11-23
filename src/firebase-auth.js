import { cloud } from './cloud.js';

let loading;
export const loginProviders={google:{name:'Google',logo:'./src/google-logo.png'},github:{name:'GitHub',logo:'./src/github-logo.svg'},microsoft:{name:'Microsoft',logo:'./src/microsoft-logo.svg'}};
export function providerButtonLabel(button,label,provider='google'){
  const logo=document.createElement('img');
  logo.src=loginProviders[provider].logo;logo.alt='';logo.width=20;logo.height=20;
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

export function providerLoginError(error,provider='google') {
  const name=loginProviders[provider].name;
  const messages = {
    'auth/popup-blocked': `瀏覽器已封鎖 ${name} 登入視窗，請允許此網站開啟彈出式視窗後重試。`,
    'auth/popup-closed-by-user': `已取消 ${name} 登入。`,
    'auth/cancelled-popup-request': `${name} 登入視窗已取消，請重試。`,
    'auth/unauthorized-domain': `此網址尚未獲准使用 ${name} 登入，請聯絡管理員。`,
    'auth/network-request-failed': `無法連接 ${name} 登入服務，請確認網路後重試。`,
    'auth/operation-not-allowed': `${name} 登入尚未啟用，請聯絡管理員。`,
    'auth/account-exists-with-different-credential': '此信箱已使用其他 Firebase 登入服務。請聯絡管理員確認供應商帳戶設定；系統不會自動合併帳號。',
  };
  return new Error(messages[error.code] || error.message || `${name} 登入失敗，請稍後重試。`);
}

export async function prepareFirebaseAuth(config){
  config ||= await cloud.authConfig();
  if(!config?.firebase?.enabled)throw new Error('外部登入服務尚未啟用，請聯絡管理員');
  let timer;
  try{return await Promise.race([loadFirebase(config.firebase.config),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('登入服務載入逾時，請稍後再試')),15000);})]);}
  finally{clearTimeout(timer);}
}

export async function authorizeProviderAccount(sdk, auth, exchange,providerId='google') {
  if(!Object.hasOwn(loginProviders,providerId))throw new Error('不支援的登入服務');
  const provider = providerId==='microsoft'?new sdk.OAuthProvider('microsoft.com'):providerId==='github'?new sdk.GithubAuthProvider():new sdk.GoogleAuthProvider();
  if(providerId==='google'||providerId==='microsoft')provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await sdk.signInWithPopup(auth, provider);
    const token = await result.user.getIdToken();
    return await exchange(token);
  } finally {
    await sdk.signOut(auth).catch(() => {});
  }
}

export function exchangeProviderLogin(sdk, auth, portal, remember, exchange, onStage=()=>{},provider='google') {
  return authorizeProviderAccount(sdk,auth,async token=>{
    onStage('正在驗證班級系統帳號…');
    const profile=await exchange(token,portal,remember,provider);
    onStage('已驗證，正在載入操作權限…');
    return profile;
  },provider);
}

export async function mountProviderLogin(button, portal, onProfile, onError,provider='google',configPromise) {
  const name=loginProviders[provider].name;
  const config = await (configPromise||cloud.authConfig()).catch(() => null);
  if (!button.isConnected || !config?.firebase?.enabled || config.firebase.bindingRequired!==true) return;
  if(provider!=='google'&&!config.firebase.providers?.includes(provider))return;
  // Prepare the SDK on the login page so the click can open its popup immediately.
  let firebase;
  button.hidden = false;
  button.disabled = true;
  providerButtonLabel(button,`正在準備 ${name} 登入…`,provider);
  try {
    firebase = await prepareFirebaseAuth(config);
  } catch (error) {
    if (button.isConnected) {
      button.textContent = `${name} 登入暫時無法使用`;
      button.title = error.message;
    }
    return;
  }
  if (!button.isConnected) return;
  button.hidden = false;
  button.disabled = false;
  providerButtonLabel(button,`使用 ${name} 登入`,provider);
  button.onclick = async () => {
    button.disabled = true;
    const otherButtons=[...document.querySelectorAll('#login-form [type="submit"],#google-login,#github-login,#microsoft-login')].filter(control=>control!==button&&!control.disabled);
    otherButtons.forEach(control=>control.disabled=true);
    try {
      const remember = !!document.querySelector('#login-form [name="remember"]')?.checked;
      const profile = await exchangeProviderLogin(firebase.sdk, firebase.auth, portal, remember,
        (token, role, save,provider) => cloud.loginFirebase(token, role, save,provider),message=>{if(button.isConnected)button.textContent=message;},provider);
      if (button.isConnected) await onProfile(profile);
    } catch (error) { onError(providerLoginError(error,provider)); }
    finally {
      button.disabled = false;
      providerButtonLabel(button,`使用 ${name} 登入`,provider);
      otherButtons.forEach(control=>control.disabled=false);
    }
  };
}
