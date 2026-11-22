async page=>{
 const assert=(value,message)=>{if(!value)throw Error(message);};
 await page.route('**/__providers-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-Hant" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/responsive.css"><link rel="stylesheet" href="/src/resend-system.css"><style>body{padding:24px}main{max-width:900px;margin:auto}</style><main><section id="provider-test" class="editor-card"></section></main></html>'}));
 await page.goto('http://127.0.0.1:4173/__providers-test');
 await page.evaluate(async()=>{
  const {cloud}=await import('/src/cloud.js'),{mountAccountProviders}=await import('/src/account-providers.js');
  window.providerTest={linked:true,signOut:false,signOuts:0,calls:0};
  cloud.providers=async()=>({providers:[{id:'google',name:'Google',enabled:false,linked:window.providerTest.linked?{email:'personal@example.com',created_at:'2026-11-22'}:null}]});
  cloud.unlinkGoogle=async data=>{window.providerTest.calls++;if(data.current_password!=='fixture-password')throw Error('Wrong system password');window.providerTest.linked=false;return {ok:true,sign_out:window.providerTest.signOut};};
  window.remountProviders=()=>mountAccountProviders(document.querySelector('#provider-test'),()=>{window.providerTest.signOuts++;});
  window.remountProviders();
 });
 await page.locator('[data-provider-action]').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[data-provider-action]').disabled);
 await page.waitForFunction(()=>document.querySelector('.provider-logo').naturalWidth>0);
 await page.setViewportSize({width:1280,height:900});
 await page.screenshot({path:'.taste-skill/providers-desktop.png'});
 await page.locator('[data-provider-action]').click();
 assert(await page.locator('dialog').isVisible(),'Unlink confirmation missing');
 assert((await page.locator('label[for="provider-system-password"]').textContent()).includes('704'),'System password label unclear');
 await page.locator('[name="current_password"]').fill('wrong');await page.locator('[data-provider-confirm]').click();
 await page.waitForFunction(()=>document.querySelector('[data-provider-dialog-status]').textContent==='Wrong system password');
 assert(await page.locator('dialog').isVisible(),'Failed password closed confirmation');
 assert(await page.locator('[name="current_password"]').inputValue()==='','Password retained after failure');
 await page.locator('[name="current_password"]').fill('fixture-password');await page.locator('[data-provider-confirm]').click();
 await page.locator('dialog').waitFor({state:'hidden'});
 assert(await page.evaluate(()=>!window.providerTest.linked&&window.providerTest.signOuts===0),'Password session incorrectly signed out');
 await page.evaluate(()=>{window.providerTest.linked=true;window.providerTest.signOut=true;window.remountProviders();});
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>!document.querySelector('[data-provider-action]').disabled);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page overflows');
 await page.locator('[data-provider-action]').click();
 await page.screenshot({path:'.taste-skill/providers-mobile.png'});
 await page.locator('[name="current_password"]').fill('fixture-password');await page.locator('[data-provider-confirm]').click();
 await page.waitForFunction(()=>window.providerTest.signOuts===1);
 return {logo:'loaded',confirmation:'pass',wrongPassword:'retained-session',passwordCleanup:'pass',passwordSession:'preserved',googleSession:'signed-out',mobile:'no-overflow'};
}
