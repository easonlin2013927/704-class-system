import assert from 'node:assert/strict';
import {isAppWindow,pwaDisplayModes} from './pwa.js';

for(const active of pwaDisplayModes){
 assert.equal(isAppWindow({navigator:{},matchMedia:query=>({matches:query===`(display-mode: ${active})`})}),true,active);
}
assert.equal(isAppWindow({navigator:{standalone:true},matchMedia:()=>{throw Error('iOS standalone should not need media queries');}}),true);
assert.equal(isAppWindow({navigator:{standalone:false},matchMedia:()=>({matches:false}),location:{search:'?source=pwa'}}),false,'A URL marker is not proof of an app window');
console.log('PWA display detection: app modes, iOS and ordinary browser checks passed');
