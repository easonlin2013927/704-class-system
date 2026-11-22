import { verify as verifySignature } from 'node:crypto';
import { firebaseConfig } from './firebase-config.mjs';
import {verify as verifyPassword} from './password.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():'';
const certUrl='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export function createFirebaseAuth(db,config=firebaseConfig,fetchCertificates=fetch,now=()=>Date.now()){
 let certificates={},expires=0,pending;
 const changeAttempts=new Map();
 async function keys(){
  if(expires>now())return certificates;
  return pending||=(async()=>{
   try{
    const response=await fetchCertificates(certUrl,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('certificate service');
    const result=await response.json();
    if(!result||typeof result!=='object'||Array.isArray(result))throw Error('certificate format');
    certificates=result;
    const maxAge=Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300);
    expires=now()+Math.min(maxAge,86400)*1000;
    return certificates;
   }catch{fail(503,'Google 驗證服務暫時無法使用，請稍後再試');}finally{pending=null;}
  })();
 }
 async function verifyToken(token){
  let header,claims,parts;
  try{
   parts=token.split('.');if(parts.length!==3||parts.some(part=>!part||!/^[A-Za-z0-9_-]+$/.test(part)))throw Error();
   header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw Error();
  }catch{fail(401,'Google 登入驗證失敗，請重新登入');}
  const certs=await keys();
  try{
   if(!Object.hasOwn(certs,header.kid)||!verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),certs[header.kid],Buffer.from(parts[2],'base64url')))throw Error();
   const seconds=Math.floor(now()/1000);
   if(claims.aud!==config.projectId||claims.iss!==`https://securetoken.google.com/${config.projectId}`||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128||!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds||!Number.isFinite(claims.auth_time)||claims.auth_time>seconds||claims.auth_time>claims.iat||claims.iat>=claims.exp)throw Error();
  }catch{fail(401,'Google 登入驗證失敗，請重新登入');}
  if(claims.email_verified!==true||claims.firebase?.sign_in_provider!=='google.com'||!normalize(claims.email)||normalize(claims.email).length>320)fail(403,'請使用已驗證的 Google 帳戶登入');
  const identities=claims.firebase.identities?.['google.com'];
  if(!Array.isArray(identities)||identities.length!==1||typeof identities[0]!=='string'||!identities[0]||identities[0].length>255)fail(403,'Google 帳戶身分資料不完整，請重新登入');
  return {userId:claims.sub,subject:identities[0],email:normalize(claims.email),authenticatedAt:claims.auth_time};
 }
 async function accountFor(identity){
  const rows=(await db.query("select a.*,p.id as binding_id from account_login_providers704 p join accounts704 a on a.id=p.account_id where p.provider='google' and p.subject=$1 and p.firebase_user_id=$2",[identity.subject,identity.userId])).rows;
  if(rows.length!==1)fail(403,'此 Google 帳戶尚未綁定；請先用系統帳密登入，再到設定綁定 Google');
  if(rows[0].disabled)fail(403,'帳戶已停用，請聯絡教師或管理員');
  return rows[0];
 }
 async function identityFor(data){
  if(!config.apiKey)fail(503,'Google 登入尚未完成伺服器設定，請先使用帳號密碼');
  if(!data||typeof data.token!=='string'||data.token.length>16000)fail(400,'Google 登入資料格式錯誤');
  return verifyToken(data.token);
 }
 async function authorizeChange(user,data){
  if(typeof data?.current_password!=='string'||!data.current_password||data.current_password.length>1024)fail(400,'請輸入目前的 704 系統密碼');
  const attempt=changeAttempts.get(user.id);
  if(attempt&&attempt.until>now()&&attempt.count>=5)fail(429,'密碼確認次數過多，請十五分鐘後再試');
  const account=(await db.query('select id,password_hash,disabled from accounts704 where id=$1',[user.id])).rows[0];
  if(!account||account.disabled)fail(401,'帳戶已失效，請重新登入');
  if(!await verifyPassword(data.current_password,account.password_hash)){
   changeAttempts.set(user.id,{count:attempt?.until>now()?attempt.count+1:1,until:now()+900000});
   fail(403,'704 系統密碼不正確');
  }
  changeAttempts.delete(user.id);
 }
 return {
  config:()=>({firebase:{enabled:Boolean(config.apiKey),bindingRequired:true,config:config.apiKey?config:null}}),
  async login(data){
   if(!data||!['student','teacher','admin'].includes(data.portal)||(data.remember!==undefined&&typeof data.remember!=='boolean'))fail(400,'Google 登入資料格式錯誤');
   const binding=await identityFor(data),account=await accountFor(binding);
   if(data.portal!==(account.role==='assistant'?'teacher':account.role))fail(403,'帳號不屬於此登入入口');
   return {account,...binding,bindingId:account.binding_id};
  },
  async providers(user){
   const linked=(await db.query("select email,created_at from account_login_providers704 where account_id=$1 and provider='google'",[user.id])).rows[0]||null;
   return {providers:[{id:'google',name:'Google',enabled:Boolean(config.apiKey),linked}]};
  },
  async link(user,data){
   await authorizeChange(user,data);
   let identity;
   try{identity=await identityFor(data);}catch(error){if(error.status===401)error.status=403;throw error;}
   if(identity.authenticatedAt<Math.floor(now()/1000)-300)fail(403,'請重新選擇 Google 帳戶後再綁定');
   try{
    const result=await db.query("insert into account_login_providers704(account_id,provider,subject,firebase_user_id,email) values($1,'google',$2,$3,$4) returning provider,email,created_at",[user.id,identity.subject,identity.userId,identity.email]);
    return result.rows[0];
   }catch(error){if(error.code==='23505')fail(409,'此 Google 帳戶或系統帳號已有綁定，請先解除原有綁定');throw error;}
  },
  async unlink(user,data){
   await authorizeChange(user,data);
   const result=await db.query("delete from account_login_providers704 where account_id=$1 and provider='google' returning id",[user.id]);
   if(!result.rowCount)fail(404,'尚未綁定 Google 帳戶');
   return {ok:true,sign_out:Boolean(user.firebase_user_id)};
  },
  async validateLocal(session){
   if(!session.firebase_user_id)return;
   if(!session.firebase_binding_id)fail(401,'請先用系統帳密登入，再到設定綁定 Google');
   const binding=(await db.query("select id from account_login_providers704 where id=$1 and account_id=$2 and provider='google' and firebase_user_id=$3",[session.firebase_binding_id,session.id,session.firebase_user_id])).rows[0];
   if(!binding)fail(401,'Google 帳戶綁定已解除，請重新登入');
  }
 };
}

export async function migrateFirebaseAuth(db){
 const client=await db.connect();
 try{
  await client.query('begin');
  await client.query('alter table sessions704 add column if not exists firebase_user_id text; alter table sessions704 add column if not exists firebase_email text');
  await client.query(`create table if not exists account_login_providers704 (
   id uuid primary key default gen_random_uuid(),account_id uuid not null references accounts704(id) on delete cascade,
   provider text not null,subject text not null,firebase_user_id text not null,email text not null,
   created_at timestamptz not null default now(),unique(provider,subject),unique(provider,firebase_user_id),unique(account_id,provider));
   alter table sessions704 add column if not exists firebase_binding_id uuid references account_login_providers704(id) on delete cascade;
   delete from sessions704 where firebase_user_id is not null and firebase_binding_id is null;`);
  await client.query('create table if not exists system_migrations704(name text primary key,applied_at timestamptz not null default now())');
  const inserted=await client.query("insert into system_migrations704(name) values('obsidian-default-once-v1') on conflict do nothing returning name");
  if(inserted.rowCount)await client.query("update accounts704 set theme='dark'");
  await client.query('commit');
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
