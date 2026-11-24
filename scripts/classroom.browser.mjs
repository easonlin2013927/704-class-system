async(page)=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 const id='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002',room='00000000-0000-4000-8000-000000000003',message='00000000-0000-4000-8000-000000000004',file='00000000-0000-4000-8000-000000000005';
 let role='student',delegated=false,posts=[],receipts=0,reminded=0,downloads=0,bulk=null;
 await page.route('**/preview-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/preview-api',''),method=request.method();let data={ok:true};
  if(path==='/me')data={id,role,display_name:'測試帳號',theme:'dark'};
  else if(path==='/school/permissions')data={permissions:role==='student'?{board_reply:delegated}:{board_reply:true,collections:true,chat_moderation:true}};
  else if(path==='/public/banner')data={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  else if(path==='/public/auth-config')data={firebase:{enabled:false}};
  else if(path==='/school/preferences')data={favorites:['board','collections','chat']};
  else if(path==='/school/mailboxes')data=[{id:'fixture-mail',address:'test@example.com',verified:true}];
  else if(path==='/school/board'){
   if(method==='POST')posts.unshift({id:peer,author_id:id,author_name:'測試帳號',content:request.postDataJSON().content,created_at:new Date().toISOString(),replies:[]});data=posts;
  }
  else if(path==='/school/honors')data={title:'段考英雄榜',top_count:3,published:false,winners:[],candidates:[]};
  else if(path==='/school/collections')data=[{id,title:'同意書',description:'請簽名繳回',due_on:'2026-12-01',my_status:'missing',submitted:0,missing:2,excluded:0}];
  else if(path==='/school/collections/'+id){if(method==='PATCH')bulk=request.postDataJSON();else data=[{student_id:id,display_name:'學生甲',status:'missing'},{student_id:peer,display_name:'學生乙',status:'missing'}];}
  else if(path.endsWith('/remind')){reminded++;data={queued:1,total:2,no_email:1,disabled:0,cooldown:0};}
  else if(path==='/school/people')data=[{id,display_name:'我',status:'online'},{id:peer,display_name:'同學',status:'offline'}];
  else if(path==='/school/chat-settings')data={enabled:true};
  else if(path==='/school/presence')data={preference:'online',status:'online'};
  else if(path==='/school/rooms')data=[{id:room,kind:'direct',members:[{id,name:'我',status:'online'},{id:peer,name:'同學',status:'offline'}],unread_count:1}];
  else if(path.endsWith('/messages'))data=[{id:message,author_id:id,author_name:'我',content:'訊息內容',created_at:new Date().toISOString(),read_by:[{id:peer,name:'同學'}],attachments:[{id:file,name:'測試.pdf',size:1234}]}];
  else if(path.startsWith('/school/chat-read/'))receipts++;
  else if(path==='/school/admin-rooms')data=[{id:room,title:'交談',members:['我','同學']}];
  else if(path==='/school/chat-attachments/'+file){downloads++;await route.fulfill({status:200,contentType:'application/pdf',headers:{'Content-Disposition':"attachment; filename*=UTF-8''test.pdf"},body:'test file'});return;}
  else if(['/school/announcements','/school/countdowns','/school/homework','/school/records','/announcements','/countdowns','/school/subjects','/school/students'].includes(path))data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const open=async()=>{await page.goto('http://127.0.0.1:4173/?classroom='+role+Date.now()+'#/'+role+'/login');await page.locator('.topbar').waitFor();};
 const view=async key=>{if(await page.locator('#board-back').count())await page.locator('#board-back').click();const control=page.locator(`[data-school-view="${key}"]`).first();if(!await control.isVisible())await page.locator('.nav-more summary').click();await control.click();};
 const bounds=async()=>check(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),'No page horizontal overflow');
 await page.setViewportSize({width:1440,height:1000});await open();
 check(await page.locator('[data-school-view="notifications"]').count()===0,'Inbox removed');
 await view('board');await page.locator('#board-add').click();await page.locator('#board-compose textarea').fill('今天很開心 <script>window.injected=true</script>');await page.locator('#board-compose button').click();await page.getByText('今天很開心 <script>window.injected=true</script>',{exact:true}).waitFor();
 check(!await page.evaluate(()=>window.injected),'Board text escaped');check(await page.locator('#board-reply-form').count()===0,'Ordinary student cannot reply');
 await view('collections');await page.getByText('我的狀態：').waitFor();check(await page.locator('[data-collection]').count()===0,'Student cannot manage collection');
 await view('honors');await page.getByText('英雄榜尚未公布',{exact:true}).waitFor();
 await view('chat');await page.locator('[data-room]').click();await page.getByText('已讀：同學',{exact:true}).waitFor();check(receipts>0,'Visible conversation acknowledged');await page.locator('#chat-presence').selectOption('offline');
 await page.setViewportSize({width:390,height:844});await page.locator('.nav-more[open]').waitFor({state:'detached'});await bounds();await page.locator('.toast').evaluateAll(items=>items.forEach(item=>item.remove()));await page.screenshot({path:'.taste-skill/classroom-chat-mobile.png'});
 role='teacher';await open();await view('collections');await page.locator('[data-create-collection]').click();await page.locator('#collection-create').waitFor();await bounds();await page.locator('#collection-create [data-close]').click();
 await page.locator('[data-collection]').click();await page.locator('#collection-manage [data-pick="all"]').click();await page.locator('#collection-manage select').selectOption('submitted');await page.locator('#collection-manage [type="submit"]').click();await page.locator('[data-collection]').waitFor();check(bulk?.students.length===2&&bulk.status==='submitted','Bulk status affects selected class');
 await page.locator('[data-collection]').click();await page.locator('[data-remind-collection]').click();await page.getByText(/已排入郵件佇列 1 人/).waitFor();check(reminded===1,'Single reminder action');await bounds();await page.locator('.toast').evaluateAll(items=>items.forEach(item=>item.remove()));await page.screenshot({path:'.taste-skill/classroom-collection-mobile.png'});await page.locator('#collection-manage [data-close]').click();
 await page.setViewportSize({width:1440,height:1000});await view('board');await page.locator('[data-open-note]').click();await page.locator('#board-reply-form').waitFor();await bounds();await page.screenshot({path:'.taste-skill/classroom-board-desktop.png'});
 role='admin';await open();await view('adminchat');await page.locator('[data-admin-room]').click();await page.locator('[data-admin-chat-file]').waitFor();const download=page.waitForEvent('download');await page.locator('[data-admin-chat-file]').click();await download;check(downloads===1,'Admin downloads actual attachment');
 role='student';delegated=true;await open();await view('board');await page.locator('[data-open-note]').click();await page.locator('#board-reply-form').waitFor();check(await page.locator('#board-reply-form').count()===1,'Delegated student can reply');
 return 'Classroom browser checks passed: student/teacher/delegated permissions, public escaped posts, collection bulk/reminders, unpublished honors, chat status/read receipts, admin file download, mobile/desktop and inbox removal';
}
