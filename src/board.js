import {openDialog,closeDialog} from './dialog-motion.js';
import {cloud} from './cloud.js';
import {lineIcon} from './interface-icons.js';
import {featureMotion} from './feature-motion.js';

const api=(path,method='GET',body)=>cloud.school(path,method,body);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=value=>Math.min(1,Math.max(0,value));
const stamp=value=>new Date(value).toLocaleString('zh-TW');

export async function renderBoard(ctx){
 const {node,user,notify,navigate}=ctx,mayReply=user.role==='admin'||user.permissions?.board_reply;
 node.innerHTML=`<section class="cork-scene" aria-labelledby="board-title"><header class="cork-toolbar"><button type="button" id="board-back" class="cork-control">${lineIcon('back',18)}<span>返回</span></button><div><h1 id="board-title">班級留言板</h1><p>留一張今天的心情</p></div><button type="button" id="board-add" class="cork-control cork-primary">${lineIcon('plus',18)}<span>新增便利貼</span></button></header><p class="cork-instructions">全班公開 · 拖動自己便利貼的移動鈕；也可聚焦移動鈕後使用方向鍵。左右、上下捲動查看牆面。</p><div class="cork-viewport" tabindex="0" aria-label="可捲動的軟木留言牆"><div class="cork-board"><div id="cork-stage" class="cork-stage"><p class="cork-empty" role="status">正在讀取便利貼…</p></div><button type="button" id="board-more" class="cork-control" hidden>載入更早的便利貼</button></div></div><p class="board-live" id="board-live" role="status" aria-live="polite"></p></section>`;
 const stage=node.querySelector('#cork-stage'),viewport=node.querySelector('.cork-viewport'),live=node.querySelector('#board-live'),more=node.querySelector('#board-more');
 stage.dataset.featureMotion='board';
 let posts=new Map(),pages=1,drag=null,refreshing=false;const saving=new Set();
 const size=paper=>({x:Math.max(1,stage.clientWidth-paper.offsetWidth),y:Math.max(1,stage.clientHeight-paper.offsetHeight)});
 const place=(paper,x,y)=>{const available=size(paper);paper.style.left=`${clamp(x)*available.x}px`;paper.style.top=`${clamp(y)*available.y}px`;};
 const layout=()=>{if(drag)return;stage.querySelectorAll('[data-note-id]').forEach(paper=>{const post=posts.get(paper.dataset.noteId);if(post)place(paper,post.position_x,post.position_y);});};
 const save=async(paper,post,x,y)=>{
  const handle=paper.querySelector('[data-note-move]');if(saving.has(post.id))return;
  saving.add(post.id);handle.setAttribute('aria-busy','true');
  try{const result=await api('board/'+post.id,'PATCH',{position_x:clamp(x),position_y:clamp(y)});Object.assign(post,result);live.textContent='便利貼位置已儲存';}
  catch(error){if(paper.isConnected)place(paper,post.position_x,post.position_y);notify(error.message,'error');}
  finally{saving.delete(post.id);handle.removeAttribute('aria-busy');}
 };
 const showDialog=(title,body)=>{
  node.querySelector('#board-dialog')?.remove();node.insertAdjacentHTML('beforeend',`<dialog id="board-dialog" class="form-dialog school-dialog" aria-labelledby="board-dialog-title"><header><h2 id="board-dialog-title">${esc(title)}</h2><button type="button" class="secondary-button" data-close>關閉</button></header><div class="board-post">${body}</div></dialog>`);
  const dialog=node.querySelector('#board-dialog');openDialog(dialog);return dialog;
 };
 const details=post=>{
  const dialog=showDialog(post.author_name+'的便利貼',`<time>${esc(stamp(post.created_at))}</time><p class="classroom-text">${esc(post.content)}</p><section class="board-replies" aria-label="公開回覆">${(post.replies||[]).map(reply=>`<article><header><strong>${esc(reply.author_name)}</strong><time>${esc(stamp(reply.created_at))}</time></header><p class="classroom-text">${esc(reply.content)}</p></article>`).join('')||'<p class="muted">尚無回覆</p>'}</section>${mayReply?'<form id="board-reply-form"><label>公開回覆<textarea name="content" rows="3" maxlength="2000" required></textarea></label><button type="submit" class="secondary-button">公開回覆</button></form>':''}${post.author_id===user.id||user.role==='admin'||user.permissions?.board_manage===true?'<button type="button" class="danger-button" data-delete-note>刪除便利貼</button>':''}`);
  const form=dialog.querySelector('form');
  const replies=dialog.querySelector('.board-replies');replies.dataset.featureMotion='replies';
  featureMotion(replies,[{opacity:0,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0)'}],{duration:260});
  replies.querySelectorAll('article').forEach((article,index)=>featureMotion(article,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{delay:Math.min(index,8)*35,fill:'backwards'}));
  if(form)form.onsubmit=ctx.safe(async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{const reply=await api('board/'+post.id+'/replies','POST',{content:new FormData(form).get('content')});post.replies=[...(post.replies||[]),reply];replies.querySelector('.muted')?.remove();replies.insertAdjacentHTML('beforeend',`<article><header><strong>${esc(reply.author_name)}</strong><time>${esc(stamp(reply.created_at))}</time></header><p class="classroom-text">${esc(reply.content)}</p></article>`);const article=replies.lastElementChild;featureMotion(article,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}]);form.reset();notify('回覆已公開');}finally{button.disabled=false;}});
  const remove=dialog.querySelector('[data-delete-note]');
  if(remove)remove.onclick=ctx.safe(async()=>{remove.disabled=true;try{await api('board/'+post.id,'DELETE');await closeDialog(dialog);const paper=[...stage.querySelectorAll('[data-note-id]')].find(item=>item.dataset.noteId===post.id);await featureMotion(paper,[{opacity:1,transform:paper?getComputedStyle(paper).transform:'none'},{opacity:0,transform:'scale(.82) rotate(-3deg)'}],{duration:200});paper?.remove();posts.delete(post.id);await refresh();}finally{remove.disabled=false;}});
 };
 const bindMove=(paper,post)=>{
  const handle=paper.querySelector('[data-note-move]');if(!handle)return;
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0||saving.has(post.id)||drag)return;
   event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
   const available=size(paper);drag={id:post.id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,scrollX:viewport.scrollLeft,scrollY:viewport.scrollTop,x:post.position_x*available.x,y:post.position_y*available.y,moved:false};paper.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove',event=>{
   if(!drag||drag.id!==post.id||drag.pointer!==event.pointerId)return;
   const edge=viewport.getBoundingClientRect();
   if(event.clientX>edge.right-28)viewport.scrollLeft+=14;else if(event.clientX<edge.left+28)viewport.scrollLeft-=14;
   if(event.clientY>edge.bottom-28)viewport.scrollTop+=14;else if(event.clientY<edge.top+28)viewport.scrollTop-=14;
   const available=size(paper),dx=event.clientX-drag.startX+viewport.scrollLeft-drag.scrollX,dy=event.clientY-drag.startY+viewport.scrollTop-drag.scrollY;
   if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
   place(paper,(drag.x+dx)/available.x,(drag.y+dy)/available.y);
  });
  const finish=(event,cancelled=false)=>{
   if(!drag||drag.id!==post.id||drag.pointer!==event.pointerId)return;
   const moved=drag.moved;drag=null;paper.classList.remove('is-dragging');
   if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
   if(cancelled){place(paper,post.position_x,post.position_y);return;}
   if(moved){featureMotion(paper,[{transform:'rotate(2deg) scale(1.035)'},{transform:'rotate(-1deg) scale(.99)',offset:.65},{transform:`rotate(${paper.style.getPropertyValue('--paper-angle')}) scale(1)`}],{duration:300});const available=size(paper);save(paper,post,parseFloat(paper.style.left)/available.x,parseFloat(paper.style.top)/available.y);}
   else live.textContent='使用方向鍵微調位置，或拖動移動鈕';
  };
  handle.addEventListener('pointerup',event=>finish(event));handle.addEventListener('pointercancel',event=>finish(event,true));
  handle.addEventListener('keydown',event=>{
   const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!direction||drag||saving.has(post.id))return;
   event.preventDefault();const available=size(paper),step=event.shiftKey?48:12;
   place(paper,(parseFloat(paper.style.left)+direction[0]*step)/available.x,(parseFloat(paper.style.top)+direction[1]*step)/available.y);
   paper.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  handle.addEventListener('keyup',event=>{if(!event.key.startsWith('Arrow')||drag||saving.has(post.id))return;event.preventDefault();const available=size(paper);save(paper,post,parseFloat(paper.style.left)/available.x,parseFloat(paper.style.top)/available.y);});
 };
 const draw=async rows=>{
  posts=new Map(rows.map((post,index)=>{const current=posts.get(post.id)||{};return [post.id,Object.assign(current,post,{position_x:Number.isFinite(post.position_x)?post.position_x:(index%5)*.2,position_y:Number.isFinite(post.position_y)?post.position_y:Math.floor(index/5)*.15})];}));
  await Promise.all([...stage.querySelectorAll('[data-note-id]')].filter(paper=>!posts.has(paper.dataset.noteId)).map(async paper=>{await featureMotion(paper,[{opacity:1},{opacity:0,transform:'scale(.85)'}]);paper.remove();}));
  stage.querySelector('.cork-empty')?.remove();
  const existing=new Map([...stage.querySelectorAll('[data-note-id]')].map(paper=>[paper.dataset.noteId,paper]));
  [...posts.values()].reverse().forEach(post=>{
   let paper=existing.get(post.id),fresh=!paper;
   if(fresh){const seed=[...post.id].reduce((sum,c)=>sum+c.charCodeAt(0),0);stage.insertAdjacentHTML('beforeend',`<article class="sticky-note paper-${seed%4}" data-note-id="${esc(post.id)}" style="--paper-angle:${(seed%5-2)*.6}deg"><button type="button" class="note-open" data-open-note="${esc(post.id)}" aria-label="閱讀${esc(post.author_name)}的便利貼"></button>${post.author_id===user.id?`<button type="button" class="note-move" data-note-move aria-label="移動我的便利貼，使用方向鍵或拖動">${lineIcon('move',16)}</button>`:''}</article>`);paper=stage.lastElementChild;paper.querySelector('[data-open-note]').onclick=()=>details(post);bindMove(paper,post);}
   const open=paper.querySelector('.note-open'),content=`<strong>${esc(post.author_name)}</strong><p>${esc(post.content.slice(0,180))}${post.content.length>180?'…':''}</p><small>${(post.replies||[]).length?`${post.replies.length} 則回覆`:'點開閱讀'}${post.author_id===user.id?' · 我的便利貼':''}</small>`;
   if(open.innerHTML!==content)open.innerHTML=content;
   place(paper,post.position_x,post.position_y);
   if(fresh)featureMotion(paper,[{opacity:0,transform:'translateY(-22px) rotate(-4deg) scale(1.06)'},{opacity:1,transform:`rotate(${paper.style.getPropertyValue('--paper-angle')}) scale(1)`}],{duration:360});
  });
  if(!rows.length)stage.innerHTML='<div class="cork-empty"><h2>今天，想留下什麼？</h2><p>點右上角新增一張便利貼。</p></div>';
 };
 async function refresh(){
  if(refreshing||drag||saving.size||!node.isConnected)return;refreshing=true;
  try{let rows=[],before='',batch=[];for(let index=0;index<pages;index++){batch=await api('board'+(before?'?before='+encodeURIComponent(before):''));rows.push(...batch);before=batch.at(-1)?.id;if(batch.length<50)break;}
   if(!node.isConnected||drag||saving.size||node.querySelector('dialog[open]'))return;
   await draw(rows);more.hidden=batch.length<50;
  }finally{refreshing=false;}
 }
 node.querySelector('#board-back').onclick=()=>navigate('home');
 node.querySelector('#board-add').onclick=()=>{
  const dialog=showDialog('新增便利貼','<form id="board-compose"><label>今天想分享什麼？<textarea name="content" rows="6" maxlength="2000" required placeholder="寫下你的心情或想分享的事…"></textarea></label><p class="muted">全班都能看見，請避免張貼私密資料。</p><button type="submit" class="primary-button">貼上便利貼</button></form>');
  const form=dialog.querySelector('form');form.onsubmit=ctx.safe(async event=>{
   event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
   const x=clamp((viewport.scrollLeft+viewport.clientWidth/2-140)/(stage.clientWidth-210)),y=clamp((viewport.scrollTop+viewport.clientHeight/2-180)/(stage.clientHeight-230));
   try{await api('board','POST',{content:new FormData(form).get('content'),position_x:x,position_y:y});await closeDialog(dialog);await refresh();notify('便利貼已貼上');}finally{button.disabled=false;}
  });
 };
 more.onclick=ctx.safe(async()=>{pages++;more.disabled=true;try{await refresh();}finally{more.disabled=false;}});
 try{await refresh();}catch(error){if(!node.isConnected)return;stage.innerHTML=`<div class="cork-empty"><p>${esc(error.message)}</p><button type="button" class="cork-control" data-board-retry>重新載入</button></div>`;stage.querySelector('[data-board-retry]').onclick=ctx.safe(refresh);}
 if(!node.isConnected)return;
 const observer=new ResizeObserver(layout);observer.observe(stage);
 const timer=setInterval(()=>{if(document.hidden||node.querySelector('dialog[open]')||node.querySelector('.sticky-note:focus-within'))return;refresh().catch(()=>{});},15000);
 return ()=>{clearInterval(timer);observer.disconnect();};
}
