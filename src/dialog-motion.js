const closing = new WeakMap();
const prepared = new WeakSet();

export function openDialog(dialog) {
 if(!prepared.has(dialog)){
  prepared.add(dialog);
  dialog.addEventListener('cancel',event=>{if(!event.defaultPrevented){event.preventDefault();closeDialog(dialog);}});
  dialog.addEventListener('submit',event=>{
   if(!event.defaultPrevented&&event.target.method==='dialog'){
    event.preventDefault();closeDialog(dialog,event.submitter?.value||'');
   }
  });
 }
 const pending=closing.get(dialog);
 if(pending)pending.cancelled=true;
 closing.delete(dialog);
 dialog.removeAttribute('data-dialog-closing');
 if(dialog.open)return;
 dialog.setAttribute('data-dialog-opening','');
 dialog.showModal();
 // Commit both starting styles before exposing the open state, including Safari.
 getComputedStyle(dialog).opacity;
 getComputedStyle(dialog,'::backdrop').backdropFilter;
 requestAnimationFrame(()=>dialog.removeAttribute('data-dialog-opening'));
}

export function closeDialog(dialog,returnValue) {
 if(!dialog.open)return Promise.resolve();
 const pending=closing.get(dialog);
 if(pending)return pending.finished;
 const state={cancelled:false};
 closing.set(dialog,state);
 dialog.removeAttribute('data-dialog-opening');
 // Capture the current rendered state so even an early close can transition.
 getComputedStyle(dialog).opacity;
 dialog.setAttribute('data-dialog-closing','');
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
 state.finished=new Promise(resolve=>setTimeout(resolve,duration)).then(()=>{
  if(state.cancelled)return;
  if(dialog.open)dialog.close(returnValue);
  dialog.removeAttribute('data-dialog-closing');
  closing.delete(dialog);
 });
 return state.finished;
}
