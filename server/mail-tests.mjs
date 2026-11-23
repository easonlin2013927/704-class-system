import {randomUUID} from 'node:crypto';
import {db} from './db.mjs';
const allowed=user=>{if(user.role!=='admin')throw Object.assign(Error('僅限管理員'),{status:403});};
export async function createMailTest(user){allowed(user);const c=await db.connect();try{await c.query('begin');const id=randomUUID();await c.query('insert into school_mail_tests(id,author_id) values($1,$2)',[id,user.id]);await c.query("insert into school_mail_queue(id,account_id,kind,title,test_id) select gen_random_uuid(),id,'test','電子郵件測試',$1 from accounts704 where not disabled",[id]);await c.query('commit');return {id};}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
export async function latestMailTest(user){allowed(user);return (await db.query('select id from school_mail_tests order by created_at desc limit 1')).rows[0]||null;}
export async function getMailTest(user,id){
 allowed(user);
 const job=(await db.query('select id,created_at from school_mail_tests where id=$1',[id])).rows[0];
 if(!job)throw Object.assign(Error('找不到郵件測試'),{status:404});
 const rows=(await db.query(`select a.id as account_id,a.display_name,a.role,a.disabled,m.id as mailbox_id,coalesce(d.delivery_address,m.address) as address,m.verified,
 q.id as queue_id,q.status as queue_status,q.last_error as queue_error,d.status,d.last_error,d.sent_at,coalesce(d.attempts,q.attempts,0) as attempts,coalesce(d.next_attempt,q.next_attempt) as next_attempt
 from accounts704 a left join school_mail_queue q on q.account_id=a.id and q.test_id=$1
 left join school_mailboxes m on m.account_id=a.id and m.created_at<=coalesce(q.created_at,now())
 left join school_mail_deliveries d on d.queue_id=q.id and d.mailbox_id=m.id order by a.display_name,m.address`,[id])).rows;
 const gate=(await db.query('select external_enabled,updated_at from school_notification_gate where id=1')).rows[0];
 const quota=(await db.query(`select count(*)::int as total,min(sent_at)+interval '24 hours' as available_at from (
 select sent_at from school_mail_deliveries where sent_at>now()-interval '24 hours'
 union all select sent_at from school_mail_queue where kind='verification' and sent_at>now()-interval '24 hours') recent`)).rows[0];
 return {...job,rows,reported_at:new Date().toISOString(),external_enabled:gate?.external_enabled,gate_updated_at:gate?.updated_at,
 sender_configured:Boolean(process.env.MAIL_GMAIL_USER&&process.env.MAIL_GMAIL_APP_PASSWORD),sent_last_24h:Number(quota.total),daily_limit:400,quota_available_at:quota.available_at};
}
