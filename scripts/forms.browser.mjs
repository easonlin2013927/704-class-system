async(page)=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 const subject='00000000-0000-4000-8000-000000000001',student='00000000-0000-4000-8000-000000000002';
 const subjects=[{id:subject,name:'國文',active:true}],students=[{id:student,display_name:'測試學生',nickname:''}];
 let role='admin',posts=[],homework=[{id:'00000000-0000-4000-8000-000000000003',subject_id:subject,subject:'國文',author:'教師',title:'既有作業',work_day:'2026-11-24',due_on:'2026-11-30',instructions:'保留原說明',resource_url:'https://example.com/',submission_mode:'link',recipients:null,done:false}];
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.append(style);});});
 await page.route('**/preview-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/preview-api',''),method=request.method();
  let body={ok:true};
  if(path==='/me')body={id:'fixture-user',role,display_name:'測試帳號',theme:'dark'};
  else if(path==='/school/permissions')body={permissions:role==='student'?{}:{publish:true,homework:true,grades:true,records:true,reports:true,points:true,subjects:true,accounts:true,site_settings:true}};
  else if(path==='/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  else if(path==='/public/auth-config')body={firebase:{enabled:false}};
  else if(path==='/account/providers')body={enabled:false,providers:[]};
  else if(path==='/school/preferences')body={favorites:[]};
  else if(path==='/school/mailboxes'||path.startsWith('/school/mail-admin/'))body=[{id:'fixture-mailbox',address:'test@example.com',verified:true,locked:false}];
  else if(path==='/school/subjects')body=subjects;
  else if(path==='/school/students'||path==='/school/people')body=students;
  else if(path==='/school/homework'){
   if(method==='POST'){
    const saved=request.postDataJSON();posts.push(saved);
    homework.push({...saved.items[0],id:'fixture-created',subject:'國文',author:'測試帳號',subject_id:saved.subject_id,work_day:saved.work_day,recipients:saved.recipients,done:false});
   }
   body=homework;
  }
  else if(path==='/school/chat-settings')body={enabled:true};
  else if(path==='/school/notification-settings')body={};
  else if(path==='/admin/accounts')body=students.map(x=>({...x,email:'test-student',role:'student',disabled:false}));
  else if(['/announcements','/countdowns','/school/records','/school/grades','/school/grade-summary','/school/rooms','/school/sessions','/school/reports'].includes(path))body=[];
  return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const open=async()=>{await page.goto('http://127.0.0.1:4173/?forms-role='+role+'#/'+(role==='assistant'?'teacher':role)+'/login');await page.locator('.topbar').waitFor({state:'visible'});};
 const view=async name=>{const item=page.locator(`[data-school-view="${name}"]`);if(!await item.isVisible())await page.locator('.nav-more summary').click();await item.click();};
 const theme=async value=>page.evaluate(async value=>{const {applyTheme}=await import('/src/personalization.js');applyTheme(value);},value);
 const audit=async selector=>{
  const issues=await page.locator(selector).evaluate(dialog=>{
   const issues=[],bounds=dialog.getBoundingClientRect();
   const visible=element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden';
   const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
   const luminance=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const contrast=element=>{let node=element,bg;while(node){bg=getComputedStyle(node).backgroundColor;if(!bg.endsWith(', 0)')&&bg!=='transparent')break;node=node.parentElement;}const a=luminance(getComputedStyle(element).color),b=luminance(bg||'rgb(255,255,255)');return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   if(bounds.x<0||bounds.right>innerWidth+1)issues.push('dialog exceeds viewport');
   for(const control of dialog.querySelectorAll('input:not([type="hidden"]),select,textarea,button')){
    if(!visible(control)||control.matches('.form-dialog>.back-button'))continue;
    const rect=control.getBoundingClientRect();
    if(rect.left<bounds.left+10||rect.right>bounds.right-10)issues.push((control.name||control.id||control.textContent)+' touches dialog edge');
   }
   for(const element of dialog.querySelectorAll('h2,h3,header button,.back-button,[data-mail-close],[data-provider-cancel]'))if(visible(element)&&contrast(element)<4.5)issues.push('low text contrast: '+element.textContent);
   for(const form of (dialog.matches('form')?[dialog]:dialog.querySelectorAll('form'))){
    const children=[...form.children].filter(visible);
    for(let i=1;i<children.length;i++){
     const before=children[i-1].getBoundingClientRect(),after=children[i].getBoundingClientRect();
     if(after.top>=before.bottom-1&&after.top-before.bottom<12)issues.push('form rows lack spacing');
    }
   }
   if(dialog.scrollWidth>dialog.clientWidth+1)issues.push('horizontal dialog overflow');
   return issues;
  });
  check(!issues.length,selector+': '+issues.join('; '));
 };
 const review=async selector=>{
  for(const value of ['dark','light'])for(const width of [1440,390]){await theme(value);await page.setViewportSize({width,height:1000});await audit(selector);}
  await theme('dark');await page.setViewportSize({width:1440,height:1000});
 };
 await open();await view('homework');await page.locator('#open-homework').click();
 check(await page.locator('#homework-form textarea').count()===1,'Creation must have exactly one free-text box');
 check(await page.locator('#homework-form [name="subject_id"]').count()===1&&await page.locator('#homework-form [name="work_day"]').count()===1&&await page.locator('#homework-form [name="target"]').count()===1,'Preserve top metadata');
 check(await page.locator('#add-homework-item').count()===0,'Remove nested multiple-item UI');
 for(const value of ['dark','light','ocean','forest','rose','amber','midnight','slate','notebook','lavender','brick','teal','mono']){await theme(value);await audit('#homework-dialog');}
 await theme('dark');
 for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});await audit('#homework-dialog');}
 await page.screenshot({path:'.taste-skill/homework-form-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#homework-form [name="subject_id"]').selectOption(subject);
 await page.locator('#homework-form [name="work_day"]').fill('2026-11-25');
 await page.locator('#homework-form [name="target"]').selectOption('selected');
 await page.locator('#homework-recipients input').check();
 await review('#homework-dialog');
 const content='課本第 20 頁習題\n補充：請寫出計算過程\n參考：https://example.com/';
 await page.locator('#homework-form [name="content"]').fill(content);
 await page.locator('#homework-form [type="submit"]').click();
 await page.waitForFunction(()=>!document.querySelector('#homework-dialog[open]'));
 check(posts.length===1&&posts[0].items.length===1&&posts[0].items[0].title===content,'Save multiline content as one item');
 check(posts[0].items[0].due_on==='2026-11-25'&&posts[0].items[0].submission_mode==='check','Creation defaults remain explicit');
 check(posts[0].recipients[0]===student&&posts[0].subject_id===subject,'Preserve chosen subject and recipients');
 await page.locator('#book-all').click();
 await page.locator('[data-edit-hw]').first().click();
 check(await page.locator('#homework-edit [name="instructions"]').inputValue()==='保留原說明','Keep existing advanced edit data');
 check(await page.locator('#homework-edit [name="resource_url"]').inputValue()==='https://example.com/'&&await page.locator('#homework-edit [name="submission_mode"]').inputValue()==='link'&&await page.locator('#homework-edit [name="due_on"]').inputValue()==='2026-11-30','Preserve resource, submission mode and deadline');
 await review('#homework-edit-dialog');await page.locator('#homework-edit-dialog [data-close]').click();
 await view('records');await page.locator('#open-record').click();await review('#record-dialog');await page.locator('#record-dialog [data-close]').click();
 await view('grades');await review('#grade-form');
 await page.locator('#open-accounts').click();await page.locator('#create-person').click();await review('#person-dialog');await page.locator('#close-person').click();
 await page.locator('[data-home]').first().click();await page.locator('#create-toggle').click();await page.locator('#new-activity').click();await review('#activity-dialog');await page.locator('#close-activity').click();
 await page.locator('#open-settings').click();await review('#profile-form');await page.locator('[data-settings-tab="account"]').click();
 await page.locator('[data-mail-add]').first().click();await review('[data-mail-dialog][open]');await page.locator('[data-mail-dialog][open] [data-mail-close]').click();
 await page.locator('[data-provider-dialog]').evaluate(dialog=>{dialog.querySelector('h2').textContent='綁定 Google 帳戶';dialog.querySelector('[data-provider-confirm]').textContent='連接 Google 帳戶';dialog.showModal();});
 await review('[data-provider-dialog]');await page.locator('[data-provider-cancel]').click();
 role='student';await open();await view('chat');await page.locator('#new-room').click();await review('#chat-room-dialog');await page.locator('#chat-room-dialog [data-close]').click();
 role='assistant';await open();await view('homework');await page.locator('#open-homework').click();
 check(await page.locator('#homework-form textarea').count()===1,'Assistant gets simplified form');
 await theme('dark');await page.screenshot({path:'.taste-skill/homework-form-desktop.png'});
 await page.keyboard.press('Escape');check(await page.locator('dialog[open]').count()===0,'Escape closes dialog');
 return 'Form checks passed: simplified homework payload, 13 themes, 320-1440px, records/accounts/activities/mail/providers/chat and Escape';
}
