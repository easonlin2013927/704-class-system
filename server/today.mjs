export async function loadToday(db,user){
 const can=key=>user.role==='admin'||user.permissions?.[key]===true;
 const student=user.role==='student',assistant=user.role==='assistant',management=['teacher','admin'].includes(user.role);
 const own=key=>student&&!can(key);
 const d="(now() at time zone 'Asia/Taipei')::date";
 const fields=[];
 if(management&&can('records'))fields.push(`(select count(*)::int from school_records where kind='missing' and not resolved) as pending_records`);
 if(management&&can('publish')){
  const owner=user.role==='teacher'?'and author_id=$1':'';
  fields.push(`(select count(*)::int from announcements704 where workflow_status='draft' ${owner}) as drafts`,`(select count(*)::int from announcements704 where workflow_status='scheduled' and (expires_at is null or expires_at>now()) ${owner}) as scheduled`);
 }
 if(management&&can('reports'))fields.push('(select count(*)::int from school_reports where not resolved) as pending_reports');
 if(user.role==='admin')fields.push('(select count(*)::int from accounts704 where not disabled) as active_accounts','(select count(*)::int from accounts704 where disabled) as disabled_accounts');
 const completed=studentId=>`case when h.submission_mode='check' then exists(select 1 from school_checks done_check where done_check.homework_id=h.id and done_check.student_id=${studentId} and done_check.done) else exists(select 1 from school_homework_submissions submitted where submitted.homework_id=h.id and submitted.student_id=${studentId} and submitted.status='submitted') end`;
 const progress=management?`,(select json_build_object('assigned',count(*),'completed',count(*) filter(where ${completed('a.id')})) from accounts704 a where a.role='student' and not a.disabled and (h.recipients is null or a.id=any(h.recipients))) progress`:'';
 const [announcements,activities,homework,records,notices,clock,overview]=await Promise.all([
  db.query(`select id,title,category,publish_at,date from announcements704 where workflow_status='published' and coalesce(publish_at,date)<=now() and (expires_at is null or expires_at>now()) and (coalesce(publish_at,date) at time zone 'Asia/Taipei')::date=${d} ${own('publish')?"and audience in ('學生','全部人員','全校學生','七年級','八年級','九年級')":''} order by coalesce(publish_at,date) desc limit 12`),
  db.query(`select id,title,target_at from countdowns704 where (target_at at time zone 'Asia/Taipei')::date=${d} order by target_at limit 12`),
  (student||can('homework'))?db.query(`select h.id,h.title,h.work_day::text,h.due_on::text,s.name subject,${completed('$1')} done${progress} from school_homework h join school_subjects s on s.id=h.subject_id where (h.work_day=${d} or h.due_on between ${d} and ${d}+3) ${student?'and (h.recipients is null or $1=any(h.recipients))':assistant?'and h.author_id=$1':''} order by h.due_on,h.created_at limit 30`,[user.id]):Promise.resolve({rows:[]}),
  (student||can('records'))?db.query(`select r.id,r.kind,r.title,r.record_day::text,r.due_on::text,r.resolved,a.display_name student from school_records r join accounts704 a on a.id=r.student_id where (r.record_day=${d} or (r.kind='missing' and not r.resolved)) ${student?'and r.student_id=$1':''} order by r.record_day desc limit 30`,student?[user.id]:[]):Promise.resolve({rows:[]}),
  db.query('select count(*)::int unread from school_notifications where account_id=$1 and read_at is null',[user.id]),
  db.query(`select ${d}::text as "day",now() as "date"`),
  fields.length?db.query('select '+fields.join(','),user.role==='teacher'&&can('publish')?[user.id]:[]):Promise.resolve({rows:[{}]})
 ]);
 return {...clock.rows[0],announcements:announcements.rows,activities:activities.rows,homework:homework.rows,records:records.rows,unread:notices.rows[0].unread,overview:overview.rows[0]};
}
