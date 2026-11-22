import assert from 'node:assert/strict';
import {bindIconMotion,lineIcon} from './interface-icons.js';
let reduced=false,id=0;
const timers=new Map(),listeners=new Map(),classes=new Set();
const originals={setTimeout,clearTimeout,matchMedia:globalThis.matchMedia};
globalThis.setTimeout=(callback,delay)=>{timers.set(++id,{callback,delay});return id;};
globalThis.clearTimeout=key=>timers.delete(key);
globalThis.matchMedia=query=>({matches:query.includes('reduced-motion')?reduced:true});
const element={isConnected:true,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},matches:()=>true,addEventListener:(type,handler)=>{const handlers=listeners.get(type)||[];handlers.push(handler);listeners.set(type,handlers);}};
const root={querySelectorAll:()=>[element]};
const fire=(type,event={})=>listeners.get(type)?.forEach(handler=>handler(event));
const run=delay=>{for(const [key,timer] of [...timers])if(timer.delay===delay){timers.delete(key);timer.callback();}};
try{
 bindIconMotion(root);bindIconMotion(root);
 assert.equal(listeners.get('pointerenter').length,1);
 fire('pointerenter',{pointerType:'mouse'});fire('pointerleave');run(70);
 assert.equal(classes.size,0);
 fire('pointerenter',{pointerType:'mouse'});fire('blur');assert.equal(timers.size,0);
 fire('pointerenter',{pointerType:'touch'});assert.equal(timers.size,0);
 fire('pointerenter',{pointerType:'mouse'});run(70);assert.equal(classes.size,1);
 fire('animationend',{animationName:'nav-icon-lift'});assert.equal(classes.size,0);assert.equal(timers.size,0);
 fire('focus');assert.equal(classes.size,1);run(460);assert.equal(classes.size,0);
 reduced=true;fire('focus');fire('pointerenter',{pointerType:'mouse'});run(70);assert.equal(classes.size,0);
 assert.match(lineIcon('search'),/aria-hidden="true"/);
 console.log('Icon motion: idempotent binding, hover cancellation, keyboard, touch and reduced motion passed');
}finally{Object.assign(globalThis,originals);}
