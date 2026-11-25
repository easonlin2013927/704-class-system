import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {db} from './db.mjs';
import {enhancementRoutes,permissionsFor,permissionKeys} from './enhancements.mjs';

test('Classroom grants stay separate and teachers cannot grant unrelated privileges',async()=>{
 const pg=new PGlite(),original=db.query;
 db.query=async(sql,values=[])=>{const result=await pg.query(sql,values);return {...result,rowCount:result.affectedRows??result.rows.length};};
 const admin={id:randomUUID(),role:'admin'},teacher={id:randomUUID(),role:'teacher'},student={id:randomUUID(),role:'student'},assistant={id:randomUUID(),role:'assistant'};
 const call=async(user,path,method='GET',body={})=>{let value;assert.equal(await enhancementRoutes({path:'/school/'+path,query:new URLSearchParams(),method,user,readBody:async()=>body,send:(status,data)=>value=data}),true);return value;};
 try{
  await pg.exec('create table accounts704(id uuid primary key,role text,display_name text);create table account_permissions704(account_id uuid primary key references accounts704(id),permissions jsonb,updated_at timestamptz default now());');
  for(const user of [admin,teacher,student,assistant])await db.query('insert into accounts704 values($1,$2,$2)',[user.id,user.role]);
  const keys=['honors','board_manage','board_reply'];for(const key of keys)assert.ok(permissionKeys.includes(key));
  assert.equal((await permissionsFor(teacher)).honors,true);assert.equal((await permissionsFor(student)).honors,false);
  assert.deepEqual(new Set((await call(teacher,'permission-accounts')).map(row=>row.id)),new Set([student.id,assistant.id]));
  const full=await permissionsFor(student);full.publish=true;await call(admin,'permissions/'+student.id,'PUT',full);
  const grants={honors:true,board_manage:false,board_reply:true};await call(teacher,'permissions/'+student.id,'PUT',grants);
  assert.deepEqual((await call(teacher,'permissions/'+student.id)).permissions,grants);assert.equal((await permissionsFor(student)).publish,true);
  await call(teacher,'permissions/'+assistant.id,'PUT',{honors:false,board_manage:true,board_reply:false});assert.equal((await permissionsFor(assistant)).board_manage,true);
  for(const target of [admin,teacher])for(const method of ['GET','PUT'])await assert.rejects(call(teacher,'permissions/'+target.id,method,grants),{status:403});
  for(const body of [{...grants,accounts:true},{honors:true},{...grants,board_reply:'true'},null])await assert.rejects(call(teacher,'permissions/'+student.id,'PUT',body),{status:400});
  for(const user of [student,assistant]){await assert.rejects(call(user,'permissions/'+student.id,'PUT',grants),{status:403});await assert.rejects(call(user,'permission-accounts'),{status:403});}
  await call(teacher,'permissions/'+student.id,'PUT',{honors:false,board_manage:false,board_reply:false});assert.equal((await permissionsFor(student)).honors,false);assert.equal((await permissionsFor(student)).publish,true);
 }finally{db.query=original;await pg.close();}
});
