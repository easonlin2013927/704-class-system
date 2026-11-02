import {db} from './db.mjs';

export async function migrateMailEvents(){await db.query(`
 create table if not exists school_presence(account_id uuid primary key references accounts704(id) on delete cascade,last_seen timestamptz not null default now());
 create table if not exists school_chat_mail_throttle(account_id uuid primary key references accounts704(id) on delete cascade,last_queued_at timestamptz not null);
 create table if not exists school_mail_schedules(name text primary key,activated_at timestamptz not null default now());
 insert into school_mail_schedules(name) values('weekly-ranking') on conflict do nothing;
 create table if not exists school_mail_weekly_runs(week_start date primary key,created_at timestamptz not null default now());
 alter table school_mail_queue add column if not exists event_kind text;
 create or replace function school_queue_mail_notification() returns trigger language plpgsql as $$ begin insert into school_mail_queue(id,account_id,kind,title,event_kind) values(gen_random_uuid(),new.account_id,'notification',new.title,new.kind);return new;end $$;
 create or replace function school_offline_message_email() returns trigger language plpgsql as $$
 begin
  with due as (
   insert into school_chat_mail_throttle(account_id,last_queued_at)
   select a.id,now() from school_members m join accounts704 a on a.id=m.account_id left join school_presence p on p.account_id=a.id
   where m.room_id=new.room_id and a.id is distinct from new.author_id and not a.disabled and (p.last_seen is null or p.last_seen<now()-interval '2 minutes')
   on conflict(account_id) do update set last_queued_at=excluded.last_queued_at where school_chat_mail_throttle.last_queued_at<now()-interval '30 minutes'
   returning account_id
  ) insert into school_mail_queue(id,account_id,kind,title) select gen_random_uuid(),account_id,'offline-chat','你有新的聊天訊息' from due;
  return new;
 end $$;
 drop trigger if exists school_offline_message_mail on school_messages;
 create trigger school_offline_message_mail after insert on school_messages for each row execute function school_offline_message_email();
 `);}
export async function markPresence(user){await db.query('insert into school_presence(account_id,last_seen) values($1,now()) on conflict(account_id) do update set last_seen=now()',[user.id]);return {ok:true};}
let scheduling=false;
export async function scheduleWeeklyRanking(){if(scheduling)return;scheduling=true;const client=await db.connect().catch(()=>null);if(!client){scheduling=false;return;}try{
 await client.query('begin');
 await client.query("select pg_advisory_xact_lock(hashtext('704-weekly-ranking'))");
 const clock=(await client.query("select now() as current_time,activated_at from school_mail_schedules where name='weekly-ranking'")).rows[0];
 const local=new Date(new Date(clock.current_time).getTime()+8*3600000),day=local.getUTCDay();
 const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 let friday=midnight-((day+2)%7)*86400000+20*3600000;if(day===5&&local.getUTCHours()<20)friday-=7*86400000;
 const instant=new Date(friday-8*3600000);if(instant<new Date(clock.activated_at)){await client.query('commit');return;}
 const week=new Date(friday).toISOString().slice(0,10);const run=await client.query('insert into school_mail_weekly_runs(week_start) values($1) on conflict do nothing returning week_start',[week]);
 if(run.rowCount){const ranking=(await client.query("select a.display_name,a.nickname,coalesce(sum(p.amount),0)::int as points from accounts704 a left join school_points p on p.student_id=a.id where a.role='student' and not a.disabled group by a.id order by points desc,a.display_name,a.id")).rows;await client.query("insert into school_mail_queue(id,account_id,kind,title) select gen_random_uuid(),id,'ranking',$1 from accounts704 where not disabled",[JSON.stringify({week,ranking})]);}
 await client.query('commit');
 }catch(error){await client.query('rollback').catch(()=>{});console.error('Weekly ranking scheduling unavailable');}finally{client.release();scheduling=false;}}
