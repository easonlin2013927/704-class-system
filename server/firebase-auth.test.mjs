import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {hash} from './password.mjs';
import {createFirebaseAuth,migrateFirebaseAuth} from './firebase-auth.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const publicKey=pair.publicKey.export({type:'spki',format:'pem'});
const password='system-password-123',passwordHash=await hash(password);
const config={projectId:'fixture',apiKey:'public'},time=1700000000000;
function jwt(overrides={},header={alg:'RS256',kid:'key'}){
 const claims={sub:'firebase-user',aud:'fixture',iss:'https://securetoken.google.com/fixture',exp:1700003600,iat:1700000000,auth_time:1699999900,email:'Personal@gmail.example',email_verified:true,firebase:{sign_in_provider:'google.com',identities:{'google.com':['google-sub']}},...overrides};
 const content=[header,claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
 return content+'.'+sign('RSA-SHA256',Buffer.from(content),pair.privateKey).toString('base64url');
}
function fixture(){
 const state={accounts:[{id:'account_1',role:'student',disabled:false,password_hash:passwordHash}],linked:true,provider:'google',conflict:false,queries:[],fetches:0,time};
 const db={query:async(sql,args)=>{
  state.queries.push({sql,args});
  if(sql.startsWith('select id,password_hash'))return {rows:state.accounts.filter(a=>a.id===args[0])};
  if(sql.startsWith('select a.*'))return {rows:state.linked&&args[0]===state.provider+'-sub'&&args[1]==='firebase-user'&&args[2]===state.provider?state.accounts.map(a=>({...a,binding_id:'binding_1'})):[]};
  if(sql.startsWith('select provider,email,created_at'))return {rows:state.linked?[{provider:state.provider,email:'bound@example.com',created_at:'fixture-date'}]:[]};
  if(sql.startsWith('select id from account_login'))return {rows:state.linked&&args[0]==='binding_1'&&args[1]==='account_1'&&args[2]==='firebase-user'?[{id:'binding_1'}]:[]};
  if(sql.startsWith('insert into account_login')){
   if(state.linked||state.conflict)throw Object.assign(Error('unique'),{code:'23505'});
   state.linked=true;return {rows:[{provider:args[4],email:args[3],created_at:'fixture-date'}]};
  }
  if(sql.startsWith('delete from account_login')){const linked=state.linked;state.linked=false;return {rowCount:linked?1:0,rows:linked?[{id:'binding_1'}]:[]};}
  throw Error('Unexpected query: '+sql);
 }};
 const auth=createFirebaseAuth(db,config,async()=>{state.fetches++;return {ok:true,headers:{get:()=> 'max-age=3600'},json:async()=>({key:publicKey})};},()=>state.time);
 return {auth,state};
}
const login={portal:'student',remember:true},user={id:'account_1'},change={current_password:password};
test('missing configuration disables Google login',async()=>{
 const auth=createFirebaseAuth({}, {projectId:'fixture',apiKey:''});
 assert.deepEqual(auth.config(),{firebase:{enabled:false,bindingRequired:true,providers:['google','github','microsoft'],config:null}});
 await assert.rejects(auth.login({...login,token:jwt()}),{status:503});
});
test('login uses bound provider subject and Firebase UID, never email fallback',async()=>{
 const {auth,state}=fixture();const result=await auth.login({...login,token:jwt(),email:'forged@example.com'});
 assert.equal(result.subject,'google-sub');assert.equal(result.bindingId,'binding_1');
 assert.match(state.queries[0].sql,/account_login_providers704/);assert.doesNotMatch(state.queries[0].sql,/school_mailboxes/);
 assert.deepEqual(state.queries[0].args,['google-sub','firebase-user','google']);
 assert.equal((await auth.login({...login,token:jwt({email:'renamed@example.com'})})).account.id,'account_1');
 state.linked=false;await assert.rejects(auth.login({...login,token:jwt()}),{status:403});
 assert.equal(state.fetches,1);assert.deepEqual(auth.config(),{firebase:{enabled:true,bindingRequired:true,providers:['google','github','microsoft'],config}});
});
test('same email with another Google subject or Firebase UID cannot log in',async()=>{
 for(const overrides of [{sub:'other-firebase-user'},{firebase:{sign_in_provider:'google.com',identities:{'google.com':['other-google-sub']}}}])await assert.rejects(fixture().auth.login({...login,token:jwt(overrides)}),{status:403});
});
test('reject malformed, tampered, unsigned and unknown-key tokens',async()=>{
 const token=jwt();for(const value of ['invalid',token.slice(0,-16)+'AAAAAAAAAAAAAAAA',jwt({}, {alg:'none',kid:'key'}),jwt({}, {alg:'RS256',kid:'other'})])await assert.rejects(fixture().auth.login({...login,token:value}),{status:401});
});
test('reject wrong project, issuer, expiry, invalid timestamps and subject',async()=>{
 for(const claims of [{aud:'other'},{iss:'https://evil.example'},{exp:1700000000},{iat:1700000001},{auth_time:1700000001},{exp:'1700003600'},{sub:''},{sub:'x'.repeat(129)}]){
  const {auth,state}=fixture();await assert.rejects(auth.login({...login,token:jwt(claims)}),{status:401});assert.equal(state.queries.length,0);
 }
});
test('reject unverified, non Google and incomplete provider identities',async()=>{
 for(const claims of [{email_verified:false},{firebase:{sign_in_provider:'password'}},{email:''},{firebase:{sign_in_provider:'google.com',identities:{}}},{firebase:{sign_in_provider:'google.com',identities:{'google.com':['a','b']}}}])await assert.rejects(fixture().auth.login({...login,token:jwt(claims)}),{status:403});
});
test('disabled accounts and wrong portals denied; assistant uses teacher portal',async()=>{
 for(const accounts of [[],[{id:'account_1',disabled:true}],[{id:'account_1',role:'admin'}]]){const {auth,state}=fixture();state.accounts=accounts;await assert.rejects(auth.login({...login,token:jwt()}),{status:403});}
 const {auth,state}=fixture();state.accounts[0].role='assistant';assert.equal((await auth.login({portal:'teacher',token:jwt()})).account.role,'assistant');
});
test('binding requires system password and fresh Google proof, ignoring claimed owner',async()=>{
 const {auth,state}=fixture();state.linked=false;
 await assert.rejects(auth.link(user,{token:jwt()}),{status:400});
 await assert.rejects(auth.link(user,{token:jwt(),current_password:'wrong'}),{status:403});assert.equal(state.fetches,0);
 await assert.rejects(auth.link(user,{...change,token:jwt({auth_time:1699999699})}),{status:403});
 await assert.rejects(auth.link(user,{...change,token:'invalid'}),{status:403});
 assert.equal((await auth.link(user,{...change,token:jwt(),account_id:'other-account'})).provider,'google');
 const insert=state.queries.find(q=>q.sql.startsWith('insert into account_login'));
 assert.equal(insert.args[0],user.id);assert.equal(insert.args[1],'google-sub');assert.ok(!insert.args.includes(password));
});
test('binding conflicts fail closed without replacing another owner or own binding',async()=>{
 await assert.rejects(fixture().auth.link(user,{...change,token:jwt()}),{status:409});
 const {auth,state}=fixture();state.linked=false;state.conflict=true;
 await assert.rejects(auth.link(user,{...change,token:jwt()}),{status:409});assert.equal(state.linked,false);
});
test('provider password confirmations are rate limited and expire',async()=>{
 const {auth,state}=fixture();
 for(let i=0;i<5;i++)await assert.rejects(auth.unlink(user,{current_password:'wrong'}),{status:403});
 await assert.rejects(auth.unlink(user,change),{status:429});state.time+=900001;
 assert.deepEqual(await auth.unlink(user,change),{ok:true,sign_out:false});
});
test('unlink verifies password; revoked and legacy Google sessions fail while password sessions survive',async()=>{
 const {auth,state}=fixture(),session={...user,firebase_user_id:'firebase-user',firebase_binding_id:'binding_1'};
 await auth.validateLocal(session);
 await assert.rejects(auth.validateLocal({...session,firebase_binding_id:null}),{status:401});
 await assert.rejects(auth.unlink(user,{current_password:'wrong'}),{status:403});assert.equal(state.linked,true);
 assert.deepEqual(await auth.unlink(session,change),{ok:true,sign_out:true});
 await assert.rejects(auth.validateLocal(session),{status:401});await assert.rejects(auth.login({...login,token:jwt()}),{status:403});
 await auth.validateLocal(user);
});
test('provider list exposes only display metadata',async()=>{
 const {auth}=fixture();assert.deepEqual(await auth.providers(user),{providers:[{id:'google',name:'Google',enabled:true,linked:{provider:'google',email:'bound@example.com',created_at:'fixture-date'}},{id:'github',name:'GitHub',enabled:true,linked:null},{id:'microsoft',name:'Microsoft',enabled:true,linked:null}]});
});
test('invalid payload and unavailable certificate service fail closed',async()=>{
 await assert.rejects(fixture().auth.login({...login,token:jwt(),remember:'yes'}),{status:400});
 const auth=createFirebaseAuth({},config,async()=>{throw Error('offline');},()=>time);await assert.rejects(auth.login({...login,token:jwt()}),{status:503});
});
const githubToken=overrides=>jwt({email:undefined,email_verified:false,firebase:{sign_in_provider:'github.com',identities:{'github.com':['github-sub']}},...overrides});
test('GitHub login requires matching provider identity, not public or verified email',async()=>{
 const {auth,state}=fixture();state.provider='github';
 const result=await auth.login({...login,provider:'github',token:githubToken()});
 assert.equal(result.provider,'github');assert.equal(result.email,'');assert.equal(result.account.id,user.id);
 assert.deepEqual(state.queries[0].args,['github-sub','firebase-user','github']);
 for(const token of [jwt(),githubToken({firebase:{sign_in_provider:'github.com',identities:{'github.com':['other']}}}),githubToken({sub:'other-user'})])await assert.rejects(auth.login({...login,provider:'github',token}),{status:403});
 await assert.rejects(auth.login({...login,token:githubToken()}),{status:403});
 await assert.rejects(auth.login({...login,provider:'unknown',token:githubToken()}),{status:400});
});
test('GitHub binding confirms password, validates proof and refuses duplicate ownership',async()=>{
 const {auth,state}=fixture();state.provider='github';state.linked=false;
 await assert.rejects(auth.link(user,{token:githubToken()},'github'),{status:400});
 await assert.rejects(auth.link(user,{...change,token:jwt()},'github'),{status:403});
 await assert.rejects(auth.link(user,{...change,token:githubToken({auth_time:1699999699})},'github'),{status:403});
 assert.equal((await auth.link(user,{...change,token:githubToken()},'github')).provider,'github');
 const insert=state.queries.find(query=>query.sql.startsWith('insert into account_login'));
 assert.deepEqual(insert.args,[user.id,'github-sub','firebase-user','','github']);
 await assert.rejects(auth.link(user,{...change,token:githubToken()},'github'),{status:409});
});
test('unlink signs out only sessions using the deleted binding, preserving other providers',async()=>{
 const {auth,state}=fixture();state.provider='github';
 assert.deepEqual(await auth.unlink({...user,firebase_user_id:'firebase-user',firebase_binding_id:'other-binding'},change,'github'),{ok:true,sign_out:false});
 state.linked=true;
 assert.deepEqual(await auth.unlink({...user,firebase_user_id:'firebase-user',firebase_binding_id:'binding_1'},change,'github'),{ok:true,sign_out:true});
 const deletes=state.queries.filter(query=>query.sql.startsWith('delete from account_login'));
 assert.ok(deletes.every(query=>query.args[0]===user.id&&query.args[1]==='github'));
 await assert.rejects(auth.unlink(user,change,'unknown'),{status:400});
});
const microsoftToken=overrides=>jwt({email:undefined,email_verified:false,firebase:{sign_in_provider:'microsoft.com',identities:{'microsoft.com':['microsoft-sub']}},...overrides});
test('Microsoft login checks signed provider identity and UID, never matches notification email',async()=>{
 const {auth,state}=fixture();state.provider='microsoft';
 const result=await auth.login({...login,provider:'microsoft',token:microsoftToken()});
 assert.equal(result.provider,'microsoft');assert.equal(result.email,'');assert.equal(result.account.id,user.id);
 assert.deepEqual(state.queries[0].args,['microsoft-sub','firebase-user','microsoft']);
 assert.equal((await auth.login({...login,provider:'microsoft',token:microsoftToken({email:'changed@example.com'})})).account.id,user.id);
 for(const token of [jwt(),githubToken(),microsoftToken({sub:'other-user'}),microsoftToken({firebase:{sign_in_provider:'microsoft.com',identities:{'microsoft.com':['other']}}})])await assert.rejects(auth.login({...login,provider:'microsoft',token}),{status:403});
 await assert.rejects(auth.login({...login,provider:'google',token:microsoftToken()}),{status:403});
 state.linked=false;await assert.rejects(auth.login({...login,provider:'microsoft',token:microsoftToken()}),{status:403});
});
test('Microsoft binding requires password and recent proof and refuses duplicate ownership',async()=>{
 const {auth,state}=fixture();state.provider='microsoft';state.linked=false;
 await assert.rejects(auth.link(user,{token:microsoftToken()},'microsoft'),{status:400});
 await assert.rejects(auth.link(user,{current_password:'wrong',token:microsoftToken()},'microsoft'),{status:403});
 await assert.rejects(auth.link(user,{...change,token:jwt()},'microsoft'),{status:403});
 await assert.rejects(auth.link(user,{...change,token:microsoftToken({auth_time:1699999699})},'microsoft'),{status:403});
 assert.equal((await auth.link(user,{...change,token:microsoftToken(),account_id:'forged-owner'},'microsoft')).provider,'microsoft');
 const insert=state.queries.find(query=>query.sql.startsWith('insert into account_login'));
 assert.deepEqual(insert.args,[user.id,'microsoft-sub','firebase-user','','microsoft']);
 await assert.rejects(auth.link(user,{...change,token:microsoftToken()},'microsoft'),{status:409});
});
test('Microsoft sessions revoke with their binding while other provider sessions survive unlink',async()=>{
 const {auth,state}=fixture();state.provider='microsoft';
 const session={...user,firebase_user_id:'firebase-user',firebase_binding_id:'binding_1'};
 await auth.validateLocal(session);assert.match(state.queries.at(-1).sql,/'microsoft'/);
 assert.deepEqual(await auth.unlink({...session,firebase_binding_id:'google-binding'},change,'microsoft'),{ok:true,sign_out:false});
 state.linked=true;assert.deepEqual(await auth.unlink(session,change,'microsoft'),{ok:true,sign_out:true});
 await assert.rejects(auth.validateLocal(session),{status:401});await auth.validateLocal(user);
 assert.deepEqual(state.queries.filter(query=>query.sql.startsWith('delete from account_login')).map(query=>query.args),[[user.id,'microsoft'],[user.id,'microsoft']]);
});
test('schema guarantees identity uniqueness and cascade revocation; theme migration runs once and rolls back',async()=>{
 let exists=false,pending=false,resets=0,fail=false;const statements=[];
 const client={query:async sql=>{statements.push(sql);if(sql.startsWith('insert into system_migrations704')){pending=!exists;return {rowCount:pending?1:0};}if(sql.startsWith('update accounts704')){if(fail)throw Error('reset failed');resets++;}if(sql==='commit')exists ||= pending;if(sql==='rollback')pending=false;return {};},release:()=>{}};
 const db={connect:async()=>client};fail=true;await assert.rejects(migrateFirebaseAuth(db),/reset failed/);assert.equal(exists,false);
 fail=false;await migrateFirebaseAuth(db);await migrateFirebaseAuth(db);assert.equal(resets,1);
 const ddl=statements.join('\n');assert.match(ddl,/unique\(provider,subject\)/);assert.match(ddl,/unique\(provider,firebase_user_id\)/);assert.match(ddl,/unique\(account_id,provider\)/);
 assert.match(ddl,/firebase_binding_id uuid references account_login_providers704\(id\) on delete cascade/);
 assert.match(ddl,/delete from sessions704 where firebase_user_id is not null and firebase_binding_id is null/);
});
