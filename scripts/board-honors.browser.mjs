async(page)=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 const ids=Array.from({length:8},(_,index)=>'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'));
 const students=ids.slice(0,5).map((id,index)=>({id,display_name:['林同學 Eason','陳同學 Avery','張同學 Ryan','李同學 Jamie','王同學 Alex'][index],nickname:['小林','星星','阿張','小李','小王'][index]}));
 const portrait=index=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${['#d8c8b5','#b9ccd2','#c8ceb7','#d7b9af','#c0bfc8'][index]}"/><circle cx="50" cy="37" r="18" fill="#fff8e9"/><path d="M16 100v-8a34 34 0 0 1 68 0v8" fill="#58606a"/></svg>`);
 let role='student',unpublishedCount=0,saves=[],moves=[],added=0,boardGets=0;
 const actor=()=>({id:role==='student'?ids[0]:role==='teacher'?ids[5]:role==='admin'?ids[6]:ids[7],role,display_name:role==='student'?'林同學 Eason':role==='teacher'?'測試教師':role==='admin'?'測試管理員':'測試小老師',theme:'dark'});
 const noteA='10000000-0000-4000-8000-000000000001',noteB='10000000-0000-4000-8000-000000000002',noteC='10000000-0000-4000-8000-000000000003';
 let notes=[{id:noteA,author_id:ids[0],author_name:'林同學 Eason',content:'今天終於解出那一道數學題了。\n謝謝願意陪我一起練習的同學！',created_at:'2026-11-24T08:00:00Z',position_x:.07,position_y:.09,replies:[]},{id:noteB,author_id:ids[1],author_name:'陳同學 Avery',content:'這星期有一點忙，但午休和大家聊天的時間，讓我覺得很開心。',created_at:'2026-11-24T07:00:00Z',position_x:.35,position_y:.13,replies:[{id:'reply',author_name:'教師',content:'慢慢來，也要記得休息。',created_at:'2026-11-24T09:00:00Z'}]}];
 let honors={title:'第一次段考',top_count:3,published:true,ids:[ids[0],ids[1],ids[2]]};
 const honorData=()=>({...honors,winners:(!honors.published&&!['teacher','admin'].includes(role))?[]:honors.ids.map((id,index)=>{const student=students.find(row=>row.id===id);return {rank:index+1,student_id:id,...student,avatar_url:portrait(students.indexOf(student))};}),candidates:['teacher','admin'].includes(role)?students:[]});
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
 await page.route('**/preview-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/preview-api',''),method=request.method();let body={ok:true};
  if(path==='/me')body=actor();
  else if(path==='/school/permissions')body={permissions:{honors:role==='teacher'||role==='admin',board_manage:role==='teacher'||role==='admin',board_reply:role!=='student',collections:role==='teacher'||role==='admin',accounts:role==='admin'}};
  else if(path==='/school/preferences')body={favorites:['board','honors']};
  else if(path==='/school/mailboxes')body=[{id:'mail',address:'fixture@example.test',verified:true}];
  else if(path==='/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
  else if(path==='/public/auth-config')body={firebase:{enabled:false}};
  else if(path==='/school/board'){
   if(method==='POST'){const data=request.postDataJSON();added++;const post={id:noteC,author_id:actor().id,author_name:actor().display_name,created_at:new Date().toISOString(),replies:[],...data};notes.unshift(post);body=post;}else{boardGets++;body=notes;}
  }
  else if(path.startsWith('/school/board/')&&method==='PATCH'){const id=path.split('/').at(-1),data=request.postDataJSON(),note=notes.find(row=>row.id===id);check(note.author_id===actor().id,'Only own note can move');Object.assign(note,data);moves.push({id,...data});body={id,...data};}
  else if(path==='/school/honors'){
   if(method==='PATCH'){check(['teacher','admin'].includes(role),'Unpublish editor role');check(request.postDataJSON().published===false,'Unpublish payload');unpublishedCount++;honors.published=false;}
   if(method==='PUT'){check(['teacher','admin'].includes(role),'Honors editor role');const data=request.postDataJSON();saves.push(data);honors={title:data.title,top_count:data.top_count,published:true,ids:data.winners};}
   body=honorData();
  }
  else if(['/announcements','/countdowns','/school/records','/school/homework','/school/subjects','/school/students'].includes(path))body=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const open=async()=>{await page.goto('http://127.0.0.1:4173/?board-honors='+role+Date.now()+'#/'+(role==='assistant'?'teacher':role)+'/login');await page.locator('.topbar').waitFor();};
 const view=async key=>{if(await page.locator('#board-back').count())await page.locator('#board-back').click();const link=page.locator(`[data-school-view="${key}"]`);if(!await link.isVisible())await page.locator('.nav-more summary').click();await link.click();};
 const screenshot=async path=>{await page.locator('.toast').evaluateAll(items=>items.forEach(item=>item.remove()));await page.screenshot({path});};
 const bounded=async()=>check(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),'No page horizontal overflow');
 await page.setViewportSize({width:1440,height:1000});await open();await view('board');await page.locator(`[data-note-id="${noteA}"]`).waitFor();
 check(await page.locator('.topbar,.school-nav').count()===0,'Board hides global header and sidebar');
 check(await page.locator(`[data-note-id="${noteA}"] [data-note-move]`).count()===1,'Own note has move control');
 check(await page.locator(`[data-note-id="${noteB}"] [data-note-move]`).count()===0,'Other note has no move control');
 await page.locator(`[data-open-note="${noteB}"]`).click();await page.getByText('慢慢來，也要記得休息。',{exact:true}).waitFor();check(await page.locator('#board-reply-form').count()===0,'Ordinary student cannot reply');await page.locator('#board-dialog [data-close]').click();
 const handle=page.locator(`[data-note-id="${noteA}"] [data-note-move]`);
 const keySaved=page.waitForResponse(response=>response.request().method()==='PATCH');await handle.press('ArrowRight');await keySaved;check(moves.length===1&&moves[0].position_x>.07,'Keyboard position persisted');
 const start=await handle.boundingBox(),dragSaved=page.waitForResponse(response=>response.request().method()==='PATCH');await page.mouse.move(start.x+22,start.y+20);await page.mouse.down();await page.mouse.move(start.x+122,start.y+90,{steps:8});await page.mouse.up();await dragSaved;check(moves.length===2&&moves[1].position_x>moves[0].position_x&&moves[1].position_y>moves[0].position_y,'Pointer drag persisted');
 const savedX=notes.find(row=>row.id===noteA).position_x;await page.locator('#board-back').click();await page.locator('.school-nav').waitFor();await view('board');await page.locator(`[data-note-id="${noteA}"]`).waitFor();
 const position=await page.locator(`[data-note-id="${noteA}"]`).evaluate(paper=>({left:parseFloat(paper.style.left),available:paper.parentElement.clientWidth-paper.offsetWidth}));check(Math.abs(position.left/position.available-savedX)<.001,'Position survives leaving and re-entering');
 await page.locator('#board-add').click();await page.locator('#board-compose textarea').fill('新的便利貼 <script>window.injected=true</script>');await page.locator('#board-compose [type="submit"]').click();await page.locator(`[data-note-id="${noteC}"]`).waitFor();check(added===1&&!await page.evaluate(()=>window.injected),'New note escaped and persisted');
 await screenshot('.taste-skill/cork-board-desktop.png');await page.setViewportSize({width:390,height:844});await page.locator(`[data-note-id="${noteA}"]`).scrollIntoViewIfNeeded();await bounded();check(await handle.evaluate(element=>getComputedStyle(element).touchAction)==='none','Touch handle does not pan page');await screenshot('.taste-skill/cork-board-mobile.png');
 await page.locator('#board-add').click();check(await page.locator('#board-dialog').evaluate(dialog=>{const box=dialog.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1;}),'Mobile compose fits');await page.locator('#board-dialog [data-close]').click();
 await view('honors');await page.locator('.honors-podium').waitFor();check(await page.locator('#edit-honors').count()===0,'Student cannot edit honors');check(await page.locator('.winner-nickname').count()===3,'Nicknames shown');check(await page.locator('.winner-avatar img').count()===3,'Avatars shown');
 role='teacher';await open();await view('honors');await page.locator('#edit-honors').waitFor();
 for(const count of [1,3,5]){await page.locator('#edit-honors').click();await page.locator('#honors-form [name="top_count"]').selectOption(String(count));await page.locator('#honors-form [name="title"]').fill('第二次段考');for(let index=0;index<count;index++)await page.locator(`#honors-form [name="place-${index+1}"]`).selectOption(ids[index]);await page.locator('#honors-form [type="submit"]').click();await page.locator(`.honors-podium[data-places="${count}"]`).waitFor();check(saves.at(-1).winners.length===count,'Configured podium count');}
 const order=await page.locator('.podium-entry').evaluateAll(items=>items.map(item=>Number(item.dataset.rank)));check(order.join(',')==='4,2,1,3,5','Five-place podium order');
 await page.locator('#edit-honors').click();await page.locator('#honors-form [name="place-2"]').selectOption(ids[0]);const before=saves.length;await page.locator('#honors-form [type="submit"]').click();await page.getByText('每個名次請選擇不同的學生',{exact:true}).waitFor();check(saves.length===before,'Duplicate places rejected before save');check(await page.locator('.feedback-dialog[data-tone="error"]').count()===1,'Duplicate places show error confirmation');await page.locator('.feedback-confirm').click();await page.locator('.feedback-dialog').waitFor({state:'detached'});await page.locator('#honors-editor [data-close]').click();
 await page.setViewportSize({width:1440,height:1000});await screenshot('.taste-skill/honors-five-desktop.png');
 for(const theme of ['dark','light','ocean','forest','rose','amber','midnight','slate','notebook','lavender','brick','teal','mono']){await page.evaluate(async value=>{const {applyTheme}=await import('/src/personalization.js');applyTheme(value);},theme);await bounded();}
 await page.evaluate(async()=>{const {applyTheme}=await import('/src/personalization.js');applyTheme('dark');});
 for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});await bounded();check(await page.locator('.podium-step').evaluateAll(steps=>steps.every(step=>{const parent=step.getBoundingClientRect();return [...step.children].every(child=>getComputedStyle(child).display==='none'||child.getBoundingClientRect().bottom<=parent.bottom+1);})),`Podium labels fit at ${width}px`);}
 await page.setViewportSize({width:390,height:844});await page.locator('.podium-scroll').evaluate(element=>element.scrollLeft=(element.scrollWidth-element.clientWidth)/2);await screenshot('.taste-skill/honors-five-mobile.png');
 role='admin';await open();await view('board');await page.locator(`[data-note-id="${noteA}"]`).waitFor();check(await page.locator('[data-note-move]').count()===0,'Admin cannot move another author notes');await page.locator(`[data-open-note="${noteB}"]`).click();await page.locator('#board-reply-form').waitFor();await page.locator('#board-dialog [data-close]').click();
 role='assistant';await open();await view('honors');await page.locator('.honors-podium').waitFor();check(await page.locator('#edit-honors').count()===0,'Assistant cannot edit honors');
 role='teacher';await open();await view('honors');await page.locator('#unpublish-honors').click();await page.getByText('英雄榜尚未公布',{exact:true}).waitFor();check(unpublishedCount===1,'Teacher can unpublish');
 await page.locator('#edit-honors').click();check(await page.locator('#honors-form [name="place-1"]').inputValue()===ids[0],'Unpublish preserves configured places');await page.locator('#honors-editor [data-close]').click();
 role='student';await open();await view('honors');await page.getByText('英雄榜尚未公布',{exact:true}).waitFor();check(await page.locator('.honors-podium,#unpublish-honors').count()===0,'Student sees unpublished message and no podium/action');
 role='admin';await open();await view('honors');await page.locator('#edit-honors').click();await page.locator('#honors-form [type="submit"]').click();await page.locator('.honors-podium').waitFor();
 role='student';await open();await view('honors');await page.locator('.honors-podium').waitFor();honors.published=false;await page.getByText('英雄榜尚未公布',{exact:true}).waitFor({timeout:22000});check(await page.locator('.honors-podium').count()===0,'Open student page removes unpublished ranking automatically');
 return 'Board and honors passed: full-screen cork wall, own-note keyboard/drag persistence, public replies, no foreign-note movement, 1/3/5 podium configuration, names/nicknames/avatars, 13 themes and 320–1440px';
}
