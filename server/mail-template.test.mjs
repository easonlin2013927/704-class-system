import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMail} from './mail-template.mjs';

test('account action emails use the monochrome action button and 30-minute expiry',()=>{
 const link='https://example.com/auth-action/?mode=resetPassword&state=state&oobCode=token';
 for(const action_kind of ['PASSWORD_RESET','VERIFY_EMAIL']){const message=buildMail({verification:true,action_kind,action_link:link});assert.ok(message.text.includes(link));assert.match(message.text,/30 分鐘/);assert.match(message.html,/state=state&amp;oobCode=token/);assert.ok(message.html.includes(action_kind==='PASSWORD_RESET'?'重設系統密碼':'驗證電子郵件'));assert.doesNotMatch(message.html,/六位數|驗證碼：|Firebase/);}
 assert.doesNotMatch(buildMail({verification:true,action_kind:'PASSWORD_RESET',action_link:'javascript:alert(1)'}).html,/href="javascript:/);
});

test('all mail variants preserve subject, text, content and monochrome HTML',()=>{
 const variants=[
  [{verification:true,verification_code:'123456'},'驗證你的電子郵件',['123456','5 分鐘']],
  [{kind:'test'},'測試郵件',['測試郵件']],
  [{kind:'broadcast',title:'公告內容\n第二行'},'你有一則班級通知',['公告內容','第二行']],
  [{kind:'ranking',title:JSON.stringify({ranking:[{display_name:'學生甲',nickname:'甲',points:12}]})},'每週班級排行榜',['學生甲','12']],
  [{kind:'digest',title:JSON.stringify({items:[{kind:'homework',title:'作業內容'}]})},'班級通知摘要',['作業內容','作業']],
  [{kind:'offline-chat'},'你有新的聊天訊息',['聊天訊息']],
  [{kind:'offline-chat',title:JSON.stringify({sender:'同學甲',content:'訊息摘要',files:[{name:'附件.pdf',size:123}]})},'你有新的聊天訊息',['同學甲','訊息摘要','附件.pdf']],
  [{kind:'collection',title:JSON.stringify({title:'同意書',due_on:'2026-12-01',description:'簽名後繳交'})},'資料繳收提醒',['同意書','2026-12-01','簽名後繳交']],
  ...Object.entries({announcements:'有新的公告',activity:'有新的活動',homework:'有新的作業',feedback:'有新的提醒或缺交紀錄',grades:'教師新增了一筆成績',report:'檢舉進度有更新'}).map(([event_kind,heading])=>[{kind:'notification',event_kind},heading,[heading]])
 ];
 for(const [row,heading,values] of variants){
  const {subject,text,html}=buildMail(row);
  assert.equal(subject,'704班級系統：'+heading);
  for(const value of values){assert.ok(text.includes(value),value);assert.ok(html.includes(value),value);}
  assert.match(html,/<html lang="zh-Hant">/);assert.match(html,/border:1px solid/);assert.match(html,/開啟班級系統/);
  assert.match(text,/https:\/\/easonlin2013927.github.io\/704-class-system\//);
  assert.doesNotMatch(html,/<script|<svg|<img|linear-gradient|box-shadow/i);
  for(const style of html.matchAll(/style="([^"]*)"/g))for(const match of style[1].matchAll(/#([a-f0-9]{6}|[a-f0-9]{3})\b/gi)){
   const hex=match[1].toLowerCase(),channels=hex.length===3?[...hex]:hex.match(/../g);
   assert.ok(channels.every(channel=>channel===channels[0]),'Non-monochrome color '+hex);
  }
 }
});

test('broadcast, verification, ranking and digest values remain escaped',()=>{
 const attack='<img src=x onerror="alert(1)"> & <script>bad</script>';
 for(const row of [{kind:'broadcast',title:attack},{verification:true,verification_code:attack},{kind:'ranking',title:JSON.stringify({ranking:[{display_name:attack,nickname:attack,points:attack}]})},{kind:'digest',title:JSON.stringify({items:[{kind:attack,title:attack}]})}]){
  const {html,text}=buildMail(row);assert.ok(text.includes(attack));assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<img|<script/);
 }
});
