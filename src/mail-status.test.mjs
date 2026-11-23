import test from 'node:test';
import assert from 'node:assert/strict';
import {mailReport,reportTime} from './mail-status.js';
import {mailFailure} from '../server/mail-diagnostics.mjs';
import {exportMailTest} from './broadcast.js';
import {mountMailTest} from './mail-test.js';
import {cloud} from './cloud.js';

const job={id:'test-job',created_at:'2026-11-23T08:00:00Z',reported_at:'2026-11-23T09:00:00Z',external_enabled:true,sender_configured:true,daily_limit:400,sent_last_24h:0};
const row={display_name:'測試帳號',role_label:'學生',queue_id:'queue',queue_status:'pending',address:'fixture@example.com',verified:true,status:'pending',attempts:2,next_attempt:'2026-11-23T09:05:00Z'};

test('cancelled rows explain historical gate closure and current enabled state, never retry',()=>{
 for(const value of [{...row,status:'cancelled',last_error:'全站外部通知已關閉'},{...row,status:null,queue_status:'cancelled',queue_error:'全站外部通知已關閉'},{...row,queue_status:'cancelled',queue_error:'全站外部通知已關閉'}]){
  const report=mailReport(value,job);assert.equal(report.status_key,'cancelled');assert.equal(report.poll,false);assert.equal(report.next_retry_at,null);
  assert.match(report.reason,/當時/);assert.match(report.reason,/目前.*已開啟/);assert.match(report.advice,/重新發送測試郵件/);assert.doesNotMatch(report.status_label,/排隊|等待重試/);assert.equal(report.style,5);
 }
 assert.match(mailReport({...row,status:'cancelled'},{...job,external_enabled:false}).reason,/目前.*仍關閉/);
});
test('accepted messages ignore stale failures and never claim inbox delivery',()=>{
 const report=mailReport({...row,status:'sent',last_error:'全站外部通知已關閉',sent_at:'2026-11-23T09:00:00Z'},job);
 assert.equal(report.status_key,'accepted');assert.equal(report.error_code,'—');assert.match(report.reason,/不代表已送進收件匣/);assert.doesNotMatch(report.reason,/關閉/);assert.equal(report.poll,false);assert.equal(report.style,2);
});
test('current configuration, quota, verification, disabled and omitted accounts are distinct',()=>{
 const cases=[['configuration',row,{...job,sender_configured:false}],['quota',row,{...job,sent_last_24h:400,quota_available_at:'2026-11-24T01:00:00Z'}],['gate_wait',row,{...job,external_enabled:false}],['unverified',{...row,verified:false},job],['disabled',{...row,disabled:true},job],['no_mailbox',{...row,address:null},job],['not_included',{...row,queue_id:null},job],['stopped',{...row,status:'failed'},job],['processing',row,job]];
 for(const [key,value,context] of cases)assert.equal(mailReport(value,context).status_key,key);
 assert.equal(reportTime(null),'—');assert.equal(reportTime('not a date'),'—');
});
test('SMTP diagnostics preserve safe evidence without credentials or full server responses',()=>{
 const encoded=mailFailure({code:'EAUTH',responseCode:535,command:'AUTH PLAIN PRIVATE_TOKEN',response:'535 5.7.8 private password recipient@example.com',message:'secret',auth:{pass:'secret'}},'2026-11-23T09:00:00Z');
 assert.deepEqual(JSON.parse(encoded),{code:'EAUTH',smtp:535,enhanced:'5.7.8',hint:'',command:'AUTH',at:'2026-11-23T09:00:00.000Z'});
 assert.doesNotMatch(encoded,/PRIVATE_TOKEN|password|recipient@example|secret/);
 const report=mailReport({...row,last_error:encoded},job);assert.match(report.reason,/驗證遭拒/);assert.match(report.error_code,/535/);assert.equal(report.last_attempt_at,'2026-11-23T09:00:00.000Z');assert.equal(report.next_retry_at,row.next_attempt);
});
test('different real SMTP and network codes produce specific reasons and actions',()=>{
 const errors=[[{code:'EENVELOPE',responseCode:550,response:'550 5.1.1'},/信箱不存在/],[{code:'EENVELOPE',responseCode:552,response:'552 5.2.2'},/容量/],[{code:'EMESSAGE',responseCode:550,response:'550 5.7.1'},/政策/],[{code:'ETIMEDOUT'},/逾時/],[{code:'EDNS'},/DNS/],[{code:'EMESSAGE',responseCode:421},/暫時/],[{code:'EENVELOPE',responseCode:550},/不足以區分/]];
 const reasons=new Set();for(const [error,expected] of errors){const report=mailReport({...row,last_error:mailFailure(error)},job);assert.match(report.reason,expected);assert.ok(report.advice.length>10);reasons.add(report.reason);assert.equal(report.poll,true);}
 assert.equal(reasons.size,errors.length);assert.match(mailReport({...row,last_error:'550'},job).reason,/舊紀錄不足/);
 assert.match(mailReport({...row,last_error:mailFailure({code:'EMESSAGE',responseCode:550,response:'550 5.7.1 Daily SMTP relay sending limit exceeded for this customer'})},job).reason,/每日寄信額度/);
});

async function workbook(blob){
 const bytes=Buffer.from(await blob.arrayBuffer()),files={};let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){
  assert.equal(bytes.readUInt16LE(offset+8),0,'Test expects stored XLSX ZIP entries');
  const size=bytes.readUInt32LE(offset+18),nameSize=bytes.readUInt16LE(offset+26),extraSize=bytes.readUInt16LE(offset+28),start=offset+30+nameSize+extraSize;
  files[bytes.toString('utf8',offset+30,offset+30+nameSize)]=bytes.toString('utf8',start,start+size);offset=start+size;
 }
 return files;
}
test('Excel has evidence, current gate, advice, times, wrapped text and distinct row colors',async()=>{
 let blob;const original={create:URL.createObjectURL,revoke:URL.revokeObjectURL,document:globalThis.document,timeout:globalThis.setTimeout};
 try{
  URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};URL.revokeObjectURL=()=>{};globalThis.document={createElement:()=>({click(){}})};globalThis.setTimeout=()=>0;
  exportMailTest(job,[{...row,display_name:'=2+2 <name&>',status:'sent'},{...row,status:'cancelled',last_error:'全站外部通知已關閉'},{...row,last_error:mailFailure({code:'EAUTH',responseCode:535})}]);
  const files=await workbook(blob),sheet=files['xl/worksheets/sheet1.xml'];
  for(const value of ['詳細原因','建議處理方式','目前全站外部通知','錯誤代碼','失敗次數','寄件服務接受時間','下次重試／額度時間','報表產生時間','目前全站外部通知已開啟','&lt;name&amp;&gt;'])assert.ok(sheet.includes(value),value);
  assert.match(sheet,/<c r="A2" t="inlineStr" s="2"/);assert.match(sheet,/<c r="A3" t="inlineStr" s="5"/);assert.match(sheet,/<c r="A4" t="inlineStr" s="3"/);assert.doesNotMatch(sheet,/<f>/);assert.match(files['xl/styles.xml'],/wrapText="1"/);
 }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;globalThis.document=original.document;globalThis.setTimeout=original.timeout;}
});
test('download refreshes job data instead of reusing the earlier closed-gate snapshot',async()=>{
 let blob,fetches=0;const original={school:cloud.school,create:URL.createObjectURL,revoke:URL.revokeObjectURL,document:globalThis.document,timeout:globalThis.setTimeout};
 const send={},message={},download={},table={querySelector:()=>download},host={isConnected:true,querySelector:selector=>selector==='[data-test-send]'?send:selector==='[data-test-message]'?message:table};
 try{
  URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};URL.revokeObjectURL=()=>{};globalThis.document={createElement:()=>({click(){}})};globalThis.setTimeout=()=>0;
  cloud.school=async path=>path==='mail-test-latest'?{id:job.id}:{...job,external_enabled:++fetches>1,rows:[{...row,status:'cancelled',last_error:'全站外部通知已關閉'}]};
  mountMailTest(host);await new Promise(setImmediate);await download.onclick({currentTarget:download});
  const files=await workbook(blob);assert.equal(fetches,2);assert.match(files['xl/worksheets/sheet1.xml'],/目前全站外部通知已開啟/);
 }finally{cloud.school=original.school;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;globalThis.document=original.document;globalThis.setTimeout=original.timeout;}
});
