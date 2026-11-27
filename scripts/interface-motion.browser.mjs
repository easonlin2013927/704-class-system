async page=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const checks=[];
 const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
 const actor={id:'10000000-0000-4000-8000-000000000001',role:'admin',display_name:'Preview Admin',theme:'dark'};
 await page.addInitScript(()=>{
  window.viewMotions=[];
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(...args){if(this.tagName==='MAIN')window.viewMotions.push(this.id);return animate.apply(this,args);};
 });
 await page.route('**/preview-api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/preview-api','');
  let body=[];
  if(path==='/me'){await new Promise(resolve=>setTimeout(resolve,600));body=actor;}
  else if(path==='/public/auth-config')body={firebase:{enabled:false}};
  else if(path==='/public/banner')body={enabled:false,content:''};
  else if(path==='/school/permissions')body={permissions:{accounts:true,site_settings:true}};
  else if(path==='/school/preferences')body={favorites:[]};
  else if(path==='/school/mailboxes')body=[{id:'mail',address:'preview@example.test',verified:true}];
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('http://127.0.0.1:4173/?motion='+Date.now()+'#/admin/login');
 await page.locator('.boot-screen span').waitFor();
 check(await page.locator('.boot-screen span').evaluate(node=>getComputedStyle(node).animationName)==='ui-ring-spin','Session restore uses loading ring');
 await page.locator('.topbar').waitFor();
 await page.waitForTimeout(250);
 const before=await page.evaluate(()=>window.viewMotions.length);
 await page.locator('#open-settings').click();
 check(await page.evaluate(()=>window.viewMotions.length)>before,'Changing screen animates main content');
 await page.locator('[data-settings-tab="account"]').click();
 const after=await page.evaluate(()=>window.viewMotions.length);
 await page.locator('input[name=nickname]').fill('Motion preview');
 check(await page.evaluate(()=>window.viewMotions.length)===after,'Typing does not replay screen motion');
 const repo=page.locator('.repo-button').first();
 check(await repo.evaluate(node=>getComputedStyle(node,'::before').maskImage.includes('github-logo.svg')),'Project button uses existing GitHub mark');
 const input=page.locator('input[name=nickname]');
 await input.focus();
 check(await input.evaluate(node=>getComputedStyle(node).boxShadow)!=='none','Text field has focus depth');
 await page.evaluate(async()=>{
  const {openDialog}=await import('/src/dialog-motion.js');
  const node=document.createElement('dialog');node.className='form-dialog';node.id='motion-dialog';node.innerHTML='<header><h2>新增項目</h2><button type="button">關閉</button></header><form><label>名稱<input></label></form>';document.body.append(node);openDialog(node);
 });
 check(await page.locator('#motion-dialog').evaluate(node=>getComputedStyle(node).transitionProperty.includes('opacity')),'Dialog supports explicit fade exit');
 await page.waitForTimeout(230);
 check(await page.locator('#motion-dialog').evaluate(node=>parseFloat(getComputedStyle(node,'::backdrop').backdropFilter.replace(/[^\d.]/g,'')))===5,'Open dialog blurs background');
 check(await page.locator('#motion-dialog').evaluate(node=>getComputedStyle(node).transform)==='none','Open dialog does not trap fixed notifications');
 await page.evaluate(async()=>{
  const dialog=document.querySelector('#motion-dialog');
  const content=document.createElement('div');content.style.height='2000px';dialog.append(content);dialog.scrollTop=2000;
  const {notify}=await import('/src/feedback.js');notify('長表單的操作完成');
 });
 check((await page.locator('.feedback-banner').boundingBox()).y<100,'Notification remains at viewport top in a scrolled dialog');
 await page.locator('.feedback-dismiss').click();
 const exit=await page.evaluate(async()=>{const {closeDialog}=await import('/src/dialog-motion.js');const dialog=document.querySelector('#motion-dialog');closeDialog(dialog);return {open:dialog.open,closing:dialog.hasAttribute('data-dialog-closing')};});
 check(exit.open&&exit.closing,'Exit keeps native top layer until fade finishes');
 await page.waitForTimeout(90);
 const opacity=await page.locator('#motion-dialog').evaluate(node=>Number(getComputedStyle(node).opacity));
 check(opacity>0&&opacity<1,'Dialog visibly fades during exit');
 await page.waitForTimeout(230);
 check(await page.locator('#motion-dialog').evaluate(node=>getComputedStyle(node).display)==='none','Dialog finishes exit');
 await page.evaluate(()=>document.querySelector('#motion-dialog').remove());
 await page.evaluate(async()=>{const {notify}=await import('/src/feedback.js');notify('無法完成這項操作','error');});
 await page.locator('.feedback-confirm').waitFor();
 await page.waitForTimeout(230);
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 check(await page.locator('.feedback-dialog').count()===0,'Feedback exit cleans up dialog');
 await page.evaluate(async()=>{
  const first=document.createElement('button');first.id='motion-first';first.textContent='原按鈕';
  const next=document.createElement('input');next.id='motion-next';document.body.append(first,next);first.focus();
  const {notify}=await import('/src/feedback.js');notify('焦點測試','error');
  document.querySelector('.feedback-dialog').addEventListener('close',()=>next.focus(),{once:true});
 });
 await page.waitForTimeout(230);
 await page.locator('.feedback-confirm').click();
 await page.locator('.feedback-dialog').waitFor({state:'detached'});
 check(await page.locator('#motion-next').evaluate(node=>node===document.activeElement),'Exit cleanup does not steal new focus');
 await page.evaluate(()=>{document.querySelector('#motion-first').remove();document.querySelector('#motion-next').remove();});
 await page.emulateMedia({reducedMotion:'reduce'});
 const reducedBefore=await page.evaluate(()=>window.viewMotions.length);
 await page.locator('[data-home]').first().click();
 check(await page.evaluate(()=>window.viewMotions.length)===reducedBefore,'Reduced motion skips page animation');
 await page.evaluate(()=>{const p=document.createElement('p');p.className='ui-loading';p.id='motion-loader';p.textContent='載入中…';document.body.append(p);});
 check(await page.locator('#motion-loader').evaluate(node=>getComputedStyle(node,'::before').animationName)==='none','Reduced motion keeps loading ring still');
 await page.evaluate(()=>document.querySelector('#motion-loader').remove());
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.screenshot({path:'.taste-skill/interface-motion-desktop.png'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Screen fits '+width+'px');
 }
 return {passed:checks.length,checks};
}
