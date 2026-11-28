/* Small, explicit motions. No data, focus, scroll, or native-control replacement. */
const active=new WeakMap(),busy=new WeakMap(),instances=new WeakMap();
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const excluded='[data-feature-motion],.sticky-note,.chat-bubble,.podium-entry,.collection-student-status';
const items='[data-motion],.announcement-card,.record-card,.editor-card,.empty-state,.bulk-toolbar,.batch-toolbar,.pwa-install-banner,.offline-banner';
const values='[data-motion="value"],.status-badge,[data-countdown-at],#profile-avatar';

function animate(element,frames,options={}){
 active.get(element)?.cancel();
 active.delete(element);
 if(reduced()||!element.isConnected||!element.animate)return null;
 const animation=element.animate(frames,{duration:180,easing:'cubic-bezier(.2,.7,.2,1)',...options});
 active.set(element,animation);
 animation.finished.then(()=>{if(active.get(element)===animation)active.delete(element);},()=>{});
 return animation;
}

export function motionEnter(element,{delay=0}={}){
 return animate(element,[{opacity:0,translate:'0 6px'},{opacity:1,translate:'0 0'}],{delay});
}

export async function motionRemove(element,{remove=true}={}){
 const animation=animate(element,[{opacity:1,translate:'0 0'},{opacity:0,translate:'0 -4px'}],{duration:140});
 if(animation){try{await animation.finished;}catch{return false;}}
 if(remove)element.remove();
 return true;
}

export function motionSwap(element,update){
 update();
 return animate(element,[{opacity:.35},{opacity:1}],{duration:140});
}

export function setMotionBusy(button,value){
 if(value){
  if(busy.has(button))return;
  busy.set(button,{width:button.style.minWidth,aria:button.getAttribute('aria-busy')});
  button.style.minWidth=`${button.getBoundingClientRect().width}px`;
  button.setAttribute('aria-busy','true');
  button.setAttribute('data-motion-busy','');
 }else{
  const previous=busy.get(button);if(!previous)return;
  button.style.minWidth=previous.width;
  if(previous.aria===null)button.removeAttribute('aria-busy');else if(button.getAttribute('aria-busy')==='true')button.setAttribute('aria-busy',previous.aria);
  button.removeAttribute('data-motion-busy');busy.delete(button);
 }
}

export function initUIMotion(root=document){
 if(instances.has(root))return instances.get(root);
 const seen=new WeakSet(),snapshots=new WeakMap(),keys=new Map(),running=new Set();
 const track=animation=>{if(animation){running.add(animation);animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));}};
 const allowed=node=>node instanceof Element&&!node.closest(excluded);
 const keyFor=node=>{
  const owner=node.closest('[data-motion-list]');
  const key=node.dataset.motionKey||node.id||node.querySelector('[data-id],[data-open],[data-edit-countdown],[data-edit-account]')?.outerHTML;
  return key?`${location.hash}|${owner?.dataset.motionList||node.className}|${key}`:null;
 };
 const remember=node=>snapshots.set(node,node.matches('#profile-avatar')?node.innerHTML:node.textContent);
 const scan=container=>{
  if(!(container instanceof Element||container instanceof Document))return;
  for(const control of container.querySelectorAll('button[title],a[title]')){
   if(!control.title)continue;
   control.dataset.tooltip=control.title;
   if(!control.hasAttribute('aria-label')&&!control.textContent.trim())control.setAttribute('aria-label',control.title);
   control.removeAttribute('title');
  }
  for(const field of container.querySelectorAll('textarea'))field.setAttribute('data-autoheight','');
  for(const value of container.querySelectorAll('.summary-grid strong,.summary-tile strong'))value.dataset.motion='value';
  for(const loading of container.querySelectorAll('.ui-loading')){loading.setAttribute('data-motion-skeleton','');loading.setAttribute('aria-busy','true');}
  for(const input of container.querySelectorAll('input[type="password"]')){
   if(input.closest('.password-field'))continue;
   const wrap=document.createElement('span'),toggle=document.createElement('button');wrap.className='password-field';
   input.before(wrap);wrap.append(input);toggle.type='button';toggle.className='password-visibility';toggle.textContent='顯示';toggle.setAttribute('aria-label','顯示密碼');toggle.setAttribute('aria-pressed','false');
   toggle.addEventListener('click',()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'隱藏':'顯示';toggle.setAttribute('aria-label',visible?'隱藏密碼':'顯示密碼');toggle.setAttribute('aria-pressed',String(visible));track(animate(toggle,[{opacity:.4},{opacity:1}],{duration:120}));});
   wrap.append(toggle);
  }
  const nodes=[...(container instanceof Element&&container.matches(items)?[container]:[]),...container.querySelectorAll(items)];
  let count=0;
  for(const node of nodes){
   if(!allowed(node)||seen.has(node))continue;
   seen.add(node);
   if(node.hidden||node.dataset.motion==='value'||node.closest('[data-motion="page"]')!==node&&node.matches('.editor-card')&&node.parentElement?.closest('.editor-card'))continue;
   const key=keyFor(node);if(key&&keys.has(key))continue;
   if(key){keys.set(key,true);if(keys.size>600)keys.delete(keys.keys().next().value);}
   if(count<12)track(motionEnter(node,{delay:count++*22}));
  }
  const valueNodes=[...(container instanceof Element&&container.matches(values)?[container]:[]),...container.querySelectorAll(values)];
  for(const node of valueNodes)if(allowed(node)&&!snapshots.has(node))remember(node);
  for(const button of container.querySelectorAll('button:not(:disabled)'))if(!busy.has(button))button.dataset.motionReady='';
 };
 scan(root);
 const observer=new MutationObserver(records=>{
  const changed=new Set();
  for(const record of records){
   const target=record.target instanceof Element?record.target:record.target.parentElement;
   if(!allowed(target))continue;
   if(record.type==='childList'){
    const value=target.closest(values);if(value&&snapshots.has(value))changed.add(value);
    for(const node of record.removedNodes)if(node instanceof Element){active.get(node)?.cancel();for(const child of node.querySelectorAll(items))active.get(child)?.cancel();}
    for(const node of record.addedNodes)if(node instanceof Element)scan(node);
   }else if(record.attributeName==='disabled'&&target.matches('button')){
    if(target.disabled&&target.hasAttribute('data-motion-ready')&&(target.type==='submit'||target.closest('form')))setMotionBusy(target,true);
    else if(!target.disabled){setMotionBusy(target,false);target.dataset.motionReady='';}
    const search=target.closest('form')?.querySelector('input[name="q"],input[type="search"]');
    if(search){const shell=search.closest('label')||search.parentElement;shell.setAttribute('data-motion-search','');shell.setAttribute('aria-busy',String(target.disabled));}
   }else if(record.attributeName==='hidden'){
    if(!target.hidden&&target.matches(items))track(motionEnter(target));
   }else if(record.attributeName==='open'&&target.matches('.nav-more')&&target.open){
    const content=target.querySelector('.nav-secondary');if(content)track(motionEnter(content));
   }else if(record.attributeName==='aria-invalid'&&target.getAttribute('aria-invalid')==='true'){
    track(animate(target,[{translate:'-3px 0'},{translate:'3px 0'},{translate:'0 0'}],{duration:160}));
   }else if(target.matches('[aria-selected="true"],[aria-current="page"],.filter-tab.active,.theme-card[aria-pressed="true"]')){
    track(animate(target,[{opacity:.5},{opacity:1}],{duration:140}));
   }
  }
  for(const node of changed){
   const next=node.matches('#profile-avatar')?node.innerHTML:node.textContent;
   if(next!==snapshots.get(node)){remember(node);track(animate(node,[{opacity:.45},{opacity:1}],{duration:120}));}
  }
 });
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','disabled','aria-selected','aria-current','aria-pressed','aria-invalid','class']});
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const cancel=()=>{for(const animation of running)animation.cancel();running.clear();};
 const onPreference=()=>{if(media.matches)for(const animation of running){try{animation.finish();}catch{animation.cancel();}}};
 const onChange=event=>{if(allowed(event.target)&&event.target.matches('input[type="checkbox"],input[type="radio"]'))track(animate(event.target,[{scale:'.88'},{scale:'1'}],{duration:140}));};
 root.addEventListener('change',onChange);
 const invalidFields=new WeakSet();
 const onInvalid=event=>{if(allowed(event.target)){invalidFields.add(event.target);event.target.setAttribute('aria-invalid','true');}};
 const onInput=event=>{const field=event.target;if(invalidFields.has(field)&&field.validity.valid){field.removeAttribute('aria-invalid');invalidFields.delete(field);}};
 root.addEventListener('invalid',onInvalid,true);root.addEventListener('input',onInput);
 media.addEventListener('change',onPreference);
 const cleanup=()=>{observer.disconnect();cancel();root.removeEventListener('change',onChange);root.removeEventListener('invalid',onInvalid,true);root.removeEventListener('input',onInput);media.removeEventListener('change',onPreference);instances.delete(root);};
 instances.set(root,cleanup);return cleanup;
}
