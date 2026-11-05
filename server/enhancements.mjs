import { randomUUID } from 'node:crypto';
import { db } from './db.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const text=(value,max=2000,required=true)=>{if(typeof value!=='string'||(required&&!value.trim())||value.length>max)fail(400,'輸入內容格式錯誤');return value.trim();};
const staff=user=>['teacher','assistant','admin'].includes(user.role);
const defaults={
 admin:{publish:true,homework:true,grades:true,records:true,reports:true,accounts:true,broadcast:true,chat_moderation:true},
 teacher:{publish:true,homework:true,grades:true,records:true,reports:true,accounts:true,broadcast:false,chat_moderation:false},
 assistant:{publish:true,homework:true,grades:false,records:false,reports:false,accounts:false,broadcast:false,chat_moderation:false},
 student:{publish:false,homework:false,grades:false,records:false,reports:false,accounts:false,broadcast:false,chat_moderation:false}
};
export const permissionKeys=Object.keys(defaults.admin);

export async function migrateEnhancements(){await db.query(`
 create table if not exists account_permissions704(account_id uuid primary key references accounts704(id) on delete cascade,permissions jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now());
 create table if not exists account_preferences704(account_id uuid primary key references accounts704(id) on delete cascade,favorites jsonb not null default '[]'::jsonb,updated_at timestamptz not null default now());
 alter table announcements704 add column if not exists workflow_status text not null default 'published';
 alter table announcements704 add column if not exists publish_at timestamptz;
 alter table announcements704 add column if not exists expires_at timestamptz;
 create table if not exists announcement_reads704(announcement_id uuid references announcements704(id) on delete cascade,account_id uuid references accounts704(id) on delete cascade,read_at timestamptz not null default now(),primary key(announcement_id,account_id));
 alter table school_homework add column if not exists instructions text not null default '';
 alter table school_homework add column if not exists resource_url text not null default '';
 alter table school_homework add column if not exists submission_mode text not null default 'check';
 create table if not exists school_homework_submissions(homework_id uuid references school_homework(id) on delete cascade,student_id uuid references accounts704(id) on delete cascade,status text not null default 'submitted',note text not null default '',link text not null default '',submitted_at timestamptz not null default now(),reviewed_at timestamptz,primary key(homework_id,student_id));
 alter table school_grades add column if not exists max_score numeric not null default 100;
 alter table school_grades add column if not exists weight numeric not null default 1;
 alter table school_grades add column if not exists visible boolean not null default true;
 alter table school_notification_settings add column if not exists digest_frequency text not null default 'immediate';
 alter table sessions704 add column if not exists session_id uuid not null default gen_random_uuid();
 alter table sessions704 add column if not exists created_at timestamptz not null default now();
 alter table sessions704 add column if not exists last_seen timestamptz not null default now();
 alter table sessions704 add column if not exists user_agent text not null default '';
 create unique index if not exists sessions704_session_id on sessions704(session_id);
 create table if not exists school_chat_blocks(blocker_id uuid references accounts704(id) on delete cascade,blocked_id uuid references accounts704(id) on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
 alter table school_messages add column if not exists edited_at timestamptz;
 create table if not exists school_message_attachments(id uuid primary key,message_id uuid not null references school_messages(id) on delete cascade,owner_id uuid references accounts704(id) on delete set null,name text not null,mime_type text not null default 'application/octet-stream',declared_size bigint not null,bytes bytea not null default ''::bytea,complete boolean not null default false,created_at timestamptz not null default now());
 create index if not exists announcement_reads_account on announcement_reads704(account_id,read_at desc);
 create index if not exists homework_submissions_student on school_homework_submissions(student_id,submitted_at desc);
 create or replace function school_notify_announcement_workflow() returns trigger language plpgsql as $$
 begin
  if new.workflow_status='published' and coalesce(new.publish_at,new.date)<=now() and (tg_op='INSERT' or old.workflow_status is distinct from new.workflow_status) then
   insert into school_notifications(account_id,kind,title)
   select a.id,'announcements',new.title from accounts704 a
   where not a.disabled and a.id is distinct from new.author_id
   and (new.audience='全部人員' or (new.audience='學生' and a.role='student') or (new.audience='教師' and a.role in ('teacher','assistant','admin')));
  end if;
  return new;
 end $$;
 drop trigger if exists school_notify_announcement on announcements704;
 create trigger school_notify_announcement after insert or update of workflow_status on announcements704 for each row execute function school_notify_announcement_workflow();
 `);}

export async function publishScheduledAnnouncements(){
 await db.query("update announcements704 set workflow_status='published' where workflow_status='scheduled' and publish_at<=now() and (expires_at is null or expires_at>now())");
}

export async function permissionsFor(user){
 const custom=(await db.query('select permissions from account_permissions704 where account_id=$1',[user.id])).rows[0]?.permissions||{};
 return {...defaults[user.role],...custom};
}

export async function authorizeEnhancedSchoolRoute(user,path,method){
 if(method==='GET'||user.role==='student'||path.startsWith('/school/push-')||path.startsWith('/school/notification'))return;
 const permissions=await permissionsFor(user);
 const rules=[[/^\/school\/homework/, 'homework'],[/^\/school\/grades/, 'grades'],[/^\/school\/records/, 'records'],[/^\/school\/reports/, 'reports'],[/^\/school\/(chat-settings|chat-stats)/,'chat_moderation']];
 const hit=rules.find(([pattern])=>pattern.test(path));
 if(hit&&!permissions[hit[1]])fail(403,'此帳號沒有執行這項功能的權限');
}

function visibleAudience(user){return user.role==='student'?['學生','全部人員','全校學生','七年級','八年級','九年級']:null;}
async function visibleAnnouncement(id,user){
 if(!uuid(id))fail(400,'公告格式錯誤');
 const row=(await db.query('select * from announcements704 where id=$1',[id])).rows[0];
 if(!row)fail(404,'找不到公告');
 const audiences=visibleAudience(user);
 if(audiences&&!audiences.includes(row.audience))fail(403,'無法查看這則公告');
 return row;
}

export async function enhancementRoutes({path,query,method,user,tokenHash,readBody,send}){
 let match;
 if(path==='/school/permissions'&&method==='GET'){send(200,{permissions:await permissionsFor(user),keys:permissionKeys});return true;}
 if((match=path.match(/^\/school\/permissions\/([0-9a-f-]{36})$/i))){
  if(user.role!=='admin')fail(403,'僅限管理員調整權限');
  const account=(await db.query('select id,role,display_name from accounts704 where id=$1',[match[1]])).rows[0];if(!account)fail(404,'找不到帳號');
  if(method==='GET'){const custom=(await db.query('select permissions from account_permissions704 where account_id=$1',[account.id])).rows[0]?.permissions||{};send(200,{account,defaults:defaults[account.role],permissions:{...defaults[account.role],...custom}});return true;}
  if(method==='PUT'){const body=await readBody(),clean={};for(const key of permissionKeys){if(typeof body[key]!=='boolean')fail(400,'權限設定格式錯誤');clean[key]=body[key];}await db.query('insert into account_permissions704(account_id,permissions) values($1,$2) on conflict(account_id) do update set permissions=$2,updated_at=now()',[account.id,clean]);send(200,{permissions:clean});return true;}
 }
 if(path==='/school/preferences'){
  if(method==='GET'){const row=(await db.query('select favorites from account_preferences704 where account_id=$1',[user.id])).rows[0];send(200,{favorites:row?.favorites||[]});return true;}
  if(method==='PUT'){const body=await readBody();if(!Array.isArray(body.favorites)||body.favorites.length>8||body.favorites.some(x=>typeof x!=='string'||x.length>40))fail(400,'常用功能格式錯誤');await db.query('insert into account_preferences704(account_id,favorites) values($1,$2) on conflict(account_id) do update set favorites=$2,updated_at=now()',[user.id,[...new Set(body.favorites)]]);send(200,{favorites:[...new Set(body.favorites)]});return true;}
 }
 if(path==='/school/search'&&method==='GET'){
  const q=(query.get('q')||'').trim();if(q.length<2||q.length>100)fail(400,'請輸入至少兩個字搜尋');const like='%'+q+'%',results=[];
  const audiences=visibleAudience(user);
  const announcements=(await db.query(`select id,title,left(regexp_replace(content,'<[^>]+>','','g'),180) excerpt,date from announcements704 where (title ilike $1 or content ilike $1) ${audiences?'and audience=any($2) and workflow_status=\'published\' and coalesce(publish_at,date)<=now() and (expires_at is null or expires_at>now())':''} order by date desc limit 20`,audiences?[like,audiences]:[like])).rows;
  results.push(...announcements.map(x=>({type:'announcement',title:x.title,excerpt:x.excerpt,date:x.date,target:x.id})));
  const hw=(await db.query(`select h.id,h.title,h.due_on,s.name subject from school_homework h join school_subjects s on s.id=h.subject_id where (h.title ilike $1 or h.instructions ilike $1) ${user.role==='student'?'and (h.recipients is null or $2=any(h.recipients))':''} order by h.due_on desc limit 20`,user.role==='student'?[like,user.id]:[like])).rows;
  results.push(...hw.map(x=>({type:'homework',title:x.title,excerpt:x.subject,date:x.due_on,target:'homework'})));
  const grades=(await db.query(`select g.id,g.title,g.grade_day,s.name subject,a.display_name student from school_grades g join school_subjects s on s.id=g.subject_id join accounts704 a on a.id=g.student_id where (g.title ilike $1 or s.name ilike $1 or a.display_name ilike $1) ${user.role==='student'?'and g.student_id=$2 and g.visible':''} order by g.grade_day desc limit 20`,user.role==='student'?[like,user.id]:[like])).rows;
  results.push(...grades.map(x=>({type:'grade',title:x.title,excerpt:user.role==='student'?x.subject:`${x.student} · ${x.subject}`,date:x.grade_day,target:'grades'})));
  if(user.role==='admin'){const accounts=(await db.query('select id,display_name,email from accounts704 where display_name ilike $1 or email ilike $1 order by display_name limit 20',[like])).rows;results.push(...accounts.map(x=>({type:'account',title:x.display_name,excerpt:x.email,target:'accounts'})));}
  send(200,results.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,50));return true;
 }
 if((match=path.match(/^\/school\/announcement-workflow\/([0-9a-f-]{36})$/i))){
  const announcement=await visibleAnnouncement(match[1],user);if(!staff(user)||(user.role!=='admin'&&announcement.author_id!==user.id))fail(403,'無法管理這則公告');
  if(method==='PATCH'){const body=await readBody();if(!['draft','published','scheduled'].includes(body.status))fail(400,'發布狀態錯誤');const publishAt=body.status==='scheduled'?new Date(body.publish_at):body.status==='published'?new Date():null;if(body.status==='scheduled'&&!Number.isFinite(publishAt.getTime()))fail(400,'排程時間錯誤');const expires=body.expires_at?new Date(body.expires_at):null;if(expires&&!Number.isFinite(expires.getTime()))fail(400,'下架時間錯誤');const row=(await db.query('update announcements704 set workflow_status=$1,publish_at=$2,expires_at=$3 where id=$4 returning workflow_status,publish_at,expires_at',[body.status,publishAt?.toISOString()||null,expires?.toISOString()||null,announcement.id])).rows[0];send(200,row);return true;}
 }
 if((match=path.match(/^\/school\/announcement-reads\/([0-9a-f-]{36})$/i))){
  const announcement=await visibleAnnouncement(match[1],user);
  if(method==='POST'){await db.query('insert into announcement_reads704(announcement_id,account_id) values($1,$2) on conflict(announcement_id,account_id) do update set read_at=now()',[announcement.id,user.id]);send(200,{read:true});return true;}
  if(method==='GET'){if(!staff(user)||(user.role!=='admin'&&announcement.author_id!==user.id))fail(403,'無法查看閱讀狀態');const rows=(await db.query("select a.id,a.display_name,a.nickname,r.read_at from accounts704 a left join announcement_reads704 r on r.account_id=a.id and r.announcement_id=$1 where a.role='student' and not a.disabled order by r.read_at nulls first,a.display_name",[announcement.id])).rows;send(200,{total:rows.length,read:rows.filter(x=>x.read_at).length,people:rows});return true;}
 }
 if((match=path.match(/^\/school\/homework-submissions\/([0-9a-f-]{36})$/i))){
  const homework=(await db.query('select * from school_homework where id=$1',[match[1]])).rows[0];if(!homework)fail(404,'找不到作業');
  if(method==='GET'){if(user.role==='student'){if(homework.recipients&&!homework.recipients.includes(user.id))fail(403,'這不是你的作業');send(200,(await db.query('select * from school_homework_submissions where homework_id=$1 and student_id=$2',[homework.id,user.id])).rows[0]||null);return true;}if(!staff(user))fail(403,'無法查看繳交狀態');const rows=(await db.query("select a.id,a.display_name,a.nickname,s.status,s.note,s.link,s.submitted_at,s.reviewed_at from accounts704 a left join school_homework_submissions s on s.student_id=a.id and s.homework_id=$1 where a.role='student' and not a.disabled and ($2::uuid[] is null or a.id=any($2)) order by s.submitted_at nulls first,a.display_name",[homework.id,homework.recipients])).rows;send(200,rows);return true;}
  if(method==='PUT'){if(user.role!=='student')fail(403,'僅學生可繳交作業');if(homework.recipients&&!homework.recipients.includes(user.id))fail(403,'這不是你的作業');const body=await readBody(),note=text(body.note||'',3000,false),link=text(body.link||'',1000,false);if(link&&!/^https:\/\//i.test(link))fail(400,'請輸入 HTTPS 連結');const row=(await db.query("insert into school_homework_submissions(homework_id,student_id,status,note,link) values($1,$2,'submitted',$3,$4) on conflict(homework_id,student_id) do update set status='submitted',note=$3,link=$4,submitted_at=now() returning *",[homework.id,user.id,note,link])).rows[0];send(200,row);return true;}
 }
 if(path==='/school/grade-summary'&&method==='GET'){
  const rows=(await db.query(`select g.student_id,a.display_name,s.id subject_id,s.name subject,round(sum((g.score/nullif(g.max_score,0))*100*g.weight)/nullif(sum(g.weight),0),2) average,count(*)::int items from school_grades g join accounts704 a on a.id=g.student_id join school_subjects s on s.id=g.subject_id where g.max_score>0 ${user.role==='student'?'and g.student_id=$1 and g.visible':''} group by g.student_id,a.display_name,s.id,s.name order by a.display_name,s.name`,user.role==='student'?[user.id]:[])).rows;send(200,rows);return true;
 }
 if(path==='/school/digest-settings'){
  if(method==='GET'){const row=(await db.query('select digest_frequency from school_notification_settings where account_id=$1',[user.id])).rows[0];send(200,{frequency:row?.digest_frequency||'immediate'});return true;}
  if(method==='PUT'){const body=await readBody();if(!['immediate','daily','weekly'].includes(body.frequency))fail(400,'摘要頻率錯誤');await db.query("insert into school_notification_settings(account_id,digest_frequency) values($1,$2) on conflict(account_id) do update set digest_frequency=$2",[user.id,body.frequency]);send(200,{frequency:body.frequency});return true;}
 }
 if(path==='/school/security-sessions'&&method==='GET'){const rows=(await db.query('select session_id,created_at,last_seen,user_agent,expires_at,token_hash=$2 current from sessions704 where account_id=$1 order by last_seen desc',[user.id,tokenHash])).rows;send(200,rows);return true;}
 if((match=path.match(/^\/school\/security-sessions\/([0-9a-f-]{36})$/i))&&method==='DELETE'){const result=await db.query('delete from sessions704 where session_id=$1 and account_id=$2 returning token_hash',[match[1],user.id]);if(!result.rowCount)fail(404,'找不到登入裝置');send(200,{ok:true,current:result.rows[0].token_hash===tokenHash});return true;}
 if(path==='/school/chat-blocks'){
  if(user.role!=='student')fail(403,'此功能僅供學生使用');
  if(method==='GET'){const rows=(await db.query('select a.id,a.display_name,a.nickname,b.created_at from school_chat_blocks b join accounts704 a on a.id=b.blocked_id where b.blocker_id=$1 order by a.display_name',[user.id])).rows;send(200,rows);return true;}
  if(method==='POST'){const body=await readBody();if(!uuid(body.account_id))fail(400,'帳號格式錯誤');await db.query("insert into school_chat_blocks(blocker_id,blocked_id) select $1,id from accounts704 where id=$2 and role='student' on conflict do nothing",[user.id,body.account_id]);send(200,{ok:true});return true;}
 }
 if((match=path.match(/^\/school\/chat-blocks\/([0-9a-f-]{36})$/i))&&method==='DELETE'){if(user.role!=='student')fail(403,'此功能僅供學生使用');await db.query('delete from school_chat_blocks where blocker_id=$1 and blocked_id=$2',[user.id,match[1]]);send(200,{ok:true});return true;}
 if((match=path.match(/^\/school\/message-safety\/([0-9a-f-]{36})$/i))&&method==='PATCH'){const body=await readBody(),content=text(body.content,5000);const row=(await db.query("update school_messages set content=$1,edited_at=now() where id=$2 and author_id=$3 and not deleted and created_at>now()-interval '15 minutes' returning id,content,edited_at",[content,match[1],user.id])).rows[0];if(!row)fail(403,'訊息只能在送出後 15 分鐘內編輯');send(200,row);return true;}
 if(path==='/school/chat-attachments'&&method==='POST'){
  const body=await readBody();if(!uuid(body.message_id)||typeof body.size!=='number'||!Number.isInteger(body.size)||body.size<0||body.size>20*1024*1024)fail(400,'單一聊天檔案上限為 20 MB');
  const message=(await db.query('select m.* from school_messages m join school_members x on x.room_id=m.room_id and x.account_id=$2 where m.id=$1 and m.author_id=$2',[body.message_id,user.id])).rows[0];if(!message)fail(403,'無法替這則訊息上傳檔案');
  const row=(await db.query('insert into school_message_attachments(id,message_id,owner_id,name,mime_type,declared_size) values($1,$2,$3,$4,$5,$6) returning id',[randomUUID(),message.id,user.id,text(body.name,255),text(body.type||'application/octet-stream',200),body.size])).rows[0];send(201,row);return true;
 }
 if((match=path.match(/^\/school\/chat-attachments\/([0-9a-f-]{36})$/i))){
  const file=(await db.query('select f.*,m.room_id from school_message_attachments f join school_messages m on m.id=f.message_id where f.id=$1',[match[1]])).rows[0];if(!file)fail(404,'找不到聊天檔案');
  const member=(await db.query('select 1 from school_members where room_id=$1 and account_id=$2',[file.room_id,user.id])).rowCount;if(!member)fail(403,'無法存取這個聊天檔案');
  if(method==='GET'){if(!file.complete)fail(404,'檔案尚未完成上傳');send(200,{name:file.name,type:file.mime_type,size:Number(file.declared_size),data:file.bytes.toString('base64')});return true;}
  if(method==='DELETE'){if(file.owner_id!==user.id&&user.role!=='admin')fail(403,'無法刪除這個檔案');await db.query('delete from school_message_attachments where id=$1',[file.id]);send(200,{ok:true});return true;}
  if(method==='PATCH'){if(file.owner_id!==user.id)fail(403,'無法上傳這個檔案');const body=await readBody();if(typeof body.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)||typeof body.complete!=='boolean')fail(400,'檔案區塊格式錯誤');const chunk=Buffer.from(body.data,'base64');if(chunk.length>100000)fail(400,'上傳區塊過大');const result=await db.query('update school_message_attachments set bytes=bytes||$1::bytea,complete=$2 where id=$3 and not complete and octet_length(bytes)+$4<=$5 and octet_length(bytes)+$4<=declared_size and (not $2 or octet_length(bytes)+$4=declared_size) returning id',[chunk,body.complete,file.id,chunk.length,20*1024*1024]);if(!result.rowCount)fail(400,'檔案超過限制、大小不符或已完成');send(200,result.rows[0]);return true;}
 }
 return false;
}
