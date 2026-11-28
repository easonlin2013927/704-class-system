import {openDialog,closeDialog} from './dialog-motion.js';
import {cloud} from './cloud.js';
import {lineIcon} from './interface-icons.js';
import {featureMotion} from './feature-motion.js';

const api=(path,method='GET',body)=>cloud.school(path,method,body);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const can=(user,key)=>user.role==='admin'||user.permissions?.[key]===true;
const date=value=>String(value||'').slice(0,10);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const button=(label,attrs='')=>`<button type="button" class="secondary-button" ${attrs}>${label}</button>`;
const heading=(title,description,icon)=>`<div class="school-heading"><div class="title-copy"><div class="title-lockup"><span class="page-title-icon">${lineIcon(icon,22)}</span><h1>${title}</h1></div><p class="muted">${description}</p></div></div>`;
const submit=(form,ctx,action)=>{form.onsubmit=ctx.safe(async event=>{event.preventDefault();const control=form.querySelector('[type="submit"]');if(control.disabled)return;control.disabled=true;try{await action(new FormData(form));}finally{control.disabled=false;}});};

export {renderBoard} from './board.js';
export {renderHonors} from './honors.js';

const statuses={missing:'未繳交',submitted:'已繳交',excluded:'排除'};
const statusMarkup=status=>`<span class="collection-status" data-status="${esc(status)}"><span class="collection-status-icon" aria-hidden="true">${({submitted:'✓',missing:'',excluded:'−'})[status]||''}</span><span>${esc(statuses[status]||'不在本次繳收名單')}</span></span>`;
const completion=item=>{const total=Number(item.submitted)+Number(item.missing);return total?Math.round(Number(item.submitted)/total*100):0;};
const progressMarkup=item=>`<div class="collection-progress-label"><span>完成率 <strong data-completion-label>${completion(item)}%</strong></span><span>排除 ${Number(item.excluded)||0} 人不計入</span></div><div class="collection-progress" role="progressbar" aria-label="${esc(item.title)}完成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completion(item)}"><span style="transform:scaleX(${completion(item)/100})"></span></div>`;
export async function renderCollections(ctx){
 const {node,user,notify}=ctx,manage=can(user,'collections'),items=await api('collections');if(!node.isConnected)return;
 node.innerHTML=heading('資料繳收狀況',manage?'建立項目、追蹤全班繳交狀態，並提醒尚未繳交的學生。':'查看班級繳收項目與自己的繳交狀態。','records')+
  (manage?`<div class="school-actions">${button('新增繳收項目','data-create-collection')}</div>`:'')+
  `<div class="school-stack" data-feature-motion="collections">${items.map(item=>`<article class="editor-card" data-collection-card="${esc(item.id)}"><div class="school-actions"><h2>${esc(item.title)}</h2><span class="school-tag">截止 ${esc(date(item.due_on))}${date(item.due_on)<today()?' · 已截止':''}</span></div>${item.description?`<p class="classroom-text">${esc(item.description)}</p>`:''}<div data-collection-progress>${progressMarkup(item)}</div>${manage?`<p data-collection-counts>已繳 ${item.submitted} · 未繳 ${item.missing} · 排除 ${item.excluded}</p>${button('管理繳收狀態',`data-collection="${item.id}"`)}`:`<p class="collection-student-status">我的狀態：${statusMarkup(item.my_status)}</p>`}</article>`).join('')||'<p class="school-empty">目前沒有繳收項目。</p>'}</div>`;
 node.querySelectorAll('.collection-progress>span').forEach(bar=>featureMotion(bar,[{transform:'scaleX(0)'},{transform:bar.style.transform}],{duration:420}));
 const show=(id,title,content)=>{node.querySelector('#'+id)?.remove();node.insertAdjacentHTML('beforeend',`<dialog id="${id}" class="form-dialog school-dialog" aria-labelledby="${id}-title"><header><h2 id="${id}-title">${esc(title)}</h2>${button('關閉','data-close')}</header>${content}</dialog>`);const dialog=node.querySelector('#'+id);openDialog(dialog);return dialog;};
 node.querySelector('[data-create-collection]')?.addEventListener('click',()=>{
  const dialog=show('collection-create','新增繳收項目',`<form><label>項目名稱<input name="title" maxlength="150" required></label><label>繳交截止日期<input type="date" name="due_on" value="${today()}" required></label><label>說明（選填）<textarea name="description" rows="3" maxlength="3000"></textarea></label><p class="muted">建立時會納入目前所有啟用中的學生。</p><button type="submit" class="primary-button">建立項目</button></form>`);
  submit(dialog.querySelector('form'),ctx,async data=>{await api('collections','POST',Object.fromEntries(data));await closeDialog(dialog);notify('繳收項目已建立');await renderCollections(ctx);});
 });
 node.querySelectorAll('[data-collection]').forEach(control=>control.onclick=ctx.safe(async()=>{
  const item=items.find(row=>row.id===control.dataset.collection),rows=await api('collections/'+item.id);
  const dialog=show('collection-manage',item.title,`<div class="collection-manager" data-feature-motion="collection-status"><p class="muted">截止日期：${esc(date(item.due_on))}。只有未繳交者會收到提醒；排除者不會收到。</p><form><fieldset class="student-picker"><legend>選擇學生</legend><div class="selection-tools">${button('全班','data-pick="all"')}${button('清除','data-pick="none"')}<strong data-picked-count>已選 0 人</strong></div>${rows.map(row=>`<label><input type="checkbox" name="students" value="${row.student_id}"><span>${esc(row.display_name)} <small class="collection-student-status" data-student-status="${esc(row.student_id)}">${statusMarkup(row.status)}</small></span></label>`).join('')||'<p>沒有學生。</p>'}</fieldset><label>批次標記為<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><button type="submit" class="primary-button">更新所選學生</button></form><div class="school-actions">${button('提醒所有未繳學生','data-remind-collection')}</div><p role="status" data-reminder-result></p></div>`);
  submit(dialog.querySelector('form'),ctx,async data=>{
   const selected=data.getAll('students');if(!selected.length)throw Error('請選擇學生');
   await api('collections/'+item.id,'PATCH',{students:selected,status:data.get('status')});
   const [updated,summary]=await Promise.all([api('collections/'+item.id),api('collections')]);if(!node.isConnected)return;
   await Promise.all(updated.map(row=>{const target=[...dialog.querySelectorAll('[data-student-status]')].find(span=>span.dataset.studentStatus===row.student_id),old=target?.querySelector('[data-status]')?.dataset.status;if(target&&old!==row.status){target.innerHTML=statusMarkup(row.status);return featureMotion(target,[{opacity:.2},{opacity:1}],{duration:200});}}));
   const current=summary.find(row=>row.id===item.id),card=[...node.querySelectorAll('[data-collection-card]')].find(article=>article.dataset.collectionCard===item.id);
   if(current&&card){const previous=completion(item);Object.assign(item,current);card.querySelector('[data-collection-counts]').textContent=`已繳 ${item.submitted} · 未繳 ${item.missing} · 排除 ${item.excluded}`;card.querySelector('[data-collection-progress]').innerHTML=progressMarkup(item);const bar=card.querySelector('.collection-progress>span');featureMotion(bar,[{transform:`scaleX(${previous/100})`},{transform:bar.style.transform}],{duration:420});}
   await closeDialog(dialog);notify('繳交狀態已更新');
  });
  const reminder=dialog.querySelector('[data-remind-collection]'),result=dialog.querySelector('[data-reminder-result]');
  reminder.onclick=async()=>{reminder.disabled=true;result.textContent='正在建立提醒…';try{const r=await api('collections/'+item.id+'/remind','POST',{});result.textContent=`未繳 ${r.total} 人：已排入郵件佇列 ${r.queued} 人、無驗證信箱 ${r.no_email} 人、關閉提醒 ${r.disabled} 人、10 分鐘內已提醒 ${r.cooldown} 人。實際寄達時間視郵件服務額度及佇列而定。`;}catch(e){result.textContent=e.message;}finally{reminder.disabled=false;}};
 }));
}
