async page=>{
 const assert=(value,message)=>{if(!value)throw Error(message);};
 await page.route('**/__microsoft-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-Hant" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/responsive.css"><link rel="stylesheet" href="/src/resend-system.css"><main style="max-width:720px;margin:24px auto;padding:16px"><section class="editor-card"><h1>登入服務</h1><form id="login-form"><input name="remember" type="checkbox" checked><button type="submit">登入系統</button></form><button id="google-login" hidden></button><button id="github-login" hidden></button><button id="microsoft-login" hidden></button></section><section class="editor-card" id="providers"></section></main></html>'}));
 await page.route('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js',route=>route.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js',route=>route.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export const inMemoryPersistence={},browserPopupRedirectResolver={};export const initializeAuth=()=>({});export class GoogleAuthProvider{setCustomParameters(){}}export class GithubAuthProvider{}export class OAuthProvider{constructor(id){if(id!=="microsoft.com")throw Error("Wrong provider");}setCustomParameters(value){if(value.prompt!=="select_account")throw Error("Missing account selection");}}export const signInWithPopup=async(auth,provider)=>({user:{getIdToken:async()=>provider instanceof OAuthProvider?"microsoft-fixture":"other-fixture"}});export const signOut=async()=>{};'}));
 await page.goto('http://127.0.0.1:4173/__microsoft-test');
 await page.evaluate(async()=>{
  const {cloud}=await import('/src/cloud.js'),{mountProviderLogin}=await import('/src/firebase-auth.js'),{mountAccountProviders}=await import('/src/account-providers.js');
  window.test={linked:false,profiles:0,signOuts:0,calls:[]};
  cloud.authConfig=async()=>({firebase:{enabled:true,bindingRequired:true,providers:['google','github','microsoft'],config:{projectId:'fixture'}}});
  cloud.loginFirebase=async(token,portal,remember,provider)=>{window.test.login={token,portal,remember,provider};await new Promise(resolve=>window.resumeLogin=resolve);return {id:'fixture'};};
  cloud.providers=async()=>({providers:[{id:'google',enabled:true,linked:{email:'google@example.com'}},{id:'github',enabled:true,linked:{email:'github@example.com'}},{id:'microsoft',enabled:true,linked:window.test.linked?{email:'microsoft@example.com'}:null}]});
  cloud.bindProvider=async(provider,value)=>{if(value.current_password!=='fixture-password')throw Error('Wrong system password');window.test.calls.push({provider,...value});window.test.linked=true;};
  cloud.unlinkProvider=async(provider)=>{window.test.calls.push({unlink:provider});window.test.linked=false;return {sign_out:false};};
  const config=cloud.authConfig();
  await Promise.all(['google','github','microsoft'].map(provider=>mountProviderLogin(document.querySelector('#'+provider+'-login'),'student',()=>window.test.profiles++,error=>{throw error;},provider,config)));
  mountAccountProviders(document.querySelector('#providers'),()=>window.test.signOuts++);
 });
 await page.waitForFunction(()=>!document.querySelector('[data-provider-card="microsoft"] [data-provider-action]').disabled);
 await page.waitForFunction(()=>[...document.images].every(image=>image.naturalWidth>0));
 await page.locator('#microsoft-login').click();await page.waitForFunction(()=>Boolean(window.resumeLogin));
 assert(await page.locator('#google-login').isDisabled()&&await page.locator('#github-login').isDisabled(),'Competing providers remain clickable');
 await page.evaluate(()=>window.resumeLogin());await page.waitForFunction(()=>window.test.profiles===1);
 assert(await page.evaluate(()=>window.test.login.provider==='microsoft'&&window.test.login.token==='microsoft-fixture'&&window.test.login.remember),'Wrong Microsoft token exchange');
 await page.locator('[data-provider-card="microsoft"] [data-provider-action]').click();
 await page.locator('[name="current_password"]').fill('wrong');await page.locator('[data-provider-confirm]').click();
 await page.waitForFunction(()=>document.querySelector('[data-provider-dialog-status]').textContent==='Wrong system password');
 assert(await page.locator('[name="current_password"]').inputValue()==='','Password retained after failure');
 await page.locator('[name="current_password"]').fill('fixture-password');await page.locator('[data-provider-confirm]').click();await page.locator('dialog').waitFor({state:'hidden'});
 assert(await page.evaluate(()=>window.test.calls[0].provider==='microsoft'&&window.test.calls[0].token==='microsoft-fixture'),'Wrong Microsoft binding');
 await page.setViewportSize({width:1100,height:900});await page.screenshot({path:'.taste-skill/microsoft-desktop.png'});
 await page.locator('[data-provider-card="microsoft"] [data-provider-action]').click();await page.locator('[name="current_password"]').fill('fixture-password');await page.locator('[data-provider-confirm]').click();await page.locator('dialog').waitFor({state:'hidden'});
 assert(await page.evaluate(()=>window.test.signOuts===0),'Another provider session was signed out');
 assert((await page.locator('[data-provider-card="google"] [data-provider-state]').textContent()).includes('google@example.com')&&(await page.locator('[data-provider-card="github"] [data-provider-state]').textContent()).includes('github@example.com'),'Existing bindings changed');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.taste-skill/microsoft-mobile.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
 return {microsoftLogin:'pass',binding:'pass',passwordCleanup:'pass',otherProvidersPreserved:'pass',logos:'loaded',mobileOverflow:false};
}
