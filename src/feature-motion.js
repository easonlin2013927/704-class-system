// Feature views own these animations so polling never replays existing content.
export function featureMotion(node,keyframes,options={}){
 if(!node||!node.isConnected||matchMedia('(prefers-reduced-motion: reduce)').matches||!node.animate)return Promise.resolve();
 const animation=node.animate(keyframes,{duration:240,easing:'cubic-bezier(.2,.8,.2,1)',...options});
 return animation.finished.catch(()=>{});
}

const textUpdates=new WeakMap();
export async function featureText(node,text){
 if(!node||(textUpdates.get(node)?.text??node.textContent)===text)return;
 const update={text};textUpdates.set(node,update);
 const current=()=>textUpdates.get(node)===update&&node.isConnected;
 if(node.textContent)await featureMotion(node,[{opacity:1},{opacity:0}],{duration:90});
 if(!current())return;
 node.textContent=text;
 await featureMotion(node,[{opacity:0},{opacity:1}],{duration:90});
 if(current())textUpdates.delete(node);
}
