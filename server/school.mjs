import { randomUUID } from 'node:crypto';
import { db } from './db.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text=(value,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(400,`請填寫內容（最多 ${max} 字）`);return value.trim();};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(400,'日期格式錯誤');return value;};
const staff=user=>['teacher','assistant','admin'].includes(user.role);
const teacher=user=>['teacher','admin'].includes(user.role);
const requireRole=(allowed)=>{if(!allowed)fail(403,'沒有使用此功能的權限');};
async function transaction(action){const c=await db.connect();try{await c.query('begin');const result=await action(c);await c.query('commit');return result;}catch(error){await c.query('rollback');throw error;}finally{c.release();}}
async function students(ids,c=db){if(!Array.isArray(ids)||!ids.length||ids.some(id=>!uuid(id)))fail(400,'請選擇學生');const unique=[...new Set(ids)];const found=await c.query("select id from accounts704 where id=any($1::uuid[]) and role='student' and not disabled",[unique]);if(found.rowCount!==unique.length)fail(400,'選擇的學生不存在或已停用');return unique;}
async function membership(id,user,c=db){if(!uuid(id))fail(400,'交談格式錯誤');const row=(await c.query('select r.* from school_rooms r join school_members m on m.room_id=r.id where r.id=$1 and m.account_id=$2',[id,user.id])).rows[0];if(!row)fail(403,'你不是此交談的成員');return row;}
async function chatOpen(c=db){const row=(await c.query('select enabled from school_chat_settings where id=1')).rows[0];if(!row.enabled)fail(403,'管理員目前已停用聊天');}
export async function migrateSchool(){await db.query(`
 alter table countdowns704 add column if not exists ends_at timestamptz;
 create table if not exists school_subjects(id uuid primary key,name text not null unique,active boolean not null default true);
 create table if not exists school_grades(id uuid primary key,student_id uuid not null references accounts704(id) on delete cascade,author_id uuid references accounts704(id) on delete set null,subject_id uuid not null references school_subjects(id),title text not null,score numeric not null,grade_day date not null,created_at timestamptz not null default now());
 create table if not exists school_homework(id uuid primary key,subject_id uuid not null references school_subjects(id),author_id uuid references accounts704(id) on delete set null,title text not null,work_day date not null,due_on date not null,recipients uuid[],created_at timestamptz not null default now());
 create table if not exists school_checks(homework_id uuid references school_homework(id) on delete cascade,student_id uuid references accounts704(id) on delete cascade,done boolean not null default false,updated_at timestamptz not null default now(),primary key(homework_id,student_id));
 create table if not exists school_records(id uuid primary key,kind text not null check(kind in ('missing','feedback')),student_id uuid not null references accounts704(id) on delete cascade,author_id uuid references accounts704(id) on delete set null,subject_id uuid references school_subjects(id),title text not null,content text not null default '',record_day date not null,due_on date,resolved boolean not null default false,created_at timestamptz not null default now());
 drop table if exists school_plans;
 create table if not exists school_chat_settings(id integer primary key check(id=1),enabled boolean not null default true);
 insert into school_chat_settings(id) values(1) on conflict do nothing;
 create table if not exists school_rooms(id uuid primary key,title text not null,kind text not null check(kind in ('direct','group')),creator_id uuid references accounts704(id) on delete set null,direct_key text unique,created_at timestamptz not null default now());
 create table if not exists school_members(room_id uuid references school_rooms(id) on delete cascade,account_id uuid references accounts704(id) on delete cascade,primary key(room_id,account_id));
 create table if not exists school_messages(id uuid primary key,room_id uuid not null references school_rooms(id) on delete cascade,author_id uuid references accounts704(id) on delete set null,author_name text not null,content text not null,deleted boolean not null default false,created_at timestamptz not null default now());
 create index if not exists school_message_room on school_messages(room_id,created_at);
 create table if not exists school_reports(id uuid primary key,message_id uuid not null references school_messages(id) on delete cascade,reporter_id uuid references accounts704(id) on delete set null,reason text not null,resolved boolean not null default false,created_at timestamptz not null default now());
 alter table school_reports add column if not exists report_type text not null default 'message';
 alter table school_reports add column if not exists target_id uuid references accounts704(id) on delete set null;
 alter table school_reports alter column message_id drop not null;
 alter table school_reports add column if not exists result text not null default '';
 alter table accounts704 add column if not exists chat_muted boolean not null default false;
 create table if not exists school_points(id uuid primary key,student_id uuid not null references accounts704(id) on delete cascade,author_id uuid references accounts704(id) on delete set null,amount integer not null,reason text not null,created_at timestamptz not null default now());
 create table if not exists school_attachments(id uuid primary key,announcement_id uuid not null references announcements704(id) on delete cascade,name text not null,owner_id uuid references accounts704(id) on delete set null,bytes bytea not null default ''::bytea,complete boolean not null default false,created_at timestamptz not null default now());
 create table if not exists school_notifications(id bigint generated always as identity primary key,account_id uuid not null references accounts704(id) on delete cascade,kind text not null,title text not null,created_at timestamptz not null default now(),read_at timestamptz);
 create table if not exists school_notification_settings(account_id uuid primary key references accounts704(id) on delete cascade,announcements boolean not null default true,homework boolean not null default true,points boolean not null default true,feedback boolean not null default true);
 create table if not exists school_push_keys(id integer primary key check(id=1),public_key text not null,private_key text not null);
 create table if not exists school_push_subscriptions(endpoint text primary key,account_id uuid not null references accounts704(id) on delete cascade,subscription jsonb not null,created_at timestamptz not null default now());
 create table if not exists school_push_delivery(notification_id bigint references school_notifications(id) on delete cascade,endpoint text references school_push_subscriptions(endpoint) on delete cascade,delivered_at timestamptz not null default now(),primary key(notification_id,endpoint));
 create index if not exists school_notifications_account on school_notifications(account_id,created_at desc);
 create or replace function school_notify_event() returns trigger language plpgsql as $$
 begin
  if tg_table_name='announcements704' then
   insert into school_notifications(account_id,kind,title) select a.id,'announcements',new.title from accounts704 a where not a.disabled and a.id is distinct from new.author_id and (new.audience='全部人員' or (new.audience='學生' and a.role='student') or (new.audience='教師' and a.role in ('teacher','assistant','admin')));
  elsif tg_table_name='school_homework' then
   insert into school_notifications(account_id,kind,title) select a.id,'homework',new.title from accounts704 a where a.role='student' and not a.disabled and (new.recipients is null or a.id=any(new.recipients));
  elsif tg_table_name='school_points' then
   insert into school_notifications(account_id,kind,title) select new.student_id,'points',case when new.amount>0 then '獲得加分：' else '收到扣分：' end || new.amount::text;
  elsif tg_table_name='school_records' then
   insert into school_notifications(account_id,kind,title) select new.student_id,'feedback',new.title;
  elsif tg_table_name='school_grades' then
   insert into school_notifications(account_id,kind,title) select new.student_id,'grades','教師新增了一筆成績' where new.author_id is distinct from new.student_id and exists(select 1 from accounts704 where id=new.author_id and role in ('teacher','admin'));
  end if;return new;
 end $$;
 drop trigger if exists school_notify_announcement on announcements704;
 create trigger school_notify_announcement after insert on announcements704 for each row execute function school_notify_event();
 drop trigger if exists school_notify_homework on school_homework;
 create trigger school_notify_homework after insert on school_homework for each row execute function school_notify_event();
 drop trigger if exists school_notify_points on school_points;
 create trigger school_notify_points after insert on school_points for each row execute function school_notify_event();
 drop trigger if exists school_notify_records on school_records;
 create trigger school_notify_records after insert on school_records for each row execute function school_notify_event();
 drop trigger if exists school_notify_grade on school_grades;
 create trigger school_notify_grade after insert on school_grades for each row execute function school_notify_event();
 create index if not exists school_records_student on school_records(student_id,record_day);
 `);}
export async function schoolRoutes({path,query,method,user,readBody,send}){
 const tail=path.slice('/school/'.length).split('/');const [resource,id,action]=tail;
 if(resource==='push-key'&&method==='GET'){const key=(await db.query('select public_key from school_push_keys where id=1')).rows[0];if(!key)fail(503,'推播服務尚未啟用');return send(200,key);}
 if(resource==='push-subscription'){
  if(method==='POST'){const b=await readBody();let endpoint;try{endpoint=new URL(b.endpoint);}catch{fail(400,'推播訂閱格式錯誤');}const host=endpoint.hostname;if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com'))||b.endpoint.length>2000||typeof b.keys?.p256dh!=='string'||typeof b.keys?.auth!=='string')fail(400,'推播訂閱格式錯誤');await db.query('insert into school_push_subscriptions(endpoint,account_id,subscription) values($1,$2,$3) on conflict(endpoint) do update set account_id=$2,subscription=$3,created_at=now()',[b.endpoint,user.id,b]);return send(200,{ok:true});}
  if(method==='DELETE'){const b=await readBody();if(typeof b.endpoint!=='string')fail(400,'訂閱格式錯誤');await db.query('delete from school_push_subscriptions where endpoint=$1 and account_id=$2',[b.endpoint,user.id]);return send(200,{ok:true});}
 }
 if(resource==='notification-settings'){
  if(method==='GET'){const row=(await db.query('select announcements,homework,points,feedback from school_notification_settings where account_id=$1',[user.id])).rows[0];return send(200,row||{announcements:true,homework:true,points:true,feedback:true});}
  if(method==='PUT'){const b=await readBody();if(!['announcements','homework','points','feedback'].every(k=>typeof b[k]==='boolean'))fail(400,'通知設定格式錯誤');return send(200,(await db.query('insert into school_notification_settings(account_id,announcements,homework,points,feedback) values($1,$2,$3,$4,$5) on conflict(account_id) do update set announcements=$2,homework=$3,points=$4,feedback=$5 returning announcements,homework,points,feedback',[user.id,b.announcements,b.homework,b.points,b.feedback])).rows[0]);}
 }
 if(resource==='notifications'){
  if(method==='GET')return send(200,(await db.query('select id,kind,title,created_at,read_at from school_notifications where account_id=$1 order by id desc limit 100',[user.id])).rows);
  if(method==='PATCH'&&!id){await db.query('update school_notifications set read_at=now() where account_id=$1 and read_at is null',[user.id]);return send(200,{ok:true});}
 }
 if(resource==='attachments'){
  const visible=async post=>{if(!uuid(post))fail(400,'公告格式錯誤');const a=(await db.query('select * from announcements704 where id=$1',[post])).rows[0];if(!a||(user.role==='student'&&!['學生','全部人員','全校學生','七年級','八年級','九年級'].includes(a.audience)))fail(404,'找不到公告');return a;};
  if(method==='GET'&&!id){const post=query.get('post');await visible(post);return send(200,(await db.query('select id,name,octet_length(bytes) as size from school_attachments where announcement_id=$1 and complete order by created_at',[post])).rows);}
  if(method==='POST'&&!id){requireRole(staff(user));const b=await readBody();await visible(b.announcement_id);return send(201,(await db.query('insert into school_attachments(id,announcement_id,name,owner_id) values($1,$2,$3,$4) returning id',[randomUUID(),b.announcement_id,text(b.name,255),user.id])).rows[0]);}
  if(uuid(id)){const item=(await db.query('select * from school_attachments where id=$1',[id])).rows[0];if(!item)fail(404,'找不到附件');await visible(item.announcement_id);
   if(method==='GET'){if(!item.complete)fail(404,'附件尚未完成');return send(200,{name:item.name,data:item.bytes.toString('base64')});}
   requireRole(staff(user));if(item.owner_id!==user.id&&user.role!=='admin')fail(403,'沒有管理此附件的權限');
   if(method==='DELETE'){await db.query('delete from school_attachments where id=$1',[id]);return send(200,{ok:true});}
   if(method==='PATCH'){const b=await readBody();if(typeof b.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data)||typeof b.complete!=='boolean')fail(400,'附件格式錯誤');const chunk=Buffer.from(b.data,'base64');if(chunk.length>100000)fail(400,'上傳區塊過大');const result=await db.query('update school_attachments set bytes=bytes || $1::bytea,complete=$2 where id=$3 and not complete and octet_length(bytes)+$4<=200000 returning id',[chunk,b.complete,id,chunk.length]);if(!result.rowCount)fail(400,'附件超過 200 KB 或已完成');return send(200,result.rows[0]);}
  }
 }
 if(resource==='points'){
  if(method==='GET')return send(200,(await db.query("select a.id,a.display_name,a.nickname,coalesce(sum(p.amount),0)::integer as points from accounts704 a left join school_points p on p.student_id=a.id where a.role='student' and not a.disabled group by a.id order by points desc,a.display_name")).rows);
  requireRole(teacher(user));if(method==='POST'){const b=await readBody(),selected=await students(Array.isArray(b.students)?b.students:[b.student_id]);if(!Number.isInteger(b.amount)||b.amount===0||Math.abs(b.amount)>10000||typeof (b.reason??'')!=='string'||(b.reason??'').length>500)fail(400,'請選擇學生並輸入有效分數');return send(201,await transaction(async c=>{const rows=[];for(const student of selected)rows.push((await c.query('insert into school_points(id,student_id,author_id,amount,reason) values($1,$2,$3,$4,$5) returning *',[randomUUID(),student,user.id,b.amount,(b.reason??'').trim()])).rows[0]);return rows;}));}
 }
 if(resource==='point-log'&&method==='GET'){requireRole(teacher(user));return send(200,(await db.query('select p.*,a.display_name as student,t.display_name as author from school_points p join accounts704 a on a.id=p.student_id left join accounts704 t on t.id=p.author_id order by p.created_at desc limit 500')).rows);}
 if(resource==='chat-stats'){
  requireRole(user.role==='admin');
  if(method==='GET')return send(200,(await db.query("select a.id,a.display_name,a.nickname,a.chat_muted,count(m.id)::integer as count from accounts704 a left join school_messages m on m.author_id=a.id and m.created_at >= date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei' where a.role='student' and not a.disabled group by a.id order by count desc,a.display_name")).rows);
  if(method==='PATCH'&&uuid(id)){const b=await readBody();if(typeof b.muted!=='boolean')fail(400,'設定格式錯誤');const r=await db.query("update accounts704 set chat_muted=$1 where id=$2 and role='student' returning id,chat_muted",[b.muted,id]);if(!r.rowCount)fail(404,'找不到學生');return send(200,r.rows[0]);}
 }
 if(resource==='grades'){
  requireRole(teacher(user)||user.role==='student');
  if(method==='GET')return send(200,(await db.query(`select g.*,a.display_name as student,s.name as subject from school_grades g join accounts704 a on a.id=g.student_id join school_subjects s on s.id=g.subject_id ${user.role==='student'?'where g.student_id=$1':''} order by g.grade_day desc,g.created_at desc`,user.role==='student'?[user.id]:[])).rows);
  if(method==='POST'){const b=await readBody(),student=user.role==='student'?user.id:b.student_id;if(!uuid(student)||!uuid(b.subject_id)||typeof b.score!=='number'||!Number.isFinite(b.score))fail(400,'成績資料格式錯誤');await students([student]);return send(201,(await db.query('insert into school_grades(id,student_id,author_id,subject_id,title,score,grade_day) values($1,$2,$3,$4,$5,$6,$7) returning *',[randomUUID(),student,user.id,b.subject_id,text(b.title,200),b.score,date(b.grade_day)])).rows[0]);}
  if(method==='DELETE'&&uuid(id)){const r=await db.query(`delete from school_grades where id=$1 ${user.role==='student'?'and student_id=$2 and author_id=$2':''} returning id`,user.role==='student'?[id,user.id]:[id]);if(!r.rowCount)fail(404,'找不到可刪除的成績');return send(200,{ok:true});}
 }
 if(resource==='admin-rooms'&&method==='GET'){
  requireRole(user.role==='admin');
  if(!id)return send(200,(await db.query(`select r.*, (select coalesce(json_agg(a.display_name),'[]') from school_members m join accounts704 a on a.id=m.account_id where m.room_id=r.id) as members from school_rooms r order by r.created_at desc`)).rows);
  if(uuid(id)&&action==='messages')return send(200,(await db.query('select id,author_name,content,deleted,created_at from school_messages where room_id=$1 order by created_at,id',[id])).rows);
 }
 if(resource==='students'&&method==='GET'){requireRole(staff(user));return send(200,(await db.query("select id,display_name,nickname from accounts704 where role='student' and not disabled order by display_name")).rows);}
 if(resource==='subjects'){
  if(method==='GET')return send(200,(await db.query('select * from school_subjects order by name')).rows);
  requireRole(user.role==='admin');
  if(method==='POST'){const b=await readBody();try{return send(201,(await db.query('insert into school_subjects(id,name) values($1,$2) returning *',[randomUUID(),text(b.name,80)])).rows[0]);}catch(e){if(e.code==='23505')fail(409,'科目名稱已存在');throw e;}}
  if(method==='PATCH'&&uuid(id)){const b=await readBody();if(typeof b.active!=='boolean')fail(400,'請選擇啟用狀態');try{const r=await db.query('update school_subjects set name=$1,active=$2 where id=$3 returning *',[text(b.name,80),b.active,id]);if(!r.rowCount)fail(404,'找不到科目');return send(200,r.rows[0]);}catch(e){if(e.code==='23505')fail(409,'科目名稱已存在');throw e;}}
 }
 if(resource==='homework'){
  if(method==='GET')return send(200,(await db.query(`select h.*,s.name as subject,a.display_name as author,coalesce(c.done,false) as done from school_homework h join school_subjects s on s.id=h.subject_id left join accounts704 a on a.id=h.author_id left join school_checks c on c.homework_id=h.id and c.student_id=$1 ${user.role==='student'?'where h.recipients is null or $1=any(h.recipients)':''} order by h.work_day desc,h.created_at`,[user.id])).rows);
  if(method==='PATCH'&&uuid(id)&&action==='check'){
   requireRole(user.role==='student');const b=await readBody();if(typeof b.done!=='boolean')fail(400,'勾選格式錯誤');
   return send(200,await transaction(async c=>{const h=(await c.query('select * from school_homework where id=$1 for share',[id])).rows[0];if(!h||(h.recipients&&!h.recipients.includes(user.id)))fail(404,'找不到你的作業');return (await c.query('insert into school_checks(homework_id,student_id,done) values($1,$2,$3) on conflict(homework_id,student_id) do update set done=$3,updated_at=now() returning *',[id,user.id,b.done])).rows[0];}));
  }
  requireRole(staff(user));
  if(method==='POST'){
   const b=await readBody();if(!uuid(b.subject_id)||!Array.isArray(b.items)||!b.items.length||b.items.length>50)fail(400,'請選擇科目並新增 1 至 50 項作業');
   return send(201,await transaction(async c=>{if(!(await c.query('select id from school_subjects where id=$1 and active for share',[b.subject_id])).rowCount)fail(400,'科目未啟用');const recipients=b.recipients===null?null:await students(b.recipients,c);const day=date(b.work_day),rows=[];for(const item of b.items){const due=date(item.due_on);if(due<day)fail(400,'截止日期不能早於登錄日期');rows.push((await c.query('insert into school_homework(id,subject_id,author_id,title,work_day,due_on,recipients) values($1,$2,$3,$4,$5,$6,$7) returning *',[randomUUID(),b.subject_id,user.id,text(item.title,1000),day,due,recipients])).rows[0]);}return rows;}));
  }
  if(uuid(id)&&(method==='PATCH'||method==='DELETE'))return send(200,await transaction(async c=>{const h=(await c.query('select * from school_homework where id=$1 for update',[id])).rows[0];if(!h)fail(404,'找不到作業');requireRole(teacher(user)||h.author_id===user.id);if(method==='DELETE'){await c.query('delete from school_homework where id=$1',[id]);return {ok:true};}const b=await readBody(),due=date(b.due_on);if(due<new Date(h.work_day).toISOString().slice(0,10))fail(400,'截止日期不能早於登錄日期');return (await c.query('update school_homework set title=$1,due_on=$2 where id=$3 returning *',[text(b.title,1000),due,id])).rows[0];}));
 }
 if(resource==='records'){
  if(method==='GET'){requireRole(teacher(user)||user.role==='student');return send(200,(await db.query(`select r.*,a.display_name as student,s.name as subject,t.display_name as author from school_records r join accounts704 a on a.id=r.student_id left join school_subjects s on s.id=r.subject_id left join accounts704 t on t.id=r.author_id ${user.role==='student'?'where r.student_id=$1':''} order by r.record_day desc,r.created_at desc`,user.role==='student'?[user.id]:[])).rows);}
  requireRole(teacher(user));
  if(method==='POST'){const b=await readBody();if(!['missing','feedback'].includes(b.kind))fail(400,'紀錄類型錯誤');const subject=b.subject_id||null;if(subject&&!uuid(subject))fail(400,'科目格式錯誤');const content=b.content==null?'':typeof b.content==='string'&&b.content.length<=5000?b.content:fail(400,'評語最多 5000 字');return send(201,await transaction(async c=>{const selected=await students(b.students,c),rows=[];for(const student of selected)rows.push((await c.query('insert into school_records(id,kind,student_id,author_id,subject_id,title,content,record_day,due_on) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[randomUUID(),b.kind,student,user.id,subject,text(b.title,200),content,date(b.record_day),b.due_on?date(b.due_on):null])).rows[0]);return rows;}));}
  if(uuid(id)&&method==='PATCH'){const b=await readBody();if(typeof b.resolved!=='boolean')fail(400,'請設定補交狀態');const row=await db.query('update school_records set resolved=$1 where id=$2 returning *',[b.resolved,id]);if(!row.rowCount)fail(404,'找不到紀錄');return send(200,row.rows[0]);}
  if(uuid(id)&&method==='DELETE'){await db.query('delete from school_records where id=$1',[id]);return send(200,{ok:true});}
 }
 if(resource==='chat-settings'){
  if(method==='GET')return send(200,(await db.query('select enabled from school_chat_settings where id=1')).rows[0]);
  requireRole(user.role==='admin');if(method==='PATCH'){const b=await readBody();if(typeof b.enabled!=='boolean')fail(400,'設定格式錯誤');return send(200,(await db.query('update school_chat_settings set enabled=$1 where id=1 returning enabled',[b.enabled])).rows[0]);}
 }
 if(resource==='people'&&method==='GET'){requireRole(user.role==='student');return send(200,(await db.query("select id,display_name,nickname from accounts704 where role='student' and not disabled order by display_name")).rows);}
 if(resource==='rooms'){
  requireRole(user.role==='student');
  if(method==='GET'&&!id)return send(200,(await db.query(`select r.*, (select coalesce(json_agg(json_build_object('id',a.id,'name',a.display_name,'nickname',a.nickname)),'[]') from school_members x join accounts704 a on a.id=x.account_id where x.room_id=r.id) as members from school_rooms r join school_members m on m.room_id=r.id where m.account_id=$1 order by r.created_at desc`,[user.id])).rows);
  if(method==='POST'&&!id){const b=await readBody();if(!['direct','group'].includes(b.kind))fail(400,'請選擇私訊或群組');return send(201,await transaction(async c=>{await chatOpen(c);const members=await students([...new Set([user.id,...(Array.isArray(b.members)?b.members:[])])],c);if(members.length<2||(b.kind==='direct'&&members.length!==2))fail(400,'請選擇交談對象');const key=b.kind==='direct'?[...members].sort().join(':'):null;const title=b.kind==='group'?text(b.title,80):'私訊';const row=(await c.query('insert into school_rooms(id,title,kind,creator_id,direct_key) values($1,$2,$3,$4,$5) on conflict(direct_key) do update set direct_key=excluded.direct_key returning *',[randomUUID(),title,b.kind,user.id,key])).rows[0];for(const member of members)await c.query('insert into school_members values($1,$2) on conflict do nothing',[row.id,member]);return row;}));}
  if(uuid(id)&&action==='members'&&method==='POST'){const b=await readBody();return send(200,await transaction(async c=>{await chatOpen(c);const room=await membership(id,user,c);if(room.kind!=='group'||room.creator_id!==user.id)fail(403,'只有群組建立者可加入成員');for(const member of await students(b.members,c))await c.query('insert into school_members values($1,$2) on conflict do nothing',[id,member]);return {ok:true};}));}
  if(uuid(id)&&action==='leave'&&method==='POST'){const room=await membership(id,user);if(room.kind==='direct')fail(400,'私訊無須退出');await db.query('delete from school_members where room_id=$1 and account_id=$2',[id,user.id]);return send(200,{ok:true});}
  if(uuid(id)&&action==='messages'){
   await membership(id,user);
   if(method==='GET'){const before=query?.get('before')||null;if(before&&!uuid(before))fail(400,'訊息游標錯誤');return send(200,(await db.query(`select m.id,m.author_id,m.author_name,case when m.deleted then '此訊息已移除' else m.content end as content,m.deleted,m.created_at,a.nickname from school_messages m left join accounts704 a on a.id=m.author_id where room_id=$1 and ($2::uuid is null or (m.created_at,m.id)<(select created_at,id from school_messages where id=$2 and room_id=$1)) order by m.created_at desc,m.id desc limit 200`,[id,before])).rows.reverse());}
   if(method==='POST'){const b=await readBody();return send(201,await transaction(async c=>{await chatOpen(c);await membership(id,user,c);if((await c.query('select chat_muted from accounts704 where id=$1',[user.id])).rows[0].chat_muted)fail(403,'你目前無法傳送訊息，請聯絡管理員');return (await c.query('insert into school_messages(id,room_id,author_id,author_name,content) values($1,$2,$3,$4,$5) returning id',[randomUUID(),id,user.id,user.display_name,text(b.content,5000)])).rows[0];}));}
  }
 }
 if(resource==='messages'&&uuid(id)){
  const msg=(await db.query('select * from school_messages where id=$1',[id])).rows[0];if(!msg)fail(404,'找不到訊息');await membership(msg.room_id,user);
  if(method==='DELETE'){requireRole(msg.author_id===user.id);await db.query("update school_messages set deleted=true,content='' where id=$1",[id]);return send(200,{ok:true});}
  if(action==='report'&&method==='POST'){const b=await readBody();if(msg.deleted||!msg.author_id)fail(400,'此項目已無法檢舉');return send(201,await transaction(async c=>{const row=(await c.query('insert into school_reports(id,message_id,reporter_id,reason,report_type,target_id) values($1,$2,$3,$4,$5,$6) returning id',[randomUUID(),id,user.id,text(b.reason,1000),'message',msg.author_id])).rows[0];await c.query("insert into school_notifications(account_id,kind,title) values($1,'report','我們已受理你的檢舉')",[user.id]);return row;}));}
 }
 if(resource==='reports'){
  if(method==='POST'&&!id){requireRole(user.role==='student');const b=await readBody();if(!['avatar','nickname','other'].includes(b.type))fail(400,'請選擇檢舉類型');if(b.type!=='other')await students([b.target_id]);return send(201,await transaction(async c=>{const row=(await c.query('insert into school_reports(id,reporter_id,reason,report_type,target_id) values($1,$2,$3,$4,$5) returning id',[randomUUID(),user.id,text(b.reason,1000),b.type,b.type==='other'?null:b.target_id])).rows[0];await c.query("insert into school_notifications(account_id,kind,title) values($1,'report','我們已受理你的檢舉')",[user.id]);return row;}));}
  requireRole(teacher(user));
  if(method==='GET')return send(200,(await db.query("select r.*,m.content,coalesce(m.author_name,a.display_name,'其他檢舉') as author_name,m.deleted,a.nickname,a.avatar_url from school_reports r left join school_messages m on m.id=r.message_id left join accounts704 a on a.id=r.target_id order by r.created_at desc")).rows);
  if(method==='PATCH'&&uuid(id)){const b=await readBody();if(typeof b.remove_message!=='boolean')fail(400,'處理格式錯誤');const result=text(b.result,1000);return send(200,await transaction(async c=>{const report=(await c.query('update school_reports set resolved=true,result=$2 where id=$1 and not resolved returning *',[id,result])).rows[0];if(!report)fail(404,'找不到待處理的檢舉');if(b.remove_message){if(report.report_type==='message')await c.query("update school_messages set deleted=true,content='' where id=$1",[report.message_id]);else if(report.report_type==='nickname')await c.query("update accounts704 set nickname='' where id=$1",[report.target_id]);else if(report.report_type==='avatar')await c.query("update accounts704 set avatar_url='' where id=$1",[report.target_id]);}if(report.reporter_id)await c.query("insert into school_notifications(account_id,kind,title) values($1,'report',$2)",[report.reporter_id,'我們已核查完你提交的檢舉，結果如下：'+result]);return {ok:true};}));}
 }
 fail(404,'找不到此功能');
}
