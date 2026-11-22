import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {cloud} from './cloud.js';

// Versioned imports create separate in-memory session tokens, including in bundles.
for(const file of (await readdir(new URL('./',import.meta.url))).filter(file=>/\.(js|mjs)$/.test(file))){
 const source=await readFile(new URL(file,import.meta.url),'utf8');
 assert.doesNotMatch(source,/from\s+['"]\.\/cloud\.js\?/,file);
}
const events=[];
globalThis.window={dispatchEvent:event=>events.push(event.type)};
globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options.detail;}};
let rejectLogin=true;
globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/auth/firebase'))return new Response(JSON.stringify(rejectLogin?{message:'Invalid Google token'}:{token:'fixture-token',profile:{id:'student'}}),{status:rejectLogin?401:200});
 assert.equal(options.headers.Authorization,'Bearer fixture-token');
 return new Response(JSON.stringify({ok:true}));
};
await assert.rejects(cloud.loginFirebase('invalid','student'),/Invalid Google token/);
assert.ok(!events.includes('session-expired'));
rejectLogin=false;
assert.deepEqual(await cloud.loginFirebase('valid','student'),{id:'student'});
assert.deepEqual(await cloud.school('permissions'),{ok:true});
await cloud.bindGoogle({token:'google-token',current_password:'fixture-password'});
await cloud.unlinkGoogle({current_password:'fixture-password'});
assert.deepEqual(await cloud.school('permissions'),{ok:true},'Provider management must retain the local bearer token');
console.log('Shared auth module and Google exchange regression checks passed');
