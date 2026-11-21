import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createFirebaseAuth,migrateFirebaseAuth} from './firebase-auth.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const publicKey=pair.publicKey.export({type:'spki',format:'pem'});
const config={projectId:'fixture',apiKey:'public'};
const time=1700000000000;
function jwt(overrides={},header={alg:'RS256',kid:'key'}){
 const claims={sub:'firebase-user',aud:'fixture',iss:'https://securetoken.google.com/fixture',exp:1700003600,iat:1700000000,auth_time:1699999900,email:'Student@school.example',email_verified:true,firebase:{sign_in_provider:'google.com'},...overrides};
 const content=[header,claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
 return content+'.'+sign('RSA-SHA256',Buffer.from(content),pair.privateKey).toString('base64url');
}
function fixture(){
 const state={accounts:[{id:'account_1',role:'student',disabled:false}],queries:[],fetches:0};
 const auth=createFirebaseAuth({query:async(sql,args)=>{state.queries.push({sql,args});return {rows:state.accounts};}},config,async()=>{state.fetches++;return {ok:true,headers:{get:()=> 'max-age=3600'},json:async()=>({key:publicKey})};},()=>time);
 return {auth,state};
}
const login={portal:'student',remember:true};
test('signed Google token maps only to current verified mailbox; public config and certificate cache',async()=>{
 const {auth,state}=fixture();const result=await auth.login({...login,token:jwt(),email:'forged@example.com'});
 assert.equal(result.email,'student@school.example');assert.equal(result.userId,'firebase-user');
 assert.match(state.queries[0].sql,/where m\.verified/);assert.doesNotMatch(state.queries[0].sql,/m\.locked/);assert.deepEqual(state.queries[0].args,['student@school.example']);
 await auth.login({...login,token:jwt()});assert.equal(state.fetches,1);assert.deepEqual(auth.config(),{firebase:{enabled:true,config}});
});
test('reject malformed, tampered, wrong signature and unknown key tokens',async()=>{
 const token=jwt();
 for(const value of ['invalid',token.slice(0,-16)+'AAAAAAAAAAAAAAAA',jwt({}, {alg:'none',kid:'key'}),jwt({}, {alg:'RS256',kid:'other'})])await assert.rejects(fixture().auth.login({...login,token:value}),{status:401});
});
test('reject wrong project, issuer, expiry, future or invalid timestamps and invalid subject',async()=>{
 for(const claims of [{aud:'other'},{iss:'https://evil.example'},{exp:1700000000},{iat:1700000001},{auth_time:1700000001},{exp:'1700003600'},{sub:''},{sub:'x'.repeat(129)}]){
 const {auth,state}=fixture();await assert.rejects(auth.login({...login,token:jwt(claims)}),{status:401});assert.equal(state.queries.length,0);
 }
});
test('reject non Google and unverified identity',async()=>{
 for(const claims of [{email_verified:false},{firebase:{sign_in_provider:'password'}},{email:''}])await assert.rejects(fixture().auth.login({...login,token:jwt(claims)}),{status:403});
});
test('reject no match, duplicate match, disabled account and wrong portal; assistant uses teacher',async()=>{
 for(const accounts of [[],[{id:'a'},{id:'b'}],[{id:'a',disabled:true}],[{id:'a',role:'admin'}]]){const {auth,state}=fixture();state.accounts=accounts;await assert.rejects(auth.login({...login,token:jwt()}),{status:403});}
 const {auth,state}=fixture();state.accounts[0].role='assistant';assert.equal((await auth.login({portal:'teacher',token:jwt()})).account.role,'assistant');
});
test('Google local sessions reject removed or reassigned verified mailbox; password sessions unaffected',async()=>{
 const {auth,state}=fixture(),session={id:'account_1',firebase_user_id:'firebase-user',firebase_email:'student@school.example'};
 await auth.validateLocal(session);state.accounts=[];await assert.rejects(auth.validateLocal(session),{status:403});
 state.accounts=[{id:'other'}];await assert.rejects(auth.validateLocal(session),{status:401});await auth.validateLocal({id:'password-user'});
});
test('invalid payload and unavailable certificate service fail closed',async()=>{
 await assert.rejects(fixture().auth.login({...login,token:jwt(),remember:'yes'}),{status:400});
 const auth=createFirebaseAuth({},config,async()=>{throw Error('offline');},()=>time);await assert.rejects(auth.login({...login,token:jwt()}),{status:503});
});
test('theme reset runs once and rolls back marker if reset fails',async()=>{
 let exists=false,pending=false,resets=0,fail=false;
 const client={query:async sql=>{if(sql.startsWith('insert into system_migrations704')){pending=!exists;return {rowCount:pending?1:0};}if(sql.startsWith('update accounts704')){if(fail)throw Error('reset failed');resets++;}if(sql==='commit')exists ||= pending;if(sql==='rollback')pending=false;return {};},release:()=>{}};
 const db={connect:async()=>client};fail=true;await assert.rejects(migrateFirebaseAuth(db),/reset failed/);assert.equal(exists,false);
 fail=false;await migrateFirebaseAuth(db);await migrateFirebaseAuth(db);assert.equal(resets,1);
});
