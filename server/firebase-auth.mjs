import { verify as verifySignature } from 'node:crypto';
import { firebaseConfig } from './firebase-config.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():'';
const certUrl='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export function createFirebaseAuth(db,config=firebaseConfig,fetchCertificates=fetch,now=()=>Date.now()){
 let certificates={},expires=0,pending;
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
  return {userId:claims.sub,email:normalize(claims.email)};
 }
 async function accountFor(email){
  const rows=(await db.query('select distinct a.* from accounts704 a join school_mailboxes m on m.account_id=a.id where m.verified and lower(trim(m.address))=$1',[email])).rows;
  if(rows.length!==1)fail(403,'此 Google 信箱未獲授權或對應多個帳號，請聯絡管理員');
  if(rows[0].disabled)fail(403,'帳戶已停用，請聯絡教師或管理員');
  return rows[0];
 }
 return {
  config:()=>({firebase:{enabled:true,config}}),
  async login(data){
   if(!data||typeof data.token!=='string'||data.token.length>16000||!['student','teacher','admin'].includes(data.portal)||(data.remember!==undefined&&typeof data.remember!=='boolean'))fail(400,'Google 登入資料格式錯誤');
   const binding=await verifyToken(data.token),account=await accountFor(binding.email);
   if(data.portal!==(account.role==='assistant'?'teacher':account.role))fail(403,'帳號不屬於此登入入口');
   return {account,...binding};
  },
  async validateLocal(session){
   if(!session.firebase_user_id)return;
   const account=await accountFor(session.firebase_email);
   if(account.id!==session.id)fail(401,'Google 帳號授權已變更，請重新登入');
  }
 };
}

export async function migrateFirebaseAuth(db){
 const client=await db.connect();
 try{
  await client.query('begin');
  await client.query('alter table sessions704 add column if not exists firebase_user_id text; alter table sessions704 add column if not exists firebase_email text');
  await client.query('create table if not exists system_migrations704(name text primary key,applied_at timestamptz not null default now())');
  const inserted=await client.query("insert into system_migrations704(name) values('obsidian-default-once-v1') on conflict do nothing returning name");
  if(inserted.rowCount)await client.query("update accounts704 set theme='dark'");
  await client.query('commit');
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
