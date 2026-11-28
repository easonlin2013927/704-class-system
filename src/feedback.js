import {openDialog,closeDialog} from './dialog-motion.js';
import {motionRemove} from './ui-motion.js';
const dialogs = [];
const banners = [];
const errors = new Set();
let activeDialog;
let activeBanner;
let dismissBanner;
let bannerRegion;

function element(tag, className, text) {
 const node=document.createElement(tag);
 node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}

function release(item) {
 if(item.key)errors.delete(item.key);
}

function restoreFocus(previous) {
 const modal=[...document.querySelectorAll('dialog:modal')].at(-1);
 const target=previous?.isConnected&&!previous.closest('[inert]')&&(!modal||modal.contains(previous))?previous:modal?.querySelector('button:not(:disabled),input:not(:disabled),[tabindex="0"]');
 target?.focus({preventScroll:true});
}

function showDialog() {
 if(activeDialog||!dialogs.length)return;
 const item=dialogs.shift();
 const previous=document.activeElement;
 const dialog=element('dialog','feedback-dialog');
 dialog.dataset.tone=item.tone;
 dialog.setAttribute('aria-labelledby','feedback-dialog-title');
 dialog.setAttribute('aria-describedby','feedback-dialog-message');
 const mark=element('span','feedback-mark');
 mark.setAttribute('aria-hidden','true');
 if(item.tone==='success')mark.append(element('span','feedback-success-ring'));
 const title=element('h2','feedback-title',item.title||(item.tone==='error'?'操作未完成':'操作完成'));
 title.id='feedback-dialog-title';
 const message=element('p','feedback-message',item.message);
 message.id='feedback-dialog-message';
 const button=element('button','feedback-confirm','確定');
 button.type='button';
 const input=item.input?element('input','feedback-input'):null;
 let inputLabel;
 if(input){
  input.id='feedback-link-url';input.type='url';input.required=true;input.pattern='https?://.+';input.value='https://';
  inputLabel=element('label','feedback-input-label','連結網址');inputLabel.htmlFor=input.id;
  mark.hidden=true;
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();choose(true);}});
 }
 let confirmed=false,decided=false;
 const choose=value=>{
  if(decided)return;
  if(value&&input&&!input.reportValidity())return;
  decided=true;confirmed=value;
  dialog.querySelectorAll('.feedback-confirm,.feedback-cancel').forEach(control=>control.disabled=true);
  closeDialog(dialog);
 };
 let focusTarget=button;
 if(item.resolve){
  const actions=element('div','feedback-actions');
  const cancel=element('button','feedback-cancel','取消');
  cancel.type='button';
  button.textContent=item.confirmLabel;
  cancel.addEventListener('click',()=>choose(false));
  actions.append(cancel,button);
  dialog.append(mark,title,message);
  if(input)dialog.append(inputLabel,input);
  dialog.append(actions);
  focusTarget=input||cancel;
 }else dialog.append(mark,title,message,button);
 focusTarget.autofocus=true;
 document.body.append(dialog);
 activeDialog=dialog;
 button.addEventListener('click',()=>choose(true));
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();choose(false);});
 dialog.addEventListener('close',async()=>{
  // Preserve a visible banner when its temporary modal host closes.
  if(bannerRegion?.parentNode===dialog)document.body.append(bannerRegion);
  restoreFocus(previous);
  const animations=dialog.getAnimations?.().filter(animation=>animation.effect?.target===dialog)||[];
  if(animations.length)await Promise.race([Promise.allSettled(animations.map(animation=>animation.finished)),new Promise(resolve=>setTimeout(resolve,240))]);
  activeDialog=undefined;
  release(item);
  dialog.remove();
  item.resolve?.(input?(confirmed?input.value:null):confirmed);
  showDialog();
 },{once:true});
 openDialog(dialog);
 focusTarget.focus({preventScroll:true});
}

export async function confirmAction(message,{title='確認刪除',confirmLabel='刪除',tone='danger'}={}) {
 return new Promise(resolve=>{
  dialogs.push({message:String(message??'').trim(),title:String(title),confirmLabel:String(confirmLabel),tone:tone==='warning'?'warning':'danger',resolve});
  showDialog();
 });
}

export function promptLink(){
 return new Promise(resolve=>{dialogs.push({message:'輸入要加入的 HTTP 或 HTTPS 網址。',title:'新增連結',confirmLabel:'加入連結',tone:'neutral',input:true,resolve});showDialog();});
}

function showBanner() {
 if(activeBanner||!banners.length)return;
 const item=banners.shift();
 if(!bannerRegion){
  bannerRegion=element('div','feedback-region');
  bannerRegion.setAttribute('aria-label','操作通知');
 }
 const attach=()=>{
  const focused=document.activeElement?.closest('dialog:modal');
  const host=(activeDialog?.open?activeDialog:null)||focused||[...document.querySelectorAll('dialog:modal')].at(-1)||document.body;
  if(bannerRegion.parentNode!==host)host.append(bannerRegion);
 };
 attach();
 const banner=element('div','feedback-banner');
 banner.dataset.tone=item.tone;
 const content=element('div','feedback-banner-content');
 content.setAttribute('role',item.tone==='error'?'alert':'status');
 content.setAttribute('aria-atomic','true');
 const close=element('button','feedback-dismiss','×');
 close.type='button';
 close.setAttribute('aria-label','關閉通知');
 banner.append(content,close);
 bannerRegion.append(banner);
 // Insert live text after the live region exists in the document.
 if(item.title)content.append(element('strong','feedback-banner-title',item.title));
 content.append(element('span','feedback-banner-message',item.message));
 let timer;
 let remaining=Math.min(12000,Math.max(4500,item.message.length*55));
 let started;
 let finished=false;
 const paused=new Set();
 const start=()=>{
  clearTimeout(timer);
  if(paused.size||finished)return;
  started=performance.now();
  timer=setTimeout(dismiss,remaining);
 };
 const pause=reason=>{
  if(!paused.size&&started!==undefined)remaining=Math.max(0,remaining-(performance.now()-started));
  paused.add(reason);
  clearTimeout(timer);
 };
 const resume=reason=>{paused.delete(reason);start();};
 const visibility=()=>document.hidden?pause('hidden'):resume('hidden');
 const observer=new MutationObserver(attach);
 async function dismiss() {
  if(finished)return;
  finished=true;
  clearTimeout(timer);
  observer.disconnect();
  document.removeEventListener('visibilitychange',visibility);
  const focused=banner.contains(document.activeElement);
  await motionRemove(banner);
  activeBanner=undefined;
  dismissBanner=undefined;
  release(item);
  if(focused)restoreFocus(item.previous);
  showBanner();
 }
 activeBanner=banner;
 dismissBanner=dismiss;
 close.addEventListener('click',dismiss);
 banner.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}
 });
 banner.addEventListener('pointerenter',()=>pause('pointer'));
 banner.addEventListener('pointerleave',()=>resume('pointer'));
 banner.addEventListener('focusin',()=>pause('focus'));
 banner.addEventListener('focusout',event=>{if(!banner.contains(event.relatedTarget))resume('focus');});
 document.addEventListener('visibilitychange',visibility);
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 if(document.hidden)pause('hidden');
 start();
}

export function notify(message,tone='success',options={}) {
 const text=String(message??'').trim();
 if(!text)return;
 const presentation=options.presentation||(tone==='error'?'dialog':'banner');
 const item={message:text,tone:tone==='error'?'error':'success',title:options.title==null?'':String(options.title),previous:document.activeElement};
 if(item.tone==='error'){
  item.key=JSON.stringify([presentation,item.title,text]);
  if(errors.has(item.key))return;
  errors.add(item.key);
 }
 if(presentation==='dialog'){
  dialogs.push(item);
  showDialog();
 }else{
  if(item.tone==='success'){
   for(let index=banners.length-1;index>=0;index--)if(banners[index].tone==='success')banners.splice(index,1);
   banners.push(item);
   if(activeBanner?.dataset.tone==='success')dismissBanner();
   else showBanner();
   return;
  }
  // Bound pending transient notices so an old success cannot surface much later.
  if(banners.length>=4)release(banners.shift());
  banners.push(item);
  showBanner();
 }
}
