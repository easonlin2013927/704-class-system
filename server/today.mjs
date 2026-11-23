export async function loadToday(db,user){
 const can=key=>user.role==='admin'||user.permissions?.[key]===true;
 const own=key=>user.role==='student'&&!can(key);
 const d="(now() at time zone 'Asia/Taipei')::date";
 const [announcements,activities,homework,records,notices,clock]=await Promise.all([
  db.query(`select id,title,category,publish_at,date from announcements704 where workflow_status='published' and coalesce(publish_at,date)<=now() and (expires_at is null or expires_at>now()) and (coalesce(publish_at,date) at time zone 'Asia/Taipei')::date=${d} ${own('publish')?"and audience in ('學生','全部人員','全校學生','七年級','八年級','九年級')":''} order by coalesce(publish_at,date) desc limit 12`),
  db.query(`select id,title,target_at from countdowns704 where (target_at at time zone 'Asia/Taipei')::date=${d} order by target_at limit 12`),
  (user.role==='student'||can('homework'))?db.query(`select h.id,h.title,h.work_day::text,h.due_on::text,s.name subject,coalesce(c.done,false) done from school_homework h join school_subjects s on s.id=h.subject_id left join school_checks c on c.homework_id=h.id and c.student_id=$1 where (h.work_day=${d} or h.due_on between ${d} and ${d}+3) ${own('homework')?'and (h.recipients is null or $1=any(h.recipients))':''} order by h.due_on,h.created_at limit 30`,[user.id]):Promise.resolve({rows:[]}),
  (user.role==='student'||can('records'))?db.query(`select r.id,r.kind,r.title,r.record_day::text,r.due_on::text,r.resolved,a.display_name student from school_records r join accounts704 a on a.id=r.student_id where (r.record_day=${d} or (r.kind='missing' and not r.resolved)) ${own('records')?'and r.student_id=$1':''} order by r.record_day desc limit 30`,own('records')?[user.id]:[]):Promise.resolve({rows:[]}),
  db.query('select count(*)::int unread from school_notifications where account_id=$1 and read_at is null',[user.id]),
  db.query(`select ${d}::text day,now() date`)
 ]);
 return {...clock.rows[0],announcements:announcements.rows,activities:activities.rows,homework:homework.rows,records:records.rows,unread:notices.rows[0].unread};
}
