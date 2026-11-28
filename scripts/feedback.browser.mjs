async page=>{
 const checks=[];
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const actor={id:'10000000-0000-4000-8000-000000000001',role:'admin',display_name:'Preview Admin',theme:'dark',permissions:{accounts:true,site_settings:true}};
 let accepted=false;
 await page.route('**/preview-api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/preview-api','');
  let body=[],status=200;
  if(path==='/me'){status=401;body={message:'請登入'};}
  else if(path==='/login'){if(accepted)body={profile:actor,token:'preview-token'};else{status=401;body={message:'帳號或密碼錯誤'};}}
  else if(path==='/public/auth-config')body={firebase:{enabled:false}};
  else if(path==='/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  else if(path==='/school/permissions')body={permissions:actor.permissions};
  else if(path==='/school/preferences')body={favorites:[]};
  else if(path==='/school/mailboxes')body=[{id:'mail',address:'preview@example.test',verified:true}];
  else if(path==='/school/presence')body={ok:true};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('http://127.0.0.1:4173/?ui-check='+Date.now()+'#/admin/login');
 await page.locator('#login-form').waitFor();
 await page.locator('#login-form [name=account]').fill('preview');
 await page.locator('#login-form [name=password]').fill('preview-only');
 await page.locator('#login-form [type=submit]').click();
 await page.locator('.feedback-banner[data-tone=error]').waitFor();
 check(await page.locator('.feedback-banner-title').textContent()==='登入失敗','Login failure uses top red banner');
 check(await page.locator('.feedback-dialog').count()===0,'Login failure does not open a dialog');
 check((await page.locator('.feedback-banner').boundingBox()).y<100,'Banner appears at top');
 await page.locator('.feedback-dismiss').click();
 accepted=true;
 await page.locator('#login-form [type=submit]').click();
 await page.locator('.topbar').waitFor();
 await page.locator('.feedback-banner[data-tone=success]').filter({hasText:'登入成功'}).waitFor();
 check((await page.locator('.feedback-banner').textContent()).includes('登入成功'),'Login success uses top green banner');
 await page.locator('.feedback-dismiss').click();
 await page.evaluate(async()=>{
  const {notify}=await import('/src/feedback.js');
  notify('操作完成');notify('活動已儲存');
 });
 check(await page.locator('.feedback-banner').count()===1,'Success notices replace outdated success');
 check((await page.locator('.feedback-banner').textContent()).includes('活動已儲存'),'Latest success is immediate');
 await page.locator('.feedback-dismiss').click();
 await page.evaluate(async()=>{
  const {notify}=await import('/src/feedback.js');
  notify('<img src=x onerror="window.injected=true">','error');
  notify('<img src=x onerror="window.injected=true">','error');
 });
 check(await page.locator('dialog.feedback-dialog:modal').count()===1,'Duplicate errors show one dialog');
 check(await page.locator('.feedback-message img').count()===0,'Error message is rendered as text');
 check(await page.locator('.feedback-confirm').evaluate(node=>node===document.activeElement),'Dialog focuses confirm');
 check(await page.locator('.feedback-mark').evaluate(node=>getComputedStyle(node).color)==='rgb(248, 113, 113)','Error mark is red');
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 check(await page.locator('.feedback-dialog').count()===0,'Duplicate error does not remain queued');
 await page.evaluate(async()=>{
  const parent=document.createElement('dialog');parent.id='test-parent';parent.innerHTML='<button id="parent-focus">Return here</button>';document.body.append(parent);parent.showModal();parent.querySelector('button').focus();
  const {notify}=await import('/src/feedback.js');notify('請確認輸入','error');
 });
 await page.keyboard.press('Escape');
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 check(await page.locator('#test-parent').evaluate(node=>node.matches(':modal')),'Escape closes feedback, preserves form');
 check(await page.locator('#parent-focus').evaluate(node=>node===document.activeElement),'Focus returns to underlying form');
 await page.evaluate(()=>{document.querySelector('#test-parent').close();document.querySelector('#test-parent').remove();});
 await page.evaluate(async()=>{const {notify}=await import('/src/feedback.js');notify('已完成重要操作','success',{presentation:'dialog'});});
 check(await page.locator('.feedback-dialog[data-tone=success]').count()===1,'Important success supports confirmation');
 const ring=await page.locator('.feedback-success-ring').evaluate(node=>{
  const animation=node.getAnimations()[0];
  if(!animation)return {};
  animation.pause();animation.currentTime=150;
  const first=getComputedStyle(node).transform;
  const mark=node.parentElement;
  const checkBefore=getComputedStyle(mark,'::before').transform;
  animation.currentTime=350;
  const result={rotates:first!==getComputedStyle(node).transform,checkFixed:checkBefore===getComputedStyle(mark,'::before').transform&&getComputedStyle(mark).transform==='none',iterations:animation.effect.getTiming().iterations};
  animation.currentTime=800;
  const style=getComputedStyle(node);
  result.complete=style.borderTopColor===style.borderRightColor&&style.borderTopColor===style.borderBottomColor;
  animation.play();return result;
 });
 check(ring.rotates,'Success ring rotates independently');
 check(ring.checkFixed,'Success checkmark stays still');
 check(ring.iterations===1&&ring.complete,'Success ring finishes once as a complete circle');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  const box=await page.locator('.feedback-dialog').boundingBox();
  check(box.x>=0&&box.x+box.width<=width+1,'Dialog fits '+width+'px');
 }
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:'.taste-skill/uiverse-success.png'});
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 for(const theme of ['dark','light','ocean','forest','rose','amber','midnight','slate','notebook','lavender','brick','teal','mono']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.evaluate(async()=>{const {notify}=await import('/src/feedback.js');notify('測試訊息','error');});
  check(await page.locator('.feedback-confirm').isVisible(),'Feedback visible in '+theme);
  await page.locator('.feedback-confirm').click();
  await page.locator('.feedback-dialog').waitFor({state:'detached'});
 }
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{const {notify}=await import('/src/feedback.js');notify('減少動畫成功測試','success',{presentation:'dialog'});});
 check(await page.locator('.feedback-success-ring').evaluate(node=>node.getAnimations().length===0&&getComputedStyle(node).borderTopColor===getComputedStyle(node).borderRightColor),'Reduced motion keeps a static complete success ring');
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 await page.evaluate(async()=>{const {notify}=await import('/src/feedback.js');notify('動畫偏好測試','error');});
 check(await page.locator('.feedback-dialog').evaluate(node=>getComputedStyle(node).animationName)==='none','Reduced motion disables entrance');
 await page.screenshot({path:'.taste-skill/uiverse-error.png'});
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.screenshot({path:'.taste-skill/uiverse-admin.png'});
 return {passed:checks.length,checks};
}
