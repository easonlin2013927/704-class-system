import { createServer } from "node:http";
import { hostname, platform, arch, cpus, totalmem, freemem, uptime } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { db, migrate } from "./db.mjs";
import { verify, digest, hash } from "./password.mjs";
import { migrateSchool, schoolRoutes } from "./school.mjs";
import webpush from "web-push";
import {migrateBroadcast,createBroadcast,getBroadcast,processBroadcasts} from './broadcast.mjs';
import {migrateMail,mailAddress,mailStatus,requestMailVerification,confirmMailVerification,processMail} from './mail.mjs';
const origin = process.env.ALLOWED_ORIGIN;
if (!origin) throw new Error("ALLOWED_ORIGIN is required");
const attempts = new Map();
const categories = new Set(["important","academic","activity","general"]);
const themes=new Set(["dark","light","ocean","forest","rose","amber","midnight"]);
function profile(account){return {id:account.id,role:account.role,display_name:account.display_name,must_change_password:account.must_change_password,nickname:account.nickname,theme:account.theme,avatar_url:account.avatar_url,wallpaper_url:account.wallpaper_url};}
function validAvatar(value){
 if(value==="")return true;
 if(typeof value!=="string"||value.length>220000)return false;
 const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)return false;
 const bytes=Buffer.from(match[2],"base64");if(bytes.length>160000||bytes.toString("base64")!==match[2])return false;
 return match[1]==="png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==="jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
}
async function visibleAnnouncement(client,id,user,lock=""){
 const row=(await client.query("select * from announcements704 where id=$1"+lock,[id])).rows[0];
 if(!row)fail(404,"找不到公告");
 if(user.role==="student"&&!["學生","全部人員","全校學生","七年級","八年級","九年級"].includes(row.audience))fail(403,"無法閱讀此公告");return row;
}
async function body(req) {
 let data = ""; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 262144) throw Object.assign(new Error("內容過長"),{status:413}); }
 try { return JSON.parse(data); } catch { throw Object.assign(new Error("JSON 格式錯誤"),{status:400}); }
}
function fail(status, message, code) { throw Object.assign(new Error(message),{status,code}); }
await migrate();
await migrateSchool();
await migrateBroadcast();
await migrateMail();
const generatedPushKeys=webpush.generateVAPIDKeys();
await db.query('insert into school_push_keys(id,public_key,private_key) values(1,$1,$2) on conflict(id) do nothing',[generatedPushKeys.publicKey,generatedPushKeys.privateKey]);
const pushKeys=(await db.query('select public_key,private_key from school_push_keys where id=1')).rows[0];
webpush.setVapidDetails('mailto:admin@example.com',pushKeys.public_key,pushKeys.private_key);
let pushBusy=false;
const pushTimer=setInterval(async()=>{if(pushBusy)return;pushBusy=true;try{const pending=await db.query("select n.id,n.title,s.endpoint,s.subscription,a.role from school_notifications n join accounts704 a on a.id=n.account_id join school_push_subscriptions s on s.account_id=n.account_id and n.created_at>=s.created_at left join school_push_delivery d on d.notification_id=n.id and d.endpoint=s.endpoint left join school_notification_settings ns on ns.account_id=n.account_id where d.notification_id is null and case n.kind when 'announcements' then coalesce(ns.announcements,true) when 'homework' then coalesce(ns.homework,true) when 'points' then coalesce(ns.points,true) when 'feedback' then coalesce(ns.feedback,true) else true end order by n.id limit 25");for(const item of pending.rows){try{await webpush.sendNotification(item.subscription,JSON.stringify({title:'704班級系統',body:item.title,url:item.role==='student'?'./?app=student#/student/login':item.role==='admin'?'./#/admin/login':'./?app=teacher#/teacher/login'}));await db.query('insert into school_push_delivery(notification_id,endpoint) values($1,$2) on conflict do nothing',[item.id,item.endpoint]);}catch(error){if(error.statusCode===404||error.statusCode===410)await db.query('delete from school_push_subscriptions where endpoint=$1',[item.endpoint]);}}}catch{console.error('Push delivery temporarily unavailable');}finally{pushBusy=false;}},15000);
pushTimer.unref();
const broadcastTimer=setInterval(processBroadcasts,3000);broadcastTimer.unref();
const mailTimer=setInterval(processMail,15000);mailTimer.unref();
const server = createServer(async (req,res) => {
 const send = (code,data) => { res.writeHead(code,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(data)); };
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Vary","Origin");
 if (req.headers.origin === origin) {
 res.setHeader("Access-Control-Allow-Origin",origin);
 res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
 res.setHeader("Access-Control-Allow-Methods","GET, POST, PUT, PATCH, DELETE, OPTIONS");
 }
 try {
 if (req.headers.origin && req.headers.origin !== origin) fail(403,"來源不被允許");
 if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
 const path = new URL(req.url,"http://localhost").pathname;
 if (path === "/health" && req.method === "GET") { await db.query("select 1"); return send(200,{status:"ok"}); }
 if (path === "/public/banner" && req.method === "GET") {
 const banner=(await db.query("select enabled,content from login_banner704 where id=1")).rows[0];
 const marquee=(await db.query("select enabled,content from site_marquee704 where id=1")).rows[0];
 return send(200,{enabled:banner.enabled,content:banner.enabled ? banner.content : "",marqueeEnabled:marquee.enabled,marquee:marquee.enabled ? marquee.content : ""});
 }
 if (path === "/login" && req.method === "POST") {
 const data = await body(req);
 const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
 if (!email || typeof data.password !== "string") fail(400,"請輸入有效帳號密碼");
 const record = attempts.get(email);
 if (record && record.until > Date.now() && record.count >= 8) fail(429,"登入次數過多，請十五分鐘後再試");
 const account = (await db.query("select * from accounts704 where email=$1",[email])).rows[0];
 if (!account || !await verify(data.password,account.password_hash)) {
 attempts.set(email,{count:record?.until > Date.now() ? record.count + 1 : 1,until:Date.now()+900000});
 fail(401,"帳號或密碼錯誤");
 }
 attempts.delete(email);
 if(account.disabled) fail(403,"帳戶已停用，請聯絡教師或管理員");
 if (!["teacher","student","admin"].includes(data.portal) || data.portal !== (account.role==="assistant"?"teacher":account.role)) fail(403,"帳號不屬於此登入入口");
 const token = randomBytes(32).toString("hex");
 if(data.remember!==undefined&&typeof data.remember!=='boolean')fail(400,"登入設定格式錯誤");
 await db.query("insert into sessions704 values($1,$2,case when $3 then 'infinity'::timestamptz else now()+interval '8 hours' end)",[digest(token),account.id,data.remember===true]);
 return send(200,{token,remembered:data.remember===true,profile:profile(account)});
 }
 const token = req.headers.authorization?.replace(/^Bearer /,"") || "";
 const user = (await db.query("select a.id,a.role,a.display_name,a.must_change_password from sessions704 s join accounts704 a on a.id=s.account_id where s.token_hash=$1 and s.expires_at>now() and not a.disabled",[digest(token)])).rows[0];
 if (!user) fail(401,"登入已失效，請重新登入");
 if (path === "/logout" && req.method === "POST") { await db.query("delete from sessions704 where token_hash=$1",[digest(token)]); return send(200,{ok:true}); }
 if(path === "/account/password" && req.method === "POST"){
 const value=await body(req);
 if(typeof value.current_password!=="string" || typeof value.new_password!=="string") fail(400,"請填寫目前密碼與新密碼");
 const client=await db.connect();
 try{
 await client.query("begin");
 await client.query("lock table accounts704 in share row exclusive mode");
 const currentSession=(await client.query("select expires_at='infinity'::timestamptz as remembered from sessions704 where token_hash=$1 and account_id=$2 and expires_at>now()",[digest(token),user.id])).rows[0];if(!currentSession) fail(401,"登入已失效，請重新登入");
 const account=(await client.query("select * from accounts704 where id=$1 for update",[user.id])).rows[0];
 if(!account || account.disabled) fail(401,"帳戶已失效，請重新登入");
 if(!await verify(value.current_password,account.password_hash)) fail(400,"目前密碼不正確");
 if(await verify(value.new_password,account.password_hash)) fail(400,"新密碼必須與目前密碼不同");
 await client.query("update accounts704 set password_hash=$1,must_change_password=false where id=$2",[await hash(value.new_password),user.id]);
 await client.query("delete from sessions704 where account_id=$1",[user.id]);
 const nextToken=randomBytes(32).toString("hex");
 await client.query("insert into sessions704 values($1,$2,case when $3 then 'infinity'::timestamptz else now()+interval '8 hours' end)",[digest(nextToken),user.id,currentSession.remembered]);
 await client.query("commit");
 return send(200,{token:nextToken,remembered:currentSession.remembered,profile:profile({...account,must_change_password:false})});
 }catch(error){await client.query("rollback");throw error;}finally{client.release();}
 }
 if(path==="/me"&&req.method==="GET")return send(200,profile((await db.query("select * from accounts704 where id=$1",[user.id])).rows[0]));
 if(user.must_change_password) fail(403,"請先變更密碼","PASSWORD_CHANGE_REQUIRED");
 if(path==='/school/mail-address'&&req.method==='GET')return send(200,await mailAddress(user));
 if(path==='/school/mail-status'&&req.method==='GET')return send(200,await mailStatus(user));
 if(path==='/school/mail-address'&&req.method==='POST'){const b=await body(req);return send(202,await requestMailVerification(user,b.address));}
 if(path==='/school/mail-verify'&&req.method==='POST'){const b=await body(req);return send(200,await confirmMailVerification(user,b.code));}
 if(path==='/school/broadcasts'&&req.method==='POST'){const b=await body(req);return send(202,await createBroadcast(user,b.message));}
 if(path==='/school/broadcast-latest'&&req.method==='GET')return send(200,await getBroadcast(user,'latest'));
 const broadcastMatch=path.match(/^\/school\/broadcasts\/(latest|[0-9a-f-]{36})$/i);
 if(broadcastMatch&&req.method==='GET')return send(200,await getBroadcast(user,broadcastMatch[1]));
 if(path==="/school/wallpaper"&&req.method==="PUT"){
 const value=await body(req),image=value.wallpaper_url;
 if(typeof image!=="string"||image.length>210000||!(image===''||/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)))fail(400,"桌布格式錯誤或檔案過大");
 return send(200,profile((await db.query("update accounts704 set wallpaper_url=$1 where id=$2 returning *",[image,user.id])).rows[0]));
 }
 if(path.startsWith('/school/'))return await schoolRoutes({path,query:new URL(req.url,'http://localhost').searchParams,method:req.method,user,readBody:()=>body(req),send});
 if(path==="/me"&&req.method==="PATCH"){
 const value=await body(req);
 if(typeof value.nickname!=="string"||value.nickname.length>80||!themes.has(value.theme)||!validAvatar(value.avatar_url))fail(400,"個人化資料格式錯誤；頭像請使用 PNG、JPEG 或 WebP，且壓縮後不超過 160 KB");
 return send(200,profile((await db.query("update accounts704 set nickname=$1,theme=$2,avatar_url=$3 where id=$4 returning *",[value.nickname.trim(),value.theme,value.avatar_url,user.id])).rows[0]));
 }
 if (path === "/settings/banner" && ["GET","PUT"].includes(req.method)) {
 if (!["teacher","admin"].includes(user.role)) fail(403,"僅限教師或維護人員設定標語");
 if(req.method==="GET") return send(200,(await db.query("select enabled,content from login_banner704 where id=1")).rows[0]);
 const value=await body(req);
 if(typeof value.enabled!=="boolean" || typeof value.content!=="string" || value.content.length>20000) fail(400,"標語格式錯誤或超過 20000 字元");
 const result=await db.query("update login_banner704 set enabled=$1,content=$2,updated_at=now() where id=1 returning enabled,content",[value.enabled,value.content]);
 return send(200,result.rows[0]);
 }
 if (path === "/settings/marquee" && ["GET","PUT"].includes(req.method)) {
 if (user.role !== "admin") fail(403,"僅限管理員設定跑馬公告");
 if(req.method==="GET") return send(200,(await db.query("select enabled,content from site_marquee704 where id=1")).rows[0]);
 const value=await body(req);
 if(typeof value.enabled!=="boolean" || typeof value.content!=="string" || value.content.length>1000) fail(400,"跑馬公告格式錯誤或超過 1000 字元");
 const result=await db.query("update site_marquee704 set enabled=$1,content=$2,updated_at=now() where id=1 returning enabled,content",[value.enabled,value.content.trim()]);
 return send(200,result.rows[0]);
 }
 if (path === "/admin/accounts" && ["GET","POST"].includes(req.method)) {
 if(!["admin","teacher"].includes(user.role)) fail(403,"僅限教師或管理員管理帳號");
 if(req.method==="GET") return send(200,(await db.query(["teacher","assistant"].includes(user.role) ? "select id,email,display_name,role,disabled,must_change_password from accounts704 where role='student' order by display_name" : "select id,email,display_name,role,disabled,must_change_password from accounts704 order by role,display_name")).rows);
 const value=await body(req);
 const email=typeof value.email==="string"?value.email.trim().toLowerCase():"";
 const name=typeof value.name==="string"&&value.name.trim()?value.name.trim():email;
 if(["teacher","assistant"].includes(user.role) && value.role!=="student") fail(403,"教師只能建立學生帳號");
 if(!email || !["student","teacher","assistant","admin"].includes(value.role) || typeof value.password!=="string" || (value.disabled!==undefined&&typeof value.disabled!=="boolean") || (value.must_change_password!==undefined&&typeof value.must_change_password!=="boolean")) fail(400,"帳號欄位格式錯誤");
 const result=await db.query("insert into accounts704(id,email,display_name,role,password_hash,disabled,must_change_password) values($1,$2,$3,$4,$5,$6,$7) on conflict(email) do nothing returning id,email,display_name,role,disabled,must_change_password",[randomUUID(),email,name,value.role,await hash(value.password),value.disabled??false,value.must_change_password??false]);
 if(!result.rowCount) fail(409,"此帳號已存在");
 return send(201,result.rows[0]);
 }
 const accountMatch=path.match(/^\/admin\/accounts\/([0-9a-f-]{36})$/i);
 if(accountMatch && ["PATCH","DELETE"].includes(req.method)) {
 if(!["admin","teacher"].includes(user.role) || (req.method==="DELETE"&&user.role!=="admin")) fail(403,"沒有管理此帳號的權限");
 const value=req.method==="PATCH"?await body(req):{};
 const client=await db.connect();
 try{
 await client.query("begin");
 await client.query("lock table accounts704 in share row exclusive mode");
 const target=(await client.query("select * from accounts704 where id=$1",[accountMatch[1]])).rows[0];
 if(!target) fail(404,"找不到帳號");
 if(["teacher","assistant"].includes(user.role) && (target.role!=="student" || (value.role!==undefined&&value.role!=="student"))) fail(403,"教師只能編輯學生帳號");
 if(req.method==="DELETE"){
 if(target.id===user.id) fail(400,"不能刪除目前登入的帳號");
 if(target.role==="admin"&&!target.disabled&&Number((await client.query("select count(*)::int as total from accounts704 where role='admin' and not disabled")).rows[0].total)<=1) fail(400,"至少需保留一位啟用中的管理員");
 await client.query("delete from accounts704 where id=$1",[target.id]);
 await client.query("commit");return send(200,{ok:true});
 }
 const email=value.email===undefined?target.email:typeof value.email==="string"?value.email.trim().toLowerCase():"";
 const name=value.name===undefined?target.display_name:typeof value.name==="string"&&value.name.trim()?value.name.trim():email;
 const role=value.role??target.role,disabled=value.disabled??target.disabled,mustChange=value.must_change_password??target.must_change_password;
 if(!email || !["student","teacher","assistant","admin"].includes(role) || typeof disabled!=="boolean" || typeof mustChange!=="boolean" || (value.reset_password!==undefined&&typeof value.reset_password!=="boolean") || (value.reset_password&&typeof value.password!=="string")) fail(400,"帳號欄位格式錯誤");
 if(target.id===user.id && (disabled||role!=="admin"&&user.role==="admin")) fail(400,"不能停用自己或移除自己的管理員身分");
 if(target.role==="admin"&&!target.disabled&&(disabled||role!=="admin")&&Number((await client.query("select count(*)::int as total from accounts704 where role='admin' and not disabled")).rows[0].total)<=1) fail(400,"至少需保留一位啟用中的管理員");
 const result=await client.query("update accounts704 set email=$1,display_name=$2,role=$3,disabled=$4,must_change_password=$5,password_hash=$6 where id=$7 returning id,email,display_name,role,disabled,must_change_password",[email,name,role,disabled,mustChange,value.reset_password?await hash(value.password):target.password_hash,target.id]);
 await client.query("delete from sessions704 where account_id=$1",[target.id]);
 await client.query("commit");
 return send(200,{...result.rows[0],reauthenticate:target.id===user.id});
 }catch(error){await client.query("rollback");if(error.code==="23505") fail(409,"此帳號已存在");throw error;}finally{client.release();}
 }
 if (path === "/admin/status" && req.method === "GET") {
 if (user.role !== "admin") fail(403,"僅限維護人員");
 const result = await db.query("select count(*)::int as total from announcements704");
 const counts=(await db.query("select (select count(*)::int from accounts704) as accounts,(select count(*)::int from countdowns704) as activities")).rows[0];
 return send(200,{status:"ok",announcements:result.rows[0].total,...counts,host:hostname(),platform:platform()+" / "+arch(),cpu:`${cpus()[0]?.model || 'CPU'} / ${cpus().length} 核心`,memory:`${Math.round((totalmem()-freemem())/1048576)} / ${Math.round(totalmem()/1048576)} MB`,uptime:`${Math.floor(uptime()/86400)} 天 ${Math.floor(uptime()%86400/3600)} 小時`,checked_at:new Date().toISOString()});
 }
 if(path === "/countdowns" && req.method === "GET") return send(200,(await db.query("select * from countdowns704 order by target_at")).rows);
 const countdownMatch=path.match(/^\/countdowns\/([0-9a-f-]{36})$/i);
 if(path === "/countdowns" || countdownMatch){
 if(!["teacher","assistant","admin"].includes(user.role)) fail(403,"僅限教師或管理員管理倒數活動");
 if((path === "/countdowns" && req.method === "POST") || (countdownMatch && req.method === "PATCH")){
 const b=await body(req); const date=new Date(b.target_at);
 const end=b.ends_at?new Date(b.ends_at):null;
 if(end&&(!Number.isFinite(end.getTime())||end<date))fail(400,"結束時間不能早於開始時間");
 if(typeof b.title!=="string" || !b.title.trim() || b.title.length>80 || typeof b.target_at!=="string" || !Number.isFinite(date.getTime())) fail(400,"請輸入活動名稱與有效時間");
 const row=countdownMatch ? await db.query("update countdowns704 set title=$1,target_at=$2,ends_at=$3 where id=$4 returning *",[b.title.trim(),date.toISOString(),end?.toISOString()||null,countdownMatch[1]]) : await db.query("insert into countdowns704(id,title,target_at,ends_at) values($1,$2,$3,$4) returning *",[randomUUID(),b.title.trim(),date.toISOString(),end?.toISOString()||null]);
 if(!row.rowCount) fail(404,"找不到活動"); return send(200,row.rows[0]);
 }
 if(countdownMatch && req.method==="DELETE"){await db.query("delete from countdowns704 where id=$1",[countdownMatch[1]]);return send(200,{ok:true});}
 fail(404,"找不到此功能");
 }
 const commentsMatch=path.match(/^\/announcements\/([0-9a-f-]{36})\/comments(?:\/([0-9a-f-]{36}))?$/i);
 if(commentsMatch){
 const announcement=await visibleAnnouncement(db,commentsMatch[1],user);
 const moderates=user.role==="admin"||announcement.author_id===user.id;
 if(req.method==="GET"&&!commentsMatch[2]){
 const rows=announcement.comments_enabled?(await db.query("select c.id,c.content,c.created_at,c.account_id,coalesce(a.display_name,c.author_name) as author,a.nickname as nickname,a.avatar_url as avatar_url from comments704 c left join accounts704 a on a.id=c.account_id where c.announcement_id=$1 order by c.created_at,c.id",[announcement.id])).rows:[];
 return send(200,{enabled:announcement.comments_enabled,comments:rows.map(row=>({...row,can_delete:moderates||row.account_id===user.id}))});
 }
 if(req.method==="POST"&&!commentsMatch[2]){
 const value=await body(req);if(typeof value.content!=="string"||!value.content.trim()||value.content.length>2000)fail(400,"請輸入 1 至 2000 字的評論");
 const client=await db.connect();try{await client.query("begin");const current=await visibleAnnouncement(client,announcement.id,user," for share");if(!current.comments_enabled)fail(403,"公告評論區已關閉");const result=await client.query("insert into comments704(id,announcement_id,account_id,author_name,content) values($1,$2,$3,$4,$5) returning id",[randomUUID(),current.id,user.id,user.display_name,value.content.trim()]);await client.query("commit");return send(201,result.rows[0]);}catch(error){await client.query("rollback");throw error;}finally{client.release();}
 }
 if(req.method==="DELETE"&&commentsMatch[2]){
 const comment=(await db.query("select * from comments704 where id=$1 and announcement_id=$2",[commentsMatch[2],announcement.id])).rows[0];if(!comment)fail(404,"找不到評論");
 if(!moderates&&comment.account_id!==user.id)fail(403,"沒有刪除此評論的權限");
 await db.query("delete from comments704 where id=$1",[comment.id]);return send(200,{ok:true});
 }
 fail(404,"找不到此功能");
 }
 if(path==="/announcements"&&req.method==="GET"){
 const query="select n.*,coalesce(a.display_name,n.author) as author,a.nickname as author_nickname,a.avatar_url as author_avatar from announcements704 n left join accounts704 a on a.id=n.author_id";
 return send(200,(await db.query(query+(user.role==="student"?" where n.audience in ('學生','全部人員','全校學生','七年級','八年級','九年級')":"")+" order by n.pinned desc,n.date desc")).rows);
 }
 if(!["teacher","assistant","admin"].includes(user.role))fail(403,"僅限教師或管理員管理公告");
 const match=path.match(/^\/announcements\/([0-9a-f-]{36})$/i);
 if((path==="/announcements"&&req.method==="POST")||(match&&req.method==="PATCH")){
 const b=await body(req);
 if(typeof b.title!=="string"||!b.title.trim()||b.title.trim().length>80||!categories.has(b.category)||typeof b.content!=="string"||!b.content.trim()||!["學生","教師","全部人員"].includes(b.audience)||typeof b.pinned!=="boolean"||(b.comments_enabled!==undefined&&typeof b.comments_enabled!=="boolean"))fail(400,"公告欄位不完整或格式錯誤");
 if(match){
 const client=await db.connect();try{await client.query("begin");const current=await visibleAnnouncement(client,match[1],user," for update");const enabled=b.comments_enabled??current.comments_enabled;
 if(enabled!==current.comments_enabled&&user.role!=="admin"&&current.author_id!==user.id)fail(403,"只有公告張貼者或管理員可以切換評論區");
 const result=await client.query("update announcements704 set title=$1,category=$2,audience=$3,pinned=$4,content=$5,comments_enabled=$6 where id=$7 returning *",[b.title.trim(),b.category,b.audience,b.pinned,b.content,enabled,current.id]);await client.query("commit");return send(200,result.rows[0]);}catch(error){await client.query("rollback");throw error;}finally{client.release();}
 }
 return send(200,(await db.query("insert into announcements704(id,title,category,author,author_id,audience,pinned,content,comments_enabled) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",[randomUUID(),b.title.trim(),b.category,user.display_name,user.id,b.audience,b.pinned,b.content,b.comments_enabled??false])).rows[0]);
 }
 if(match&&req.method==="DELETE"){
 const result=await db.query("delete from announcements704 where id=$1 returning id",[match[1]]);if(!result.rowCount)fail(404,"找不到公告");return send(200,{ok:true});
 }
 fail(404,"找不到此功能");
 } catch(error) {
 if (!error.status) console.error("API/database operation failed");
 send(error.status || 503,{message:error.status ? error.message : "服務暫時無法使用，請稍後再試",...(error.code==="PASSWORD_CHANGE_REQUIRED"?{code:error.code}:{})});
 }
});
server.requestTimeout=30000;
server.headersTimeout=15000;
server.listen(7040,"0.0.0.0",()=>console.log("704 API ready on port 7040"));
const cleanup=setInterval(()=>{ for(const [key,value] of attempts) if(value.until<Date.now()) attempts.delete(key); db.query("delete from sessions704 where expires_at<now()").catch(()=>{}); },60000);
cleanup.unref();
