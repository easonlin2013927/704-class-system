async(page)=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const check=(value,message)=>{if(!value)throw Error(message);};let checks=0;
 const verify=(value,message)=>{check(value,message);checks++;};
 await page.route('**/feature-motion-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/board-honors.css"><style>:root{--ink:#eee;--surface:#151515;--surface-2:#222;--muted:#aaa;--line:#444;--line-strong:#666}body{margin:0;background:var(--surface);color:var(--ink);font-family:system-ui}main{padding:16px}dialog{max-width:calc(100vw - 48px);color:var(--ink);background:var(--surface)}textarea{max-width:100%}.chat-messages{height:350px;overflow:auto}.chat-bubble{max-width:70%;padding:12px;border:1px solid var(--line);margin:10px}.chat-bubble.mine{margin-left:auto}.room-button{display:inline-grid}.room-button small{display:block}.chat-file{display:flex}.message-form{display:flex;gap:10px}</style></head><body><main id="fixture"></main></body></html>'}));
 // Never permit an accidental real API write during these source-module checks.
 await page.route('**/preview-api/**',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"Unexpected real API call"}'}));
 await page.goto('http://127.0.0.1:4173/feature-motion-fixture');
 await page.evaluate(async()=>{
  window.polls=new Map();let timer=0;
  window.setInterval=(action,delay)=>{const id=++timer;polls.set(id,{action,delay});return id;};window.clearInterval=id=>polls.delete(id);
  window.poll=async delay=>{for(const entry of [...polls.values()])if(entry.delay===delay)await entry.action();};
  window.animations=[];const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){animations.push({className:this.className,id:this.dataset.noteId||this.dataset.messageId||'',frames});return animate.call(this,frames,options);};
  const {cloud}=await import('/src/cloud.js');window.cloud=cloud;window.realDownload=cloud.downloadChatAttachment;window.realUpload=cloud.uploadChatAttachment;
  const {renderBoard}=await import('/src/board.js'),{renderHonors}=await import('/src/honors.js'),{renderCollections}=await import('/src/classroom.js'),{renderChat}=await import('/src/chat.js');
  window.renderers={board:renderBoard,honors:renderHonors,collections:renderCollections,chat:renderChat};
  window.errors=[];window.fixture={notes:[{id:'mine',author_id:'me',author_name:'我',content:'自己的便利貼',created_at:'2026-11-28',position_x:.05,position_y:.04,replies:[]},{id:'peer',author_id:'peer',author_name:'同學',content:'同學便利貼',created_at:'2026-11-28',position_x:.35,position_y:.1,replies:[{id:'reply',author_name:'老師',content:'繼續加油',created_at:'2026-11-28'}]}],honors:{title:'段考',top_count:3,published:true,winners:[1,2,3].map(rank=>({rank,student_id:'s'+rank,display_name:'學生'+rank,nickname:'暱稱'+rank})),candidates:[]},entries:[{student_id:'me',display_name:'我',status:'missing'},{student_id:'peer',display_name:'同學',status:'submitted'},{student_id:'excluded',display_name:'排除同學',status:'excluded'}],messages:[{id:'old',author_id:'me',author_name:'我',content:'舊訊息',created_at:'2026-11-28',read_by:[],attachments:[{id:'file',name:'檔案.txt',size:4}]}],peerStatus:'online',failDelete:false,failCollection:false,holdSend:false};
  cloud.school=async(path,method='GET',value)=>{
   if(path==='board'){if(method==='POST'){const note={id:'new',author_id:'me',author_name:'我',created_at:'2026-11-28',replies:[],...value};fixture.notes.unshift(note);return structuredClone(note);}return structuredClone(fixture.notes);}
   if(path.startsWith('board/')&&method==='DELETE'){if(fixture.failDelete)throw Error('刪除失敗');fixture.notes=fixture.notes.filter(note=>note.id!==path.split('/')[1]);return {ok:true};}
   if(path.endsWith('/replies')){const reply={id:'new-reply',author_name:'我',created_at:'2026-11-28',...value};fixture.notes.find(note=>note.id===path.split('/')[1]).replies.push(reply);return structuredClone(reply);}
   if(path.startsWith('board/')&&method==='PATCH'){const note=fixture.notes.find(note=>note.id===path.split('/')[1]);Object.assign(note,value);return structuredClone(note);}
   if(path==='honors'){if(method==='PATCH')fixture.honors.published=value.published;return structuredClone(fixture.honors);}
   if(path==='collections')return [{id:'collection',title:'同意書',due_on:'2026-12-01',my_status:fixture.entries[0].status,submitted:fixture.entries.filter(row=>row.status==='submitted').length,missing:fixture.entries.filter(row=>row.status==='missing').length,excluded:fixture.entries.filter(row=>row.status==='excluded').length}];
   if(path==='collections/collection'){if(method==='PATCH'){if(fixture.failCollection)throw Error('更新失敗');fixture.entries.forEach(row=>{if(value.students.includes(row.student_id))row.status=value.status;});return {ok:true};}return structuredClone(fixture.entries);}
   if(path==='people')return [];if(path==='chat-settings')return {enabled:true};if(path==='presence')return {preference:'online'};
   if(path==='rooms')return (fixture.roomOrder||['room']).map(id=>({id,kind:'direct',members:[{id:'me',name:'我',status:'online'},{id:'peer',name:id==='room'?'同學':'另一位同學',status:fixture.peerStatus}],unread_count:0}));
   if(path==='rooms/room/messages'){if(method==='POST'){if(fixture.holdSend)await new Promise(resolve=>window.releaseSend=resolve);const message={id:value.uploads_pending?'file-sent':'sent',author_id:'me',author_name:'我',created_at:'2026-11-28',read_by:[],...value};fixture.messages.push(message);return structuredClone(message);}return structuredClone(fixture.messages);}
   if(path.startsWith('chat-read/')||path.startsWith('chat-sent/'))return {ok:true};throw Error('Unexpected fixture path: '+method+' '+path);
  };
  cloud.presence=async()=>({ok:true});
  window.mount=async(view,role='student')=>{window.cleanup?.();polls.clear();const node=document.querySelector('#fixture');node.innerHTML='';node.className=view==='board'?'board-scene-shell':'';animations.length=0;window.ctx={node,user:{id:'me',role,permissions:{board_reply:true,collections:role==='teacher',honors:role==='teacher'}},notify:()=>{},navigate:()=>{},safe:action=>(...args)=>Promise.resolve(action(...args)).catch(error=>errors.push(error.message))};node.onclick=event=>{const close=event.target.closest('[data-close]');if(close)close.closest('dialog').close();};window.cleanup=await renderers[view](ctx);};
 });
 await page.evaluate(()=>mount('board'));
 verify(await page.locator('[data-note-id]').count()===2,'Board displays fixture notes');
 verify(await page.locator('[data-note-id="peer"] [data-note-move]').count()===0,'Foreign note has no drag permission');
 await page.locator('[data-note-id="mine"]').evaluate(node=>node.dataset.retained='yes');
 await page.evaluate(async()=>{animations.length=0;await poll(15000);});
 verify(await page.locator('[data-note-id="mine"]').getAttribute('data-retained')==='yes','Polling retains note DOM');
 verify(await page.evaluate(()=>!animations.some(row=>String(row.className).includes('sticky-note'))),'Polling does not replay old note entrance');
 const handle=page.locator('[data-note-id="mine"] [data-note-move]');await handle.press('ArrowRight');
 verify(await page.evaluate(()=>fixture.notes.find(note=>note.id==='mine').position_x>.05),'Keyboard movement persists');
 const box=await handle.boundingBox();await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+80,box.y+50,{steps:4});
 verify(await page.locator('[data-note-id="mine"]').evaluate(node=>node.classList.contains('is-dragging')&&getComputedStyle(node).transform!=='none'),'Drag lifts and tilts own note');await page.mouse.up();
 await page.locator('[data-open-note="peer"]').click();
 verify(await page.evaluate(()=>animations.some(row=>row.className==='board-replies')),'Replies expand on open');
 await page.locator('#board-reply-form textarea').fill('新的回覆');await page.locator('#board-reply-form [type="submit"]').click();await page.getByText('新的回覆',{exact:true}).waitFor();
 verify(await page.locator('.board-replies article').count()===2,'Confirmed reply appears without closing dialog');await page.locator('[data-close]').click();
 await page.locator('#board-add').click();await page.locator('#board-compose textarea').fill('貼上動畫');await page.locator('#board-compose [type="submit"]').click();await page.locator('[data-note-id="new"]').waitFor();
 verify(await page.evaluate(()=>animations.some(row=>row.id==='new')),'New confirmed note animates');
 await page.locator('[data-open-note="new"]').click();await page.evaluate(()=>fixture.failDelete=true);await page.locator('[data-delete-note]').click();
 await page.waitForFunction(()=>errors.includes('刪除失敗'));
 verify(await page.locator('[data-note-id="new"]').count()===1,'Failed deletion retains note');
 await page.evaluate(()=>fixture.failDelete=false);await page.locator('[data-delete-note]').click();await page.locator('[data-note-id="new"]').waitFor({state:'detached'});
 verify(await page.evaluate(()=>!fixture.notes.some(note=>note.id==='new')),'Confirmed deletion shrinks then removes note');
 await page.evaluate(()=>mount('honors'));
 verify(await page.evaluate(()=>animations.filter(row=>row.className==='podium-step').length===3),'Podium steps rise');
 await page.evaluate(async()=>{animations.length=0;await poll(15000);});
 verify(await page.evaluate(()=>animations.length===0),'Identical honors poll does not replay');
 await page.evaluate(async()=>{fixture.honors.published=false;await poll(15000);});await page.locator('.honors-empty').waitFor();
 verify(await page.locator('.podium-entry').count()===0,'Unpublished rankings disappear');
 await page.evaluate(async()=>{fixture.honors.published=true;await poll(15000);});await page.locator('.honors-podium').waitFor();
 verify(await page.locator('.podium-entry').count()===3,'Unpublished view detects later publication');
 await page.evaluate(()=>cleanup());verify(await page.evaluate(()=>polls.size===0),'Original honors cleanup stops replacement polling timer');
 await page.evaluate(()=>mount('collections','teacher'));
 verify(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow')==='50','Completion excludes excluded students');
 await page.locator('[data-collection]').click();await page.locator('[name="students"][value="me"]').check();await page.locator('[name="status"]').selectOption('submitted');await page.evaluate(()=>fixture.failCollection=true);await page.locator('#collection-manage [type="submit"]').click();await page.waitForFunction(()=>errors.includes('更新失敗'));
 verify(await page.locator('[data-student-status="me"] [data-status]').getAttribute('data-status')==='missing','Failed collection update retains real status');
 await page.evaluate(()=>fixture.failCollection=false);await page.locator('#collection-manage [type="submit"]').click();await page.waitForFunction(()=>document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='100');
 verify(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow')==='100','Confirmed collection update changes completion');
 await page.evaluate(()=>mount('chat'));await page.locator('#room-list [data-room]').click();await page.locator('[data-message-id="old"]').waitFor();
 await page.locator('[data-message-id="old"]').evaluate(node=>node.dataset.retained='yes');
 await page.evaluate(async()=>{animations.length=0;fixture.messages[0].read_by=[{name:'同學'}];fixture.peerStatus='away';fixture.messages.push({id:'incoming',author_id:'peer',author_name:'同學',content:'新訊息',created_at:'2026-11-28'});await poll(5000);});
 verify(await page.locator('[data-message-id="old"]').getAttribute('data-retained')==='yes','Read receipt update retains bubble DOM');
 await page.waitForFunction(()=>document.querySelector('.chat-read-receipt').textContent==='已讀：同學');
 verify(await page.locator('.chat-read-receipt').textContent()==='已讀：同學','Real read receipt updates');
 verify(await page.evaluate(()=>animations.filter(row=>row.className==='chat-bubble').length===1&&animations.some(row=>row.id==='incoming'&&row.frames[0].transform.includes('-18px'))),'Only incoming message slides from other side');
 verify(await page.locator('#room-list .chat-presence-dot').getAttribute('data-presence')==='away','Presence dot reflects actual server state');
 await page.evaluate(async()=>{animations.length=0;await poll(5000);});
 verify(await page.evaluate(()=>!animations.some(row=>String(row.className).includes('chat-bubble'))),'Unchanged chat poll does not replay');
 await page.locator('#room-list [data-room="room"]').evaluate(control=>control.dataset.retained='yes');
 await page.evaluate(async()=>{fixture.roomOrder=['room-new','room'];await poll(5000);});
 verify((await page.locator('#room-list [data-room]').evaluateAll(controls=>controls.map(control=>control.dataset.room))).join(',')==='room-new,room','New room follows newest-first API order');
 await page.evaluate(async()=>{fixture.roomOrder=['room','room-new'];await poll(5000);});
 verify((await page.locator('#room-list [data-room]').evaluateAll(controls=>controls.map(control=>control.dataset.room))).join(',')==='room,room-new','Existing rooms follow changed API order');
 verify(await page.locator('#room-list [data-room="room"]').getAttribute('data-retained')==='yes','Room reorder retains original button DOM');
 await page.evaluate(async()=>{fixture.roomOrder=['room'];await poll(5000);});
 await page.evaluate(()=>fixture.holdSend=true);await page.locator('#chat-content').fill('送出訊息');await page.locator('#message-form [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.chat-send-state').textContent==='傳送中…');
 verify(await page.locator('.chat-send-state').textContent()==='傳送中…','Sending state waits for server');await page.evaluate(()=>releaseSend());await page.locator('[data-message-id="sent"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('.chat-send-state').textContent==='已送出');
 verify(await page.locator('.chat-send-state').textContent()==='已送出','Sent state follows server success');
 verify(await page.evaluate(()=>animations.some(row=>row.id==='sent'&&row.frames[0].transform.includes('18px'))),'Own message slides from own side');
 await page.evaluate(()=>{fixture.holdSend=false;cloud.uploadChatAttachment=async(message,file,onProgress)=>{onProgress(25);await new Promise(resolve=>window.releaseUpload=resolve);onProgress(100);};});
 await page.locator('#chat-files').setInputFiles({name:'upload.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});await page.locator('#message-form [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.queued-file progress')?.value===25);
 await page.waitForFunction(()=>document.querySelector('.chat-send-state').textContent==='傳送中…');
 verify(await page.locator('.chat-send-state').textContent()==='傳送中…','File upload keeps message in sending state');
 verify(await page.locator('.queued-file progress').getAttribute('value')==='25','File UI reflects actual upload callback');
 await page.evaluate(()=>releaseUpload());await page.locator('[data-message-id="file-sent"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('.chat-send-state').textContent==='已送出');
 verify(await page.locator('.chat-send-state').textContent()==='已送出','Upload success completes send state');
 await page.evaluate(()=>{cloud.downloadChatAttachment=async(id,onProgress)=>{window.downloadTick=onProgress;onProgress(null);await new Promise(resolve=>window.releaseDownload=resolve);onProgress(100);};});
 await page.locator('[data-chat-file="file"]').click();
 verify(await page.locator('.chat-file-progress').evaluate(progress=>!progress.hidden&&!progress.hasAttribute('value')),'Download UI starts indeterminate');
 await page.evaluate(()=>downloadTick(50));verify(await page.locator('.chat-file-progress').getAttribute('value')==='50','Download UI follows real byte callback');
 await page.evaluate(()=>releaseDownload());await page.waitForFunction(()=>document.querySelector('.chat-file-progress').hidden);
 verify(await page.locator('[data-chat-file="file"]').isEnabled(),'Download completion restores control');
 const downloadChecks=await page.evaluate(async()=>{
  const fetch=window.fetch,click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
  try{
   const result=[];for(const mode of ['length','unknown','json','error']){
    const progress=[];window.fetch=async()=>mode==='error'?new Response('{"message":"download failed"}',{status:500,headers:{'Content-Type':'application/json'}}):mode==='json'?new Response(JSON.stringify({name:'legacy.txt',data:btoa('data')}),{headers:{'Content-Type':'application/json'}}):new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2]));controller.enqueue(new Uint8Array([3,4]));controller.close();}}),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''file.txt",...(mode==='length'?{'Content-Length':'4'}:{})}});
    let failed=false;try{await realDownload.call(cloud,'file',value=>progress.push(value));}catch{failed=true;}result.push({mode,progress,failed});
   }return result;
  }finally{window.fetch=fetch;HTMLAnchorElement.prototype.click=click;}
 });
 verify(downloadChecks[0].progress.includes(50)&&downloadChecks[0].progress.at(-1)===100,'Known-length download reports actual transferred bytes');
 verify(downloadChecks[1].progress.join(',')===[null,100].join(','),'Unknown-length download stays indeterminate until completion');
 verify(downloadChecks[2].progress.at(-1)===100,'Legacy JSON download reports completion');
 verify(downloadChecks[3].failed&&!downloadChecks[3].progress.includes(100),'Failed download never reports completion');
 const uploadChecks=await page.evaluate(async()=>{
  const fetch=window.fetch,progress=[],sizes=[];let created=false;
  try{window.fetch=async(url,options)=>{if(options.method==='POST'){created=true;return new Response('{"id":"upload"}',{headers:{'Content-Type':'application/json'}});}sizes.push(options.body.size);return new Response('{}',{headers:{'Content-Type':'application/json'}});};await realUpload.call(cloud,'message',new File([new Uint8Array(4*1024*1024+4)],'large.bin'),value=>progress.push(value));return {created,progress,sizes};}finally{window.fetch=fetch;}
 });
 verify(uploadChecks.created&&uploadChecks.sizes.join(',')==='4194304,4','Upload uses confirmed 4 MB chunks');
 verify(uploadChecks.progress[0]===99&&uploadChecks.progress.at(-1)===100,'Upload never rounds incomplete last chunk to 100');
 await page.evaluate(async()=>{
  await Promise.all(['styles.css','themes.css','school.css','redesign.css','theme-expansion.css','responsive.css','login-layout.css','v025.css','resend-system.css','offline.css','board-honors.css','uiverse-system.css','feedback.css'].map(file=>new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/src/'+file;link.onload=resolve;document.head.append(link);})));
 });
 await page.evaluate(()=>mount('collections'));
 for(const theme of ['dark','light','ocean','forest','rose','amber','midnight','slate','notebook','lavender','brick','teal','mono']){
  await page.evaluate(async theme=>{const {applyTheme}=await import('/src/personalization.js');applyTheme(theme);},theme);
  verify(await page.locator('.collection-status-icon').evaluate(icon=>{const style=getComputedStyle(icon);return style.color!==style.backgroundColor;}),`Collection status contrast preserved in ${theme}`);
 }
 await page.evaluate(()=>mount('honors'));
 const stopped=await page.evaluate(()=>{cleanup();return polls.size;});verify(stopped===0,'Honors cleanup stops latest timer after publication changes');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>mount('board'));
 verify(await page.evaluate(()=>animations.length===0),'Reduced motion disables feature WAAPI');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});verify(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1),`Board bounds at ${width}px`);}
 await page.setViewportSize({width:320,height:900});
 await page.evaluate(async()=>{fixture.honors.top_count=5;fixture.honors.winners=[1,2,3,4,5].map(rank=>({rank,student_id:'s'+rank,display_name:'學生'+rank,nickname:'很長的暱稱'}));await mount('honors');});
 verify(await page.locator('.podium-entry').count()===5&&await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1),'Five-place honors stay inside 320px page');
 verify(await page.locator('.podium-scroll').evaluate(scroller=>scroller.scrollWidth>scroller.clientWidth),'Five-place honors scroll internally on mobile');
 verify(await page.evaluate(()=>animations.length===0),'Reduced motion disables five-place podium animation');
 await page.screenshot({path:'.taste-skill/feature-honors-five-mobile.png'});
 await page.evaluate(()=>mount('collections','teacher'));await page.locator('[data-collection]').click();
 verify(await page.locator('#collection-manage').evaluate(dialog=>{const box=dialog.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&dialog.scrollWidth<=dialog.clientWidth+1;}),'Collection manager fits 320px');
 await page.screenshot({path:'.taste-skill/feature-collections-mobile.png'});
 verify(await page.evaluate(()=>animations.length===0),'Reduced motion disables collection progress animation');await page.locator('#collection-manage [data-close]').click();
 await page.evaluate(async()=>{fixture.messages[0].attachments[0].name='very-long-file-name-'.repeat(15)+'.txt';await mount('chat');});
 // Select before mobile sidebar is collapsed; direct click follows the same handler.
 await page.locator('#room-list [data-room="room"]').evaluate(control=>control.click());await page.locator('[data-message-id="old"]').waitFor();
 verify(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1),'Chat with long filename fits 320px');
 verify(await page.locator('[data-chat-file="file"]').evaluate(file=>{const box=file.getBoundingClientRect(),bubble=file.closest('.chat-bubble').getBoundingClientRect();return box.left>=bubble.left&&box.right<=bubble.right+1&&file.scrollWidth<=file.clientWidth+1;}),'Long attachment filename stays inside bubble');
 verify(await page.locator('.chat-file-progress').evaluate(progress=>getComputedStyle(progress).display==='none'),'Idle download progress stays visually hidden');
 await page.locator('[data-chat-file="file"]').click();await page.evaluate(()=>downloadTick(50));
 verify(await page.locator('.chat-file-progress').evaluate(progress=>{const box=progress.getBoundingClientRect(),file=progress.closest('.chat-file').getBoundingClientRect();return progress.value===50&&box.width>file.width*.8&&box.right<=file.right+1;}),'Download progress spans attachment width at 320px');
 await page.screenshot({path:'.taste-skill/feature-chat-progress-mobile.png'});
 await page.evaluate(()=>releaseDownload());await page.waitForFunction(()=>document.querySelector('.chat-file-progress').hidden);
 verify(await page.evaluate(()=>animations.length===0),'Reduced motion disables chat transitions');
 await page.evaluate(()=>cleanup?.());
 return JSON.stringify({passed:checks,scope:'board, honors, collection, chat; confirmed/failed updates; real download progress; reduced motion; 320–1440px'});
}
