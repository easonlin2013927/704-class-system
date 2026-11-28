import {randomBytes,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {digest,hash,verify} from './password.mjs';
import {firebaseConfig} from './firebase-config.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const invalid=()=>fail(400,'連結無效或已過期，請重新要求寄送');
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():'';
const generic={ok:true,delivery:'firebase'};

export async function migrateFirebaseEmail(db){
 await db.query(`create table if not exists firebase_email_challenges704(
 state_hash text primary key,kind text not null,account_id uuid not null references accounts704(id) on delete cascade,
 mailbox_id uuid not null references school_mailboxes(id) on delete cascade,address text not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 proof_hash text,password_hash text,consumed_at timestamptz);
 create index if not exists firebase_email_account704 on firebase_email_challenges704(account_id,created_at);
 create table if not exists firebase_email_limits704(key text primary key,window_start timestamptz not null default now(),attempts integer not null default 1);
 create or replace function revoke_firebase_password_reset704() returns trigger language plpgsql as $$ begin
 update firebase_email_challenges704 set consumed_at=now(),password_hash=null where account_id=new.id and kind='PASSWORD_RESET' and consumed_at is null;
 return new;end $$;
 drop trigger if exists firebase_password_change704 on accounts704;
 create trigger firebase_password_change704 after update of password_hash on accounts704 for each row when(old.password_hash is distinct from new.password_hash) execute function revoke_firebase_password_reset704();`);
}

// Service account material and short-lived tokens remain on the API server.
export function createFirebaseEmailRemote({env=process.env,config=firebaseConfig,request=fetch,now=()=>Date.now()}={}){
 let credentials,accessToken,accessExpires=0;
 async function credential(){
  if(credentials)return credentials;
  try{const raw=env.FIREBASE_SERVICE_ACCOUNT_JSON||await readFile(env.GOOGLE_APPLICATION_CREDENTIALS,'utf8');const value=JSON.parse(raw);if(value.project_id!==config.projectId||!value.client_email||!value.private_key||!config.apiKey)throw Error();credentials=value;return value;}catch{fail(503,'Firebase 郵件服務尚未設定，請聯絡管理員');}
 }
 function jwt(value,key){const content=[{alg:'RS256',typ:'JWT'},value].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return content+'.'+sign('RSA-SHA256',Buffer.from(content),key).toString('base64url');}
 async function post(url,value,token){
  let response;try{response=await request(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(value),signal:AbortSignal.timeout(15000)});}catch{fail(503,'Firebase 郵件服務暫時無法使用');}
  const result=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error('Firebase 郵件操作失敗，請重新要求寄送'),{status:response.status>=500?503:400,firebaseCode:String(result.error?.message||'').split(' : ')[0]});return result;
 }
 async function oauth(){const c=await credential();if(accessExpires>now())return accessToken;const issued=Math.floor(now()/1000),assertion=jwt({iss:c.client_email,scope:'https://www.googleapis.com/auth/identitytoolkit',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600},c.private_key);let response;try{response=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000)});}catch{fail(503,'Firebase 郵件服務暫時無法使用');}const value=await response.json().catch(()=>({}));if(!response.ok||!value.access_token)fail(503,'Firebase 服務帳戶憑證無法使用');accessToken=value.access_token;accessExpires=now()+Math.min(Number(value.expires_in)||3600,3600)*1000-60000;return accessToken;}
 const client=(method,value)=>post('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+encodeURIComponent(config.apiKey),value);
 async function provision(email){
  const token=await oauth(),base='https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(config.projectId)+'/accounts';
  let user=(await post(base+':lookup',{email:[email]},token)).users?.[0];
  if(!user){try{user=await post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(config.apiKey),{targetProjectId:config.projectId,email,password:randomBytes(48).toString('base64url'),emailVerified:false},token);}catch(error){if(error.firebaseCode!=='EMAIL_EXISTS')throw error;user=(await post(base+':lookup',{email:[email]},token)).users?.[0];}}
  if(!user?.localId||user.disabled)fail(400,'此電子郵件目前無法接收驗證連結');return user;
 }
 return {
  async configured(){await credential();},
  async send(kind,email,continueUrl){const user=await provision(email);let idToken;if(kind==='VERIFY_EMAIL'){const c=await credential(),issued=Math.floor(now()/1000),token=jwt({iss:c.client_email,sub:c.client_email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:issued,exp:issued+3600,uid:user.localId},c.private_key);idToken=(await client('signInWithCustomToken',{token,returnSecureToken:true})).idToken;if(!idToken)fail(503,'Firebase 郵件服務暫時無法使用');}await client('sendOobCode',{requestType:kind,...(idToken?{idToken}:{email}),continueUrl,canHandleCodeInApp:false});},
  check:oobCode=>client('resetPassword',{oobCode}),
  // A random Firebase password avoids changing any external-provider binding.
  consume:(kind,oobCode)=>client(kind==='VERIFY_EMAIL'?'update':'resetPassword',kind==='VERIFY_EMAIL'?{oobCode}:{oobCode,newPassword:randomBytes(48).toString('base64url')})
 };
}

export function createFirebaseEmail(db,{remote=createFirebaseEmailRemote(),continueUrl=process.env.FIREBASE_EMAIL_CONTINUE_URL||'https://easonlin2013927.github.io/704-class-system/auth-action/',schedule=task=>setImmediate(task)}={}){
 async function transaction(action){const c=await db.connect();try{await c.query('begin');const result=await action(c);await c.query('commit');return result;}catch(error){await c.query('rollback').catch(()=>{});throw error;}finally{c.release();}}
 async function limited(key,max,seconds){const row=(await db.query(`insert into firebase_email_limits704(key) values($1) on conflict(key) do update set attempts=case when firebase_email_limits704.window_start<now()-($2::text||' seconds')::interval then 1 else firebase_email_limits704.attempts+1 end,window_start=case when firebase_email_limits704.window_start<now()-($2::text||' seconds')::interval then now() else firebase_email_limits704.window_start end returning attempts`,[digest(key),seconds])).rows[0];return row.attempts>max;}
 async function send(kind,box){
  const state=randomBytes(32).toString('hex'),url=new URL(continueUrl);url.searchParams.set('state',state);
  await db.query('insert into firebase_email_challenges704(state_hash,kind,account_id,mailbox_id,address) values($1,$2,$3,$4,$5)',[digest(state),kind,box.account_id,box.id,box.address]);
  try{await remote.send(kind,box.address,url.href);}catch(error){await db.query('delete from firebase_email_challenges704 where state_hash=$1',[digest(state)]);throw error;}
  return {...generic};
 }
 async function eligible(c,row){
  const account=(await c.query('select * from accounts704 where id=$1 for update',[row.account_id])).rows[0];
  const box=(await c.query('select * from school_mailboxes where id=$1 and account_id=$2 for update',[row.mailbox_id,row.account_id])).rows[0];
  if(!account||account.disabled||!box||box.address!==row.address)invalid();
  if(row.kind==='PASSWORD_RESET'&&(!box.verified||(await c.query('select count(distinct account_id)::int as total from school_mailboxes where address=$1 and verified',[row.address])).rows[0].total!==1))invalid();
  return box;
 }
 // Lock the account before challenges, matching password-update trigger order.
 // Reset locks also prevent concurrent mailbox writes from making an address
 // ambiguous. Ordinary reads stay available; remote calls time out in 15s.
 async function challenge(c,state,kind){const candidate=(await c.query('select account_id from firebase_email_challenges704 where state_hash=$1',[digest(state)])).rows[0];if(!candidate)invalid();await c.query('select id from accounts704 where id=$1 for update',[candidate.account_id]);if(kind==='PASSWORD_RESET')await c.query('lock table school_mailboxes in share row exclusive mode');const row=(await c.query('select *,expires_at>now() as active from firebase_email_challenges704 where state_hash=$1 for update',[digest(state)])).rows[0];if(!row||!row.active||row.consumed_at||row.kind!==kind)invalid();await eligible(c,row);return row;}
 async function confirm(value,kind){
  if(typeof value?.state!=='string'||!/^([a-f0-9]{64})$/.test(value.state)||typeof value.oobCode!=='string'||!value.oobCode||value.oobCode.length>2048)invalid();
  if(kind==='PASSWORD_RESET'&&(typeof value.password!=='string'||value.password.length<8||value.password.length>256))fail(400,'新密碼須為 8 至 256 個字元');
  if(await limited('confirm:'+value.state,12,900))fail(429,'嘗試次數過多，請重新要求寄送');
  const proof=digest(value.oobCode);
  // Persist checked evidence before consuming Firebase's code. A database failure
  // after consumption can then be retried using exactly the same code/password.
  await transaction(async c=>{const row=await challenge(c,value.state,kind);if(row.proof_hash){if(row.proof_hash!==proof||(kind==='PASSWORD_RESET'&&!await verify(value.password,row.password_hash)))invalid();return;}const checked=await remote.check(value.oobCode);if(normalize(checked.email)!==row.address||checked.requestType!==kind)invalid();await c.query('update firebase_email_challenges704 set proof_hash=$2,password_hash=$3 where state_hash=$1',[digest(value.state),proof,kind==='PASSWORD_RESET'?await hash(value.password):null]);});
  return transaction(async c=>{
   const row=await challenge(c,value.state,kind);if(row.proof_hash!==proof)invalid();
   try{await remote.consume(kind,value.oobCode);}catch(error){if(error.firebaseCode!=='INVALID_OOB_CODE')throw error;}
   if(kind==='PASSWORD_RESET'){await c.query('update accounts704 set password_hash=$2,must_change_password=false where id=$1',[row.account_id,row.password_hash]);await c.query('delete from sessions704 where account_id=$1',[row.account_id]);}
   else{const box=await eligible(c,row);await c.query('update school_mailboxes set verified=true where id=$1',[box.id]);await c.query('update accounts704 set must_add_email=case when not $2 and $4>=must_add_email_since or (not $2 and must_add_email_since is null) then false else must_add_email end,must_change_email=case when must_change_email=$3 and must_change_email_original<>$5 then null else must_change_email end where id=$1',[row.account_id,box.locked,box.id,box.created_at,box.address]);}
   if(kind!=='PASSWORD_RESET')await c.query('update firebase_email_challenges704 set consumed_at=now(),password_hash=null where state_hash=$1',[digest(value.state)]);return {ok:true};
  });
 }
 return {
  async requestVerification(user,id){if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))fail(400,'信箱格式錯誤');const box=(await db.query('select m.* from school_mailboxes m join accounts704 a on a.id=m.account_id where m.id=$1 and m.account_id=$2 and not a.disabled',[id,user.id])).rows[0];if(!box)fail(404,'找不到信箱');if(await limited('verify:'+user.id,1,60))fail(429,'請稍候一分鐘後再要求驗證');return send('VERIFY_EMAIL',box);},
  async requestReset(value){
   await remote.configured?.();
   const account=normalize(value?.account),address=normalize(value?.address),portal=value?.portal;
   if(await limited('reset-global',1000,900)||await limited('reset-account:'+account,5,900)||await limited('reset:'+account+':'+address,1,60))return {...generic};
   if(!account||account.length>254||!address||address.length>254||!['student','teacher','admin'].includes(portal))return {...generic};
   // Acknowledge receipt before recipient lookup or network delivery. Process
   // restarts can discard pending work; the requester may retry after one minute.
   schedule(async()=>{try{const box=(await db.query("select m.* from school_mailboxes m join accounts704 a on a.id=m.account_id where lower(a.email)=$1 and m.address=$2 and m.verified and not a.disabled and case when a.role='assistant' then 'teacher' else a.role end=$3 and (select count(distinct account_id) from school_mailboxes where address=$2 and verified)=1",[account,address,portal])).rows[0];if(box)await send('PASSWORD_RESET',box);}catch{console.warn('Firebase password reset delivery unavailable');}});
   return {...generic};
  },
  confirmReset:value=>confirm(value,'PASSWORD_RESET'),confirmVerification:value=>confirm(value,'VERIFY_EMAIL')
 };
}
