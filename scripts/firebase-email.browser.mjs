async page=>{
 await page.bringToFront();
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.unroute('**/preview-api/**');await page.context().unroute('**/preview-api/**');
 const checks=[];const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 const requests=[];let fail=false,verified=false;
 const id='10000000-0000-4000-8000-000000000001',state='a'.repeat(64);
 await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true});});
 await page.context().route('**/preview-api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/preview-api','');let body=[],status=200;
  if(path==='/me'){status=401;body={message:'請登入'};}
  if(path==='/public/auth-config')body={firebase:{enabled:false}};
  if(path==='/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  if(path==='/school/mailboxes')body=[{id,address:'fixture@example.test',verified,locked:false}];
  if(path==='/school/mailbox-request')body={ok:true,delivery:'firebase'};
  if(path.startsWith('/auth/email/')){requests.push({path,body:route.request().postDataJSON()});body={ok:true,delivery:'firebase'};if(fail){status=400;body={message:'連結無效或已過期'};}}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 for(const portal of ['student','teacher','admin']){
  await page.goto('http://127.0.0.1:4173/?email-test='+Date.now()+'#/'+portal+'/login');
  await page.locator('[data-password-reset]').waitFor();
  check(await page.locator('[data-password-reset]').count()===1,portal+' login offers recovery');
  await page.locator('[data-password-reset]').click();
  await page.locator('.password-recovery-dialog [name=account]').fill('fixture');
  await page.locator('.password-recovery-dialog [name=address]').fill('fixture@example.test');
  await page.locator('.password-recovery-dialog [type=submit]').click();
  await page.locator('.feedback-dialog').waitFor();
  check(requests.at(-1).body.portal===portal,portal+' recovery uses correct portal');
  check(await page.locator('.feedback-message').textContent().then(text=>text.includes('若帳號')),'Recovery does not disclose account existence');
  await page.locator('.feedback-confirm').click();await page.locator('.feedback-dialog').waitFor({state:'detached'});
 }
 await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>false,configurable:true});const original=matchMedia.bind(window);window.matchMedia=query=>query.includes('display-mode')?{matches:false,media:query,addEventListener(){},removeEventListener(){}}:original(query);});
 // Local preview intentionally bypasses PWA installation; exercise production gating only in this fixture.
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("['127.0.0.1','localhost'].includes(location.hostname)||isAppWindow()","isAppWindow()")});});
 for(const portal of ['student','teacher']){
  await page.goto('http://127.0.0.1:4173/?install-test='+Date.now()+'#/'+portal+'/login');
  await page.locator('.install-card [data-password-reset]').waitFor();
  check(await page.locator('[data-password-reset]').count()===1,portal+' installation page also offers recovery');
 }
 await page.unroute('**/src/main.js*');
 await page.goto('http://127.0.0.1:4173/auth-action/?mode=verifyEmail&oobCode=fixture-code&continueUrl='+encodeURIComponent('http://127.0.0.1:4173/auth-action/?state='+state));
 check(await page.locator('#action-title').textContent()==='驗證電子郵件','Verification link opens public handler');
 check(!page.url().includes('oobCode')&&!page.url().includes('state'),'One-time credentials removed from address bar');
 const before=requests.length;await page.waitForTimeout(100);
 check(requests.length===before,'Opening email link does not consume it');
 await page.locator('#action-submit').click();await page.locator('.feedback-dialog').waitFor();
 check(requests.at(-1).path==='/auth/email/verify-confirm'&&requests.at(-1).body.state===state,'Verification submits state and code to server');
 check(await page.locator('#action-form').isHidden(),'Verification hides form only after success');
 await page.goto('http://127.0.0.1:4173/auth-action/?mode=resetPassword&oobCode=fixture-code&state='+state);
 await page.locator('[name=password]').fill('fixture-password');await page.locator('[name=confirmation]').fill('different-password');
 const mismatch=requests.length;await page.locator('#action-submit').click();
 check(requests.length===mismatch&&await page.locator('#action-status').textContent().then(text=>text.includes('不相同')),'Mismatched passwords never call API');
 await page.locator('[name=confirmation]').fill('fixture-password');fail=true;await page.locator('#action-submit').click();
 await page.getByText('連結無效或已過期',{exact:true}).waitFor();
 check(await page.locator('#action-form').isVisible()&&await page.locator('.feedback-dialog').count()===0,'Failed reset preserves retry and never shows success');
 fail=false;await page.locator('#action-submit').click();await page.locator('.feedback-dialog').waitFor();
 check(requests.at(-1).body.password==='fixture-password','Reset submits new system password');
 check(await page.locator('#action-status').textContent().then(text=>text.includes('舊登入狀態')),'Reset completion explains sign-in again');
 await page.goto('http://127.0.0.1:4173/auth-action/?mode=verifyEmail&oobCode=x&continueUrl='+encodeURIComponent('https://other.example/auth-action/?state='+state));
 check(await page.locator('#action-title').textContent()==='連結無效','Foreign continuation is rejected');
 await page.evaluate(async()=>{const {mountMailboxes}=await import('/src/mailboxes.js');const host=document.createElement('section');host.id='mail-test';document.body.append(host);window.mailVerified=0;mountMailboxes(host,null,()=>window.mailVerified++);});
 await page.locator('[data-mail-request]').waitFor();await page.locator('[data-mail-request]').click();
 await page.locator('[data-mail-verify]').waitFor({state:'visible'});
 check(await page.locator('[data-mail-code]').count()===0,'Firebase verification uses link instead of old six-digit code');
 await page.locator('[data-mail-confirm]').click();
 await page.getByText(/尚未確認驗證完成/).waitFor();
 check(await page.evaluate(()=>window.mailVerified)===0,'Unverified mailbox cannot complete locally');
 verified=true;await page.locator('[data-mail-confirm]').click();await page.locator('[data-mail-dialog]').waitFor({state:'hidden'});
 check(await page.evaluate(()=>window.mailVerified)===1,'Mailbox completion trusts refreshed server verification');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:320,height:760});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Public action handler fits mobile');
 return {passed:checks.length,checks};
}
