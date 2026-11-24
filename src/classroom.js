import {cloud} from './cloud.js';
import {lineIcon} from './interface-icons.js';

const api=(path,method='GET',body)=>cloud.school(path,method,body);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const can=(user,key)=>user.role==='admin'||user.permissions?.[key]===true;
const stamp=value=>new Date(value).toLocaleString('zh-TW');
const date=value=>String(value||'').slice(0,10);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const button=(label,attrs='')=>`<button type="button" class="secondary-button" ${attrs}>${label}</button>`;
const heading=(title,description,icon)=>`<div class="school-heading"><div class="title-copy"><div class="title-lockup"><span class="page-title-icon">${lineIcon(icon,22)}</span><h1>${title}</h1></div><p class="muted">${description}</p></div></div>`;
const submit=(form,ctx,action)=>{form.onsubmit=ctx.safe(async event=>{event.preventDefault();const control=form.querySelector('[type="submit"]');if(control.disabled)return;control.disabled=true;try{await action(new FormData(form));}finally{control.disabled=false;}});};

export function renderHonors({node}){
 node.innerHTML=heading('段考英雄榜','班級段考表現與學習成果。','points')+'<section class="editor-card"><span class="school-tag">尚未完成 · 暫不開放</span><h2>功能準備中</h2><p class="muted">目前不提供排名，也不會公開任何學生成績。</p></section>';
}

export async function renderBoard(ctx){
 const {node,user,notify}=ctx,reply=can(user,'board_reply');
 const rows=await api('board');if(!node.isConnected)return;
 node.innerHTML=heading('班級留言板','這裡是全班可見的公開心情留言板。請尊重同學，避免留下密碼、聯絡資訊或其他私密資料。','chat')+
  (user.role==='student'?'<form id="board-compose" class="editor-card"><label>今天想分享什麼？<textarea name="content" rows="4" maxlength="2000" required placeholder="寫下你的心情或想與班級分享的事…"></textarea></label><button type="submit" class="primary-button">公開留言</button></form>':'<p class="muted">學生可留言；你可以選擇回覆，或保留留言不作處理。</p>')+
  `<div class="school-actions">${button('重新整理','data-board-refresh')}</div><div id="board-posts" class="school-stack"></div>${button('載入更早留言','data-board-more hidden')}`;
 const target=node.querySelector('#board-posts'),more=node.querySelector('[data-board-more]');let last='';
 const draw=posts=>{
  target.insertAdjacentHTML('beforeend',posts.map(post=>`<article class="editor-card board-post"><header><strong>${esc(post.author_name)}</strong><time>${esc(stamp(post.created_at))}</time></header><p class="classroom-text">${esc(post.content)}</p><section class="board-replies" aria-label="留言回覆">${post.replies.map(row=>`<article><header><strong>${esc(row.author_name)}</strong><time>${esc(stamp(row.created_at))}</time></header><p class="classroom-text">${esc(row.content)}</p></article>`).join('')||'<p class="muted">尚無回覆</p>'}</section>${reply?`<form data-board-reply="${post.id}"><label>回覆 ${esc(post.author_name)}<textarea name="content" rows="2" maxlength="2000" required></textarea></label><button type="submit" class="secondary-button">公開回覆</button></form>`:''}${post.author_id===user.id||['admin','teacher'].includes(user.role)?button('刪除留言',`data-board-delete="${post.id}"`):''}</article>`).join(''));
  if(!target.children.length)target.innerHTML='<p class="school-empty">還沒有留言，歡迎分享今天的心情。</p>';
  last=posts.at(-1)?.id||last;more.hidden=posts.length<50;
  target.querySelectorAll('[data-board-reply]').forEach(form=>submit(form,ctx,async data=>{await api('board/'+form.dataset.boardReply+'/replies','POST',{content:data.get('content')});notify('回覆已公開');await renderBoard(ctx);}));
  target.querySelectorAll('[data-board-delete]').forEach(control=>control.onclick=ctx.safe(async()=>{if(control.dataset.confirm!=='yes'){control.dataset.confirm='yes';control.textContent='再次點擊確認刪除';return;}await api('board/'+control.dataset.boardDelete,'DELETE');notify('留言已刪除');await renderBoard(ctx);}));
 };
 draw(rows);
 const form=node.querySelector('#board-compose');if(form)submit(form,ctx,async data=>{await api('board','POST',{content:data.get('content')});notify('留言已公開');await renderBoard(ctx);});
 node.querySelector('[data-board-refresh]').onclick=ctx.safe(()=>renderBoard(ctx));
 more.onclick=ctx.safe(async()=>{more.disabled=true;try{draw(await api('board?before='+encodeURIComponent(last)));}finally{more.disabled=false;}});
}

const statuses={missing:'未繳交',submitted:'已繳交',excluded:'排除'};
export async function renderCollections(ctx){
 const {node,user,notify}=ctx,manage=can(user,'collections'),items=await api('collections');if(!node.isConnected)return;
 node.innerHTML=heading('資料繳收狀況',manage?'建立項目、追蹤全班繳交狀態，並提醒尚未繳交的學生。':'查看班級繳收項目與自己的繳交狀態。','records')+
  (manage?`<div class="school-actions">${button('新增繳收項目','data-create-collection')}</div>`:'')+
  `<div class="school-stack">${items.map(item=>`<article class="editor-card"><div class="school-actions"><h2>${esc(item.title)}</h2><span class="school-tag">截止 ${esc(date(item.due_on))}${date(item.due_on)<today()?' · 已截止':''}</span></div>${item.description?`<p class="classroom-text">${esc(item.description)}</p>`:''}${manage?`<p>已繳 ${item.submitted} · 未繳 ${item.missing} · 排除 ${item.excluded}</p>${button('管理繳收狀態',`data-collection="${item.id}"`)}`:`<p>我的狀態：<strong>${esc(statuses[item.my_status]||'不在本次繳收名單')}</strong></p>`}</article>`).join('')||'<p class="school-empty">目前沒有繳收項目。</p>'}</div>`;
 const show=(id,title,content)=>{node.querySelector('#'+id)?.remove();node.insertAdjacentHTML('beforeend',`<dialog id="${id}" class="form-dialog school-dialog" aria-labelledby="${id}-title"><header><h2 id="${id}-title">${esc(title)}</h2>${button('關閉','data-close')}</header>${content}</dialog>`);const dialog=node.querySelector('#'+id);dialog.showModal();return dialog;};
 node.querySelector('[data-create-collection]')?.addEventListener('click',()=>{
  const dialog=show('collection-create','新增繳收項目',`<form><label>項目名稱<input name="title" maxlength="150" required></label><label>繳交截止日期<input type="date" name="due_on" value="${today()}" required></label><label>說明（選填）<textarea name="description" rows="3" maxlength="3000"></textarea></label><p class="muted">建立時會納入目前所有啟用中的學生。</p><button type="submit" class="primary-button">建立項目</button></form>`);
  submit(dialog.querySelector('form'),ctx,async data=>{await api('collections','POST',Object.fromEntries(data));dialog.close();notify('繳收項目已建立');await renderCollections(ctx);});
 });
 node.querySelectorAll('[data-collection]').forEach(control=>control.onclick=ctx.safe(async()=>{
  const item=items.find(row=>row.id===control.dataset.collection),rows=await api('collections/'+item.id);
  const dialog=show('collection-manage',item.title,`<div class="collection-manager"><p class="muted">截止日期：${esc(date(item.due_on))}。只有未繳交者會收到提醒；排除者不會收到。</p><form><fieldset class="student-picker"><legend>選擇學生</legend><div class="selection-tools">${button('全班','data-pick="all"')}${button('清除','data-pick="none"')}<strong data-picked-count>已選 0 人</strong></div>${rows.map(row=>`<label><input type="checkbox" name="students" value="${row.student_id}"><span>${esc(row.display_name)} <small>目前：${statuses[row.status]}</small></span></label>`).join('')||'<p>沒有學生。</p>'}</fieldset><label>批次標記為<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><button type="submit" class="primary-button">更新所選學生</button></form><div class="school-actions">${button('提醒所有未繳學生','data-remind-collection')}</div><p role="status" data-reminder-result></p></div>`);
  submit(dialog.querySelector('form'),ctx,async data=>{const selected=data.getAll('students');if(!selected.length)throw Error('請選擇學生');await api('collections/'+item.id,'PATCH',{students:selected,status:data.get('status')});dialog.close();notify('繳交狀態已更新');await renderCollections(ctx);});
  const reminder=dialog.querySelector('[data-remind-collection]'),result=dialog.querySelector('[data-reminder-result]');
  reminder.onclick=async()=>{reminder.disabled=true;result.textContent='正在建立提醒…';try{const r=await api('collections/'+item.id+'/remind','POST',{});result.textContent=`未繳 ${r.total} 人：已排入郵件佇列 ${r.queued} 人、無驗證信箱 ${r.no_email} 人、關閉提醒 ${r.disabled} 人、10 分鐘內已提醒 ${r.cooldown} 人。實際寄達時間視郵件服務額度及佇列而定。`;}catch(e){result.textContent=e.message;}finally{reminder.disabled=false;}};
 }));
}
