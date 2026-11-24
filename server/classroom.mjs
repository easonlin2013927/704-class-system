import {randomUUID} from 'node:crypto';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(400,`請填寫 1–${max} 字的內容`);return value.trim();};
const can=(user,key)=>user.role==='admin'||user.permissions?.[key]===true;
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export const presenceSql=(alias='p')=>`case when ${alias}.last_seen is null or ${alias}.last_seen<now()-interval '2 minutes' or ${alias}.preference='offline' then 'offline' when ${alias}.preference='away' or ${alias}.active_at<now()-interval '5 minutes' then 'away' else 'online' end`;

export const classroomSchema=`
 create table if not exists school_board(id uuid primary key,author_id uuid references accounts704(id) on delete set null,author_name text not null,content text not null,created_at timestamptz not null default now());
 create table if not exists school_board_replies(id uuid primary key,post_id uuid not null references school_board(id) on delete cascade,author_id uuid references accounts704(id) on delete set null,author_name text not null,content text not null,created_at timestamptz not null default now());
 alter table school_board add column if not exists position_x double precision not null default random() check(position_x>=0 and position_x<=1);
 alter table school_board add column if not exists position_y double precision not null default random() check(position_y>=0 and position_y<=1);
 create table if not exists school_honors(id integer primary key check(id=1),title text not null default '段考英雄榜',top_count integer not null default 3 check(top_count in (1,3,5)),published boolean not null default false,updated_at timestamptz not null default now(),updated_by uuid references accounts704(id) on delete set null);
 insert into school_honors(id) values(1) on conflict do nothing;
 create table if not exists school_honor_places(rank integer primary key check(rank between 1 and 5),student_id uuid unique not null references accounts704(id) on delete cascade);
 create index if not exists school_board_created on school_board(created_at desc,id);
 create index if not exists school_board_reply_post on school_board_replies(post_id,created_at);
 create table if not exists school_collections(id uuid primary key,title text not null,description text not null default '',due_on date not null,author_id uuid references accounts704(id) on delete set null,created_at timestamptz not null default now());
 create table if not exists school_collection_entries(collection_id uuid references school_collections(id) on delete cascade,student_id uuid references accounts704(id) on delete cascade,status text not null default 'missing' check(status in ('missing','submitted','excluded')),updated_at timestamptz not null default now(),last_reminded_at timestamptz,primary key(collection_id,student_id));
 alter table school_presence add column if not exists preference text not null default 'online';
 alter table school_presence add column if not exists active_at timestamptz not null default now();
 alter table school_members add column if not exists last_read_at timestamptz;
 alter table school_messages add column if not exists uploads_pending boolean not null default false;
 create table if not exists school_chat_notices(message_id uuid references school_messages(id) on delete cascade,account_id uuid references accounts704(id) on delete cascade,ready_at timestamptz not null default now()+interval '1 minute',handled boolean not null default false,primary key(message_id,account_id));
 create index if not exists school_chat_notices_pending on school_chat_notices(ready_at) where not handled;
 alter table school_mail_queue add column if not exists chat_message_id uuid references school_messages(id) on delete cascade;
 alter table school_mail_queue add column if not exists collection_id uuid references school_collections(id) on delete cascade;
 drop trigger if exists school_offline_message_mail on school_messages;
 create or replace function school_prepare_chat_notice() returns trigger language plpgsql as $$ begin
  insert into school_chat_notices(message_id,account_id,handled) select new.id,m.account_id,not coalesce((select external_enabled from school_notification_gate where id=1),false) or not coalesce((select chat from school_notification_settings where account_id=a.id),true) from school_members m join accounts704 a on a.id=m.account_id where m.room_id=new.room_id and m.account_id is distinct from new.author_id and not a.disabled;
  return new;
 end $$;
 drop trigger if exists school_prepare_chat_notice_insert on school_messages;
 create trigger school_prepare_chat_notice_insert after insert on school_messages for each row execute function school_prepare_chat_notice();
`;

export async function markClassPresence(db,user,body={}){
 if(body.preference!==undefined&&!['online','away','offline'].includes(body.preference))fail(400,'狀態格式錯誤');
 if(body.active!==undefined&&typeof body.active!=='boolean')fail(400,'活動狀態格式錯誤');
 return (await db.query(`insert into school_presence(account_id,last_seen,active_at,preference) values($1,now(),now(),coalesce($2,'online')) on conflict(account_id) do update set last_seen=now(),active_at=case when $3 then now() else school_presence.active_at end,preference=coalesce($2,school_presence.preference) returning preference,${presenceSql('school_presence')} status`,[user.id,body.preference??null,body.active??true])).rows[0];
}

export function createClassroom(db){
 const transaction=async work=>{const c=await db.connect();try{await c.query('begin');const result=await work(c);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
 async function routes({path,method,user,readBody,query,send}){
  const parts=path.slice('/school/'.length).split('/'),[resource,id,action]=parts;
  if(!['board','honors','collections','chat-read','chat-sent','presence'].includes(resource))return false;
  if(id&&!uuid(id))fail(400,'項目格式錯誤');
  if(resource==='presence'&&method==='GET'&&!id){send(200,(await db.query(`select preference,${presenceSql()} status from school_presence p where account_id=$1`,[user.id])).rows[0]||{preference:'online',status:'online'});return true;}
  if(resource==='board'){
   if(method==='GET'&&!id){const before=query.get('before');if(before&&!uuid(before))fail(400,'留言游標格式錯誤');send(200,(await db.query(`select b.*,(select coalesce(json_agg(x order by x.created_at),'[]') from (select id,author_id,author_name,content,created_at from school_board_replies where post_id=b.id order by created_at desc limit 100) x) replies from school_board b where ($1::uuid is null or (b.created_at,b.id)<(select created_at,id from school_board where id=$1)) order by b.created_at desc,b.id desc limit 50`,[before||null])).rows);return true;}
   if(method==='POST'&&!id){const b=await readBody(),placed=b?.position_x!==undefined||b?.position_y!==undefined;if(placed&&![b?.position_x,b?.position_y].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1))fail(400,'便利貼位置格式錯誤');send(201,(await db.query('insert into school_board(id,author_id,author_name,content,position_x,position_y) values($1,$2,$3,$4,$5,$6) returning *',[randomUUID(),user.id,user.display_name,text(b?.content,2000),placed?b.position_x:Math.random(),placed?b.position_y:Math.random()])).rows[0]);return true;}
   if(method==='PATCH'&&id&&!action){const b=await readBody();if(![b?.position_x,b?.position_y].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1))fail(400,'便利貼位置格式錯誤');const row=(await db.query('update school_board set position_x=$3,position_y=$4 where id=$1 and author_id=$2 returning id,position_x,position_y',[id,user.id,b.position_x,b.position_y])).rows[0];if(!row)fail(403,'只能移動自己的便利貼');send(200,row);return true;}
   if(method==='POST'&&id&&action==='replies'){if(!can(user,'board_reply'))fail(403,'此帳號沒有留言板回覆權限');const b=await readBody();if(!(await db.query('select 1 from school_board where id=$1',[id])).rowCount)fail(404,'找不到留言');send(201,(await db.query('insert into school_board_replies(id,post_id,author_id,author_name,content) values($1,$2,$3,$4,$5) returning *',[randomUUID(),id,user.id,user.display_name,text(b?.content,2000)])).rows[0]);return true;}
   if(method==='DELETE'&&id&&!action){const r=await db.query('delete from school_board where id=$1 and (author_id=$2 or $3) returning id',[id,user.id,['admin','teacher'].includes(user.role)]);if(!r.rowCount)fail(403,'沒有刪除此留言的權限');send(200,{ok:true});return true;}
  }
  if(resource==='honors'&&!id){
   const editable=['admin','teacher'].includes(user.role);
   if(method==='GET'){const config=(await db.query('select title,top_count,published,updated_at from school_honors where id=1')).rows[0],winners=(await db.query('select p.rank,a.id student_id,a.display_name,a.nickname,a.avatar_url from school_honor_places p join accounts704 a on a.id=p.student_id where not a.disabled order by p.rank')).rows,candidates=editable?(await db.query("select id,display_name,nickname from accounts704 where role='student' and not disabled order by display_name")).rows:[];send(200,{...config,winners,candidates});return true;}
   if(!editable)fail(403,'只有教師與管理員可以編輯段考英雄榜');
   if(method==='PUT'){const b=await readBody(),title=text(b?.title,100);if(![1,3,5].includes(b.top_count)||!Array.isArray(b.winners)||b.winners.length!==b.top_count||b.winners.some(value=>!uuid(value))||new Set(b.winners).size!==b.top_count)fail(400,'請依名次選擇 1、3 或 5 位不重複的學生');send(200,await transaction(async c=>{await c.query('select id from school_honors where id=1 for update');const valid=await c.query("select id from accounts704 where id=any($1::uuid[]) and role='student' and not disabled for share",[b.winners]);if(valid.rowCount!==b.top_count)fail(400,'請選擇啟用中的學生帳號');await c.query('delete from school_honor_places');for(let i=0;i<b.winners.length;i++)await c.query('insert into school_honor_places(rank,student_id) values($1,$2)',[i+1,b.winners[i]]);await c.query('update school_honors set title=$1,top_count=$2,published=true,updated_at=now(),updated_by=$3 where id=1',[title,b.top_count,user.id]);return {ok:true};}));return true;}
  }
  if(resource==='collections'){
   const manage=can(user,'collections');
   if(method==='GET'&&!id){send(200,(await db.query(`select c.*,count(e.student_id)::int total,count(*) filter(where e.status='submitted')::int submitted,count(*) filter(where e.status='excluded')::int excluded,count(*) filter(where e.status='missing')::int missing,max(e.status) filter(where e.student_id=$1) my_status from school_collections c left join school_collection_entries e on e.collection_id=c.id and exists(select 1 from accounts704 a where a.id=e.student_id and not a.disabled) group by c.id order by c.due_on desc,c.created_at desc`,[user.id])).rows);return true;}
   if(method==='POST'&&!id){if(!manage)fail(403,'沒有管理資料繳收的權限');const b=await readBody();if(!validDay(b.due_on))fail(400,'請輸入有效截止日期');send(201,await transaction(async c=>{const row=(await c.query('insert into school_collections(id,title,description,due_on,author_id) values($1,$2,$3,$4,$5) returning *',[randomUUID(),text(b.title,150),b.description?text(b.description,3000):'',b.due_on,user.id])).rows[0];await c.query("insert into school_collection_entries(collection_id,student_id) select $1,id from accounts704 where role='student' and not disabled",[row.id]);return row;}));return true;}
   if(method==='GET'&&id&&!action){if(!manage)fail(403,'沒有查看班級繳收名單的權限');send(200,(await db.query('select e.*,a.display_name,a.nickname from school_collection_entries e join accounts704 a on a.id=e.student_id where collection_id=$1 and not a.disabled order by a.display_name',[id])).rows);return true;}
   if(!manage)fail(403,'沒有管理資料繳收的權限');
   if(method==='PATCH'&&id&&!action){const b=await readBody(),ids=Array.isArray(b.students)?[...new Set(b.students)]:[];if(!ids.length||ids.length>500||ids.some(x=>!uuid(x))||!['missing','submitted','excluded'].includes(b.status))fail(400,'請選擇學生及有效繳交狀態');send(200,await transaction(async c=>{const rows=await c.query('update school_collection_entries set status=$3,updated_at=now() where collection_id=$1 and student_id=any($2::uuid[]) returning student_id',[id,ids,b.status]);if(rows.rowCount!==ids.length)fail(400,'包含非此項目的學生');return {updated:rows.rowCount};}));return true;}
   if(method==='DELETE'&&id&&!action){await db.query('delete from school_collections where id=$1',[id]);send(200,{ok:true});return true;}
   if(method==='POST'&&id&&action==='remind'){send(202,await transaction(async c=>{
    const item=(await c.query('select *,due_on::text as due_on from school_collections where id=$1 for update',[id])).rows[0];if(!item)fail(404,'找不到繳收項目');
    if(!(await c.query('select external_enabled from school_notification_gate where id=1')).rows[0]?.external_enabled)fail(409,'全站外部通知已關閉，未寄送提醒');
    const candidates=(await c.query(`select e.student_id,e.last_reminded_at,coalesce(s.feedback,true) enabled,exists(select 1 from school_mailboxes m where m.account_id=e.student_id and m.verified) has_email from school_collection_entries e join accounts704 a on a.id=e.student_id left join school_notification_settings s on s.account_id=a.id where e.collection_id=$1 and e.status='missing' and not a.disabled`,[id])).rows;
    const result={queued:0,no_email:0,disabled:0,cooldown:0,total:candidates.length};
    for(const student of candidates){if(!student.enabled){result.disabled++;continue;}if(!student.has_email){result.no_email++;continue;}if(student.last_reminded_at&&Date.now()-new Date(student.last_reminded_at).getTime()<10*60000){result.cooldown++;continue;}
     await c.query("insert into school_mail_queue(id,account_id,kind,title,event_kind,collection_id) values($1,$2,'collection',$3,'feedback',$4)",[randomUUID(),student.student_id,JSON.stringify({title:item.title,due_on:String(item.due_on).slice(0,10),sender:user.display_name,description:item.description}),id]);await c.query('update school_collection_entries set last_reminded_at=now() where collection_id=$1 and student_id=$2',[id,student.student_id]);result.queued++;
    }return result;
   }));return true;}
  }
  if(['chat-read','chat-sent'].includes(resource)&&id&&method==='POST'){
   if(!(await db.query('select 1 from school_members where room_id=$1 and account_id=$2',[id,user.id])).rowCount)fail(403,'你不是此交談的成員');
   const b=await readBody();if(!uuid(b.message_id))fail(400,'訊息格式錯誤');
   if(resource==='chat-read'){
    const result=await db.query(`update school_members set last_read_at=greatest(coalesce(last_read_at,'-infinity'),(select created_at from school_messages where id=$3 and room_id=$1)) where room_id=$1 and account_id=$2 and exists(select 1 from school_messages where id=$3 and room_id=$1) returning last_read_at`,[id,user.id,b.message_id]);if(!result.rowCount)fail(404,'找不到交談訊息');
   }else{const r=await db.query('update school_messages set uploads_pending=false where id=$1 and room_id=$2 and author_id=$3 returning id',[b.message_id,id,user.id]);if(!r.rowCount)fail(403,'無法完成此訊息的傳送');await db.query("update school_chat_notices set ready_at=now()+interval '1 minute' where message_id=$1 and not handled",[b.message_id]);}
   send(200,{ok:true});return true;
  }
  fail(404,'找不到此功能');
 }
 async function scheduleChat(){return transaction(async c=>{
  // One scheduler at a time across API instances, including deployment probes.
  await c.query("select pg_advisory_xact_lock(hashtext('704-chat-notices'))");
  const rows=(await c.query(`select n.message_id,n.account_id,m.room_id,m.author_name,m.content,m.created_at,m.deleted,m.uploads_pending,sm.last_read_at,a.disabled,${presenceSql()} status,coalesce(s.chat,true) enabled,g.external_enabled from school_chat_notices n join school_messages m on m.id=n.message_id join accounts704 a on a.id=n.account_id left join school_members sm on sm.room_id=m.room_id and sm.account_id=n.account_id left join school_presence p on p.account_id=n.account_id left join school_notification_settings s on s.account_id=n.account_id cross join school_notification_gate g where g.id=1 and not n.handled and n.ready_at<=now() and not m.uploads_pending order by n.ready_at limit 100`)).rows;
  for(const row of rows){
   if((await c.query('select 1 from school_message_attachments where message_id=$1 and not complete',[row.message_id])).rowCount)continue;
   if(!row.deleted&&!row.disabled&&row.enabled&&row.external_enabled&&(!row.last_read_at||new Date(row.last_read_at)<new Date(row.created_at))&&(await c.query('select 1 from school_members where room_id=$1 and account_id=$2',[row.room_id,row.account_id])).rowCount){
    if(row.status==='online'){await c.query("update school_chat_notices set ready_at=now()+interval '1 minute' where message_id=$1 and account_id=$2",[row.message_id,row.account_id]);continue;}
    const files=(await c.query("select name,declared_size size from school_message_attachments where message_id=$1 and complete and created_at>now()-interval '3 days' order by created_at",[row.message_id])).rows;
    await c.query("insert into school_mail_queue(id,account_id,kind,title,event_kind,chat_message_id) values($1,$2,'offline-chat',$3,'chat',$4)",[randomUUID(),row.account_id,JSON.stringify({sender:row.author_name,content:row.content.slice(0,1500),files}),row.message_id]);
   }
   await c.query('update school_chat_notices set handled=true where message_id=$1 and account_id=$2',[row.message_id,row.account_id]);
  }
  return rows.length;
 });}
 return {migrate:()=>db.query(classroomSchema),routes,scheduleChat};
}

export async function prepareClassMail(db,row){
 const gate=(await db.query('select g.external_enabled,a.disabled from school_notification_gate g join accounts704 a on a.id=$1 where g.id=1',[row.account_id])).rows[0];
 if(!gate?.external_enabled||gate.disabled)return null;
 if(row.kind==='offline-chat'&&row.chat_message_id){
  const message=(await db.query(`select m.*,sm.last_read_at,${presenceSql()} status,coalesce(s.chat,true) enabled from school_messages m join school_members sm on sm.room_id=m.room_id and sm.account_id=$2 left join school_presence p on p.account_id=sm.account_id left join school_notification_settings s on s.account_id=sm.account_id where m.id=$1`,[row.chat_message_id,row.account_id])).rows[0];
  if(!message||message.deleted||message.uploads_pending||!message.enabled||message.status==='online'||(message.last_read_at&&new Date(message.last_read_at)>=new Date(message.created_at)))return null;
  const files=(await db.query("select name,declared_size size from school_message_attachments where message_id=$1 and complete and created_at>now()-interval '3 days' order by created_at",[message.id])).rows;
  return {...row,title:JSON.stringify({sender:message.author_name,content:message.content.slice(0,1500),files})};
 }
 if(row.kind==='collection'&&row.collection_id){
  const entry=(await db.query(`select e.status,coalesce(s.feedback,true) enabled,c.title,c.description,c.due_on::text from school_collection_entries e join school_collections c on c.id=e.collection_id left join school_notification_settings s on s.account_id=e.student_id where e.collection_id=$1 and e.student_id=$2`,[row.collection_id,row.account_id])).rows[0];
  if(!entry||entry.status!=='missing'||!entry.enabled)return null;
  return {...row,title:JSON.stringify(entry)};
 }
 return row;
}
