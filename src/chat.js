import {openDialog,closeDialog} from './dialog-motion.js';
import { cloud } from './cloud.js';
import {featureMotion,featureText} from './feature-motion.js';

const api=(path,method='GET',value)=>cloud.school(path,method,value);
const esc=(value='')=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const stamp=value=>new Date(value).toLocaleString('zh-TW');
const bytes=value=>{const size=Number(value)||0;if(size<1024)return `${size} B`;if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;return `${(size/1024/1024).toFixed(1)} MB`;};
const button=(label,attrs='')=>`<button type="button" class="secondary-button" ${attrs}>${label}</button>`;
const empty=label=>`<p class="school-empty">${label}</p>`;
const heading=(title,description,action='')=>`<div class="school-heading"><div><h1>${title}</h1><p class="muted">${description}</p></div>${action}</div>`;

export async function renderChat(ctx){
 const {node,user,safe,notify}=ctx;
 if(user.role!=='student')throw Error('學生可使用同學聊天；管理員請到聊天管理處理檢舉');
 const [people,settings,presence]=await Promise.all([api('people'),api('chat-settings'),api('presence')]);
 if(!node.isConnected)return;
 let rooms=await api('rooms'),selected='',messages=[],signature='',sending=false,lastAcknowledged='';
 const seenByRoom=new Map();let downloading=0;
 const statusLabel=value=>({online:'在線',away:'暫離',offline:'離線'}[value]||'離線');
 const roomName=room=>room.kind==='direct'?(room.members.filter(member=>member.id!==user.id).map(member=>member.name+(member.nickname?`（${member.nickname}）`:'')).join('、')||'私訊'):room.title;
 node.innerHTML=heading('同學聊天','私訊、群組交談及檔案分享。附件供交談成員及獲授權的聊天管理人員下載，並會在上傳三天後自動刪除。',settings.enabled?button('＋ 開始交談','id="new-room"'):'')+(!settings.enabled?'<p class="status-card status-warning" role="status">聊天目前已由管理員停用，可閱讀既有訊息。</p>':'')+`<div class="chat-presence school-actions"><label>我的狀態<select id="chat-presence"><option value="online">在線（閒置時自動暫離）</option><option value="away">暫離</option><option value="offline">顯示離線</option></select></label><p class="muted">關閉頁面或斷線約 2 分鐘後會自動顯示離線；狀態不代表訊息已讀。</p></div><div class="chat-layout"><aside id="room-list" class="room-list" aria-label="交談列表"></aside><section class="chat-main"><header id="room-heading"><strong>請選擇交談</strong></header><div id="chat-messages" class="chat-messages" aria-live="polite"></div><form id="message-form" class="message-form" hidden><div class="message-composer"><label for="chat-content">訊息</label><textarea id="chat-content" name="content" rows="2" maxlength="5000" placeholder="輸入訊息，Enter 傳送、Shift + Enter 換行"></textarea><div id="chat-file-list" class="chat-file-list" aria-live="polite"></div><div class="composer-actions"><label class="secondary-button file-picker" for="chat-files">＋ 加入檔案<input id="chat-files" type="file" multiple></label><small>任意格式，單一檔案最多 400 MB；三天後自動刪除</small></div></div><button type="submit" class="primary-button">傳送</button></form></section></div>`;
 const list=node.querySelector('#chat-messages'),fileInput=node.querySelector('#chat-files'),fileList=node.querySelector('#chat-file-list'),form=node.querySelector('#message-form');
 node.querySelector('.chat-layout').dataset.featureMotion='chat';
 form.querySelector('.message-composer').insertAdjacentHTML('beforeend','<span class="chat-send-state" role="status" aria-live="polite"></span>');const sendState=form.querySelector('.chat-send-state');
 const drawPresence=(target,members)=>{
  const keys=members.map(member=>member.id).join(',');
  if(target.dataset.members!==keys){target.innerHTML=members.map(member=>`<span data-presence-person="${esc(member.id)}"><span class="chat-presence-dot" aria-hidden="true"></span><span data-presence-label></span></span>`).join('、');target.dataset.members=keys;}
  members.forEach(member=>{const person=[...target.querySelectorAll('[data-presence-person]')].find(span=>span.dataset.presencePerson===member.id);person.querySelector('.chat-presence-dot').dataset.presence=member.status||'offline';featureText(person.querySelector('[data-presence-label]'),member.name+' · '+statusLabel(member.status));});
 };
 const drawRooms=()=>{
  const target=node.querySelector('#room-list'),existing=new Map([...target.querySelectorAll('[data-room]')].map(room=>[room.dataset.room,room]));
  target.querySelector('.school-empty')?.remove();existing.forEach((room,id)=>{if(!rooms.some(item=>item.id===id))room.remove();});
  rooms.forEach((room,index)=>{let control=existing.get(room.id);if(!control){control=document.createElement('button');control.className='room-button';control.dataset.room=room.id;control.innerHTML='<strong></strong><small></small><span class="school-tag" hidden></span>';target.append(control);control.onclick=safe(async()=>{if(selected===room.id)return;selected=room.id;signature='';lastAcknowledged='';list.innerHTML='';drawRooms();await loadMessages();});}control.classList.toggle('selected',selected===room.id);featureText(control.querySelector('strong'),roomName(room));const small=control.querySelector('small');if(room.kind==='direct')drawPresence(small,room.members.filter(member=>member.id!==user.id));else featureText(small,`${room.members.length} 位成員`);const unread=control.querySelector('.school-tag');const anchor=target.children[index];if(anchor!==control)target.insertBefore(control,anchor||null);unread.hidden=!room.unread_count;featureText(unread,room.unread_count?`${room.unread_count} 則未讀`:'');});
  if(!rooms.length)target.innerHTML=empty('尚無交談，請建立私訊或群組。');
 };
 const drawFiles=()=>{fileList.innerHTML=[...fileInput.files].map((file,index)=>`<div class="queued-file" data-file-index="${index}"><span><strong>${esc(file.name)}</strong><small>${esc(bytes(file.size))}</small></span><progress max="100" value="0" aria-label="${esc(file.name)} 上傳進度"></progress></div>`).join('');};
 const openReport=id=>{const old=node.querySelector('#chat-report-dialog');if(old)old.remove();node.insertAdjacentHTML('beforeend',`<dialog id="chat-report-dialog" class="form-dialog school-dialog"><header><h2>檢舉訊息</h2><button type="button" class="secondary-button" data-close>關閉</button></header><form><label>檢舉原因<textarea name="reason" required maxlength="1000" rows="3"></textarea></label><p class="muted">教師與管理員會收到被檢舉的訊息及原因。</p><button type="submit" class="primary-button">送出檢舉</button></form></dialog>`);const dialog=node.querySelector('#chat-report-dialog');dialog.querySelector('[data-close]').onclick=()=>closeDialog(dialog);dialog.querySelector('form').onsubmit=safe(async event=>{event.preventDefault();const reason=new FormData(event.currentTarget).get('reason');await api(`messages/${id}/report`,'POST',{reason,type:'message'});await closeDialog(dialog);notify('檢舉已送出，處理結果將依通知設定寄送至已驗證信箱');});openDialog(dialog);};
 const bindMessageActions=()=>{node.querySelectorAll('[data-chat-file]').forEach(item=>item.onclick=safe(async()=>{item.disabled=true;item.setAttribute('aria-busy','true');downloading++;const progress=item.querySelector('progress');progress.hidden=false;progress.removeAttribute('value');try{await cloud.downloadChatAttachment(item.dataset.chatFile,value=>{if(value===null)progress.removeAttribute('value');else progress.value=value;});featureText(item.querySelector('.chat-file-icon'),'\u2713');}finally{downloading--;item.disabled=false;item.removeAttribute('aria-busy');progress.hidden=true;}}));node.querySelectorAll('[data-report]').forEach(item=>item.onclick=()=>openReport(item.dataset.report));node.querySelectorAll('[data-edit-message]').forEach(item=>item.onclick=()=>{const message=messages.find(row=>row.id===item.dataset.editMessage);if(!message)return;node.querySelector('#chat-edit-dialog')?.remove();node.insertAdjacentHTML('beforeend',`<dialog id="chat-edit-dialog" class="form-dialog school-dialog"><header><h2>編輯訊息</h2><button type="button" class="secondary-button" data-close>關閉</button></header><form><label>訊息內容<textarea name="content" required maxlength="5000">${esc(message.content)}</textarea></label><p class="muted">訊息只能在送出後 15 分鐘內編輯，並會顯示「已編輯」。</p><button class="primary-button">儲存變更</button></form></dialog>`);const dialog=node.querySelector('#chat-edit-dialog');dialog.querySelector('[data-close]').onclick=()=>closeDialog(dialog);dialog.querySelector('form').onsubmit=safe(async event=>{event.preventDefault();await api('message-safety/'+message.id,'PATCH',{content:new FormData(event.currentTarget).get('content')});await closeDialog(dialog);signature='';await loadMessages();});openDialog(dialog);});node.querySelectorAll('[data-retract]').forEach(item=>item.onclick=safe(async()=>{await api('messages/'+item.dataset.retract,'DELETE');signature='';await loadMessages();}));};
 const markRead=async()=>{
  if(!selected||!node.isConnected||document.hidden||list.scrollHeight-list.scrollTop-list.clientHeight>80)return;
  const newest=messages.at(-1),active=selected;if(!newest||lastAcknowledged===newest.id)return;
  await api('chat-read/'+active,'POST',{message_id:newest.id});if(active===selected){lastAcknowledged=newest.id;const room=rooms.find(x=>x.id===active);if(room)room.unread_count=0;drawRooms();}
 };
 list.addEventListener('scroll',()=>markRead().catch(()=>{}));
 const presenceSelect=node.querySelector('#chat-presence');presenceSelect.value=presence.preference||'online';
 presenceSelect.onchange=safe(async()=>{presenceSelect.disabled=true;try{await cloud.presence({preference:presenceSelect.value,active:true});notify('狀態已更新');}finally{presenceSelect.disabled=false;}});
 const loadMessages=async()=>{
  if(!selected||!node.isConnected)return;
  const active=selected,room=rooms.find(item=>item.id===active);if(!room)return;
  const incoming=await api(`rooms/${active}/messages`);if(!node.isConnected||active!==selected)return;
  messages=incoming;const roomHeading=node.querySelector('#room-heading');
  if(roomHeading.dataset.activeRoom!==active){roomHeading.innerHTML='<div><strong></strong><small></small></div>';roomHeading.dataset.activeRoom=active;}
  featureText(roomHeading.querySelector('strong'),roomName(room));drawPresence(roomHeading.querySelector('small'),room.members);form.hidden=!settings.enabled;
  const next=JSON.stringify(messages);if(next===signature){await markRead();return;}
  const atBottom=list.scrollHeight-list.scrollTop-list.clientHeight<100,seen=seenByRoom.get(active),known=seen||new Set(),existing=new Map([...list.querySelectorAll('[data-message-id]')].map(bubble=>[bubble.dataset.messageId,bubble]));
  list.querySelector('.school-empty')?.remove();existing.forEach((bubble,id)=>{if(!messages.some(message=>message.id===id))bubble.remove();});
  messages.forEach(message=>{
   let bubble=existing.get(message.id);const fresh=!bubble,mine=message.author_id===user.id;
   if(fresh){bubble=document.createElement('article');bubble.className='chat-bubble'+(mine?' mine':'');bubble.dataset.messageId=message.id;list.append(bubble);}
   const body=JSON.stringify({...message,read_by:undefined}),receipt=message.read_by?.length?'已讀：'+message.read_by.map(person=>person.name).join('、'):'未讀';
   if(bubble.dataset.content!==body){
    bubble.innerHTML=`<div><strong>${esc(message.author_name)}${message.nickname?'（'+esc(message.nickname)+'）':''}</strong><time>${esc(stamp(message.created_at))}${message.edited_at?' · 已編輯':''}</time></div>${message.content?`<p>${esc(message.content)}</p>`:''}${!message.deleted&&message.attachments?.length?`<div class="chat-attachments">${message.attachments.map(file=>`<button type="button" class="chat-file" data-chat-file="${esc(file.id)}" aria-label="下載 ${esc(file.name)}"><span class="chat-file-icon" aria-hidden="true">↓</span><span><strong>${esc(file.name)}</strong><small>${esc(bytes(file.size))} · ${file.expires_at?`${esc(stamp(file.expires_at))} 到期`:'三天後到期'}</small></span><progress class="chat-file-progress" max="100" hidden aria-label="${esc(file.name)} 下載進度"></progress></button>`).join('')}</div>`:''}${mine?'<small class="chat-read-receipt"></small>':''}${!message.deleted?`<div class="message-actions">${mine?`${button('編輯',`data-edit-message="${esc(message.id)}"`)}${button('收回',`data-retract="${esc(message.id)}"`)}`:button('檢舉',`data-report="${esc(message.id)}"`)}</div>`:''}`;
    bubble.dataset.content=body;
   }
   const label=bubble.querySelector('.chat-read-receipt');if(label){if(fresh)label.textContent=receipt;else featureText(label,receipt);}
   if(fresh&&seen&&!known.has(message.id))featureMotion(bubble,[{opacity:0,transform:`translateX(${mine?18:-18}px) translateY(6px)`},{opacity:1,transform:'none'}],{duration:280});
   known.add(message.id);
  });
  seenByRoom.set(active,known);if(!messages.length)list.innerHTML=empty('尚未有訊息，來打聲招呼吧。');
  signature=next;if(atBottom||messages.length<3)list.scrollTop=list.scrollHeight;bindMessageActions();await markRead();
 };
 const openRoom=()=>{node.querySelector('#chat-room-dialog')?.remove();node.insertAdjacentHTML('beforeend',`<dialog id="chat-room-dialog" class="form-dialog school-dialog"><header><h2>建立交談</h2><button type="button" class="secondary-button" data-close>關閉</button></header><form><label>交談類型<select name="kind"><option value="direct">私訊</option><option value="group">群組</option></select></label><label>群組名稱<input name="title" maxlength="80" placeholder="群組交談才需要"></label><fieldset class="student-picker"><legend>選擇同學</legend>${people.filter(person=>person.id!==user.id).map(person=>`<label><input type="checkbox" name="students" value="${person.id}">${esc(person.display_name+(person.nickname?`（${person.nickname}）`:''))}</label>`).join('')}</fieldset><button type="submit" class="primary-button">建立交談</button></form></dialog>`);const dialog=node.querySelector('#chat-room-dialog');dialog.querySelector('[data-close]').onclick=()=>closeDialog(dialog);dialog.querySelector('form').onsubmit=safe(async event=>{event.preventDefault();const data=new FormData(event.currentTarget),members=data.getAll('students');if(!members.length)throw Error('請至少選擇一位同學');const room=await api('rooms','POST',{kind:data.get('kind'),title:data.get('title'),members});selected=room.id;rooms=await api('rooms');await closeDialog(dialog);drawRooms();signature='';await loadMessages();});openDialog(dialog);};
 fileInput.onchange=()=>{const invalid=[...fileInput.files].find(file=>file.size>400*1024*1024);if(invalid){fileInput.value='';drawFiles();notify(`${invalid.name} 超過 400 MB，未加入傳送佇列`,'error');return;}drawFiles();};
 node.querySelector('#chat-content').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}};
 node.querySelector('#new-room')?.addEventListener('click',openRoom);
 form.onsubmit=safe(async event=>{
  event.preventDefault();if(!selected||sending)return;const activeRoom=selected,content=form.elements.content.value.trim(),files=[...fileInput.files];
  if(!content&&!files.length){notify('請輸入訊息或選擇檔案','error');form.elements.content.focus();return;}
  sending=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;featureText(sendState,'傳送中…');
  try{
   const message=await api(`rooms/${activeRoom}/messages`,'POST',{content:content||(files.length===1?'傳送了一個檔案':`傳送了 ${files.length} 個檔案`),uploads_pending:files.length>0});
   try{for(let index=0;index<files.length;index++){const progress=fileList.querySelector(`[data-file-index="${index}"] progress`);await cloud.uploadChatAttachment(message.id,files[index],value=>{if(progress)progress.value=value;});}}
   finally{if(files.length)await api('chat-sent/'+activeRoom,'POST',{message_id:message.id});}
   form.reset();drawFiles();signature='';await loadMessages();featureText(sendState,'已送出');notify(files.length?'訊息與檔案已送出':'訊息已送出');
  }catch(error){featureText(sendState,'傳送失敗');throw error;}
  finally{sending=false;lastAcknowledged='';submit.disabled=false;}
 });
 drawRooms();
 const timer=setInterval(async()=>{if(!node.isConnected){clearInterval(timer);return;}if(document.hidden||sending||downloading)return;try{rooms=await api('rooms');drawRooms();await loadMessages();}catch(error){notify(error.message,'error');}},5000);
 return ()=>clearInterval(timer);
}
