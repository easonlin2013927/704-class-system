import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {digest,hash} from './password.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const invalid=()=>fail(400,'連結無效或已過期，請重新要求寄送');
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():'';
const generic={ok:true,delivery:'email'};

export async function migrateAccountEmail(db){await db.query(`
 create table if not exists account_email_challenges704(state_hash text primary key,token_hash text not null,kind text not null,account_id uuid not null references accounts704(id) on delete cascade,mailbox_id uuid not null references school_mailboxes(id) on delete cascade,address text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',consumed_at timestamptz);
 create index if not exists account_email_account704 on account_email_challenges704(account_id,created_at);
 create table if not exists account_email_limits704(key text primary key,window_start timestamptz not null default now(),attempts integer not null default 1);
 alter table school_mail_queue add column if not exists action_state_hash text references account_email_challenges704(state_hash) on delete set null;
 alter table school_mail_queue add column if not exists action_link text;
 drop trigger if exists firebase_password_change704 on accounts704;
 drop function if exists revoke_firebase_password_reset704();
 create or replace function revoke_account_password_reset704() returns trigger language plpgsql as $$ begin
 update account_email_challenges704 set consumed_at=now() where account_id=new.id and kind='PASSWORD_RESET' and consumed_at is null;
 update school_mail_queue q set status='cancelled',action_link=null,last_error='密碼已變更，安全連結已失效' where q.account_id=new.id and q.status='pending' and exists(select 1 from account_email_challenges704 c where c.state_hash=q.action_state_hash and c.kind='PASSWORD_RESET');
 return new;end $$;
 drop trigger if exists account_password_change704 on accounts704;
 create trigger account_password_change704 after update of password_hash on accounts704 for each row when(old.password_hash is distinct from new.password_hash) execute function revoke_account_password_reset704();
 `);}

export function createAccountEmail(db,{env=process.env,actionUrl='https://easonlin2013927.github.io/704-class-system/auth-action/',schedule=task=>setImmediate(task)}={}){
 const configured=()=>{if(!env.MAIL_GMAIL_USER||!env.MAIL_GMAIL_APP_PASSWORD)fail(503,'寄件服務尚未設定，請聯絡管理員');};
 async function transaction(action){const c=await db.connect();try{await c.query('begin');const result=await action(c);await c.query('commit');return result;}catch(error){await c.query('rollback').catch(()=>{});throw error;}finally{c.release();}}
 async function limited(key,max,seconds){const row=(await db.query(`insert into account_email_limits704(key) values($1) on conflict(key) do update set attempts=case when account_email_limits704.window_start<now()-($2::text||' seconds')::interval then 1 else account_email_limits704.attempts+1 end,window_start=case when account_email_limits704.window_start<now()-($2::text||' seconds')::interval then now() else account_email_limits704.window_start end returning attempts`,[digest(key),seconds])).rows[0];return row.attempts>max;}
 async function eligible(c,row){
  const account=(await c.query('select * from accounts704 where id=$1 for update',[row.account_id])).rows[0],box=(await c.query('select * from school_mailboxes where id=$1 and account_id=$2 for update',[row.mailbox_id,row.account_id])).rows[0];
  if(!account||account.disabled||!box||box.address!==row.address)invalid();
  if(row.kind==='PASSWORD_RESET'&&(!box.verified||(await c.query('select count(distinct account_id)::int as total from school_mailboxes where address=$1 and verified',[row.address])).rows[0].total!==1))invalid();return box;
 }
 async function queue(kind,box){return transaction(async c=>{
  // Hold the account first, matching the password-change trigger lock order.
  await c.query('select id from accounts704 where id=$1 for update',[box.account_id]);await eligible(c,{...box,mailbox_id:box.id,kind});
  const state=randomBytes(32).toString('hex'),token=randomBytes(32).toString('hex'),url=new URL(actionUrl);url.searchParams.set('mode',kind==='PASSWORD_RESET'?'resetPassword':'verifyEmail');url.searchParams.set('state',state);url.searchParams.set('oobCode',token);
  await c.query('insert into account_email_challenges704(state_hash,token_hash,kind,account_id,mailbox_id,address) values($1,$2,$3,$4,$5,$6)',[digest(state),digest(token),kind,box.account_id,box.id,box.address]);
  // Only the pending mail keeps the plaintext link; the worker clears it after
  // delivery, expiry or cancellation. The challenge stores hashes exclusively.
  await c.query("insert into school_mail_queue(id,account_id,address,kind,title,action_state_hash,action_link) values($1,$2,$3,'verification',$4,$5,$6)",[randomUUID(),box.account_id,box.address,kind==='PASSWORD_RESET'?'重設系統密碼':'驗證通知信箱',digest(state),url.href]);return {...generic};
 });}
 async function confirm(value,kind){
  if(typeof value?.state!=='string'||!/^[a-f0-9]{64}$/.test(value.state)||typeof value.oobCode!=='string'||!/^[a-f0-9]{64}$/.test(value.oobCode))invalid();
  if(kind==='PASSWORD_RESET'&&(typeof value.password!=='string'||value.password.length<8||value.password.length>256))fail(400,'新密碼須為 8 至 256 個字元');
  if(await limited('confirm:'+value.state,12,900))fail(429,'嘗試次數過多，請重新要求寄送');
  return transaction(async c=>{
   const candidate=(await c.query('select account_id from account_email_challenges704 where state_hash=$1',[digest(value.state)])).rows[0];if(!candidate)invalid();await c.query('select id from accounts704 where id=$1 for update',[candidate.account_id]);
   // The short database-only reset transaction blocks concurrent mailbox writes
   // that could otherwise make the verified address ambiguous mid-confirmation.
   if(kind==='PASSWORD_RESET')await c.query('lock table school_mailboxes in share row exclusive mode');
   const row=(await c.query('select *,expires_at>now() as active from account_email_challenges704 where state_hash=$1 for update',[digest(value.state)])).rows[0];if(!row||!row.active||row.consumed_at||row.kind!==kind||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(digest(value.oobCode),'hex')))invalid();
   const box=await eligible(c,row);
   if(kind==='PASSWORD_RESET'){await c.query('update accounts704 set password_hash=$2,must_change_password=false where id=$1',[row.account_id,await hash(value.password)]);await c.query('delete from sessions704 where account_id=$1',[row.account_id]);}
   else{await c.query('update school_mailboxes set verified=true where id=$1',[box.id]);await c.query('update accounts704 set must_add_email=case when not $2 and ($4>=must_add_email_since or must_add_email_since is null) then false else must_add_email end,must_change_email=case when must_change_email=$3 and must_change_email_original<>$5 then null else must_change_email end where id=$1',[row.account_id,box.locked,box.id,box.created_at,box.address]);await c.query('update account_email_challenges704 set consumed_at=now() where state_hash=$1',[row.state_hash]);}
   await c.query("update school_mail_queue set status='cancelled',action_link=null,last_error='安全連結已使用' where action_state_hash=$1 and status='pending'",[row.state_hash]);return {ok:true};
  });
 }
 return {
  async requestVerification(user,id){configured();if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))fail(400,'信箱格式錯誤');const box=(await db.query('select m.* from school_mailboxes m join accounts704 a on a.id=m.account_id where m.id=$1 and m.account_id=$2 and not a.disabled',[id,user.id])).rows[0];if(!box)fail(404,'找不到信箱');if(await limited('verify:'+user.id,1,60))fail(429,'請稍候一分鐘後再要求驗證');return queue('VERIFY_EMAIL',box);},
  async requestReset(value){configured();const account=normalize(value?.account),address=normalize(value?.address),portal=value?.portal;if(await limited('reset-global',1000,900)||await limited('reset-account:'+account,5,900)||await limited('reset:'+account+':'+address,1,60))return {...generic};if(!account||account.length>254||!address||address.length>254||!['student','teacher','admin'].includes(portal))return {...generic};
   // Recipient lookup and queueing happen after the identical public acceptance.
   schedule(async()=>{try{const box=(await db.query("select m.* from school_mailboxes m join accounts704 a on a.id=m.account_id where lower(a.email)=$1 and m.address=$2 and m.verified and not a.disabled and case when a.role='assistant' then 'teacher' else a.role end=$3 and (select count(distinct account_id) from school_mailboxes where address=$2 and verified)=1",[account,address,portal])).rows[0];if(box)await queue('PASSWORD_RESET',box);}catch{console.warn('Account password reset queue unavailable');}});return {...generic};
  },confirmReset:value=>confirm(value,'PASSWORD_RESET'),confirmVerification:value=>confirm(value,'VERIFY_EMAIL')
 };
}
