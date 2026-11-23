async(page)=>{
 await page.setViewportSize({width:1280,height:900});
 const check=(value,message)=>{if(!value)throw Error(message);};
 const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
 const profile={id:'fixture-admin',role:'admin',display_name:'Remembered Admin',theme:'dark'};
 let mode='remembered',lookup=deferred(),access=null,feedFails=false,accessExpired=false;
 await page.addInitScript(()=>{
  globalThis.sawLoginForm=false;
  globalThis.sawAuthenticatedUi=false;
  new MutationObserver(()=>{if(document.querySelector('#login-form'))globalThis.sawLoginForm=true;if(document.querySelector('.topbar'))globalThis.sawAuthenticatedUi=true;}).observe(document,{childList:true,subtree:true});
 });
 await page.route('**/preview-api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/preview-api','');
  const response=async(body,status=200)=>{await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});};
  if(path==='/me'){
   const currentMode=mode,currentLookup=lookup;
   await currentLookup.promise;
   return currentMode==='remembered'?response(profile):currentMode==='signed-out'?response({message:'Session expired'},401):response({message:'Test API unavailable'},503);
  }
  if(path==='/school/permissions'){
   const expired=accessExpired;
   if(access)await access.promise;
   if(expired)return response({message:'Session revoked'},401);
   return response({permissions:{publish:true,homework:true,records:true,accounts:true,site_settings:true}});
  }
  if(path==='/public/banner')return response({enabled:false,content:'',marqueeEnabled:false,marquee:''});
  if(path==='/public/auth-config')return response({firebase:{enabled:false}});
  if(path==='/school/mailboxes')return response([{verified:true}]);
  if(path==='/school/preferences')return response({favorites:[]});
  if(path==='/announcements'&&feedFails)return response({message:'Test feed unavailable'},503);
  if(path==='/announcements'||path==='/countdowns')return response([]);
  return response({ok:true});
 });
 let scenario=0;
 const open=(timeout=false)=>page.goto('http://127.0.0.1:4173/?startup-test='+(++scenario)+(timeout?'&restore-timeout=1':'')+'#/admin/login');
 const noForm=async()=>check(await page.locator('#login-form').count()===0,'Login form must not appear during restoration');
 await open();
 await page.waitForFunction(()=>document.body.textContent.includes('正在恢復登入狀態'));
 await noForm();
 check(!await page.evaluate(()=>globalThis.sawLoginForm),'No initial login flash');
 lookup.resolve();
 await page.locator('.topbar').waitFor({state:'visible'});
 check(await page.locator('.topbar').innerText().then(text=>text.includes('Remembered Admin')),'Remembered profile goes directly to authenticated UI');
 check(!await page.evaluate(()=>globalThis.sawLoginForm),'No login form anywhere in remembered startup');

 mode='signed-out';lookup=deferred();
 await open();await noForm();lookup.resolve();
 await page.locator('#login-form').waitFor({state:'visible'});
 await page.locator('input[name="account"]').fill('manual-account');
 check(await page.locator('input[name="account"]').inputValue()==='manual-account','Signed-out user can type after lookup completes');

 mode='unavailable';lookup=deferred();lookup.resolve();
 await open();await page.locator('#session-restore-retry').waitFor({state:'visible'});await noForm();
 mode='remembered';
 await page.locator('#session-restore-retry').click();
 await page.locator('.topbar').waitFor({state:'visible'});
 check(!await page.evaluate(()=>globalThis.sawLoginForm),'Retry restores existing login without showing login form');

 mode='unavailable';await open();
 await page.locator('#session-restore-sign-in').click();
 await page.locator('input[name="account"]').fill('explicit-manual-login');
 check(await page.locator('input[name="account"]').inputValue()==='explicit-manual-login','Explicit fallback allows manual login');

 mode='remembered';lookup=deferred();await open();
 await page.waitForFunction(()=>document.body.textContent.includes('正在恢復登入狀態'));
 await page.evaluate(()=>{location.hash='#/student/login';});
 await page.locator('#login-form').waitFor({state:'visible'});
 await page.locator('input[name="account"]').fill('keep-this-input');
 lookup.resolve();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 check(await page.locator('input[name="account"]').inputValue()==='keep-this-input','Stale restoration must not overwrite a different portal or manual input');
 check(await page.locator('.topbar').count()===0,'Cancelled restoration cannot sign in later');

 lookup=deferred();lookup.resolve();access=deferred();feedFails=true;
 await open();await page.waitForFunction(()=>document.body.textContent.includes('正在恢復登入狀態'));await noForm();
 access.resolve();
 await page.locator('.topbar').waitFor({state:'visible'});
 check(!await page.evaluate(()=>globalThis.sawLoginForm),'Early feed failure cannot expose login before permissions resolve');

 access=null;feedFails=false;accessExpired=true;
 await open();await page.locator('#login-form').waitFor({state:'visible'});
 check(!await page.evaluate(()=>globalThis.sawAuthenticatedUi),'Revoked session must not be revived by a late access callback');

 accessExpired=false;lookup=deferred();
 await page.addInitScript(()=>{if(!new URL(location.href).searchParams.has('restore-timeout'))return;const original=setTimeout;globalThis.setTimeout=(callback,delay,...args)=>original(callback,delay===15000?50:delay,...args);});
 await open(true);await page.locator('#session-restore-retry').waitFor({state:'visible'});await noForm();
 check(await page.locator('#app').innerText().then(text=>text.includes('逾時')),'Timed-out lookup shows recovery controls');
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Session recovery screen must fit mobile viewport');
 lookup.resolve();
 return 'Session startup checks passed: remembered, signed out, failure, retry, manual fallback, stale response, feed failure, revocation, timeout and mobile layout';
}
