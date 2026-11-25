import {cloud} from './cloud.js';
import {lineIcon} from './interface-icons.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const personName=student=>student.display_name+(student.nickname?'（'+student.nickname+'）':'');

const unpublished='<section class="editor-card honors-empty"><span class="page-title-icon">'+lineIcon('points',28)+'</span><h2>英雄榜尚未公布</h2><p class="muted">教師或管理員設定名次後，就會出現在頒獎台。</p></section>';

export async function renderHonors(ctx){
 const {node,user,notify}=ctx,editable=user.role==='admin'||user.permissions?.honors===true,data=await cloud.school('honors');if(!node.isConnected)return;
 const order={1:[1],3:[2,1,3],5:[4,2,1,3,5]}[data.top_count]||[2,1,3],heights={1:210,2:162,3:124,4:88,5:62};
 node.innerHTML=`<div class="school-heading"><div class="title-copy"><div class="title-lockup"><span class="page-title-icon">${lineIcon('points',22)}</span><h1>段考英雄榜</h1></div><p class="muted">${esc(data.title)} · 前 ${data.top_count} 名</p></div>${editable?`<div class="school-actions"><button type="button" class="secondary-button" id="edit-honors">編輯英雄榜</button>${data.published?'<button type="button" class="secondary-button" id="unpublish-honors">取消公布</button>':''}</div>`:''}</div>`+
  (data.published?`<section class="honors-stage" aria-label="${esc(data.title)}頒獎台"><div class="honors-caption"><span>704 CLASS HONORS</span><h2>${esc(data.title)}</h2><p>每一分努力，都值得被看見。</p></div><div class="podium-scroll" tabindex="0" aria-label="頒獎台，可左右捲動"><div class="honors-podium" data-places="${data.top_count}" style="--places:${data.top_count}">${order.map(rank=>{const winner=data.winners.find(item=>item.rank===rank);return `<article class="podium-entry place-${rank}" data-rank="${rank}" style="--step-height:${heights[rank]}px"><div class="winner-profile">${winner?`<div class="winner-avatar"><span aria-hidden="true">${esc([...winner.display_name][0]||'同')}</span>${winner.avatar_url?`<img src="${esc(winner.avatar_url)}" alt="${esc(personName(winner))}的頭像" loading="lazy">`:''}</div><h3>${esc(winner.display_name)}</h3>${winner.nickname?`<p class="winner-nickname">${esc(winner.nickname)}</p>`:''}`:'<div class="winner-avatar" aria-hidden="true">—</div><h3>名次待更新</h3>'}</div><div class="podium-step"><span class="podium-trophy" aria-hidden="true">${lineIcon('points',24)}</span><strong>${rank}</strong><span>第 ${rank} 名</span></div></article>`;}).join('')}</div></div>${data.top_count===5?'<p class="podium-scroll-hint muted">小螢幕可左右滑動查看全部名次。</p>':''}</section>`:unpublished);
 node.querySelectorAll('.winner-avatar img').forEach(image=>image.addEventListener('error',()=>image.remove(),{once:true}));
 const scroller=node.querySelector('.podium-scroll');if(scroller&&data.top_count===5)scroller.scrollLeft=(scroller.scrollWidth-scroller.clientWidth)/2;
 node.querySelector('#unpublish-honors')?.addEventListener('click',ctx.safe(async event=>{const button=event.currentTarget;button.disabled=true;try{await cloud.school('honors','PATCH',{published:false});await renderHonors(ctx);notify('英雄榜已取消公布');}finally{button.disabled=false;}}));
 node.querySelector('#edit-honors')?.addEventListener('click',()=>{
  node.insertAdjacentHTML('beforeend','<dialog id="honors-editor" class="form-dialog school-dialog" aria-labelledby="honors-editor-title"><header><h2 id="honors-editor-title">編輯段考英雄榜</h2><button type="button" class="secondary-button" data-close>關閉</button></header><form id="honors-form"><label>英雄榜名稱<input name="title" maxlength="100" required></label><label>顯示名次<select name="top_count"><option value="1">只顯示第一名</option><option value="3">前三名</option><option value="5">前五名</option></select></label><div id="honors-places" class="honors-places"></div><p class="muted">每個名次須選擇不同的啟用中學生。姓名、暱稱與頭像會使用帳號目前的資料。</p><button type="submit" class="primary-button">公布英雄榜</button></form></dialog>');
  const dialog=node.querySelector('#honors-editor'),form=dialog.querySelector('form'),selected=new Map(data.winners.map(winner=>[winner.rank,winner.student_id]));form.elements.title.value=data.title;form.elements.top_count.value=String(data.top_count);
  const draw=()=>{node.querySelector('#honors-places').innerHTML=Array.from({length:Number(form.elements.top_count.value)},(_,index)=>`<label>第 ${index+1} 名<select name="place-${index+1}" data-honor-rank="${index+1}" required><option value="">請選擇學生</option>${data.candidates.map(student=>`<option value="${student.id}">${esc(personName(student))}</option>`).join('')}</select></label>`).join('');form.querySelectorAll('[data-honor-rank]').forEach(select=>{select.value=selected.get(Number(select.dataset.honorRank))||'';select.onchange=()=>selected.set(Number(select.dataset.honorRank),select.value);});};
  form.elements.top_count.onchange=draw;draw();dialog.showModal();
  form.onsubmit=ctx.safe(async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]'),count=Number(form.elements.top_count.value),winners=Array.from({length:count},(_,index)=>form.elements['place-'+(index+1)].value);if(new Set(winners).size!==count)throw Error('每個名次請選擇不同的學生');button.disabled=true;try{await cloud.school('honors','PUT',{title:form.elements.title.value,top_count:count,winners});dialog.close();await renderHonors(ctx);notify('英雄榜已公布');}finally{button.disabled=false;}});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 });
 if(!editable&&data.published){
  let checking=false;
  const check=async()=>{if(!node.isConnected){cleanup();return;}if(document.hidden||checking)return;checking=true;try{const current=await cloud.school('honors');if(!current.published&&node.isConnected){cleanup();const podium=node.querySelector('.honors-stage');if(podium)podium.outerHTML=unpublished;}}catch{}finally{checking=false;}};
  const timer=setInterval(check,15000);
  document.addEventListener('visibilitychange',check);
  const cleanup=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);};
  return cleanup;
 }
}
