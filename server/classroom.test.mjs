import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createClassroom,markClassPresence,prepareClassMail,presenceSql,classroomSchema} from './classroom.mjs';
import {buildMail} from './mail-template.mjs';

test('Classroom PostgreSQL routes, permissions, reminders, receipts and offline attachments',async()=>{
 const pg=new PGlite();
 const query=async(sql,values=[])=>{if(sql.includes('create table')){await pg.exec(sql);return {rows:[],rowCount:0};}const r=await pg.query(sql,values);return {...r,rowCount:/^\s*select/i.test(sql)?r.rows.length:r.affectedRows};};
 const db={query,connect:async()=>({query,release(){}})},tools=createClassroom(db);
 const admin={id:randomUUID(),role:'admin',display_name:'管理員'},teacher={id:randomUUID(),role:'teacher',display_name:'教師',permissions:{board_reply:true,collections:true}},assistant={id:randomUUID(),role:'assistant',display_name:'小老師',permissions:{board_reply:true}},student={id:randomUUID(),role:'student',display_name:'學生甲'},other={id:randomUUID(),role:'student',display_name:'學生乙'},noMail={id:randomUUID(),role:'student',display_name:'學生丙'};
 try{
  await pg.exec(`create table accounts704(id uuid primary key,display_name text,role text,nickname text default '',disabled boolean default false);
   create table school_presence(account_id uuid primary key references accounts704(id),last_seen timestamptz default now());
   create table school_rooms(id uuid primary key,title text,kind text,created_at timestamptz default now());
   create table school_members(room_id uuid references school_rooms(id),account_id uuid references accounts704(id),primary key(room_id,account_id));
   create table school_messages(id uuid primary key,room_id uuid references school_rooms(id),author_id uuid references accounts704(id),author_name text,content text,deleted boolean default false,created_at timestamptz default now(),edited_at timestamptz);
   create table school_message_attachments(id uuid primary key,message_id uuid references school_messages(id),name text,mime_type text,declared_size bigint,complete boolean,created_at timestamptz default now());
   create table school_mail_queue(id uuid primary key,account_id uuid references accounts704(id),kind text,title text,event_kind text,status text default 'pending');
   create table school_mailboxes(id uuid primary key,account_id uuid references accounts704(id),verified boolean);
   create table school_notification_gate(id int primary key,external_enabled boolean);insert into school_notification_gate values(1,true);
   create table school_notification_settings(account_id uuid primary key,chat boolean default true,feedback boolean default true);`);
  for(const user of [admin,teacher,assistant,student,other,noMail])await query('insert into accounts704(id,display_name,role) values($1,$2,$3)',[user.id,user.display_name,user.role]);
  await tools.migrate();await tools.migrate();
  const call=async(user,path,method='GET',body={})=>{let value;const u=new URL('http://test/school/'+path);assert.equal(await tools.routes({user,path:u.pathname,query:u.searchParams,method,readBody:async()=>body,send:(status,data)=>value={status,data}}),true);return value.data;};
  const post=await call(student,'board','POST',{content:'今天的心情 <script>alert(1)</script>'});
  await assert.rejects(call(teacher,'board','POST',{content:'staff'}),{status:403});
  await assert.rejects(call(other,`board/${post.id}/replies`,'POST',{content:'未授權'}),{status:403});
  await call(assistant,`board/${post.id}/replies`,'POST',{content:'小老師回覆'});
  await call({...other,permissions:{board_reply:true}},`board/${post.id}/replies`,'POST',{content:'授權學生回覆'});
  assert.equal((await call(student,'board'))[0].replies.length,2);
  await assert.rejects(call(other,`board/${post.id}`,'DELETE'),{status:403});
  await assert.rejects(call({...other,permissions:{board_reply:true}},`board/${post.id}`,'DELETE'),{status:403});
  await assert.rejects(call(student,'board','POST',{content:'x'.repeat(2001)}),{status:400});
  await assert.rejects(call(assistant,'collections','POST',{title:'項目',due_on:'2026-12-10'}),{status:403});
  await assert.rejects(call(teacher,'collections','POST',{title:'項目',due_on:'2026-02-30'}),{status:400});
  const item=await call(teacher,'collections','POST',{title:'家長同意書',due_on:'2026-12-10',description:'請簽名繳回'});
  assert.equal((await call(teacher,'collections/'+item.id)).length,3);
  await assert.rejects(call(student,'collections/'+item.id),{status:403});
  await assert.rejects(call(student,'collections/'+item.id,'PATCH',{students:[student.id],status:'submitted'}),{status:403});
  await call(teacher,'collections/'+item.id,'PATCH',{students:[other.id],status:'excluded'});
  await query('insert into school_mailboxes values($1,$2,true)',[randomUUID(),student.id]);
  const reminder=await call(teacher,'collections/'+item.id+'/remind','POST');
  assert.deepEqual(reminder,{queued:1,total:2,no_email:1,disabled:0,cooldown:0});
  assert.equal((await call(teacher,'collections/'+item.id+'/remind','POST')).cooldown,1);
  let queued=(await query("select * from school_mail_queue where kind='collection'")).rows[0];
  assert.ok(await prepareClassMail(db,queued));
  await call(teacher,'collections/'+item.id,'PATCH',{students:[student.id],status:'submitted'});
  assert.equal(await prepareClassMail(db,queued),null,'Submitted students cancel queued reminders');
  assert.equal((await call(student,'collections'))[0].my_status,'submitted');
  await query('update school_notification_gate set external_enabled=false');
  await assert.rejects(call(teacher,'collections/'+item.id+'/remind','POST'),{status:409});
  await query('update school_notification_gate set external_enabled=true');
  await query('insert into school_notification_settings(account_id,feedback) values($1,false)',[noMail.id]);
  assert.equal((await call(teacher,'collections/'+item.id+'/remind','POST')).disabled,1);
  // Invalid selection must roll back every status update, not partially apply it.
  await assert.rejects(call(teacher,'collections/'+item.id,'PATCH',{students:[other.id,admin.id],status:'submitted'}),{status:400});
  assert.equal((await call(teacher,'collections/'+item.id)).find(x=>x.student_id===other.id).status,'excluded');
  const room=randomUUID(),message=randomUUID(),file=randomUUID();
  await query("insert into school_rooms(id,title,kind) values($1,'私訊','direct')",[room]);
  for(const user of [student,other])await query('insert into school_members(room_id,account_id) values($1,$2)',[room,user.id]);
  await markClassPresence(db,other,{preference:'offline'});
  await query('insert into school_messages(id,room_id,author_id,author_name,content,uploads_pending) values($1,$2,$3,$4,$5,true)',[message,room,student.id,student.display_name,'請查看這份檔案']);
  await query("update school_chat_notices set ready_at=now()-interval '1 minute'");
  assert.equal(await tools.scheduleChat(),0,'Unfinished uploads do not send notices');
  await query("insert into school_message_attachments(id,message_id,name,mime_type,declared_size,complete) values($1,$2,'測試 <檔案>.pdf','application/pdf',1234,true)",[file,message]);
  await call(student,'chat-sent/'+room,'POST',{message_id:message});
  await query("update school_chat_notices set ready_at=now()-interval '1 minute'");
  await tools.scheduleChat();await tools.scheduleChat();
  const chat=(await query("select * from school_mail_queue where kind='offline-chat'")).rows;
  assert.equal(chat.length,1,'Notice scheduling is idempotent');
  assert.equal(JSON.parse(chat[0].title).files[0].name,'測試 <檔案>.pdf');
  const mail=buildMail(await prepareClassMail(db,chat[0]));assert.match(mail.text,/學生甲/);assert.match(mail.text,/請查看這份檔案/);assert.match(mail.html,/測試 &lt;檔案&gt;\.pdf/);
  await query('update school_notification_gate set external_enabled=false');assert.equal(await prepareClassMail(db,chat[0]),null,'Gate is checked again immediately before delivery');await query('update school_notification_gate set external_enabled=true');
  await assert.rejects(call(noMail,'chat-read/'+room,'POST',{message_id:message}),{status:403});
  await assert.rejects(call(other,'chat-sent/'+room,'POST',{message_id:message}),{status:403});
  await call(other,'chat-read/'+room,'POST',{message_id:message});
  assert.equal(await prepareClassMail(db,chat[0]),null,'Read messages cancel queued mail');
  // Execute actual message/room queries against PostgreSQL to catch schema and alias errors.
  const source=readFileSync(new URL('./school.mjs',import.meta.url),'utf8');
  const messages=source.match(/`(select m\.id,m\.author_id[\s\S]*?limit 200)`/)[1];
  const loaded=(await query(messages,[room,null])).rows;assert.equal(loaded[0].attachments.length,1);assert.equal(loaded[0].read_by[0].id,other.id);
  const roomsLine=source.split('\n').find(line=>line.includes("if(method==='GET'&&!id)")&&line.includes('school_rooms r join school_members'));
  const roomSql=Function('presenceSql','return `'+roomsLine.match(/`([\s\S]+?)`/)[1]+'`;')(presenceSql);
  assert.equal((await query(roomSql,[student.id])).rows[0].members.find(x=>x.id===other.id).status,'offline');
  await markClassPresence(db,other,{preference:'online',active:true});assert.equal((await call(other,'presence')).status,'online');
  assert.equal(await prepareClassMail(db,chat[0]),null,'Online recipients do not get stale offline mail');
  await query("update school_presence set active_at=now()-interval '6 minutes' where account_id=$1",[other.id]);assert.equal((await call(other,'presence')).status,'away');
  await query("update school_presence set last_seen=now()-interval '3 minutes' where account_id=$1",[other.id]);assert.equal((await call(other,'presence')).status,'offline');
  await query('update school_notification_gate set external_enabled=false');
  await query('insert into school_messages(id,room_id,author_id,author_name,content) values($1,$2,$3,$4,$5)',[randomUUID(),room,student.id,student.display_name,'關閉通知時的訊息']);
  await query('update school_notification_gate set external_enabled=true');
  await query("update school_chat_notices set ready_at=now()-interval '1 minute'");await tools.scheduleChat();
  assert.equal((await query("select * from school_mail_queue where kind='offline-chat'")).rows.length,1,'Gate-off messages never replay after enabling');
  await markClassPresence(db,other,{preference:'online',active:true});
  const late=randomUUID();await query('insert into school_messages(id,room_id,author_id,author_name,content) values($1,$2,$3,$4,$5)',[late,room,student.id,student.display_name,'剛關閉視窗時傳來的訊息']);
  await query("update school_chat_notices set ready_at=now()-interval '1 minute'");await tools.scheduleChat();
  assert.equal((await query('select handled from school_chat_notices where message_id=$1',[late])).rows[0].handled,false,'Online unread notices wait for read or expired heartbeat');
  await query("update school_presence set last_seen=now()-interval '3 minutes' where account_id=$1",[other.id]);await query("update school_chat_notices set ready_at=now()-interval '1 minute'");await tools.scheduleChat();
  assert.equal((await query("select * from school_mail_queue where kind='offline-chat'")).rows.length,2,'Closed clients receive mail after heartbeat expiry');
  await call(student,'board/'+post.id,'DELETE');assert.equal((await call(admin,'board')).length,0);
 }finally{await pg.close();}
});

test('Classroom migrations apply idempotently on the actual application schemas',async()=>{
 const pg=new PGlite();
 try{
  for(const [file,name] of [['db.mjs','migrate'],['school.mjs','migrateSchool'],['enhancements.mjs','migrateEnhancements'],['broadcast.mjs','migrateBroadcast'],['mail.mjs','migrateMail'],['mailboxes.mjs','migrateMailboxes'],['multi-mail-worker.mjs','migrateMailDeliveries'],['mail-events.mjs','migrateMailEvents']]){
   const source=readFileSync(new URL(file,import.meta.url),'utf8'),start=source.indexOf('export async function '+name+'('),end=source.indexOf('\nexport ',start+1),section=source.slice(start,end<0?undefined:end);
   for(const match of section.matchAll(/await db\.query\(`([\s\S]*?)`\)/g))await pg.exec(match[1]);
  }
  await pg.exec(classroomSchema);await pg.exec(classroomSchema);
  assert.equal((await pg.query("select count(*)::int n from information_schema.tables where table_name in ('school_board','school_collections','school_chat_notices')")).rows[0].n,3);
 }finally{await pg.close();}
});
