import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { arch, cpus, freemem, hostname, platform, totalmem, uptime } from 'node:os';
import { join } from 'node:path';
import { db } from './db.mjs';

const zip=promisify(gzip);
const backupDir=process.env.BACKUP_DIR||join(process.env.CHAT_UPLOAD_DIR||'/data/chat-files','backups');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(value);

export async function migrateSystemCenter(){
 await mkdir(backupDir,{recursive:true});
 await db.query(`create table if not exists system_backups704(
  id uuid primary key, file_name text not null, size_bytes bigint not null default 0,
  table_count integer not null default 0, row_count integer not null default 0,
  status text not null check(status in ('creating','ready','failed')),
  error text not null default '', created_by uuid references accounts704(id) on delete set null,
  created_at timestamptz not null default now(), completed_at timestamptz
 )`);
}

async function storage(){
 try{const s=await statfs(backupDir);return {path:backupDir,total_bytes:s.blocks*s.bsize,free_bytes:s.bavail*s.bsize,writable:true};}
 catch(error){return {path:backupDir,total_bytes:0,free_bytes:0,writable:false,error:error.message};}
}

export async function healthCenter(){
 const started=performance.now();await db.query('select 1');const latency=Math.round(performance.now()-started);
 const [size,connections,counts,latest,disk]=await Promise.all([
  db.query('select pg_database_size(current_database())::bigint as bytes'),
  db.query("select count(*)::int as total,count(*) filter(where state='active')::int as active from pg_stat_activity where datname=current_database()"),
  db.query(`select (select count(*)::int from accounts704) accounts,(select count(*)::int from announcements704) announcements,
   (select count(*)::int from school_homework) homework,(select count(*)::int from school_messages) messages,
   (select count(*)::int from school_notifications where read_at is null) unread_notifications`),
  db.query("select id,file_name,size_bytes,table_count,row_count,status,error,created_at,completed_at from system_backups704 order by created_at desc limit 1"),storage()
 ]);
 return {status:'ok',checked_at:new Date().toISOString(),api:{host:hostname(),platform:`${platform()} / ${arch()}`,cpu:`${cpus()[0]?.model||'CPU'} / ${cpus().length} 核心`,memory_used:totalmem()-freemem(),memory_total:totalmem(),uptime_seconds:Math.floor(uptime())},database:{status:'ok',latency_ms:latency,size_bytes:Number(size.rows[0].bytes),connections:connections.rows[0]},counts:counts.rows[0],storage:disk,latest_backup:latest.rows[0]||null,services:{email_configured:Boolean(process.env.MAIL_GMAIL_USER&&process.env.MAIL_GMAIL_APP_PASSWORD),public_api_url:process.env.PUBLIC_API_URL||'',external_notifications:(await db.query('select external_enabled from school_notification_gate where id=1')).rows[0]?.external_enabled??true}};
}

const backupTables=async()=>{const rows=await db.query(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and (table_name like 'school_%' or table_name like '%704') and table_name not in ('sessions704','school_push_keys','school_push_subscriptions','system_backups704') order by table_name`);return rows.rows.map(x=>x.table_name);};

export async function createBackup(user){
 const id=randomUUID(),fileName=`704-backup-${new Date().toISOString().replace(/[:.]/g,'-')}-${id.slice(0,8)}.json.gz`,path=join(backupDir,fileName);
 await db.query("insert into system_backups704(id,file_name,status,created_by) values($1,$2,'creating',$3)",[id,fileName,user.id]);
 try{
  const tables=await backupTables(),data={},summary={rows:0};
  for(const table of tables){const rows=(await db.query(`select * from "${table}"`)).rows;data[table]=rows;summary.rows+=rows.length;}
  const payload={format:'704-class-system-backup',version:1,created_at:new Date().toISOString(),tables:data};
  const bytes=await zip(Buffer.from(JSON.stringify(payload)));await writeFile(path,bytes,{mode:0o600});
  await db.query("update system_backups704 set status='ready',size_bytes=$2,table_count=$3,row_count=$4,completed_at=now() where id=$1",[id,bytes.length,tables.length,summary.rows]);
  return {id,file_name:fileName,size_bytes:bytes.length,table_count:tables.length,row_count:summary.rows,status:'ready'};
 }catch(error){await db.query("update system_backups704 set status='failed',error=$2,completed_at=now() where id=$1",[id,String(error.message).slice(0,1000)]);throw error;}
}

export async function listBackups(){return (await db.query('select id,file_name,size_bytes,table_count,row_count,status,error,created_at,completed_at from system_backups704 order by created_at desc limit 50')).rows;}
export async function streamBackup(id,res){
 if(!uuid(id))fail(400,'備份格式錯誤');
 const row=(await db.query("select file_name from system_backups704 where id=$1 and status='ready'",[id])).rows[0];
 if(!row)fail(404,'找不到可下載的備份');
 const path=join(backupDir,row.file_name),info=await stat(path).catch(()=>null);
 if(!info?.isFile())fail(404,'備份檔案不存在，請重新建立備份');
 res.writeHead(200,{
  'Content-Type':'application/gzip',
  'Content-Length':String(info.size),
  'Content-Disposition':`attachment; filename="${row.file_name}"`,
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
 });
 await pipeline(createReadStream(path),res);
}
export async function deleteBackup(id){if(!uuid(id))fail(400,'備份格式錯誤');const row=(await db.query('delete from system_backups704 where id=$1 returning file_name',[id])).rows[0];if(!row)fail(404,'找不到備份');await rm(join(backupDir,row.file_name),{force:true});return {ok:true};}
