import {test} from 'node:test';
import assert from 'node:assert/strict';
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
   assert.doesNotMatch(sql,/ends_at/,'countdowns704 has no ends_at column');
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
