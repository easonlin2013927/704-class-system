async(page)=>{
 const check=(value,message)=>{if(!value)throw Error(message);},ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 let role='teacher',grants={honors:false,board_manage:false,board_reply:false},saved=0;
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
 await page.route('**/preview-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/preview-api','');let body=[];
  if(path==='/me')body={id:ids[role==='teacher'?1:0],role,display_name:'測試帳號',theme:'dark'};
  else if(path==='/school/permissions')body={permissions:{accounts:['teacher','admin'].includes(role),...grants}};
  else if(path==='/school/permission-accounts'||path==='/admin/accounts')body=[{id:ids[0],role:'student',display_name:'測試學生',email:'student-test'},{id:ids[1],role:'assistant',display_name:'測試小老師',email:'assistant-test'}];
  else if(path.startsWith('/school/permissions/')){if(request.method()==='PUT'){grants=request.postDataJSON();saved++;}body={permissions:grants};}
  else if(path==='/school/preferences')body={favorites:['board','honors']};
  else if(path==='/school/mailboxes')body=[{id:'mail',address:'fixture@example.test',verified:true}];
  else if(path==='/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  else if(path==='/public/auth-config')body={firebase:{enabled:false}};
  else if(path==='/school/honors')body={title:'段考英雄榜',top_count:1,published:false,winners:[],candidates:grants.honors?[{id:ids[0],display_name:'測試學生'}]:[]};
  else if(path==='/school/board')body=[{id:ids[1],author_id:ids[1],author_name:'其他學生',content:'公開便條',created_at:new Date().toISOString(),position_x:.1,position_y:.1,replies:[]}];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const open=async()=>{await page.goto('http://127.0.0.1:4173/?permissions-test='+Date.now()+'#/'+role+'/login');await page.locator('.topbar').waitFor();};
 const view=async key=>{const link=page.locator(`[data-school-view="${key}"]`);if(!await link.isVisible())await page.locator('.nav-more summary').click();await link.click();};
 await page.setViewportSize({width:1280,height:900});await open();
 await page.locator('#open-accounts').click();
 const selector=page.locator('#classroom-permission-account');await selector.locator('option').nth(2).waitFor({state:'attached'});await selector.selectOption(ids[0]);
 for(const key of ['honors','board_manage','board_reply'])await page.locator(`#classroom-permissions [name="${key}"]`).check();
 await page.getByRole('button',{name:'儲存班級工具權限'}).click();await page.getByText('權限已儲存，該使用者重新整理頁面後生效。',{exact:true}).waitFor();check(saved===1&&Object.values(grants).every(Boolean),'Teacher grants three independent capabilities');
 await selector.selectOption(ids[1]);await page.locator('#classroom-permissions [name="honors"]').waitFor();check(await selector.locator('option').count()===3,'Assistant is selectable');
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});check(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),'Permissions page fits width '+width);}
 role='student';await open();await view('honors');await page.locator('#edit-honors').click();await page.locator('#honors-form').waitFor();await page.locator('#honors-editor [data-close]').click();
 await view('board');await page.locator('[data-open-note]').click();check(await page.locator('#board-reply-form').count()===1,'Delegated student can reply');check(await page.locator('[data-delete-note]').count()===1,'Delegated student can moderate');check(await page.locator('[data-note-move]').count()===0,'Moderation never permits moving others notes');
 grants={honors:false,board_manage:false,board_reply:false};await open();await view('honors');await page.getByText('英雄榜尚未公布',{exact:true}).waitFor();check(await page.locator('#edit-honors').count()===0,'Revoked student cannot edit');await view('board');await page.locator('[data-open-note]').click();check(await page.locator('#board-reply-form,[data-delete-note]').count()===0,'Revoked board actions disappear');
 role='admin';await open();await page.locator('#open-accounts').click();await page.locator(`[data-edit-account="${ids[0]}"]`).click();
 for(const key of ['honors','board_manage','board_reply'])await page.locator(`#permission-fields [data-permission="${key}"]`).waitFor();
 check(await page.locator('#permission-fields').innerText().then(text=>text.includes('段考英雄榜編輯與公布')&&text.includes('班級留言板管理')&&text.includes('班級留言板回覆')),'Admin existing editor labels all three permissions');
 return 'PASS: teacher/admin grant UI, assistant targets, delegated/revoked student actions, 320-1280px';
}
