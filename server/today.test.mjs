import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadToday} from './today.mjs';

function database(){
 const calls=[];
 return {calls,async query(sql,values=[]){
  calls.push({sql,values});
  const placeholders=[...sql.matchAll(/\$(\d+)/g)].map(x=>Number(x[1]));
  assert.equal(values.length,Math.max(0,...placeholders),'PostgreSQL bind parameter count');
  if(sql.includes('from announcements704')){
   assert.doesNotMatch(sql,/created_at/,'announcements704 timestamp column is date');
   return {rows:[{id:'announcement',title:'Today',category:'general'}]};
  }
  if(sql.includes('from countdowns704')){
   return {rows:[{id:'activity',target_at:'2026-11-23T03:00:00Z'}]};
  }
  if(sql.includes('from school_homework'))return {rows:[{id:'homework',due_on:'2026-11-23'}]};
  if(sql.includes('from school_records'))return {rows:[{id:'record'}]};
  if(sql.includes('from school_notifications'))return {rows:[{unread:2}]};
  return {rows:[{day:'2026-11-23',date:'2026-11-22T16:01:00Z'}]};
 }};
}
test('Today loads every section for admin without schema or bind errors',async()=>{
 const db=database(),result=await loadToday(db,{id:'admin',role:'admin'});
 assert.equal(result.announcements[0].id,'announcement');
 assert.equal(result.activities[0].id,'activity');
 assert.equal(result.homework[0].id,'homework');
 assert.equal(result.records[0].id,'record');
 assert.equal(result.unread,2);
 assert.equal(result.day,'2026-11-23');
});
test('Students only query assigned homework, their records and their unread count',async()=>{
 const db=database();await loadToday(db,{id:'student',role:'student'});
 const query=table=>db.calls.find(x=>x.sql.includes('from '+table));
 assert.match(query('school_homework').sql,/h\.recipients is null or \$1=any\(h\.recipients\)/);
 assert.match(query('school_records').sql,/and r\.student_id=\$1/);
 assert.deepEqual(query('school_records').values,['student']);
 assert.deepEqual(query('school_notifications').values,['student']);
 assert.match(query('announcements704').sql,/and audience in/);
});
test('Teachers and assistants without capabilities cannot query homework or records',async()=>{
 for(const role of ['teacher','assistant']){
  const db=database(),result=await loadToday(db,{id:role,role,permissions:{}});
  assert.deepEqual(result.homework,[]);assert.deepEqual(result.records,[]);
  assert.equal(db.calls.some(x=>/from school_(homework|records)/.test(x.sql)),false);
 }
});
test('Explicit capabilities grant their section, including elevated students',async()=>{
 for(const role of ['teacher','assistant','student']){
  const db=database();await loadToday(db,{id:role,role,permissions:{homework:true,records:true,publish:true}});
  assert.match(db.calls.find(x=>x.sql.includes('from school_homework')).sql,/from school_homework/);
  const records=db.calls.find(x=>x.sql.includes('from school_records'));
  assert.doesNotMatch(records.sql,/and r\.student_id=\$1/);
  assert.deepEqual(records.values,[]);
  assert.doesNotMatch(db.calls[0].sql,/and audience in/);
 }
});
test('Today uses Taipei day and excludes future, expired and unpublished announcements',async()=>{
 const db=database();await loadToday(db,{id:'student',role:'student'});
 const sql=db.calls[0].sql;
 assert.match(sql,/workflow_status='published'/);
 assert.match(sql,/coalesce\(publish_at,date\)<=now\(\)/);
 assert.match(sql,/expires_at is null or expires_at>now\(\)/);
 assert.match(sql,/Asia\/Taipei/);
 assert.match(db.calls[1].sql,/::date=\(now\(\) at time zone 'Asia\/Taipei'\)::date/);
 assert.match(db.calls.find(x=>x.sql.includes('from school_homework')).sql,/h\.due_on::text/);
});
test('Database failure remains an error, never a misleading empty success',async()=>{
 await assert.rejects(loadToday({query:async()=>{throw Error('database unavailable');}},{id:'student',role:'student'}),/database unavailable/);
});

test('Real PostgreSQL executes Today with project migrations and enforces data visibility',async()=>{
 const pg=new PGlite();
 try{
  for(const [file,start,end] of [['db.mjs','export async function migrate()',null],['school.mjs','export async function migrateSchool()','export async function schoolRoutes'],['enhancements.mjs','export async function migrateEnhancements()','export async function publishScheduledAnnouncements']]){
   const source=readFileSync(new URL(file,import.meta.url),'utf8'),section=source.slice(source.indexOf(start),end?source.indexOf(end):undefined);
   for(const match of section.matchAll(/await db\.query\(`([\s\S]*?)`\)/g))await pg.exec(match[1]);
  }
  const student='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',subject='00000000-0000-4000-8000-000000000003';
  const day="(now() at time zone 'Asia/Taipei')::date";
  await pg.exec(`begin;
   insert into accounts704(id,email,display_name,role,password_hash) values('${student}','one','One','student','unused'),('${other}','two','Two','student','unused');
   insert into school_subjects(id,name) values('${subject}','Math');
   insert into school_homework(id,subject_id,title,work_day,due_on,recipients) values
    (gen_random_uuid(),'${subject}','Public homework',${day},${day},null),
    (gen_random_uuid(),'${subject}','My homework',${day},${day},array['${student}'::uuid]),
    (gen_random_uuid(),'${subject}','Other homework',${day},${day},array['${other}'::uuid]),
    (gen_random_uuid(),'${subject}','Later homework',${day}-1,${day}+4,null);
   insert into school_records(id,kind,student_id,title,record_day) values
    (gen_random_uuid(),'missing','${student}','My record',${day}-2),
    (gen_random_uuid(),'missing','${other}','Other record',${day});
   insert into announcements704(id,title,category,author,audience,content,date,workflow_status,publish_at,expires_at) values
    (gen_random_uuid(),'Visible','general','Test','學生','',now(),'published',null,null),
    (gen_random_uuid(),'Teachers only','general','Test','教師','',now(),'published',null,null),
    (gen_random_uuid(),'Draft','general','Test','學生','',now(),'draft',null,null),
    (gen_random_uuid(),'Future','general','Test','學生','',now(),'published',now()+interval '1 hour',null),
    (gen_random_uuid(),'Expired','general','Test','學生','',now(),'published',null,now());
   insert into countdowns704(id,title,target_at) values(gen_random_uuid(),'Today activity',now()),(gen_random_uuid(),'Tomorrow activity',now()+interval '1 day');
  `);
  const db={query:(sql,values=[])=>pg.query(sql,values)};
  const mine=await loadToday(db,{id:student,role:'student'});
  assert.deepEqual(mine.announcements.map(x=>x.title),['Visible']);
  assert.deepEqual(mine.homework.map(x=>x.title).sort(),['My homework','Public homework']);
  assert.deepEqual(mine.records.map(x=>x.title),['My record']);
  assert.deepEqual(mine.activities.map(x=>x.title),['Today activity']);
  assert.match(mine.day,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(mine.homework[0].due_on,mine.day);
  assert.ok(Number.isFinite(new Date(mine.date).getTime()));
  const admin=await loadToday(db,{id:student,role:'admin'});
  assert.equal(admin.records.length,2);assert.equal(admin.homework.length,3);
  for(const role of ['teacher','assistant']){
   const restricted=await loadToday(db,{id:student,role,permissions:{}});
   assert.deepEqual(restricted.homework,[]);assert.deepEqual(restricted.records,[]);
  }
 }finally{await pg.close();}
});
